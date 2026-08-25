using System.Security.Claims;
using ChatApp.Application.Interfaces;
using Microsoft.AspNetCore.Authentication.JwtBearer;

namespace ChatApp.Web.Services;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _http;

    public CurrentUserService(IHttpContextAccessor http) => _http = http;

    public Guid? UserId
    {
        get
        {
            var id = _http.HttpContext?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                  ?? _http.HttpContext?.User?.FindFirst("sub")?.Value;
            return Guid.TryParse(id, out var g) ? g : null;
        }
    }

    public string? PhoneNumber => _http.HttpContext?.User?.FindFirst(ClaimTypes.MobilePhone)?.Value
                               ?? _http.HttpContext?.User?.FindFirst("phone")?.Value;

    public string? Role => _http.HttpContext?.User?.FindFirst(ClaimTypes.Role)?.Value;

    public bool IsAuthenticated => _http.HttpContext?.User?.Identity?.IsAuthenticated ?? false;

    public bool IsAdmin => string.Equals(Role, "admin", StringComparison.OrdinalIgnoreCase);

    public string? IpAddress => _http.HttpContext?.Connection?.RemoteIpAddress?.ToString();

    public string? UserAgent => _http.HttpContext?.Request?.Headers.UserAgent.ToString();
}
