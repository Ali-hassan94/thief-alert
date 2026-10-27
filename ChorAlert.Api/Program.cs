using ChorAlert.Api.Services;
using Dapper;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

DefaultTypeMap.MatchNamesWithUnderscores = true;

var supabaseUrl = cfg["Supabase:Url"]!.TrimEnd('/');

builder.Services.AddSingleton(NpgsqlDataSource.Create(cfg.GetConnectionString("Db")!));
builder.Services.AddSingleton<PushService>();
builder.Services.AddHttpClient();
builder.Services.AddSingleton<GeminiService>();
builder.Services.AddSingleton<Notifier>();
builder.Services.AddSingleton<TelegramService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<TelegramService>());
builder.Services.AddHostedService<MonitorService>();

var jwks = new JwksProvider(supabaseUrl, cfg["Supabase:JwtSecret"]);

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = $"{supabaseUrl}/auth/v1",
            ValidateAudience = true,
            ValidAudience = "authenticated",
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKeyResolver = (_, _, _, _) => jwks.GetKeys()
        };
        o.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = ctx =>
            {
                Console.WriteLine("JWT fail: " + ctx.Exception.Message);
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

var origins = cfg.GetSection("Cors:Origins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddControllers();

var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.MapGet("/api/health", () => Results.Ok(new { ok = true })).AllowAnonymous();

app.Run();