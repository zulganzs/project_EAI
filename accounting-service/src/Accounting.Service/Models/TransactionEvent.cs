using System.Text.Json.Serialization;

namespace Accounting.Service.Models;

public class TransactionEvent
{
    [JsonPropertyName("event_type")]
    public string EventType { get; set; } = string.Empty;

    [JsonPropertyName("transaction_id")]
    public string TransactionId { get; set; } = string.Empty;

    [JsonPropertyName("source_system")]
    public string SourceSystem { get; set; } = string.Empty;

    [JsonPropertyName("timestamp")]
    public string Timestamp { get; set; } = string.Empty;

    [JsonPropertyName("customer")]
    public Customer Customer { get; set; } = new();

    [JsonPropertyName("items")]
    public List<TransactionItem> Items { get; set; } = new();

    [JsonPropertyName("total_amount")]
    public decimal TotalAmount { get; set; }

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = string.Empty;

    [JsonPropertyName("trace_id")]
    public string TraceId { get; set; } = string.Empty;
}

public class Customer
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

public class TransactionItem
{
    [JsonPropertyName("menu_id")]
    public string MenuId { get; set; } = string.Empty;

    [JsonPropertyName("menu_name")]
    public string MenuName { get; set; } = string.Empty;

    [JsonPropertyName("qty")]
    public int Qty { get; set; }

    [JsonPropertyName("price")]
    public decimal Price { get; set; }
}
