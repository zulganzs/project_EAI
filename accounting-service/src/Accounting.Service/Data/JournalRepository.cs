using Accounting.Service.Models;
using Microsoft.EntityFrameworkCore;

namespace Accounting.Service.Data;

public class JournalRepository
{
    private readonly AccountingDbContext _dbContext;

    public JournalRepository(AccountingDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task SaveJournalEntryAsync(JournalEntry entry)
    {
        _dbContext.JournalEntries.Add(entry);
        await _dbContext.SaveChangesAsync();
    }

    public async Task<List<JournalEntry>> GetAllAsync()
    {
        return await _dbContext.JournalEntries.OrderByDescending(j => j.CreatedAt).ToListAsync();
    }

    public async Task<JournalEntry?> GetByIdAsync(int id)
    {
        return await _dbContext.JournalEntries.FirstOrDefaultAsync(j => j.Id == id);
    }

    public async Task<JournalEntry?> GetByTransactionIdAsync(string transactionId)
    {
        return await _dbContext.JournalEntries.FirstOrDefaultAsync(j => j.TransactionId == transactionId);
    }

    public async Task<List<ProcessedTransaction>> GetAllProcessedAsync()
    {
        return await _dbContext.ProcessedTransactions.OrderByDescending(p => p.ProcessedAt).ToListAsync();
    }
}
