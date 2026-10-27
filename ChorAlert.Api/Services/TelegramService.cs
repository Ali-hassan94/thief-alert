using System.Net.Http.Json;
using System.Text.Json;
using Dapper;
using Npgsql;

namespace ChorAlert.Api.Services;

public class TelegramService(IConfiguration cfg, IHttpClientFactory factory, NpgsqlDataSource db,
    ILogger<TelegramService> log) : BackgroundService
{
    private string? Token => cfg["Telegram:BotToken"];
    public string? BotName => cfg["Telegram:BotName"];
    public bool Enabled => !string.IsNullOrWhiteSpace(Token);
    private string Api(string method) => $"https://api.telegram.org/bot{Token}/{method}";

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!Enabled) return;
        var http = factory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(40);
        long offset = 0;

        while (!ct.IsCancellationRequested)
        {
            try
            {
                var json = await http.GetStringAsync(Api($"getUpdates?timeout=25&offset={offset}"), ct);
                using var doc = JsonDocument.Parse(json);
                foreach (var u in doc.RootElement.GetProperty("result").EnumerateArray())
                {
                    offset = u.GetProperty("update_id").GetInt64() + 1;
                    if (!u.TryGetProperty("message", out var m)) continue;
                    var chat = m.GetProperty("chat").GetProperty("id").GetInt64();
                    var text = m.TryGetProperty("text", out var t) ? t.GetString() ?? "" : "";

                    if (text.StartsWith("/start "))
                    {
                        var code = text[7..].Trim();
                        await using var conn = await db.OpenConnectionAsync(ct);
                        var n = await conn.ExecuteAsync(
                            "update telegram_links set chat_id = @chat where code = @code", new { chat, code });
                        await SendAsync(chat, n > 0
                            ? "✅ Thief Alert jur gaya. Ab aap ke zone ke alerts yahan aayenge."
                            : "Code galat ya purana hai. Dashboard se dobara 'Telegram jodein' dabayen.");
                    }
                    else await SendAsync(chat, "Dashboard par 'Telegram jodein' button dabayen.");
                }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                log.LogWarning(ex, "Telegram poll fail");
                try { await Task.Delay(5000, ct); } catch { break; }
            }
        }
    }

    public async Task SendAsync(long chatId, string text, string? photoUrl = null)
    {
        if (!Enabled) return;
        try
        {
            var http = factory.CreateClient();
            if (photoUrl != null)
                await http.PostAsJsonAsync(Api("sendPhoto"), new { chat_id = chatId, photo = photoUrl, caption = text });
            else
                await http.PostAsJsonAsync(Api("sendMessage"), new { chat_id = chatId, text });
        }
        catch (Exception ex) { log.LogWarning(ex, "Telegram send fail"); }
    }
}