namespace ChorAlert.Api.Models;

public record CreateAlertRequest(double Lat, double Lng, string? Description, string? Source, string? PhotoUrl);
public record VoteRequest(string Vote);
public record HeartbeatRequest(int? Battery, bool? Charging);
public record SightingRequest(double Lat, double Lng);

public class SightingDto
{
    public double Lat { get; set; }
    public double Lng { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class Recipient
{
    public string Endpoint { get; set; } = "";
    public string P256dh { get; set; } = "";
    public string Auth { get; set; } = "";
    public int DistanceM { get; set; }
}

public class AlertDto
{
    public Guid Id { get; set; }
    public string? PhotoUrl { get; set; }
    public int Confirms { get; set; }
    public int Fakes { get; set; }
    public string? MyVote { get; set; }
    public string? Description { get; set; }
    public string Status { get; set; } = "active";
    public DateTime CreatedAt { get; set; }
    public double Lat { get; set; }
    public double Lng { get; set; }
    public int? DistanceM { get; set; }
    public bool Mine { get; set; }
}