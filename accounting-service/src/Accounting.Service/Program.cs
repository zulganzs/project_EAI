using Accounting.Service.Configuration;
using Accounting.Service.Data;
using Accounting.Service.Messaging;
using Accounting.Service.Services;
using Microsoft.EntityFrameworkCore;

var builder = Host.CreateDefaultBuilder(args);

builder.ConfigureAppConfiguration((hostingContext, config) =>
{
    config.AddEnvironmentVariables();
});

builder.ConfigureServices((hostContext, services) =>
{
    var appSettings = new AppSettings();

    // Manual binding for environment variables
    appSettings.RabbitMq.HostName = Environment.GetEnvironmentVariable("RABBITMQ_HOSTNAME") ?? appSettings.RabbitMq.HostName;
    appSettings.RabbitMq.ExchangeName = Environment.GetEnvironmentVariable("RABBITMQ_EXCHANGE") ?? appSettings.RabbitMq.ExchangeName;
    appSettings.RabbitMq.QueueName = Environment.GetEnvironmentVariable("RABBITMQ_QUEUE") ?? appSettings.RabbitMq.QueueName;
    appSettings.RabbitMq.RoutingKey = Environment.GetEnvironmentVariable("RABBITMQ_ROUTING_KEY") ?? appSettings.RabbitMq.RoutingKey;
    appSettings.DatabaseConnectionString = Environment.GetEnvironmentVariable("DATABASE_CONNECTION_STRING") ?? appSettings.DatabaseConnectionString;

    services.Configure<AppSettings>(options =>
    {
        options.RabbitMq = appSettings.RabbitMq;
        options.DatabaseConnectionString = appSettings.DatabaseConnectionString;
    });

    services.AddDbContext<AccountingDbContext>(options =>
        options.UseSqlite(appSettings.DatabaseConnectionString));

    services.AddScoped<IdempotencyService>();
    services.AddScoped<JournalRepository>();
    services.AddScoped<MessageTransformer>();

    services.AddHostedService<RabbitMqConsumer>();
});

var host = builder.Build();

// Ensure DB is created
using (var scope = host.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AccountingDbContext>();
    db.Database.EnsureCreated();
}

await host.RunAsync();

