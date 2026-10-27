using Dapper;
using Npgsql;

namespace ChorAlert.Api.Services;

public class MonitorService(NpgsqlDataSource db, Notifier notifier, ILogger<MonitorService> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await using var conn = await db.OpenConnectionAsync(ct);
                var ids = (await conn.QueryAsync<Guid>(@"
                    update device_status set warned_offline = true
                    where armed and not warned_offline and last_seen < now() - interval '3 minutes'
                    returning user_id")).ToList();

                foreach (var id in ids)
                    await notifier.PushToUserAsync(id, "⚠️ Camera offline",
                        "Camera phone ka internet ya battery band ho gaya. Nigrani ruki hui hai!");

                await Task.Delay(TimeSpan.FromSeconds(60), ct);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                log.LogWarning(ex, "Monitor fail");
                try { await Task.Delay(10000, ct); } catch { break; }
            }
        }
    }
}