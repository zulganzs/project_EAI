namespace Accounting.Service.Configuration;

public class AppSettings
{
    public RabbitMqSettings RabbitMq { get; set; } = new();
    public string DatabaseConnectionString { get; set; } = "Data Source=accounting.db";
}

public class RabbitMqSettings
{
    public string HostName { get; set; } = "localhost";
    public int Port { get; set; } = 5672;
    public string UserName { get; set; } = "guest";
    public string Password { get; set; } = "guest";
    public string ExchangeName { get; set; } = "flowca.events";
    public string QueueName { get; set; } = "accounting.transactions";
    public string RoutingKey { get; set; } = "transaction.completed";
    public string DlqName { get; set; } = "accounting.transactions.dlq";
    public int MaxRetries { get; set; } = 3;
}
