using ChatApp.Application.Interfaces;
using ChatApp.Contracts.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.Web.Api.Controllers;

[ApiController]
[Route("api/conversations")]
[Authorize]
public class ConversationsController : ControllerBase
{
    private readonly IConversationService _conversations;
    private readonly IMessageService _messages;

    public ConversationsController(IConversationService conversations, IMessageService messages)
    {
        _conversations = conversations;
        _messages = messages;
    }

    private Guid UserId()
    {
        var id = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
              ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(id, out var g) ? g : Guid.Empty;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        var list = await _conversations.ListConversationsAsync(UserId(), page, pageSize, ct);
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateConversationRequest req, CancellationToken ct)
    {
        var dto = await _conversations.CreateOrGetAsync(UserId(), req.OtherUserId, ct);
        return Ok(dto);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var dto = await _conversations.GetConversationAsync(UserId(), id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        await _conversations.MarkConversationReadAsync(UserId(), id, ct);
        return Ok(new { Success = true });
    }

    [HttpGet("{id:guid}/messages")]
    public async Task<IActionResult> Messages(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        var list = await _messages.GetMessagesAsync(UserId(), id, page, pageSize, ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}/messages/before/{before:datetime}")]
    public async Task<IActionResult> MessagesBefore(Guid id, DateTime before, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        var list = await _messages.GetMessagesBeforeAsync(UserId(), id, before, pageSize, ct);
        return Ok(list);
    }

    [HttpPost("{id:guid}/messages")]
    public async Task<IActionResult> SendMessage(Guid id, [FromBody] SendMessageRequest req, CancellationToken ct)
    {
        var dto = await _messages.SendTextAsync(UserId(), id, req.Content, req.ReplyToMessageId, ct);
        return Ok(dto);
    }
}
