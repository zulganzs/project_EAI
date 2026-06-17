using System.Text;
using System.Text.Json;
using Accounting.Service.Configuration;
using Accounting.Service.Data;
using Accounting.Service.Models;
using Accounting.Service.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Accounting.Service.Messaging;

public class RabbitMqConsumer : BackgroundService
{
    private readonly ILogger<RabbitMqConsumer> _logger;
    private readonly RabbitMqSettings _settings;
    private readonly IServiceProvider _serviceProvider;
    private IConnection? _connection;
    private IChannel? _channel;

    public RabbitMqConsumer(
        ILogger<RabbitMqConsumer> logger,
        IOptions<AppSettings> appSettings,
        IServiceProvider serviceProvider)
    {
        _logger = logger;
        _settings = appSettings.Value.RabbitMq;
        _serviceProvider = serviceProvider;
    }

    public override async Task StartAsync(CancellationToken cancellationToken)
    {
        await InitializeRabbitMqWithRetryAsync(cancellationToken);
        await base.StartAsync(cancellationToken);
    }

    private async Task InitializeRabbitMqWithRetryAsync(CancellationToken cancellationToken)
    {
        var maxAttempts = 10;
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                await InitializeRabbitMqAsync();
                return; // Success
            }
            catch (Exception ex)
            {
                _logger.LogWarning("RabbitMQ connection attempt {Attempt}/{Max} failed: {Message}", attempt, maxAttempts, ex.Message);
                if (attempt == maxAttempts)
                {
                    _logger.LogError(ex, "Failed to connect to RabbitMQ after {Max} attempts", maxAttempts);
                    return;
                }
                await Task.Delay(3000, cancellationToken);
            }
        }
    }

    private async Task InitializeRabbitMqAsync()
    {
        var factory = new ConnectionFactory
        {
            HostName = _settings.HostName,
            Port = _settings.Port,
            UserName = _settings.UserName,
            Password = _settings.Password
        };

        _connection = await factory.CreateConnectionAsync();
        _channel = await _connection.CreateChannelAsync();

        // Set up DLQ Exchange and Queue
        var dlqExchange = $"{_settings.ExchangeName}.dlq";
        await _channel.ExchangeDeclareAsync(dlqExchange, ExchangeType.Topic, durable: true);
        await _channel.QueueDeclareAsync(_settings.DlqName, durable: true, exclusive: false, autoDelete: false);
        await _channel.QueueBindAsync(_settings.DlqName, dlqExchange, _settings.RoutingKey);

        // Set up Main Exchange and Queue with DLQ arguments
        await _channel.ExchangeDeclareAsync(_settings.ExchangeName, ExchangeType.Topic, durable: true);
        var queueArgs = new Dictionary<string, object?>
        {
            { "x-dead-letter-exchange", dlqExchange },
            { "x-dead-letter-routing-key", _settings.RoutingKey }
        };

        await _channel.QueueDeclareAsync(
            queue: _settings.QueueName,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: queueArgs);
        await _channel.QueueBindAsync(_settings.QueueName, _settings.ExchangeName, _settings.RoutingKey);

        await _channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 1, global: false);

        _logger.LogInformation("RabbitMQ initialized successfully. Listening on {QueueName}", _settings.QueueName);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (_channel == null) return;

        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.ReceivedAsync += async (model, ea) =>
        {
            var body = ea.Body.ToArray();
            var message = Encoding.UTF8.GetString(body);
            var retryCount = GetRetryCount(ea);

            try
            {
                _logger.LogInformation("Received message. RoutingKey: {RoutingKey}", ea.RoutingKey);
                await ProcessMessageAsync(message);
                await _channel.BasicAckAsync(ea.DeliveryTag, false);
                _logger.LogInformation("Message processed successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing message. Attempt: {Attempt}", retryCount + 1);

                if (retryCount >= _settings.MaxRetries)
                {
                    _logger.LogWarning("Max retries reached. Sending to DLQ.");
                    await _channel.BasicRejectAsync(ea.DeliveryTag, false);
                }
                else
                {
                    await Task.Delay(1000, stoppingToken);
                    await _channel.BasicNackAsync(ea.DeliveryTag, false, true);
                }
            }
        };

        await _channel.BasicConsumeAsync(queue: _settings.QueueName, autoAck: false, consumer: consumer, cancellationToken: stoppingToken);

        // Keep the task alive until cancellation
        var tcs = new TaskCompletionSource<bool>();
        stoppingToken.Register(() => tcs.SetResult(true));
        await tcs.Task;
    }

    private async Task ProcessMessageAsync(string message)
    {
        using var scope = _serviceProvider.CreateScope();
        var idempotencyService = scope.ServiceProvider.GetRequiredService<IdempotencyService>();
        var journalRepo = scope.ServiceProvider.GetRequiredService<JournalRepository>();
        var transformer = scope.ServiceProvider.GetRequiredService<MessageTransformer>();

        var transaction = JsonSerializer.Deserialize<TransactionEvent>(message);
        if (transaction == null || string.IsNullOrEmpty(transaction.TransactionId))
        {
            throw new ArgumentException("Invalid transaction event payload");
        }

        // Idempotency check
        if (await idempotencyService.HasBeenProcessedAsync(transaction.TransactionId))
        {
            _logger.LogInformation("Transaction {TransactionId} already processed. Skipping.", transaction.TransactionId);
            return;
        }

        // Transform (JSON -> CSV)
        var csvPayload = transformer.TransformToCsv(transaction);

        // Store Journal
        var entry = new JournalEntry
        {
            TransactionId = transaction.TransactionId,
            Amount = transaction.TotalAmount,
            Currency = transaction.Currency,
            Type = "SALES_REVENUE",
            AccountCode = "REV-100",
            CreatedAt = DateTime.UtcNow,
            CsvPayload = csvPayload
        };

        await journalRepo.SaveJournalEntryAsync(entry);
        await idempotencyService.MarkAsProcessedAsync(transaction.TransactionId);
    }

    private int GetRetryCount(BasicDeliverEventArgs ea)
    {
        return ea.Redelivered ? 1 : 0;
    }

    public override async void Dispose()
    {
        if (_channel != null) { try { await _channel.CloseAsync(); } catch { } }
        if (_connection != null) { try { await _connection.CloseAsync(); } catch { } }
        base.Dispose();
        GC.SuppressFinalize(this);
    }
}
