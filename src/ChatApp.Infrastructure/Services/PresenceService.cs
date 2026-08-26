using System.Collections.Concurrent;
using ChatApp.Application.Interfaces;
using ChatApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Services;

public class PresenceService : IPresenceService
{
    private readonly ChatAppDbContext _db;
    // Maps userId -> set of connectionIds (HashSet-equivalent: ConcurrentDictionary<string, byte>)
    private static readonly ConcurrentDictionary<Guid, ConcurrentDictionary<string, byte>> _connections = new();

    public PresenceService(ChatAppDbContext db) => _db = db;

    public async Task UserConnectedAsync(Guid userId, string connectionId, CancellationToken ct = default)
    {
        var conns = _connections.GetOrAdd(userId, _ => new ConcurrentDictionary<string, byte>());
        conns.TryAdd(connectionId, 0);

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
            conns.TryRemove(connectionId, out _);

            if (conns.IsEmpty)
            {
                // Try to remove the user entry; if another connection was added in the meantime, leave it
                _connections.TryRemove(new KeyValuePair<Guid, ConcurrentDictionary<string, byte>>(userId, conns));
                // Re-check after remove (in case TryUpdate failed because of concurrent addition)
                if (_connections.TryGetValue(userId, out var stillThere) && !stillThere.IsEmpty)
                {
                    return;  // still has connections
                }

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
        IReadOnlyList<Guid> result = _connections
            .Where(kv => !kv.Value.IsEmpty)
            .Select(kv => kv.Key)
            .ToList();
        return Task.FromResult(result);
    }

    public async Task<DateTime> GetUserLastSeenAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        return user?.LastSeen ?? DateTime.UtcNow;
    }
}
