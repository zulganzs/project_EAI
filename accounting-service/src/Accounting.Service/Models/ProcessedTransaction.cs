namespace Accounting.Service.Models;

public class ProcessedTransaction
{
    public string TransactionId { get; set; } = string.Empty;
    public DateTime ProcessedAt { get; set; }
}
