using System.Security.Claims;
using ChatApp.Application.Interfaces;
using ChatApp.Domain.Enums;
using ChatApp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Infrastructure.SignalR;

[Authorize]
public class ChatHub : Hub
{
    private readonly IPresenceService _presence;
    private readonly ChatAppDbContext _db;
    private readonly IConversationService _conversations;
    private readonly ILogger<ChatHub> _log;

    public ChatHub(IPresenceService presence, ChatAppDbContext db, IConversationService conversations, ILogger<ChatHub> log)
    {
        _presence = presence;
        _db = db;
        _conversations = conversations;
        _log = log;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) { Context.Abort(); return; }

        await _presence.UserConnectedAsync(userId, Context.ConnectionId, Context.ConnectionAborted);

        // Notify contacts that this user is online
        await Clients.All.SendAsync("UserOnline", userId);

        // Auto-join all conversation groups the user is a member of
        var conversationIds = await (
            from p in _db.ConversationParticipants.AsNoTracking()
            where p.UserId == userId
            select p.ConversationId
        ).ToListAsync(Context.ConnectionAborted);

        foreach (var cid in conversationIds)
            await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(cid), Context.ConnectionAborted);

        _log.LogInformation("User {UserId} connected ({ConnectionId})", userId, Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return;

        await _presence.UserDisconnectedAsync(userId, Context.ConnectionId, Context.ConnectionAborted);

        // Only mark offline if no remaining connections
        var stillOnline = await _presence.IsUserOnlineAsync(userId);
        if (!stillOnline)
        {
            await Clients.All.SendAsync("UserOffline", userId);
        }

        _log.LogInformation("User {UserId} disconnected ({ConnectionId})", userId, Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Join a conversation group (server-side authorization enforced).
    /// </summary>
    public async Task JoinConversation(Guid conversationId)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return;

        var isMember = await _conversations.BelongsToConversationAsync(userId, conversationId, Context.ConnectionAborted);
        if (!isMember) throw new HubException("You are not a member of this conversation.");

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(conversationId), Context.ConnectionAborted);
    }

    public async Task LeaveConversation(Guid conversationId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(conversationId), Context.ConnectionAborted);
    }

    /// <summary>
    /// Notify that user started typing in a conversation.
    /// </summary>
    public async Task StartTyping(Guid conversationId)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return;

        var isMember = await _conversations.BelongsToConversationAsync(userId, conversationId, Context.ConnectionAborted);
        if (!isMember) return;

        await Clients.GroupExcept(GroupName(conversationId), new[] { Context.ConnectionId })
            .SendAsync("UserTyping", new { ConversationId = conversationId, UserId = userId }, Context.ConnectionAborted);
    }

    public async Task StopTyping(Guid conversationId)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return;

        await Clients.GroupExcept(GroupName(conversationId), new[] { Context.ConnectionId })
            .SendAsync("UserStoppedTyping", new { ConversationId = conversationId, UserId = userId }, Context.ConnectionAborted);
    }

    /// <summary>
    /// Notify conversation that a new message was sent (called by sender).
    /// </summary>
    public async Task NotifyMessageSent(Guid conversationId, Guid messageId)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return;

        var isMember = await _conversations.BelongsToConversationAsync(userId, conversationId, Context.ConnectionAborted);
        if (!isMember) return;

        // Broadcast to others in the conversation (recipients)
        await Clients.GroupExcept(GroupName(conversationId), new[] { Context.ConnectionId })
            .SendAsync("ReceiveMessage", new { ConversationId = conversationId, MessageId = messageId, SenderId = userId }, Context.ConnectionAborted);
    }

    /// <summary>
    /// Acknowledge message delivery from recipient.
    /// </summary>
    public async Task NotifyMessageDelivered(Guid conversationId, Guid messageId)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return;

        await Clients.Group(GroupName(conversationId))
            .SendAsync("MessageDelivered", new { ConversationId = conversationId, MessageId = messageId, DeliveredTo = userId }, Context.ConnectionAborted);
    }

    /// <summary>
    /// Mark message as read by recipient.
    /// </summary>
    public async Task NotifyMessageRead(Guid conversationId, Guid messageId)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return;

        await Clients.Group(GroupName(conversationId))
            .SendAsync("MessageRead", new { ConversationId = conversationId, MessageId = messageId, ReadBy = userId }, Context.ConnectionAborted);
    }

    public static string GroupName(Guid conversationId) => $"conversation:{conversationId}";

    private Guid GetUserId()
    {
        var idStr = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                 ?? Context.User?.FindFirst("sub")?.Value;
        return Guid.TryParse(idStr, out var id) ? id : Guid.Empty;
    }
}

public static class ChatHubEvents
{
    public const string ReceiveMessage = nameof(ReceiveMessage);
    public const string MessageDelivered = nameof(MessageDelivered);
    public const string MessageRead = nameof(MessageRead);
    public const string MessageDeleted = nameof(MessageDeleted);
    public const string UserTyping = nameof(UserTyping);
    public const string UserStoppedTyping = nameof(UserStoppedTyping);
    public const string UserOnline = nameof(UserOnline);
    public const string UserOffline = nameof(UserOffline);
    public const string ConversationUpdated = nameof(ConversationUpdated);
}
