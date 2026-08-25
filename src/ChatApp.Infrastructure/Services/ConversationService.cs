using AutoMapper;
using ChatApp.Application.Interfaces;
using ChatApp.Contracts.Dtos;
using ChatApp.Domain.Entities;
using ChatApp.Domain.Exceptions;
using ChatApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Services;

public class ConversationService : IConversationService
{
    private readonly ChatAppDbContext _db;
    private readonly IMapper _mapper;

    public ConversationService(ChatAppDbContext db, IMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    public async Task<ConversationDto> CreateOrGetAsync(Guid currentUserId, Guid otherUserId, CancellationToken ct = default)
    {
        if (currentUserId == otherUserId)
            throw new DomainException("امکان ایجاد گفتگو با خود وجود ندارد.");

        var other = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == otherUserId, ct);
        if (other is null) throw new EntityNotFoundException("User", otherUserId);

        // Find existing private conversation between these two users
        var existing = await (
            from c in _db.Conversations.AsNoTracking()
            where !c.IsGroup && c.DeletedAt == null
            where c.Participants.Any(p => p.UserId == currentUserId)
               && c.Participants.Any(p => p.UserId == otherUserId)
            select c
        ).FirstOrDefaultAsync(ct);

        if (existing is not null)
        {
            var dto = _mapper.Map<ConversationDto>(existing);
            dto.OtherParticipant = _mapper.Map<UserSummaryDto>(other);
            dto.UnreadCount = await GetUnreadCountAsync(currentUserId, existing.Id, ct);
            return dto;
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

        var result = _mapper.Map<ConversationDto>(conv);
        result.OtherParticipant = _mapper.Map<UserSummaryDto>(other);
        return result;
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
            var dto = _mapper.Map<ConversationDto>(c);
            // Other participant (for private)
            var otherParticipant = await (
                from p in _db.ConversationParticipants.AsNoTracking()
                join u in _db.Users.AsNoTracking() on p.UserId equals u.Id
                where p.ConversationId == c.Id && p.UserId != currentUserId
                select u
            ).FirstOrDefaultAsync(ct);
            dto.OtherParticipant = otherParticipant is not null ? _mapper.Map<UserSummaryDto>(otherParticipant) : null;
            dto.UnreadCount = await GetUnreadCountAsync(currentUserId, c.Id, ct);
            result.Add(dto);
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
        var dto = _mapper.Map<ConversationDto>(conv);
        var other = await (
            from p in _db.ConversationParticipants.AsNoTracking()
            join u in _db.Users.AsNoTracking() on p.UserId equals u.Id
            where p.ConversationId == conversationId && p.UserId != currentUserId
            select u
        ).FirstOrDefaultAsync(ct);
        dto.OtherParticipant = other is not null ? _mapper.Map<UserSummaryDto>(other) : null;
        dto.UnreadCount = await GetUnreadCountAsync(currentUserId, conversationId, ct);
        return dto;
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
            select p.LastReadAt
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
