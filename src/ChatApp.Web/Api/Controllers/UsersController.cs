using ChatApp.Application.Interfaces;
using ChatApp.Contracts.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.Web.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserService _users;

    public UsersController(IUserService users) => _users = users;

    private Guid UserId()
    {
        var id = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
              ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(id, out var g) ? g : Guid.Empty;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        var list = await _users.ListUsersAsync(UserId(), search, page, pageSize, ct);
        return Ok(list);
    }

    [HttpGet("online")]
    public async Task<IActionResult> Online(CancellationToken ct)
    {
        var list = await _users.GetOnlineUsersAsync(ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var dto = await _users.GetUserAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var dto = await _users.GetProfileAsync(UserId(), ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest req, CancellationToken ct)
    {
        var dto = await _users.UpdateProfileAsync(UserId(), req.FirstName, req.LastName, req.AvatarUrl, req.Bio, ct);
        return Ok(dto);
    }

    [HttpPost("me/presence")]
    public async Task<IActionResult> UpdatePresence([FromBody] bool isOnline, CancellationToken ct)
    {
        await _users.UpdatePresenceAsync(UserId(), isOnline, ct);
        return Ok(new { Success = true });
    }
}
