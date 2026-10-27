using System.Net.Http.Json;
using System.Text.Json;

namespace ChorAlert.Api.Services;

public record PhotoCheck(bool RealPerson, string Summary);

public class GeminiService(IConfiguration cfg, IHttpClientFactory factory, ILogger<GeminiService> log)
{
    // null = check nahi ho saka (key nahi / error), us surat me alert rokna nahi
    public async Task<PhotoCheck?> CheckAsync(string photoUrl)
    {
        var key = cfg["Gemini:ApiKey"];
        if (string.IsNullOrWhiteSpace(key)) return null;
        try
        {
            var http = factory.CreateClient();
            http.Timeout = TimeSpan.FromSeconds(20);
            var bytes = await http.GetByteArrayAsync(photoUrl);

            var body = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new object[]
                        {
                            new { text = "Ye ghar ke bahar ki security camera photo hai. Kya isme koi ASLI zinda insaan hai? " +
                                         "Poster, TV, saya, janwar, ya khali jagah ho to false. " +
                                         "Sirf JSON do: {\"real_person\": true/false, \"summary\": \"Roman Urdu me max 15 lafz: kitne log, kapre\"}" },
                            new { inline_data = new { mime_type = "image/jpeg", data = Convert.ToBase64String(bytes) } }
                        }
                    }
                },
                generationConfig = new { response_mime_type = "application/json" }
            };

            var req = new HttpRequestMessage(HttpMethod.Post,
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent")
            { Content = JsonContent.Create(body) };
            req.Headers.Add("x-goog-api-key", key);

            var res = await http.SendAsync(req);
            res.EnsureSuccessStatusCode();

            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
            var text = doc.RootElement.GetProperty("candidates")[0].GetProperty("content")
                          .GetProperty("parts")[0].GetProperty("text").GetString()!;
            using var j = JsonDocument.Parse(text);
            return new PhotoCheck(
                j.RootElement.GetProperty("real_person").GetBoolean(),
                j.RootElement.TryGetProperty("summary", out var s) ? s.GetString() ?? "" : "");
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Gemini check fail");
            return null;
        }
    }
}