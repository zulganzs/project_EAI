using Accounting.Service.Models;
using Accounting.Service.Services;
using FluentAssertions;
using Xunit;

namespace Accounting.Service.Tests.Services;

public class MessageTransformerTests
{
    private readonly MessageTransformer _transformer = new();

    [Fact]
    public void TransformToCsv_ShouldConvertTransactionCorrectly()
    {
        // Arrange
        var transaction = new TransactionEvent
        {
            TransactionId = "TXN-001",
            TotalAmount = 50000,
            Currency = "IDR",
            Timestamp = "2026-06-09T10:30:00Z"
        };

        // Act
        var csv = _transformer.TransformToCsv(transaction);

        // Assert
        csv.Should().Be(
            "transaction_id,timestamp,total_amount,currency,type\n" +
            "TXN-001,2026-06-09T10:30:00Z,50000,IDR,SALES_REVENUE"
        );
    }

    [Fact]
    public void TransformToCsv_ShouldIncludeHeader()
    {
        // Arrange
        var transaction = new TransactionEvent
        {
            TransactionId = "TXN-002",
            TotalAmount = 25000,
            Currency = "IDR",
            Timestamp = "2026-06-09T12:00:00Z"
        };

        // Act
        var csv = _transformer.TransformToCsv(transaction);

        // Assert
        csv.Should().StartWith("transaction_id,timestamp,total_amount,currency,type\n");
    }

    [Fact]
    public void TransformToCsv_ShouldHandleLargeAmount()
    {
        // Arrange
        var transaction = new TransactionEvent
        {
            TransactionId = "TXN-BIG",
            TotalAmount = 999999999,
            Currency = "IDR",
            Timestamp = "2026-06-09T23:59:59Z"
        };

        // Act
        var csv = _transformer.TransformToCsv(transaction);

        // Assert
        csv.Should().Contain("999999999");
        csv.Should().Contain("TXN-BIG");
    }

    [Fact]
    public void TransformToCsv_ShouldHandleZeroAmount()
    {
        // Arrange
        var transaction = new TransactionEvent
        {
            TransactionId = "TXN-ZERO",
            TotalAmount = 0,
            Currency = "IDR",
            Timestamp = "2026-06-09T00:00:00Z"
        };

        // Act
        var csv = _transformer.TransformToCsv(transaction);

        // Assert
        csv.Should().Contain("0");
    }

    [Fact]
    public void TransformToCsv_ShouldUseSALES_REVENUEType()
    {
        // Arrange
        var transaction = new TransactionEvent
        {
            TransactionId = "TXN-003",
            TotalAmount = 75000,
            Currency = "IDR",
            Timestamp = "2026-06-09T15:30:00Z"
        };

        // Act
        var csv = _transformer.TransformToCsv(transaction);

        // Assert
        csv.Should().EndWith("SALES_REVENUE");
    }

    [Fact]
    public void TransformToCsv_ShouldHandleFullCDMPayload()
    {
        // Arrange - simulate the full CDM from POS
        var transaction = new TransactionEvent
        {
            EventType = "TRANSAKSI_SELESAI",
            TransactionId = "TXN-20260609-ab12",
            SourceSystem = "POS",
            Timestamp = "2026-06-09T10:30:00.000Z",
            Customer = new Customer { Name = "Walk-in Customer" },
            Items =
            [
                new TransactionItem { MenuId = "M001", MenuName = "Steak", Qty = 1, Price = 50000 }
            ],
            TotalAmount = 50000,
            Currency = "IDR",
            TraceId = "trace-pos-ab12cd34"
        };

        // Act
        var csv = _transformer.TransformToCsv(transaction);

        // Assert
        csv.Should().Contain("TXN-20260609-ab12");
        csv.Should().Contain("50000");
        csv.Should().Contain("IDR");
    }
}
