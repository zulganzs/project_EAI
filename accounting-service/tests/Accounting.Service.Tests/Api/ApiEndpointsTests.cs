using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Accounting.Service.Data;
using Accounting.Service.Models;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Accounting.Service.Tests.Api;

public class ApiEndpointsTests : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private readonly IServiceScope _scope;

    public ApiEndpointsTests()
    {
        var dbName = $"test_api_{Guid.NewGuid()}";

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Environment", "Testing");

            builder.ConfigureServices(services =>
            {
                // Remove RabbitMQ consumer hosted service
                var hosted = services
                    .Where(d => d.ImplementationType == typeof(Accounting.Service.Messaging.RabbitMqConsumer))
                    .ToList();
                foreach (var d in hosted) services.Remove(d);

                // Remove ALL DbContext-related registrations
                var toRemove = services
                    .Where(d => d.ServiceType == typeof(DbContextOptions<AccountingDbContext>) ||
                                d.ServiceType == typeof(AccountingDbContext) ||
                                d.ServiceType == typeof(IDbContextFactory<AccountingDbContext>))
                    .ToList();
                foreach (var d in toRemove) services.Remove(d);

                // Use InMemory with its OWN internal service provider (avoids SQLite conflict)
                var internalProvider = new ServiceCollection()
                    .AddEntityFrameworkInMemoryDatabase()
                    .BuildServiceProvider();

                services.AddDbContext<AccountingDbContext>(options =>
                    options.UseInMemoryDatabase(dbName)
                           .UseInternalServiceProvider(internalProvider));
            });
        });

        _client = _factory.CreateClient();
        _scope = _factory.Services.CreateScope();
    }

    private AccountingDbContext GetDb() =>
        _scope.ServiceProvider.GetRequiredService<AccountingDbContext>();

    // ===== Health =====
    [Fact]
    public async Task Health_Returns200()
    {
        var response = await _client.GetAsync("/health");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Health_ReturnsStatusAndTimestamp()
    {
        var response = await _client.GetAsync("/health");
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("status").GetString().Should().Be("healthy");
        body.GetProperty("timestamp").GetString().Should().NotBeNullOrEmpty();
    }

    // ===== GET /api/journal-entries =====
    [Fact]
    public async Task GetJournalEntries_Empty_ReturnsEmptyArray()
    {
        var response = await _client.GetAsync("/api/journal-entries");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task GetJournalEntries_WithData_ReturnsEntries()
    {
        var db = GetDb();
        db.JournalEntries.Add(new JournalEntry
        {
            TransactionId = "TXN-API-001", Amount = 50000, Currency = "IDR",
            Type = "SALES_REVENUE", AccountCode = "REV-100",
            CreatedAt = DateTime.UtcNow, CsvPayload = "test-csv"
        });
        await db.SaveChangesAsync();

        var response = await _client.GetAsync("/api/journal-entries");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().BeGreaterThan(0);
    }

    // ===== GET /api/journal-entries/{id} =====
    [Fact]
    public async Task GetJournalEntryById_NotFound_Returns404()
    {
        var response = await _client.GetAsync("/api/journal-entries/9999");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetJournalEntryById_Found_ReturnsEntry()
    {
        var db = GetDb();
        var entry = new JournalEntry
        {
            TransactionId = "TXN-BYID-001", Amount = 75000, Currency = "IDR",
            Type = "SALES_REVENUE", AccountCode = "REV-100",
            CreatedAt = DateTime.UtcNow, CsvPayload = "csv-by-id"
        };
        db.JournalEntries.Add(entry);
        await db.SaveChangesAsync();

        var response = await _client.GetAsync($"/api/journal-entries/{entry.Id}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("transactionId").GetString().Should().Be("TXN-BYID-001");
        body.GetProperty("amount").GetDecimal().Should().Be(75000);
    }

    // ===== GET /api/journal-entries/transaction/{transactionId} =====
    [Fact]
    public async Task GetByTransactionId_NotFound_Returns404()
    {
        var response = await _client.GetAsync("/api/journal-entries/transaction/NONEXISTENT");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetByTransactionId_Found_ReturnsEntry()
    {
        var db = GetDb();
        db.JournalEntries.Add(new JournalEntry
        {
            TransactionId = "TXN-LOOKUP-001", Amount = 123000, Currency = "IDR",
            Type = "SALES_REVENUE", AccountCode = "REV-100",
            CreatedAt = DateTime.UtcNow, CsvPayload = "csv-lookup"
        });
        await db.SaveChangesAsync();

        var response = await _client.GetAsync("/api/journal-entries/transaction/TXN-LOOKUP-001");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("transactionId").GetString().Should().Be("TXN-LOOKUP-001");
    }

    // ===== GET /api/processed-transactions =====
    [Fact]
    public async Task GetProcessedTransactions_Empty_ReturnsEmptyArray()
    {
        var response = await _client.GetAsync("/api/processed-transactions");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task GetProcessedTransactions_WithData_ReturnsList()
    {
        var db = GetDb();
        db.ProcessedTransactions.Add(new ProcessedTransaction
        {
            TransactionId = "TXN-PROC-001", ProcessedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var response = await _client.GetAsync("/api/processed-transactions");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().BeGreaterThan(0);
    }

    public void Dispose()
    {
        _factory.Dispose();
    }
}
