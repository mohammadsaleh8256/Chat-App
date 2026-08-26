using ChatApp.Application.Interfaces;
using ChatApp.Contracts.Dtos;
using ChatApp.Infrastructure.Mapping;
using ChatApp.Domain.Entities;
using ChatApp.Domain.Exceptions;
using ChatApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Services;

public class ConversationService : IConversationService
{
    private readonly ChatAppDbContext _db;

    public ConversationService(ChatAppDbContext db) => _db = db;

    public async Task<ConversationDto> CreateOrGetAsync(Guid currentUserId, Guid otherUserId, CancellationToken ct = default)
    {
        if (currentUserId == otherUserId)
            throw new DomainException("امکان ایجاد گفتگو با خود وجود ندارد.");

        var other = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == otherUserId, ct);
        if (other is null) throw new EntityNotFoundException("User", otherUserId);

        // Find existing private conversation
        var existing = await (
            from c in _db.Conversations.AsNoTracking()
            where !c.IsGroup && c.DeletedAt == null
            where c.Participants.Any(p => p.UserId == currentUserId)
               && c.Participants.Any(p => p.UserId == otherUserId)
            select c
        ).FirstOrDefaultAsync(ct);

        if (existing is not null)
        {
            var unread = await GetUnreadCountAsync(currentUserId, existing.Id, ct);
            return existing.ToDto(other, unread);
        }

        var conv = new Conversation
        {
            IsGroup = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Conversations.Add(conv);
        _db.ConversationParticipants.Add(new ConversationParticipant
        {
            ConversationId = conv.Id,
            UserId = currentUserId,
            JoinedAt = DateTime.UtcNow
        });
        _db.ConversationParticipants.Add(new ConversationParticipant
        {
            ConversationId = conv.Id,
            UserId = otherUserId,
            JoinedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);

        return conv.ToDto(other, 0);
    }

    public async Task<IReadOnlyList<ConversationDto>> ListConversationsAsync(Guid currentUserId, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var conversations = await (
            from c in _db.Conversations.AsNoTracking()
            where c.DeletedAt == null && c.Participants.Any(p => p.UserId == currentUserId)
            orderby c.LastMessageAt ?? c.CreatedAt descending
            select c
        ).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        var result = new List<ConversationDto>();
        foreach (var c in conversations)
        {
            var otherParticipant = await (
                from p in _db.ConversationParticipants.AsNoTracking()
                join u in _db.Users.AsNoTracking() on p.UserId equals u.Id
                where p.ConversationId == c.Id && p.UserId != currentUserId
                select u
            ).FirstOrDefaultAsync(ct);
            var unread = await GetUnreadCountAsync(currentUserId, c.Id, ct);
            result.Add(c.ToDto(otherParticipant, unread));
        }
        return result;
    }

    public async Task<ConversationDto?> GetConversationAsync(Guid currentUserId, Guid conversationId, CancellationToken ct = default)
    {
        var conv = await _db.Conversations.AsNoTracking().FirstOrDefaultAsync(c => c.Id == conversationId, ct);
        if (conv is null) return null;

        var isMember = await _db.ConversationParticipants
            .AnyAsync(p => p.ConversationId == conversationId && p.UserId == currentUserId, ct);
        if (!isMember) throw new AuthorizationException();

        var other = await (
            from p in _db.ConversationParticipants.AsNoTracking()
            join u in _db.Users.AsNoTracking() on p.UserId equals u.Id
            where p.ConversationId == conversationId && p.UserId != currentUserId
            select u
        ).FirstOrDefaultAsync(ct);
        var unread = await GetUnreadCountAsync(currentUserId, conversationId, ct);
        return conv.ToDto(other, unread);
    }

    public async Task<bool> BelongsToConversationAsync(Guid userId, Guid conversationId, CancellationToken ct = default)
        => await _db.ConversationParticipants.AnyAsync(p => p.ConversationId == conversationId && p.UserId == userId, ct);

    public async Task MarkConversationReadAsync(Guid userId, Guid conversationId, CancellationToken ct = default)
    {
        var p = await _db.ConversationParticipants.FirstOrDefaultAsync(x => x.ConversationId == conversationId && x.UserId == userId, ct);
        if (p is null) return;
        p.LastReadAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<int> GetUnreadCountAsync(Guid userId, Guid conversationId, CancellationToken ct = default)
    {
        var lastReadAt = await (
            from p in _db.ConversationParticipants.AsNoTracking()
            where p.ConversationId == conversationId && p.UserId == userId
            select (DateTime?)p.LastReadAt
        ).FirstOrDefaultAsync(ct);

        var q = _db.Messages.AsNoTracking().Where(m =>
            m.ConversationId == conversationId &&
            m.DeletedAt == null &&
            m.SenderId != userId);
        if (lastReadAt.HasValue)
            q = q.Where(m => m.CreatedAt > lastReadAt.Value);
        return await q.CountAsync(ct);
    }
}
