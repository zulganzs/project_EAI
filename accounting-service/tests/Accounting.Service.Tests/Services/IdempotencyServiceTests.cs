using Accounting.Service.Data;
using Accounting.Service.Models;
using Accounting.Service.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Accounting.Service.Tests.Services;

public class IdempotencyServiceTests : IDisposable
{
    private readonly AccountingDbContext _dbContext;
    private readonly IdempotencyService _service;

    public IdempotencyServiceTests()
    {
        var options = new DbContextOptionsBuilder<AccountingDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        _dbContext = new AccountingDbContext(options);
        _service = new IdempotencyService(_dbContext);
    }

    // --- HasBeenProcessedAsync Tests ---

    [Fact]
    public async Task HasBeenProcessedAsync_ShouldReturnFalse_ForNewTransaction()
    {
        // Act
        var result = await _service.HasBeenProcessedAsync("TXN-NEW");

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task HasBeenProcessedAsync_ShouldReturnFalse_ForDifferentTransactionId()
    {
        // Arrange
        await _service.MarkAsProcessedAsync("TXN-001");

        // Act
        var result = await _service.HasBeenProcessedAsync("TXN-002");

        // Assert
        result.Should().BeFalse();
    }

    // --- MarkAsProcessedAsync Tests ---

    [Fact]
    public async Task MarkAsProcessedAsync_ShouldSaveTransaction()
    {
        // Act
        await _service.MarkAsProcessedAsync("TXN-SAVED");

        // Assert
        var result = await _service.HasBeenProcessedAsync("TXN-SAVED");
        result.Should().BeTrue();
    }

    [Fact]
    public async Task MarkAsProcessedAsync_ShouldRecordProcessedAt()
    {
        // Act
        await _service.MarkAsProcessedAsync("TXN-TIMESTAMP");

        // Assert
        var processed = await _dbContext.ProcessedTransactions.FindAsync("TXN-TIMESTAMP");
        processed.Should().NotBeNull();
        processed!.ProcessedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    // --- Idempotency: false -> mark -> true ---

    [Fact]
    public async Task Idempotency_FullCycle_NewThenProcessed()
    {
        // Step 1: Not processed yet
        var isNew = await _service.HasBeenProcessedAsync("TXN-CYCLE");
        isNew.Should().BeFalse();

        // Step 2: Mark as processed
        await _service.MarkAsProcessedAsync("TXN-CYCLE");

        // Step 3: Now it's processed
        var isProcessed = await _service.HasBeenProcessedAsync("TXN-CYCLE");
        isProcessed.Should().BeTrue();
    }

    [Fact]
    public async Task MarkAsProcessedAsync_ShouldBeIdempotent_CalledTwice()
    {
        // Act - mark twice
        await _service.MarkAsProcessedAsync("TXN-DOUBLE");
        await _service.MarkAsProcessedAsync("TXN-DOUBLE");

        // Assert - should still be processed (no error thrown)
        var result = await _service.HasBeenProcessedAsync("TXN-DOUBLE");
        result.Should().BeTrue();
    }

    public void Dispose()
    {
        _dbContext.Database.EnsureDeleted();
        _dbContext.Dispose();
    }
}
