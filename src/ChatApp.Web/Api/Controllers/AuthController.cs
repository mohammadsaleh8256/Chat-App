using ChatApp.Application.Interfaces;
using ChatApp.Contracts.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.Web.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth)
    {
        _auth = auth;
    }

    private string? Ip() => HttpContext.Connection.RemoteIpAddress?.ToString();

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req, CancellationToken ct)
    {
        var result = await _auth.RegisterAsync(req.FirstName, req.LastName, req.PhoneNumber, req.Password, Ip(), ct);
        return Ok(result);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        var result = await _auth.LoginAsync(req.PhoneNumber, req.Password, Ip(), ct);
        return Ok(result);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] string refreshToken, CancellationToken ct)
    {
        await _auth.LogoutAsync(refreshToken, Ip(), ct);
        return Ok(new { Success = true });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest req, CancellationToken ct)
    {
        var result = await _auth.RefreshAsync(req.AccessToken, req.RefreshToken, Ip(), ct);
        if (result is null) return Unauthorized(new { Error = "Invalid tokens." });
        return Ok(result);
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var userId = UserUserId();
        if (userId is null) return Unauthorized();
        var dto = await _auth.GetCurrentUserAsync(userId.Value, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    private Guid? UserUserId()
    {
        var id = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
              ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(id, out var g) ? g : null;
    }
}
