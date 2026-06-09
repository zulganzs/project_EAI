using Accounting.Service.Models;
using Microsoft.EntityFrameworkCore;

namespace Accounting.Service.Data;

public class AccountingDbContext : DbContext
{
    public AccountingDbContext(DbContextOptions<AccountingDbContext> options) : base(options)
    {
    }

    public DbSet<JournalEntry> JournalEntries { get; set; } = null!;
    public DbSet<ProcessedTransaction> ProcessedTransactions { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ProcessedTransaction>()
            .HasKey(p => p.TransactionId);

        modelBuilder.Entity<JournalEntry>()
            .HasIndex(j => j.TransactionId);
    }
}
