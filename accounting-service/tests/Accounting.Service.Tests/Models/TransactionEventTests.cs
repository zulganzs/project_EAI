using System.Text.Json;
using Accounting.Service.Models;
using FluentAssertions;
using Xunit;

namespace Accounting.Service.Tests.Models;

public class TransactionEventTests
{
    [Fact]
    public void CanDeserialize_CanonicalDataModel_FromPOS()
    {
        // Arrange - exact CDM payload from POS service buildCDMPayload()
        var json = @"{
            ""event_type"": ""TRANSAKSI_SELESAI"",
            ""transaction_id"": ""TXN-20260609-ab12"",
            ""source_system"": ""POS"",
            ""timestamp"": ""2026-06-09T10:30:00.000Z"",
            ""customer"": {
                ""name"": ""Walk-in Customer""
            },
            ""items"": [
                {
                    ""menu_id"": ""M001"",
                    ""menu_name"": ""Steak"",
                    ""qty"": 1,
                    ""price"": 50000
                }
            ],
            ""total_amount"": 50000,
            ""currency"": ""IDR"",
            ""trace_id"": ""trace-pos-ab12cd34""
        }";

        // Act
        var result = JsonSerializer.Deserialize<TransactionEvent>(json);

        // Assert
        result.Should().NotBeNull();
        result!.EventType.Should().Be("TRANSAKSI_SELESAI");
        result.TransactionId.Should().Be("TXN-20260609-ab12");
        result.SourceSystem.Should().Be("POS");
        result.Timestamp.Should().Be("2026-06-09T10:30:00.000Z");
        result.Customer.Name.Should().Be("Walk-in Customer");
        result.Items.Should().HaveCount(1);
        result.Items[0].MenuId.Should().Be("M001");
        result.Items[0].MenuName.Should().Be("Steak");
        result.Items[0].Qty.Should().Be(1);
        result.Items[0].Price.Should().Be(50000);
        result.TotalAmount.Should().Be(50000);
        result.Currency.Should().Be("IDR");
        result.TraceId.Should().Be("trace-pos-ab12cd34");
    }

    [Fact]
    public void CanDeserialize_MultipleItems()
    {
        // Arrange
        var json = @"{
            ""event_type"": ""TRANSAKSI_SELESAI"",
            ""transaction_id"": ""TXN-20260609-cd34"",
            ""source_system"": ""POS"",
            ""timestamp"": ""2026-06-09T12:00:00Z"",
            ""customer"": { ""name"": ""John"" },
            ""items"": [
                { ""menu_id"": ""M001"", ""menu_name"": ""Steak"", ""qty"": 2, ""price"": 50000 },
                { ""menu_id"": ""M002"", ""menu_name"": ""Nasi Goreng"", ""qty"": 1, ""price"": 25000 }
            ],
            ""total_amount"": 125000,
            ""currency"": ""IDR"",
            ""trace_id"": ""trace-pos-xyz""
        }";

        // Act
        var result = JsonSerializer.Deserialize<TransactionEvent>(json);

        // Assert
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(2);
        result.TotalAmount.Should().Be(125000);
        result.Items[0].Qty.Should().Be(2);
        result.Items[1].MenuName.Should().Be("Nasi Goreng");
    }

    [Fact]
    public void JournalEntry_HasDefaultValues()
    {
        // Arrange & Act
        var entry = new JournalEntry();

        // Assert
        entry.TransactionId.Should().Be(string.Empty);
        entry.Amount.Should().Be(0);
        entry.Currency.Should().Be(string.Empty);
        entry.Type.Should().Be(string.Empty);
        entry.AccountCode.Should().Be(string.Empty);
        entry.CsvPayload.Should().Be(string.Empty);
    }

    [Fact]
    public void JournalEntry_CanSetAllProperties()
    {
        // Arrange
        var entry = new JournalEntry
        {
            TransactionId = "TXN-001",
            Amount = 50000,
            Currency = "IDR",
            Type = "SALES_REVENUE",
            AccountCode = "REV-100",
            CreatedAt = new DateTime(2026, 6, 9, 10, 30, 0, DateTimeKind.Utc),
            CsvPayload = "transaction_id,timestamp,total_amount,currency,type\nTXN-001,2026-06-09,50000,IDR,SALES_REVENUE"
        };

        // Assert
        entry.TransactionId.Should().Be("TXN-001");
        entry.Amount.Should().Be(50000);
        entry.Currency.Should().Be("IDR");
        entry.Type.Should().Be("SALES_REVENUE");
        entry.AccountCode.Should().Be("REV-100");
        entry.CsvPayload.Should().Contain("TXN-001");
    }

    [Fact]
    public void ProcessedTransaction_HasDefaultValues()
    {
        // Arrange & Act
        var pt = new ProcessedTransaction();

        // Assert
        pt.TransactionId.Should().Be(string.Empty);
    }

    [Fact]
    public void ProcessedTransaction_CanSetProperties()
    {
        // Arrange
        var pt = new ProcessedTransaction
        {
            TransactionId = "TXN-001",
            ProcessedAt = DateTime.UtcNow
        };

        // Assert
        pt.TransactionId.Should().Be("TXN-001");
        pt.ProcessedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }
}
