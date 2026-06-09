using Accounting.Service.Models;

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
}
