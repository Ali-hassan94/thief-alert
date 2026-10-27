using System.Security.Cryptography;
using ChorAlert.Api.Services;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace ChorAlert.Api.Controllers;

[ApiController]
[Route("api/telegram")]
[Authorize]
public class TelegramController(NpgsqlDataSource db, TelegramService tg) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirst("sub")!.Value);

    [HttpGet("link")]
    public async Task<IActionResult> Link()
    {
        if (!tg.Enabled || string.IsNullOrWhiteSpace(tg.BotName))
            return StatusCode(503, new { error = "Telegram bot abhi set nahi hai." });

        var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(8));
        await using var conn = await db.OpenConnectionAsync();
        await conn.ExecuteAsync(@"
            insert into telegram_links (user_id, code) values (@uid, @code)
            on conflict (user_id) do update set code = @code, chat_id = null",
            new { uid = UserId, code });
        return Ok(new { url = $"https://t.me/{tg.BotName}?start={code}" });
    }

    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        await using var conn = await db.OpenConnectionAsync();
        var linked = await conn.ExecuteScalarAsync<bool>(
            "select exists(select 1 from telegram_links where user_id = @uid and chat_id is not null)",
            new { uid = UserId });
        return Ok(new { linked });
    }
}