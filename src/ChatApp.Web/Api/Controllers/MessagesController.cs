using ChatApp.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.Web.Api.Controllers;

[ApiController]
[Route("api/messages")]
[Authorize]
public class MessagesController : ControllerBase
{
    private readonly IMessageService _messages;

    public MessagesController(IMessageService messages) => _messages = messages;

    private Guid UserId()
    {
        var id = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
              ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(id, out var g) ? g : Guid.Empty;
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _messages.DeleteAsync(UserId(), id, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        await _messages.MarkReadAsync(UserId(), id, ct);
        return Ok(new { Success = true });
    }

    [HttpPost("{id:guid}/forward/{conversationId:guid}")]
    public async Task<IActionResult> Forward(Guid id, Guid conversationId, CancellationToken ct)
    {
        var dto = await _messages.ForwardAsync(UserId(), id, conversationId, ct);
        return Ok(dto);
    }
}
