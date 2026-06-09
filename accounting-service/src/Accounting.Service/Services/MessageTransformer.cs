using System.Text;
using Accounting.Service.Models;

namespace Accounting.Service.Services;

public class MessageTransformer
{
    public string TransformToCsv(TransactionEvent transaction)
    {
        var sb = new StringBuilder();

        // Header
        sb.Append("transaction_id,timestamp,total_amount,currency,type");

        // Data row
        sb.Append('\n');
        sb.Append($"{transaction.TransactionId},");
        sb.Append($"{transaction.Timestamp},");
        sb.Append($"{transaction.TotalAmount},");
        sb.Append($"{transaction.Currency},");
        sb.Append("SALES_REVENUE"); // Default accounting type for POS transactions

        return sb.ToString();
    }
}
