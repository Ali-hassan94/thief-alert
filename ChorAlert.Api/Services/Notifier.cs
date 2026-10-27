using System.Text.Json;
using ChorAlert.Api.Models;
using Dapper;
using Npgsql;

namespace ChorAlert.Api.Services;

public class Notifier(NpgsqlDataSource db, PushService push)
{
    public async Task PushToUserAsync(Guid userId, string title, string body, string url = "/dashboard")
    {
        await using var conn = await db.OpenConnectionAsync();
        var subs = await conn.QueryAsync<Recipient>(
            "select endpoint, p256dh, auth from push_subscriptions where user_id = @userId", new { userId });
        foreach (var s in subs)
        {
            var payload = JsonSerializer.Serialize(new { title, body, url, tag = "system" });
            var r = await push.SendAsync(s.Endpoint, s.P256dh, s.Auth, payload);
            if (r == PushResult.Expired)
                await conn.ExecuteAsync("delete from push_subscriptions where endpoint = @e", new { e = s.Endpoint });
        }
    }
}