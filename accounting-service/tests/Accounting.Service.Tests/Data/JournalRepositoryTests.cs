using Accounting.Service.Data;
using Accounting.Service.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Accounting.Service.Tests.Data;

public class JournalRepositoryTests : IDisposable
{
    private readonly AccountingDbContext _dbContext;
    private readonly JournalRepository _repository;

    public JournalRepositoryTests()
    {
        var options = new DbContextOptionsBuilder<AccountingDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        _dbContext = new AccountingDbContext(options);
        _repository = new JournalRepository(_dbContext);
    }

    [Fact]
    public async Task SaveJournalEntryAsync_ShouldPersistEntry()
    {
        // Arrange
        var entry = new JournalEntry
        {
            TransactionId = "TXN-001",
            Amount = 50000,
            Currency = "IDR",
            Type = "SALES_REVENUE",
            AccountCode = "REV-100",
            CreatedAt = DateTime.UtcNow,
            CsvPayload = "transaction_id,timestamp,total_amount,currency,type\nTXN-001,2026-06-09,50000,IDR,SALES_REVENUE"
        };

        // Act
        await _repository.SaveJournalEntryAsync(entry);

        // Assert
        var saved = await _dbContext.JournalEntries.FirstOrDefaultAsync(j => j.TransactionId == "TXN-001");
        saved.Should().NotBeNull();
        saved!.Amount.Should().Be(50000);
        saved.Currency.Should().Be("IDR");
        saved.Type.Should().Be("SALES_REVENUE");
        saved.AccountCode.Should().Be("REV-100");
        saved.CsvPayload.Should().Contain("TXN-001");
    }

    [Fact]
    public async Task SaveJournalEntryAsync_ShouldAutoGenerateId()
    {
        // Arrange
        var entry = new JournalEntry
        {
            TransactionId = "TXN-AUTO",
            Amount = 25000,
            Currency = "IDR",
            Type = "SALES_REVENUE",
            AccountCode = "REV-100",
            CreatedAt = DateTime.UtcNow,
            CsvPayload = "csv-data"
        };

        // Act
        await _repository.SaveJournalEntryAsync(entry);

        // Assert
        entry.Id.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task SaveJournalEntryAsync_ShouldSaveMultipleEntries()
    {
        // Arrange
        var entry1 = new JournalEntry
        {
            TransactionId = "TXN-M1",
            Amount = 10000,
            Currency = "IDR",
            Type = "SALES_REVENUE",
            AccountCode = "REV-100",
            CreatedAt = DateTime.UtcNow,
            CsvPayload = "csv1"
        };
        var entry2 = new JournalEntry
        {
            TransactionId = "TXN-M2",
            Amount = 20000,
            Currency = "IDR",
            Type = "SALES_REVENUE",
            AccountCode = "REV-100",
            CreatedAt = DateTime.UtcNow,
            CsvPayload = "csv2"
        };

        // Act
        await _repository.SaveJournalEntryAsync(entry1);
        await _repository.SaveJournalEntryAsync(entry2);

        // Assert
        var all = await _dbContext.JournalEntries.ToListAsync();
        all.Should().HaveCount(2);
    }

    [Fact]
    public async Task SaveJournalEntryAsync_ShouldStoreCsvPayload()
    {
        // Arrange
        var csvContent = "transaction_id,timestamp,total_amount,currency,type\nTXN-CSV,2026-06-09,50000,IDR,SALES_REVENUE";
        var entry = new JournalEntry
        {
            TransactionId = "TXN-CSV",
            Amount = 50000,
            Currency = "IDR",
            Type = "SALES_REVENUE",
            AccountCode = "REV-100",
            CreatedAt = DateTime.UtcNow,
            CsvPayload = csvContent
        };

        // Act
        await _repository.SaveJournalEntryAsync(entry);

        // Assert
        var saved = await _dbContext.JournalEntries.FirstOrDefaultAsync(j => j.TransactionId == "TXN-CSV");
        saved!.CsvPayload.Should().Be(csvContent);
    }

    public void Dispose()
    {
        _dbContext.Database.EnsureDeleted();
        _dbContext.Dispose();
    }
}
