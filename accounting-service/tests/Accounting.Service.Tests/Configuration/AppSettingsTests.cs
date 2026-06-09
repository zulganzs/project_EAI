using Accounting.Service.Configuration;
using FluentAssertions;
using Xunit;

namespace Accounting.Service.Tests.Configuration;

public class AppSettingsTests
{
    [Fact]
    public void AppSettings_HasDefaultRabbitMqSettings()
    {
        // Arrange & Act
        var settings = new AppSettings();

        // Assert
        settings.RabbitMq.Should().NotBeNull();
        settings.RabbitMq.HostName.Should().Be("localhost");
        settings.RabbitMq.Port.Should().Be(5672);
        settings.RabbitMq.UserName.Should().Be("guest");
        settings.RabbitMq.Password.Should().Be("guest");
        settings.RabbitMq.ExchangeName.Should().Be("flowca.events");
        settings.RabbitMq.QueueName.Should().Be("accounting.transactions");
        settings.RabbitMq.RoutingKey.Should().Be("TRANSAKSI_SELESAI");
        settings.RabbitMq.DlqName.Should().Be("accounting.transactions.dlq");
        settings.RabbitMq.MaxRetries.Should().Be(3);
    }

    [Fact]
    public void AppSettings_HasDefaultDatabaseConnectionString()
    {
        // Arrange & Act
        var settings = new AppSettings();

        // Assert
        settings.DatabaseConnectionString.Should().Be("Data Source=accounting.db");
    }

    [Fact]
    public void RabbitMqSettings_CanBeOverridden()
    {
        // Arrange
        var settings = new AppSettings();

        // Act
        settings.RabbitMq.HostName = "rabbitmq-server";
        settings.RabbitMq.Port = 5673;
        settings.RabbitMq.ExchangeName = "custom.exchange";
        settings.RabbitMq.MaxRetries = 5;

        // Assert
        settings.RabbitMq.HostName.Should().Be("rabbitmq-server");
        settings.RabbitMq.Port.Should().Be(5673);
        settings.RabbitMq.ExchangeName.Should().Be("custom.exchange");
        settings.RabbitMq.MaxRetries.Should().Be(5);
    }

    [Fact]
    public void DatabaseConnectionString_CanBeOverridden()
    {
        // Arrange
        var settings = new AppSettings();

        // Act
        settings.DatabaseConnectionString = "Data Source=/app/data/custom.db";

        // Assert
        settings.DatabaseConnectionString.Should().Be("Data Source=/app/data/custom.db");
    }
}
