using Accounting.Service.Data;
using Accounting.Service.Models;
using Microsoft.EntityFrameworkCore;

namespace Accounting.Service.Services;

public class IdempotencyService
{
    private readonly AccountingDbContext _dbContext;

    public IdempotencyService(AccountingDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> HasBeenProcessedAsync(string transactionId)
    {
        return await _dbContext.ProcessedTransactions
            .AnyAsync(p => p.TransactionId == transactionId);
    }

    public async Task MarkAsProcessedAsync(string transactionId)
    {
        // Check if already exists to avoid duplicate key exception
        var exists = await _dbContext.ProcessedTransactions
            .AnyAsync(p => p.TransactionId == transactionId);

        if (!exists)
        {
            _dbContext.ProcessedTransactions.Add(new ProcessedTransaction
            {
                TransactionId = transactionId,
                ProcessedAt = DateTime.UtcNow
            });

            await _dbContext.SaveChangesAsync();
        }
    }
}
