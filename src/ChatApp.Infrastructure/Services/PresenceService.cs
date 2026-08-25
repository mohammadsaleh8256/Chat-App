using System.Collections.Concurrent;
using ChatApp.Application.Interfaces;
using ChatApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Services;

public class PresenceService : IPresenceService
{
    private readonly ChatAppDbContext _db;
    private static readonly ConcurrentDictionary<Guid, ConcurrentBag<string>> _connections = new();

    public PresenceService(ChatAppDbContext db) => _db = db;

    public async Task UserConnectedAsync(Guid userId, string connectionId, CancellationToken ct = default)
    {
        var conns = _connections.GetOrAdd(userId, _ => new ConcurrentBag<string>());
        conns.Add(connectionId);

        var user = await _db.Users.FindAsync(new object[] { userId }, ct);
        if (user is not null)
        {
            user.IsOnline = true;
            user.LastSeen = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
    }

    public async Task UserDisconnectedAsync(Guid userId, string connectionId, CancellationToken ct = default)
    {
        if (_connections.TryGetValue(userId, out var conns))
        {
            // ConcurrentBag doesn't support removal easily, so we recreate
            var remaining = conns.Where(c => c != connectionId).ToList();
            while (!_connections.TryUpdate(userId, new ConcurrentBag<string>(remaining), conns))
            {
                conns = _connections.GetOrAdd(userId, _ => new ConcurrentBag<string>());
                remaining = conns.Where(c => c != connectionId).ToList();
            }

            if (remaining.Count == 0)
            {
                _connections.TryRemove(userId, out _);
                var user = await _db.Users.FindAsync(new object[] { userId }, ct);
                if (user is not null)
                {
                    user.IsOnline = false;
                    user.LastSeen = DateTime.UtcNow;
                    await _db.SaveChangesAsync(ct);
                }
            }
        }
    }

    public Task<bool> IsUserOnlineAsync(Guid userId, CancellationToken ct = default)
    {
        return Task.FromResult(_connections.TryGetValue(userId, out var conns) && !conns.IsEmpty);
    }

    public Task<IReadOnlyList<Guid>> GetOnlineUserIdsAsync(CancellationToken ct = default)
    {
        IReadOnlyList<Guid> result = _connections.Keys.Where(k => !_connections[k].IsEmpty).ToList();
        return Task.FromResult(result);
    }

    public async Task<DateTime> GetUserLastSeenAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        return user?.LastSeen ?? DateTime.UtcNow;
    }
}
