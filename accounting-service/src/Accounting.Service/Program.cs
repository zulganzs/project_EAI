using Accounting.Service.Configuration;
using Accounting.Service.Data;
using Accounting.Service.Messaging;
using Accounting.Service.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddEnvironmentVariables();

// Bind settings
var appSettings = new AppSettings();
appSettings.RabbitMq.HostName = Environment.GetEnvironmentVariable("RABBITMQ_HOSTNAME") ?? appSettings.RabbitMq.HostName;
appSettings.RabbitMq.ExchangeName = Environment.GetEnvironmentVariable("RABBITMQ_EXCHANGE") ?? appSettings.RabbitMq.ExchangeName;
appSettings.RabbitMq.QueueName = Environment.GetEnvironmentVariable("RABBITMQ_QUEUE") ?? appSettings.RabbitMq.QueueName;
appSettings.RabbitMq.RoutingKey = Environment.GetEnvironmentVariable("RABBITMQ_ROUTING_KEY") ?? appSettings.RabbitMq.RoutingKey;
appSettings.DatabaseConnectionString = Environment.GetEnvironmentVariable("DATABASE_CONNECTION_STRING") ?? appSettings.DatabaseConnectionString;

builder.Services.Configure<AppSettings>(options =>
{
    options.RabbitMq = appSettings.RabbitMq;
    options.DatabaseConnectionString = appSettings.DatabaseConnectionString;
});

builder.Services.AddDbContext<AccountingDbContext>(options =>
    options.UseSqlite(appSettings.DatabaseConnectionString));

builder.Services.AddScoped<IdempotencyService>();
builder.Services.AddScoped<JournalRepository>();
builder.Services.AddScoped<MessageTransformer>();

builder.Services.AddHostedService<RabbitMqConsumer>();

var app = builder.Build();

// Ensure DB is created
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AccountingDbContext>();
    db.Database.EnsureCreated();
}

// ============================================================
// HTTP API Endpoints
// ============================================================

// Health check
app.MapGet("/health", () =>
{
    return Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow.ToString("O") });
});

// GET /api/journal-entries — List all journal entries
app.MapGet("/api/journal-entries", async (JournalRepository repo) =>
{
    var entries = await repo.GetAllAsync();
    return Results.Ok(entries);
});

// GET /api/journal-entries/{id} — Get journal entry by ID
app.MapGet("/api/journal-entries/{id:int}", async (int id, JournalRepository repo) =>
{
    var entry = await repo.GetByIdAsync(id);
    return entry is not null ? Results.Ok(entry) : Results.NotFound(new { error = "Journal entry not found" });
});

// GET /api/journal-entries/transaction/{transactionId} — Get by transaction ID
app.MapGet("/api/journal-entries/transaction/{transactionId}", async (string transactionId, JournalRepository repo) =>
{
    var entry = await repo.GetByTransactionIdAsync(transactionId);
    return entry is not null ? Results.Ok(entry) : Results.NotFound(new { error = "Journal entry not found for transaction" });
});

// GET /api/processed-transactions — List all processed transactions
app.MapGet("/api/processed-transactions", async (JournalRepository repo) =>
{
    var processed = await repo.GetAllProcessedAsync();
    return Results.Ok(processed);
});

app.Run();

// Make Program accessible for integration testing
public partial class Program { }

