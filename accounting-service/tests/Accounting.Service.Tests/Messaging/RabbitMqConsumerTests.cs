using Accounting.Service.Configuration;
using Accounting.Service.Messaging;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;
using Accounting.Service.Models;
using Xunit;

namespace Accounting.Service.Tests.Messaging;

public class RabbitMqConsumerTests
{
    // --- Consumer Export Tests ---

    [Fact]
    public void RabbitMqConsumer_IsABackgroundService()
    {
        // Assert that the consumer extends BackgroundService
        typeof(RabbitMqConsumer).BaseType!.Name.Should().Be("BackgroundService");
    }

    // --- Configuration Tests ---

    [Fact]
    public void RabbitMqSettings_HasCorrectDefaultRoutingKey()
    {
        var settings = new RabbitMqSettings();
        settings.RoutingKey.Should().Be("TRANSAKSI_SELESAI");
    }

    [Fact]
    public void RabbitMqSettings_HasCorrectDefaultExchange()
    {
        var settings = new RabbitMqSettings();
        settings.ExchangeName.Should().Be("flowca.events");
    }

    [Fact]
    public void RabbitMqSettings_HasCorrectDefaultQueue()
    {
        var settings = new RabbitMqSettings();
        settings.QueueName.Should().Be("accounting.transactions");
    }

    [Fact]
    public void RabbitMqSettings_HasCorrectDefaultDlq()
    {
        var settings = new RabbitMqSettings();
        settings.DlqName.Should().Be("accounting.transactions.dlq");
    }

    [Fact]
    public void RabbitMqSettings_MaxRetries_DefaultIsThree()
    {
        var settings = new RabbitMqSettings();
        settings.MaxRetries.Should().Be(3);
    }

    // --- CDM Deserialization Integration Test ---

    [Fact]
    public void CDM_Payload_FromPOS_CanBeDeserialized()
    {
        // Arrange - exact CDM from POS service
        var cdm = new
        {
            event_type = "TRANSAKSI_SELESAI",
            transaction_id = "TXN-20260609-ab12",
            source_system = "POS",
            timestamp = "2026-06-09T10:30:00.000Z",
            customer = new { name = "Walk-in Customer" },
            items = new[]
            {
                new { menu_id = "M001", menu_name = "Steak", qty = 1, price = 50000 }
            },
            total_amount = 50000,
            currency = "IDR",
            trace_id = "trace-pos-ab12cd34"
        };
        var json = JsonSerializer.Serialize(cdm);

        // Act
        var result = JsonSerializer.Deserialize<TransactionEvent>(json);

        // Assert
        result.Should().NotBeNull();
        result!.EventType.Should().Be("TRANSAKSI_SELESAI");
        result.TransactionId.Should().Be("TXN-20260609-ab12");
        result.Items.Should().HaveCount(1);
        result.TotalAmount.Should().Be(50000);
    }

    // --- Full Pipeline Test (Transformer + Idempotency) ---

    [Fact]
    public void FullPipeline_CDM_To_CSV()
    {
        // Arrange - CDM payload from POS
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
        var transformer = new Accounting.Service.Services.MessageTransformer();

        // Act
        var csv = transformer.TransformToCsv(transaction);

        // Assert
        csv.Should().Contain("TXN-20260609-ab12");
        csv.Should().Contain("50000");
        csv.Should().Contain("IDR");
        csv.Should().Contain("SALES_REVENUE");
        csv.Split('\n').Should().HaveCount(2); // header + 1 data row
    }
}
