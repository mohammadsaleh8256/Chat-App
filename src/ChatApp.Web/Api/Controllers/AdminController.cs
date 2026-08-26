using ChatApp.Application.Interfaces;
using ChatApp.Contracts.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.Web.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Policy = "Admin")]
public class AdminController : ControllerBase
{
    private readonly IAdminService _admin;

    public AdminController(IAdminService admin) => _admin = admin;

    private Guid AdminId()
    {
        var id = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
              ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(id, out var g) ? g : Guid.Empty;
    }

    private string? Ip() => HttpContext.Connection.RemoteIpAddress?.ToString();

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(CancellationToken ct)
    {
        var stats = await _admin.GetDashboardStatsAsync(ct);
        return Ok(stats);
    }

    [HttpGet("users")]
    public async Task<IActionResult> Users([FromQuery] string? search, [FromQuery] string? phone, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        var list = await _admin.ListUsersAsync(search, phone, page, pageSize, ct);
        return Ok(list);
    }

    [HttpGet("users/{id:guid}")]
    public async Task<IActionResult> GetUser(Guid id, CancellationToken ct)
    {
        var dto = await _admin.GetUserAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut("users/{id:guid}/role")]
    public async Task<IActionResult> ChangeRole(Guid id, [FromBody] UpdateUserRoleRequest req, CancellationToken ct)
    {
        // Prevent self-demotion / self-lockout: admin cannot change own role.
        if (id == AdminId())
            return BadRequest(new { Error = "نمی‌توانید نقش خودتان را تغییر دهید." });
        var dto = await _admin.ChangeUserRoleAsync(AdminId(), id, req.Role, Ip(), ct);
        return Ok(dto);
    }

    [HttpPut("users/{id:guid}/status")]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] UpdateUserStatusRequest req, CancellationToken ct)
    {
        // Prevent self-disable
        if (id == AdminId())
            return BadRequest(new { Error = "نمی‌توانید حساب خودتان را غیرفعال کنید." });
        var dto = await _admin.ChangeUserStatusAsync(AdminId(), id, req.Status, Ip(), ct);
        return Ok(dto);
    }

    [HttpGet("users/{id:guid}/conversations")]
    public async Task<IActionResult> UserConversations(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        var list = await _admin.ListUserConversationsAsync(AdminId(), id, Ip(), page, pageSize, ct);
        return Ok(list);
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> Conversations([FromQuery] Guid? userId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        if (userId is null) return BadRequest("userId is required.");
        var list = await _admin.ListUserConversationsAsync(AdminId(), userId.Value, Ip(), page, pageSize, ct);
        return Ok(list);
    }

    [HttpGet("conversations/{id:guid}/messages")]
    public async Task<IActionResult> ConversationMessages(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        var list = await _admin.ListConversationMessagesAsync(AdminId(), id, Ip(), page, pageSize, ct);
        return Ok(list);
    }

    [HttpGet("messages/search")]
    public async Task<IActionResult> SearchMessages([FromQuery] string query, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        var list = await _admin.SearchMessagesAsync(AdminId(), query, page, pageSize, ct);
        return Ok(list);
    }

    [HttpGet("audit-logs")]
    public async Task<IActionResult> AuditLogs([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        var list = await _admin.ListAuditLogsAsync(from, to, page, pageSize, ct);
        return Ok(list);
    }

    [HttpGet("settings/admin-phone")]
    public async Task<IActionResult> GetAdminPhone(CancellationToken ct)
    {
        var phone = await _admin.GetAdminPhoneAsync(ct);
        return Ok(new { PhoneNumber = phone });
    }

    [HttpPut("settings/admin-phone")]
    public async Task<IActionResult> UpdateAdminPhone([FromBody] UpdateAdminPhoneRequest req, CancellationToken ct)
    {
        await _admin.UpdateAdminPhoneAsync(AdminId(), req.PhoneNumber, Ip(), ct);
        return Ok(new { Success = true });
    }
}
