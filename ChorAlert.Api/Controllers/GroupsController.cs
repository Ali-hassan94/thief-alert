using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace ChorAlert.Api.Controllers;

public record CreateGroupRequest(string Name);
public record JoinGroupRequest(string Code);
public class GroupDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Code { get; set; } = "";
    public int Members { get; set; }
}

[ApiController]
[Route("api/groups")]
[Authorize]
public class GroupsController(NpgsqlDataSource db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirst("sub")!.Value);

    private static string NewCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        return new string(Enumerable.Range(0, 6).Select(_ => chars[Random.Shared.Next(chars.Length)]).ToArray());
    }

    [HttpGet]
    public async Task<IActionResult> Mine()
    {
        await using var conn = await db.OpenConnectionAsync();
        var rows = await conn.QueryAsync<GroupDto>(@"
            select g.id, g.name, g.code,
                   (select count(*) from group_members m where m.group_id = g.id)::int as members
            from mohalla_groups g
            join group_members gm on gm.group_id = g.id
            where gm.user_id = @uid order by g.created_at desc", new { uid = UserId });
        return Ok(rows);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateGroupRequest req)
    {
        var name = (req.Name ?? "").Trim();
        if (name.Length is < 2 or > 50) return BadRequest(new { error = "Naam 2 se 50 harf ka rakhein." });

        await using var conn = await db.OpenConnectionAsync();
        var count = await conn.ExecuteScalarAsync<int>(
            "select count(*) from group_members where user_id = @uid", new { uid = UserId });
        if (count >= 5) return BadRequest(new { error = "Aap zyada se zyada 5 groups me ho sakte hain." });

        var id = await conn.ExecuteScalarAsync<Guid>(
            "insert into mohalla_groups (name, code, owner_id) values (@name, @code, @uid) returning id",
            new { name, code = NewCode(), uid = UserId });
        await conn.ExecuteAsync("insert into group_members (group_id, user_id) values (@id, @uid)",
            new { id, uid = UserId });
        return Ok(new { id });
    }

    [HttpPost("join")]
    public async Task<IActionResult> Join(JoinGroupRequest req)
    {
        var code = (req.Code ?? "").Trim().ToUpperInvariant();
        await using var conn = await db.OpenConnectionAsync();
        var gid = await conn.ExecuteScalarAsync<Guid?>(
            "select id from mohalla_groups where code = @code", new { code });
        if (gid is null) return NotFound(new { error = "Ye code galat hai." });

        await conn.ExecuteAsync(
            "insert into group_members (group_id, user_id) values (@gid, @uid) on conflict do nothing",
            new { gid, uid = UserId });
        return Ok(new { ok = true });
    }

    [HttpPost("{id:guid}/leave")]
    public async Task<IActionResult> Leave(Guid id)
    {
        await using var conn = await db.OpenConnectionAsync();
        await conn.ExecuteAsync("delete from group_members where group_id = @id and user_id = @uid",
            new { id, uid = UserId });
        return Ok(new { ok = true });
    }
}