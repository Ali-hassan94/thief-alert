using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace ChorAlert.Api.Services;

public class JwksProvider
{
    private readonly string _url;
    private readonly string? _legacySecret;
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(10) };
    private readonly object _lock = new();
    private List<SecurityKey> _keys = new();
    private DateTime _fetched = DateTime.MinValue;

    public JwksProvider(string supabaseUrl, string? legacySecret)
    {
        _url = $"{supabaseUrl}/auth/v1/.well-known/jwks.json";
        _legacySecret = legacySecret;
    }

    public IEnumerable<SecurityKey> GetKeys()
    {
        if (_keys.Count == 0 || DateTime.UtcNow - _fetched > TimeSpan.FromMinutes(10))
        {
            lock (_lock)
            {
                if (_keys.Count == 0 || DateTime.UtcNow - _fetched > TimeSpan.FromMinutes(10))
                {
                    try
                    {
                        var json = _http.GetStringAsync(_url).GetAwaiter().GetResult();
                        var list = new JsonWebKeySet(json).GetSigningKeys().ToList();
                        if (!string.IsNullOrWhiteSpace(_legacySecret))
                            list.Add(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_legacySecret)));
                        _keys = list;
                        _fetched = DateTime.UtcNow;
                    }
                    catch
                    {
                        if (_keys.Count == 0) throw;
                    }
                }
            }
        }
        return _keys;
    }
}