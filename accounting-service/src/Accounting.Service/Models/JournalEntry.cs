namespace Accounting.Service.Models;

public class JournalEntry
{
    public int Id { get; set; }
    public string TransactionId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // "DEBIT" or "CREDIT"
    public string AccountCode { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    // CSV Payload storing transformed format
    public string CsvPayload { get; set; } = string.Empty;
}
