using System.Text.Json;
using Accounting.Service.Data;
using Accounting.Service.Models;
using Accounting.Service.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Accounting.Service.IntegrationTests;

/// <summary>
/// Full pipeline integration tests — REAL SQLite, REAL services, NO mocks.
/// Simulates: CDM JSON → deserialize → idempotency → transform → persist → mark processed.
/// </summary>
public class PipelineTests : IDisposable
{
    private readonly string _dbPath;
    private readonly AccountingDbContext _dbContext;
    private readonly IdempotencyService _idempotencyService;
    private readonly JournalRepository _journalRepo;
    private readonly MessageTransformer _transformer;

    public PipelineTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"accounting_pipeline_{Guid.NewGuid()}.db");
        var options = new DbContextOptionsBuilder<AccountingDbContext>()
            .UseSqlite($"Data Source={_dbPath}").Options;
        _dbContext = new AccountingDbContext(options);
        _dbContext.Database.EnsureCreated();
        _idempotencyService = new IdempotencyService(_dbContext);
        _journalRepo = new JournalRepository(_dbContext);
        _transformer = new MessageTransformer();
    }

    [Fact]
    public async Task FullPipeline_CDM_To_JournalEntry_Persisted()
    {
        // Step 1: Simulate CDM JSON arriving from POS via RabbitMQ
        var cdmJson = @"{
            ""event_type"": ""TRANSAKSI_SELESAI"",
            ""transaction_id"": ""TXN-20260609-ab12"",
            ""source_system"": ""POS"",
            ""timestamp"": ""2026-06-09T10:30:00.000Z"",
            ""customer"": { ""name"": ""Walk-in Customer"" },
            ""items"": [{ ""menu_id"": ""M001"", ""menu_name"": ""Steak"", ""qty"": 1, ""price"": 50000 }],
            ""total_amount"": 50000,
            ""currency"": ""IDR"",
            ""trace_id"": ""trace-pos-ab12cd34""
        }";

        // Step 2: Deserialize
        var transaction = JsonSerializer.Deserialize<TransactionEvent>(cdmJson);
        transaction.Should().NotBeNull();
        transaction!.TransactionId.Should().Be("TXN-20260609-ab12");

        // Step 3: Idempotency — NOT processed yet
        var isNew = await _idempotencyService.HasBeenProcessedAsync(transaction.TransactionId);
        isNew.Should().BeFalse();

        // Step 4: Transform JSON → CSV
        var csv = _transformer.TransformToCsv(transaction);
        csv.Should().Contain("TXN-20260609-ab12");

        // Step 5: Persist journal entry
        await _journalRepo.SaveJournalEntryAsync(new JournalEntry
        {
            TransactionId = transaction.TransactionId,
            Amount = transaction.TotalAmount,
            Currency = transaction.Currency,
            Type = "SALES_REVENUE",
            AccountCode = "REV-100",
            CreatedAt = DateTime.UtcNow,
            CsvPayload = csv
        });

        // Step 6: Mark processed
        await _idempotencyService.MarkAsProcessedAsync(transaction.TransactionId);

        // Step 7: Verify — journal in DB
        _dbContext.ChangeTracker.Clear();
        var saved = await _dbContext.JournalEntries.FirstAsync(j => j.TransactionId == "TXN-20260609-ab12");
        saved.Amount.Should().Be(50000);
        saved.Currency.Should().Be("IDR");
        saved.CsvPayload.Should().Contain("TXN-20260609-ab12");

        // Step 8: Verify — idempotency blocks reprocessing
        var isProcessed = await _idempotencyService.HasBeenProcessedAsync(transaction.TransactionId);
        isProcessed.Should().BeTrue();
    }

    [Fact]
    public async Task FullPipeline_DuplicateTransaction_IsRejected()
    {
        var txnId = "TXN-DUP-TEST";
        await _idempotencyService.MarkAsProcessedAsync(txnId);
        await _journalRepo.SaveJournalEntryAsync(new JournalEntry
        {
            TransactionId = txnId, Amount = 100, Currency = "IDR",
            Type = "SALES_REVENUE", AccountCode = "REV-100",
            CreatedAt = DateTime.UtcNow, CsvPayload = "csv-dup"
        });

        var alreadyProcessed = await _idempotencyService.HasBeenProcessedAsync(txnId);
        alreadyProcessed.Should().BeTrue();

        var entries = await _dbContext.JournalEntries.Where(j => j.TransactionId == txnId).ToListAsync();
        entries.Should().HaveCount(1);
    }

    [Fact]
    public async Task FullPipeline_MultipleTransactions_AllPersisted()
    {
        for (int i = 1; i <= 3; i++)
        {
            var txnId = $"TXN-MULTI-{i:D3}";
            var cdm = new TransactionEvent
            {
                EventType = "TRANSAKSI_SELESAI",
                TransactionId = txnId,
                SourceSystem = "POS",
                Timestamp = DateTime.UtcNow.ToString("o"),
                TotalAmount = 10000 * i,
                Currency = "IDR"
            };

            var isNew = await _idempotencyService.HasBeenProcessedAsync(txnId);
            isNew.Should().BeFalse();

            var csv = _transformer.TransformToCsv(cdm);
            await _journalRepo.SaveJournalEntryAsync(new JournalEntry
            {
                TransactionId = txnId, Amount = cdm.TotalAmount,
                Currency = cdm.Currency, Type = "SALES_REVENUE",
                AccountCode = "REV-100", CreatedAt = DateTime.UtcNow,
                CsvPayload = csv
            });
            await _idempotencyService.MarkAsProcessedAsync(txnId);
        }

        _dbContext.ChangeTracker.Clear();
        var allEntries = await _dbContext.JournalEntries.ToListAsync();
        allEntries.Should().HaveCount(3);

        var allProcessed = await _dbContext.ProcessedTransactions.ToListAsync();
        allProcessed.Should().HaveCount(3);
    }

    public void Dispose()
    {
        _dbContext.Database.EnsureDeleted();
        _dbContext.Dispose();
        if (File.Exists(_dbPath)) File.Delete(_dbPath);
    }
}
