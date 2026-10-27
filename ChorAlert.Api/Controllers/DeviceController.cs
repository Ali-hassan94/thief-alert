using ChorAlert.Api.Models;
using ChorAlert.Api.Services;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace ChorAlert.Api.Controllers;

[ApiController]
[Route("api/device")]
[Authorize]
public class DeviceController(NpgsqlDataSource db, Notifier notifier) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirst("sub")!.Value);

    [HttpPost("heartbeat")]
    public async Task<IActionResult> Heartbeat(HeartbeatRequest req)
    {
        var uid = UserId;
        await using var conn = await db.OpenConnectionAsync();
        var warnedLow = await conn.ExecuteScalarAsync<bool>(@"
            insert into device_status (user_id, last_seen, battery, charging, armed, warned_offline)
            values (@uid, now(), @battery, @charging, true, false)
            on conflict (user_id) do update
              set last_seen = now(), battery = @battery, charging = @charging,
                  armed = true, warned_offline = false
            returning warned_low",
            new { uid, battery = req.Battery, charging = req.Charging });

        var low = req.Battery is <= 20 && req.Charging != true;
        if (low && !warnedLow)
        {
            await conn.ExecuteAsync("update device_status set warned_low = true where user_id = @uid", new { uid });
            await notifier.PushToUserAsync(uid, "🔋 Camera ki battery kam",
                $"Camera phone ki battery {req.Battery}% reh gayi. Charger lagayen!");
        }
        else if (req.Charging == true || req.Battery is > 40)
        {
            await conn.ExecuteAsync("update device_status set warned_low = false where user_id = @uid", new { uid });
        }
        return Ok(new { ok = true });
    }

    [HttpPost("disarm")]
    public async Task<IActionResult> Disarm()
    {
        await using var conn = await db.OpenConnectionAsync();
        await conn.ExecuteAsync("update device_status set armed = false where user_id = @uid", new { uid = UserId });
        return Ok(new { ok = true });
    }
}