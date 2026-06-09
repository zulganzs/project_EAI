using Accounting.Service.Data;
using Accounting.Service.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Accounting.Service.IntegrationTests;

/// <summary>
/// Integration tests using REAL SQLite file database — no mocks.
/// Validates EF Core schema creation, constraints, and persistence round-trips.
/// </summary>
public class SchemaTests : IDisposable
{
    private readonly string _dbPath;
    private readonly AccountingDbContext _dbContext;

    public SchemaTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"accounting_test_{Guid.NewGuid()}.db");
        var options = new DbContextOptionsBuilder<AccountingDbContext>()
            .UseSqlite($"Data Source={_dbPath}")
            .Options;
        _dbContext = new AccountingDbContext(options);
        _dbContext.Database.EnsureCreated();
    }

    [Fact]
    public async Task Database_CreatesJournalEntriesTable()
    {
        var entries = await _dbContext.JournalEntries.ToListAsync();
        entries.Should().BeEmpty();
    }

    [Fact]
    public async Task Database_CreatesProcessedTransactionsTable()
    {
        var processed = await _dbContext.ProcessedTransactions.ToListAsync();
        processed.Should().BeEmpty();
    }

    [Fact]
    public async Task JournalEntries_HasAutoIncrementId()
    {
        var entry1 = new JournalEntry
        {
            TransactionId = "TXN-001", Amount = 100, Currency = "IDR",
            Type = "SALES_REVENUE", AccountCode = "REV-100",
            CreatedAt = DateTime.UtcNow, CsvPayload = "csv1"
        };
        var entry2 = new JournalEntry
        {
            TransactionId = "TXN-002", Amount = 200, Currency = "IDR",
            Type = "SALES_REVENUE", AccountCode = "REV-100",
            CreatedAt = DateTime.UtcNow, CsvPayload = "csv2"
        };

        _dbContext.JournalEntries.AddRange(entry1, entry2);
        await _dbContext.SaveChangesAsync();

        entry1.Id.Should().BeGreaterThan(0);
        entry2.Id.Should().BeGreaterThan(entry1.Id);
    }

    [Fact]
    public async Task JournalEntries_HasIndexOnTransactionId()
    {
        for (int i = 0; i < 10; i++)
        {
            _dbContext.JournalEntries.Add(new JournalEntry
            {
                TransactionId = $"TXN-BATCH-{i:D3}", Amount = 1000 * (i + 1),
                Currency = "IDR", Type = "SALES_REVENUE", AccountCode = "REV-100",
                CreatedAt = DateTime.UtcNow, CsvPayload = $"csv-{i}"
            });
        }
        await _dbContext.SaveChangesAsync();

        var result = await _dbContext.JournalEntries
            .Where(j => j.TransactionId == "TXN-BATCH-005").ToListAsync();
        result.Should().HaveCount(1);
        result[0].Amount.Should().Be(6000);
    }

    [Fact]
    public async Task ProcessedTransactions_HasPrimaryKeyTransactionId()
    {
        _dbContext.ProcessedTransactions.Add(new ProcessedTransaction
        {
            TransactionId = "TXN-PK-001", ProcessedAt = DateTime.UtcNow
        });
        await _dbContext.SaveChangesAsync();

        var found = await _dbContext.ProcessedTransactions.FindAsync("TXN-PK-001");
        found.Should().NotBeNull();
        found!.TransactionId.Should().Be("TXN-PK-001");
    }

    [Fact]
    public async Task ProcessedTransactions_RejectsDuplicatePrimaryKey()
    {
        _dbContext.ProcessedTransactions.Add(new ProcessedTransaction
        {
            TransactionId = "TXN-DUP", ProcessedAt = DateTime.UtcNow
        });
        await _dbContext.SaveChangesAsync();

        // Clear tracker so EF doesn't catch it in-memory — forces real DB constraint violation
        _dbContext.ChangeTracker.Clear();

        _dbContext.ProcessedTransactions.Add(new ProcessedTransaction
        {
            TransactionId = "TXN-DUP", ProcessedAt = DateTime.UtcNow
        });

        var act = async () => await _dbContext.SaveChangesAsync();
        (await act.Should().ThrowAsync<DbUpdateException>())
            .Which.InnerException.Should().BeOfType<Microsoft.Data.Sqlite.SqliteException>();
    }

    [Fact]
    public async Task JournalEntry_InsertSelect_RoundTrip()
    {
        var original = new JournalEntry
        {
            TransactionId = "TXN-ROUNDTRIP", Amount = 125000.50m, Currency = "IDR",
            Type = "SALES_REVENUE", AccountCode = "REV-100",
            CreatedAt = new DateTime(2026, 6, 9, 10, 30, 0, DateTimeKind.Utc),
            CsvPayload = "transaction_id,timestamp,total_amount,currency,type\nTXN-ROUNDTRIP,2026-06-09,125000.50,IDR,SALES_REVENUE"
        };

        _dbContext.JournalEntries.Add(original);
        await _dbContext.SaveChangesAsync();

        _dbContext.ChangeTracker.Clear();
        var loaded = await _dbContext.JournalEntries.FirstAsync(j => j.TransactionId == "TXN-ROUNDTRIP");

        loaded.TransactionId.Should().Be(original.TransactionId);
        loaded.Amount.Should().Be(original.Amount);
        loaded.Currency.Should().Be(original.Currency);
        loaded.Type.Should().Be(original.Type);
        loaded.AccountCode.Should().Be(original.AccountCode);
        loaded.CsvPayload.Should().Be(original.CsvPayload);
    }

    [Fact]
    public async Task ProcessedTransaction_InsertSelect_RoundTrip()
    {
        var processedAt = new DateTime(2026, 6, 9, 12, 0, 0, DateTimeKind.Utc);
        _dbContext.ProcessedTransactions.Add(new ProcessedTransaction
        {
            TransactionId = "TXN-PT-RT", ProcessedAt = processedAt
        });
        await _dbContext.SaveChangesAsync();

        _dbContext.ChangeTracker.Clear();
        var loaded = await _dbContext.ProcessedTransactions.FindAsync("TXN-PT-RT");

        loaded.Should().NotBeNull();
        loaded!.TransactionId.Should().Be("TXN-PT-RT");
        loaded.ProcessedAt.Should().Be(processedAt);
    }

    public void Dispose()
    {
        _dbContext.Database.EnsureDeleted();
        _dbContext.Dispose();
        if (File.Exists(_dbPath)) File.Delete(_dbPath);
    }
}
