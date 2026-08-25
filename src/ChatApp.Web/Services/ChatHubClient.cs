using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.JSInterop;
using System.Collections.Concurrent;

namespace ChatApp.Web.Services;

/// <summary>
/// Wraps SignalR ChatHub connection for Blazor components.
/// </summary>
public interface IChatHubClient : IAsyncDisposable
{
    Task StartAsync();
    Task StopAsync();
    Task JoinConversationAsync(Guid conversationId);
    Task LeaveConversationAsync(Guid conversationId);
    Task SendTypingAsync(Guid conversationId);
    Task StopTypingAsync(Guid conversationId);
    Task NotifyMessageSentAsync(Guid conversationId, Guid messageId);
    Task NotifyMessageDeliveredAsync(Guid conversationId, Guid messageId);
    Task NotifyMessageReadAsync(Guid conversationId, Guid messageId);

    event Func<HubMessage, Task> OnMessage;
    event Func<Guid, Task> OnUserOnline;
    event Func<Guid, Task> OnUserOffline;
    event Func<TypingPayload, Task> OnUserTyping;
    event Func<TypingPayload, Task> OnUserStoppedTyping;
    event Func<DeliveryPayload, Task> OnMessageDelivered;
    event Func<ReadPayload, Task> OnMessageRead;
    bool IsConnected { get; }
}

public record HubMessage(Guid ConversationId, Guid MessageId, Guid SenderId);
public record TypingPayload(Guid ConversationId, Guid UserId);
public record DeliveryPayload(Guid ConversationId, Guid MessageId, Guid DeliveredTo);
public record ReadPayload(Guid ConversationId, Guid MessageId, Guid ReadBy);

public class ChatHubClient : IChatHubClient
{
    private readonly NavigationManager _nav;
    private readonly IJwtTokenStore _tokens;
    private readonly ILogger<ChatHubClient> _log;
    private HubConnection? _hub;
    private readonly ConcurrentDictionary<Guid, byte> _joinedConversations = new();

    public ChatHubClient(NavigationManager nav, IJwtTokenStore tokens, ILogger<ChatHubClient> log)
    {
        _nav = nav;
        _tokens = tokens;
        _log = log;
    }

    public bool IsConnected => _hub?.State == HubConnectionState.Connected;

    public event Func<HubMessage, Task>? OnMessage;
    public event Func<Guid, Task>? OnUserOnline;
    public event Func<Guid, Task>? OnUserOffline;
    public event Func<TypingPayload, Task>? OnUserTyping;
    public event Func<TypingPayload, Task>? OnUserStoppedTyping;
    public event Func<DeliveryPayload, Task>? OnMessageDelivered;
    public event Func<ReadPayload, Task>? OnMessageRead;

    public async Task StartAsync()
    {
        if (_hub is not null) return;

        var token = await _tokens.GetAccessTokenAsync();
        var hubUrl = _nav.ToAbsoluteUri("/hubs/chat").ToString();

        _hub = new HubConnectionBuilder()
            .WithUrl(hubUrl, opt =>
            {
                opt.AccessTokenProvider = () => Task.FromResult(token);
            })
            .WithAutomaticReconnect(new[] { TimeSpan.Zero, TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(10) })
            .Build();

        _hub.On<Guid, Guid, Guid>("ReceiveMessage", (convId, msgId, senderId) =>
            OnMessage?.Invoke(new HubMessage(convId, msgId, senderId)));
        _hub.On<Guid>("UserOnline", id => OnUserOnline?.Invoke(id));
        _hub.On<Guid>("UserOffline", id => OnUserOffline?.Invoke(id));
        _hub.On<Guid, Guid>("UserTyping", (convId, userId) => OnUserTyping?.Invoke(new TypingPayload(convId, userId)));
        _hub.On<Guid, Guid>("UserStoppedTyping", (convId, userId) => OnUserStoppedTyping?.Invoke(new TypingPayload(convId, userId)));
        _hub.On<Guid, Guid, Guid>("MessageDelivered", (convId, msgId, to) => OnMessageDelivered?.Invoke(new DeliveryPayload(convId, msgId, to)));
        _hub.On<Guid, Guid, Guid>("MessageRead", (convId, msgId, by) => OnMessageRead?.Invoke(new ReadPayload(convId, msgId, by)));

        try
        {
            await _hub.StartAsync();
            _log.LogInformation("SignalR connected.");
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "SignalR connect failed.");
        }
    }

    public async Task StopAsync()
    {
        if (_hub is null) return;
        await _hub.DisposeAsync();
        _hub = null;
    }

    public async Task JoinConversationAsync(Guid conversationId)
    {
        if (_hub is null) return;
        if (!_joinedConversations.TryAdd(conversationId, 0)) return;
        await _hub.InvokeAsync("JoinConversation", conversationId);
    }

    public async Task LeaveConversationAsync(Guid conversationId)
    {
        if (_hub is null) return;
        _joinedConversations.TryRemove(conversationId, out _);
        await _hub.InvokeAsync("LeaveConversation", conversationId);
    }

    public Task SendTypingAsync(Guid conversationId) =>
        _hub?.InvokeAsync("StartTyping", conversationId) ?? Task.CompletedTask;

    public Task StopTypingAsync(Guid conversationId) =>
        _hub?.InvokeAsync("StopTyping", conversationId) ?? Task.CompletedTask;

    public Task NotifyMessageSentAsync(Guid conversationId, Guid messageId) =>
        _hub?.InvokeAsync("NotifyMessageSent", conversationId, messageId) ?? Task.CompletedTask;

    public Task NotifyMessageDeliveredAsync(Guid conversationId, Guid messageId) =>
        _hub?.InvokeAsync("NotifyMessageDelivered", conversationId, messageId) ?? Task.CompletedTask;

    public Task NotifyMessageReadAsync(Guid conversationId, Guid messageId) =>
        _hub?.InvokeAsync("NotifyMessageRead", conversationId, messageId) ?? Task.CompletedTask;

    public async ValueTask DisposeAsync()
    {
        if (_hub is not null) await _hub.DisposeAsync();
    }
}
