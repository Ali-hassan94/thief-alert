using System.Collections.Concurrent;
using System.Text.Json;
using ChorAlert.Api.Models;
using ChorAlert.Api.Services;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace ChorAlert.Api.Controllers;

[ApiController]
[Route("api/alerts")]
[Authorize]
public class AlertsController(
    NpgsqlDataSource db,
    PushService push,
    GeminiService gemini,
    TelegramService telegram,
    Notifier notifier,
    IConfiguration cfg,
    ILogger<AlertsController> log) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirst("sub")!.Value);

    // Mohalla group ke saathi (jis user ki id @uid hai us ke groupmates)
    private const string Mates = @"select gm2.user_id from group_members gm1
        join group_members gm2 on gm2.group_id = gm1.group_id where gm1.user_id = @uid";

    private const string AlertSelect = @"
        select a.id, a.photo_url,
               (select count(*) from alert_votes v where v.alert_id = a.id and v.vote = 'confirm')::int as confirms,
               (select count(*) from alert_votes v where v.alert_id = a.id and v.vote = 'fake')::int as fakes,
               (select v.vote from alert_votes v where v.alert_id = a.id and v.user_id = @uid) as my_vote,
               a.description, a.status, a.created_at,
               st_y(a.location::geometry) as lat,
               st_x(a.location::geometry) as lng,
               st_distance(a.location, z.location)::int as distance_m,
               (a.user_id = @uid) as mine
        from alerts a
        left join zones z on z.user_id = @uid
        where (a.user_id = @uid
               or (z.id is not null and st_dwithin(a.location, z.location, z.radius_m))
               or a.user_id in (" + Mates + "))";

    [HttpPost]
    public async Task<IActionResult> Create(CreateAlertRequest req)
    {
        if (req.Lat is < -90 or > 90 || req.Lng is < -180 or > 180)
            return BadRequest(new { error = "Location sahi nahi hai." });

        var desc = (req.Description ?? "").Trim();
        if (desc.Length > 300) desc = desc[..300];

        var uid = UserId;
        var isAuto = req.Source == "camera";

        var photo = req.PhotoUrl;
        var allowed = $"{cfg["Supabase:Url"]!.TrimEnd('/')}/storage/v1/object/public/snapshots/";
        if (photo != null && !photo.StartsWith(allowed)) photo = null;

        if (isAuto && photo != null)
        {
            var check = await gemini.CheckAsync(photo);
            if (check is { RealPerson: false })
                return Ok(new { id = (Guid?)null, notified = 0, filtered = true });
            if (check is { Summary.Length: > 0 })
                desc = (desc + " AI: " + check.Summary).Trim();
        }

        var maxPerHour = isAuto ? 20 : cfg.GetValue("Alerts:MaxPerHour", 3);
        var includeSender = cfg.GetValue("Alerts:NotifySender", false);

        await using var conn = await db.OpenConnectionAsync();

        if (isAuto)
        {
            var last = await conn.ExecuteScalarAsync<int>(
                "select count(*) from alerts where user_id = @uid and created_at > now() - interval '2 minutes'",
                new { uid });
            if (last > 0) return StatusCode(429, new { error = "Abhi abhi alert ja chuka hai." });
        }

        var recent = await conn.ExecuteScalarAsync<int>(
            "select count(*) from alerts where user_id = @uid and created_at > now() - interval '1 hour'",
            new { uid });
        if (recent >= maxPerHour)
            return StatusCode(429, new { error = $"Ek ghante me sirf {maxPerHour} alert bheje ja sakte hain." });

        var alertId = await conn.ExecuteScalarAsync<Guid>(@"
            insert into alerts (user_id, location, description, photo_url)
            values (@uid, st_setsrid(st_makepoint(@lng, @lat), 4326)::geography, @desc, @photo)
            returning id",
            new { uid, lat = req.Lat, lng = req.Lng, desc = desc.Length == 0 ? null : desc, photo });

        var args = new { lat = req.Lat, lng = req.Lng, uid, includeSender };

        // Push: zone me aane wale + mohalla group ke saathi
        var recipients = (await conn.QueryAsync<Recipient>(@"
            select distinct on (ps.endpoint) ps.endpoint, ps.p256dh, ps.auth,
                   coalesce(st_distance(z.location, pt.g)::int, 0) as distance_m
            from push_subscriptions ps
            left join zones z on z.user_id = ps.user_id
            cross join (select st_setsrid(st_makepoint(@lng, @lat), 4326)::geography as g) pt
            where (@includeSender or ps.user_id <> @uid)
              and ((z.id is not null and st_dwithin(z.location, pt.g, z.radius_m))
                   or ps.user_id in (" + Mates + @"))
            order by ps.endpoint", args)).ToList();

        var sent = 0;
        var expired = new ConcurrentBag<string>();

        await Parallel.ForEachAsync(recipients, new ParallelOptions { MaxDegreeOfParallelism = 10 },
            async (r, _) =>
            {
                var payload = JsonSerializer.Serialize(new
                {
                    title = "🚨 Chor Alert!",
                    body = BuildBody(r.DistanceM, desc),
                    url = $"/alert/{alertId}",
                    tag = $"alert-{alertId}",
                    image = photo
                });
                var result = await push.SendAsync(r.Endpoint, r.P256dh, r.Auth, payload);
                if (result == PushResult.Ok) Interlocked.Increment(ref sent);
                else if (result == PushResult.Expired) expired.Add(r.Endpoint);
            });

        if (!expired.IsEmpty)
            await conn.ExecuteAsync("delete from push_subscriptions where endpoint = any(@eps)",
                new { eps = expired.ToArray() });

        // Telegram
        var tgSent = 0;
        if (telegram.Enabled)
        {
            var chats = (await conn.QueryAsync<long>(@"
                select distinct tl.chat_id
                from telegram_links tl
                left join zones z on z.user_id = tl.user_id
                cross join (select st_setsrid(st_makepoint(@lng, @lat), 4326)::geography as g) pt
                where tl.chat_id is not null and (@includeSender or tl.user_id <> @uid)
                  and ((z.id is not null and st_dwithin(z.location, pt.g, z.radius_m))
                       or tl.user_id in (" + Mates + "))", args)).ToList();

            var link = $"{cfg["App:Url"]?.TrimEnd('/')}/alert/{alertId}";
            var text = $"🚨 CHOR ALERT!\n{(desc.Length > 0 ? desc + "\n" : "")}Detail aur map: {link}";
            foreach (var c in chats)
            {
                await telegram.SendAsync(c, text, photo);
                tgSent++;
            }
        }

        await conn.ExecuteAsync("update alerts set notified_count = @n where id = @id",
            new { n = sent + tgSent, id = alertId });

        log.LogInformation("Alert {Id}: push {Total}/{Sent}, telegram {Tg}", alertId, recipients.Count, sent, tgSent);
        return Ok(new { id = alertId, notified = sent + tgSent, telegram = tgSent });
    }

    private static string BuildBody(int distanceM, string desc)
    {
        var dist = distanceM < 1000 ? $"{distanceM} m" : $"{distanceM / 1000.0:0.#} km";
        var text = $"Aap ke zone me, lagbhag {dist} door chor ka alert.";
        if (desc.Length > 0) text += " " + (desc.Length > 100 ? desc[..100] + "…" : desc);
        return text;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int days = 7)
    {
        days = Math.Clamp(days, 1, 90);
        await using var conn = await db.OpenConnectionAsync();
        var rows = await conn.QueryAsync<AlertDto>(
            AlertSelect + " and a.created_at > now() - interval '1 day' * @days order by a.created_at desc limit 300",
            new { uid = UserId, days });
        return Ok(rows);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        await using var conn = await db.OpenConnectionAsync();
        var row = await conn.QueryFirstOrDefaultAsync<AlertDto>(
            AlertSelect + " and a.id = @id", new { uid = UserId, id });
        return row is null ? NotFound(new { error = "Alert nahi mila." }) : Ok(row);
    }

    [HttpPost("{id:guid}/resolve")]
    public async Task<IActionResult> Resolve(Guid id)
    {
        await using var conn = await db.OpenConnectionAsync();
        var n = await conn.ExecuteAsync(
            "update alerts set status = 'resolved' where id = @id and user_id = @uid",
            new { id, uid = UserId });
        return n == 0 ? NotFound(new { error = "Alert nahi mila." }) : Ok(new { ok = true });
    }

    [HttpPost("{id:guid}/vote")]
    public async Task<IActionResult> Vote(Guid id, VoteRequest req)
    {
        if (req.Vote is not ("confirm" or "fake")) return BadRequest(new { error = "Vote galat hai." });
        await using var conn = await db.OpenConnectionAsync();
        var visible = await conn.QueryFirstOrDefaultAsync<AlertDto>(
            AlertSelect + " and a.id = @id", new { uid = UserId, id });
        if (visible is null) return NotFound(new { error = "Alert nahi mila." });

        await conn.ExecuteAsync(@"
            insert into alert_votes (alert_id, user_id, vote) values (@id, @uid, @vote)
            on conflict (alert_id, user_id) do update set vote = excluded.vote",
            new { id, uid = UserId, vote = req.Vote });
        return Ok(new { ok = true });
    }

    // 🔁 Chor ka track
    [HttpGet("{id:guid}/sightings")]
    public async Task<IActionResult> Sightings(Guid id)
    {
        await using var conn = await db.OpenConnectionAsync();
        var visible = await conn.QueryFirstOrDefaultAsync<AlertDto>(
            AlertSelect + " and a.id = @id", new { uid = UserId, id });
        if (visible is null) return NotFound(new { error = "Alert nahi mila." });

        var rows = await conn.QueryAsync<SightingDto>(@"
            select st_y(location::geometry) as lat, st_x(location::geometry) as lng, created_at
            from alert_sightings where alert_id = @id order by created_at", new { id });
        return Ok(rows);
    }

    [HttpPost("{id:guid}/sighting")]
    public async Task<IActionResult> AddSighting(Guid id, SightingRequest req)
    {
        if (req.Lat is < -90 or > 90 || req.Lng is < -180 or > 180)
            return BadRequest(new { error = "Location sahi nahi hai." });

        await using var conn = await db.OpenConnectionAsync();
        var visible = await conn.QueryFirstOrDefaultAsync<AlertDto>(
            AlertSelect + " and a.id = @id", new { uid = UserId, id });
        if (visible is null) return NotFound(new { error = "Alert nahi mila." });
        if (visible.Status != "active" || (DateTime.UtcNow - visible.CreatedAt.ToUniversalTime()).TotalHours > 3)
            return BadRequest(new { error = "Ye alert ab track nahi ho sakta." });

        var mine = await conn.ExecuteScalarAsync<int>(
            "select count(*) from alert_sightings where alert_id = @id and user_id = @uid and created_at > now() - interval '1 minute'",
            new { id, uid = UserId });
        if (mine >= 3) return StatusCode(429, new { error = "Thora ruk kar dobara bhejein." });

        await conn.ExecuteAsync(@"
            insert into alert_sightings (alert_id, user_id, location)
            values (@id, @uid, st_setsrid(st_makepoint(@lng, @lat), 4326)::geography)",
            new { id, uid = UserId, lat = req.Lat, lng = req.Lng });

        var owner = await conn.ExecuteScalarAsync<Guid>("select user_id from alerts where id = @id", new { id });
        if (owner != UserId)
            await notifier.PushToUserAsync(owner, "📍 Chor ki nayi location",
                "Kisi padosi ne chor ko nayi jagah dekha. Map dekhein.", $"/alert/{id}");

        return Ok(new { ok = true });
    }
}