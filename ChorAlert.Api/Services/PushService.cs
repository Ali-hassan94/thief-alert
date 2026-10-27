using System.Net;
using WebPush;

namespace ChorAlert.Api.Services;

public enum PushResult { Ok, Expired, Failed }

public class PushService
{
    private readonly WebPushClient _client = new();
    private readonly VapidDetails _vapid;
    private readonly ILogger<PushService> _log;

    public PushService(IConfiguration cfg, ILogger<PushService> log)
    {
        _log = log;
        _vapid = new VapidDetails(
            cfg["Vapid:Subject"]!,
            cfg["Vapid:PublicKey"]!,
            cfg["Vapid:PrivateKey"]!);
    }

    public async Task<PushResult> SendAsync(string endpoint, string p256dh, string auth, string payload)
    {
        try
        {
            await _client.SendNotificationAsync(new PushSubscription(endpoint, p256dh, auth), payload, _vapid);
            return PushResult.Ok;
        }
        catch (WebPushException ex) when (ex.StatusCode is HttpStatusCode.Gone or HttpStatusCode.NotFound)
        {
            return PushResult.Expired;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Push fail hui");
            return PushResult.Failed;
        }
    }
}