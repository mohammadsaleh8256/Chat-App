using AutoMapper;
using ChatApp.Application.Interfaces;
using ChatApp.Contracts.Dtos;
using ChatApp.Domain.Entities;
using ChatApp.Domain.Enums;
using ChatApp.Domain.Exceptions;
using ChatApp.Domain.ValueObjects;
using ChatApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Services;

public class AdminService : IAdminService
{
    private readonly ChatAppDbContext _db;
    private readonly IMapper _mapper;
    private readonly IFileStorage _storage;

    public AdminService(ChatAppDbContext db, IMapper mapper, IFileStorage storage)
    {
        _db = db;
        _mapper = mapper;
        _storage = storage;
    }

    public async Task<DashboardStatsDto> GetDashboardStatsAsync(CancellationToken ct = default)
    {
        var totalUsers = await _db.Users.AsNoTracking().CountAsync(u => u.DeletedAt == null, ct);
        var onlineUsers = await _db.Users.AsNoTracking().CountAsync(u => u.IsOnline && u.DeletedAt == null, ct);
        var totalConversations = await _db.Conversations.AsNoTracking().CountAsync(c => c.DeletedAt == null, ct);
        var totalMessages = await _db.Messages.AsNoTracking().CountAsync(m => m.DeletedAt == null, ct);
        var totalAttachments = await _db.MessageAttachments.AsNoTracking().CountAsync(ct);
        var totalAdmins = await _db.Users.AsNoTracking().CountAsync(u => u.Role == UserRole.Admin && u.DeletedAt == null, ct);
        var disabledUsers = await _db.Users.AsNoTracking().CountAsync(u => u.Status == UserStatus.Disabled && u.DeletedAt == null, ct);
        var activeUploads = await _db.FileUploads.AsNoTracking().CountAsync(f => f.Status == UploadStatus.Uploading || f.Status == UploadStatus.Pending, ct);

        long totalSize = 0;
        var sizes = await _db.FileUploads.AsNoTracking().Where(f => f.Status == UploadStatus.Completed).Select(f => f.Size).ToListAsync(ct);
        totalSize = sizes.Sum();

        return new DashboardStatsDto(
            totalUsers, onlineUsers, totalConversations, totalMessages,
            totalAttachments, totalSize, totalAdmins, disabledUsers, activeUploads);
    }

    public async Task<IReadOnlyList<UserDto>> ListUsersAsync(string? search, string? phone, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        var q = _db.Users.AsNoTracking().Where(u => u.DeletedAt == null);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(u => u.FirstName.Contains(s) || u.LastName.Contains(s) || u.FullName.Contains(s));
        }
        if (!string.IsNullOrWhiteSpace(phone))
        {
            var p = phone.Trim();
            // Try normalize
            if (PhoneNumber.TryParse(p, out var pn))
                q = q.Where(u => u.NormalizedPhoneNumber == pn.E164);
            else
                q = q.Where(u => u.PhoneNumber.Contains(p));
        }
        var users = await q.OrderByDescending(u => u.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return _mapper.Map<List<UserDto>>(users);
    }

    public async Task<UserDto?> GetUserAsync(Guid id, CancellationToken ct = default)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);
        return user is null ? null : _mapper.Map<UserDto>(user);
    }

    public async Task<UserDto> ChangeUserRoleAsync(Guid adminId, Guid userId, string role, string? ipAddress, CancellationToken ct = default)
    {
        if (!Enum.TryParse<UserRole>(role, true, out var r)) throw new DomainException($"نقش نامعتبر: {role}");
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct) ?? throw new EntityNotFoundException("User", userId);
        var oldRole = user.Role;
        user.Role = r;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        _db.AuditLogs.Add(new AuditLog
        {
            AdminId = adminId,
            Action = AuditAction.ChangeRole,
            TargetUserId = userId,
            Details = $"Role changed from {oldRole} to {r}",
            IpAddress = ipAddress,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);
        return _mapper.Map<UserDto>(user);
    }

    public async Task<UserDto> ChangeUserStatusAsync(Guid adminId, Guid userId, string status, string? ipAddress, CancellationToken ct = default)
    {
        if (!Enum.TryParse<UserStatus>(status, true, out var s)) throw new DomainException($"وضعیت نامعتبر: {status}");
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct) ?? throw new EntityNotFoundException("User", userId);
        var oldStatus = user.Status;
        user.Status = s;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        _db.AuditLogs.Add(new AuditLog
        {
            AdminId = adminId,
            Action = s == UserStatus.Disabled ? AuditAction.DisableUser : (s == UserStatus.Active ? AuditAction.EnableUser : AuditAction.DeleteUser),
            TargetUserId = userId,
            Details = $"Status changed from {oldStatus} to {s}",
            IpAddress = ipAddress,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);
        return _mapper.Map<UserDto>(user);
    }

    public async Task<IReadOnlyList<ConversationDto>> ListUserConversationsAsync(Guid adminId, Guid userId, string? ipAddress, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var conversations = await (
            from c in _db.Conversations.AsNoTracking()
            where c.DeletedAt == null && c.Participants.Any(p => p.UserId == userId)
            orderby c.LastMessageAt ?? c.CreatedAt descending
            select c
        ).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        var result = new List<ConversationDto>();
        foreach (var c in conversations)
        {
            var dto = _mapper.Map<ConversationDto>(c);
            var others = await (
                from p in _db.ConversationParticipants.AsNoTracking()
                join u in _db.Users.AsNoTracking() on p.UserId equals u.Id
                where p.ConversationId == c.Id && p.UserId != userId
                select u
            ).FirstOrDefaultAsync(ct);
            dto.OtherParticipant = others is not null ? _mapper.Map<UserSummaryDto>(others) : null;
            dto.UnreadCount = 0;
            result.Add(dto);
        }

        _db.AuditLogs.Add(new AuditLog
        {
            AdminId = adminId,
            Action = AuditAction.ViewUser,
            TargetUserId = userId,
            Details = "Admin viewed user conversations",
            IpAddress = ipAddress,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);
        return result;
    }

    public async Task<IReadOnlyList<MessageDto>> ListConversationMessagesAsync(Guid adminId, Guid conversationId, string? ipAddress, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var conv = await _db.Conversations.AsNoTracking().FirstOrDefaultAsync(c => c.Id == conversationId, ct);
        if (conv is null) return Array.Empty<MessageDto>();

        var msgs = await _db.Messages.AsNoTracking()
            .Where(m => m.ConversationId == conversationId && m.DeletedAt == null)
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(ct);

        var senders = await _db.Users.AsNoTracking().Where(u => msgs.Select(m => m.SenderId).Distinct().Contains(u.Id)).ToDictionaryAsync(u => u.Id, ct);
        var attachments = await _db.MessageAttachments.AsNoTracking().Where(a => msgs.Select(m => m.Id).Contains(a.MessageId)).ToListAsync(ct);

        var result = msgs.Select(m => new MessageDto(
            Id: m.Id,
            ConversationId: m.ConversationId,
            SenderId: m.SenderId,
            SenderName: senders.TryGetValue(m.SenderId, out var s) ? s.FullName : "",
            SenderAvatarUrl: senders.TryGetValue(m.SenderId, out var s2) ? s2.AvatarUrl : null,
            Content: m.Content,
            Type: m.Type.ToString(),
            Status: m.Status.ToString(),
            ReplyToMessageId: m.ReplyToMessageId,
            ReplyToPreview: null,
            CreatedAt: m.CreatedAt,
            UpdatedAt: m.UpdatedAt,
            DeletedAt: m.DeletedAt,
            IsEdited: m.IsEdited,
            DeliveredAt: m.DeliveredAt,
            ReadAt: m.ReadAt,
            Attachments: attachments.Where(a => a.MessageId == m.Id).Select(a => new AttachmentDto(
                Id: a.Id, OriginalFileName: a.OriginalFileName, Size: a.Size,
                ContentType: a.ContentType, Type: a.Type.ToString(),
                ThumbnailUrl: a.ThumbnailPath, DownloadUrl: $"/api/files/{a.Id}")).ToList()
        )).ToList();

        _db.AuditLogs.Add(new AuditLog
        {
            AdminId = adminId,
            Action = AuditAction.ViewConversation,
            TargetConversationId = conversationId,
            Details = $"Admin viewed conversation messages ({result.Count})",
            IpAddress = ipAddress,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);
        return result;
    }

    public async Task<IReadOnlyList<AuditLogDto>> ListAuditLogsAsync(DateTime? from, DateTime? to, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        var q = _db.AuditLogs.AsNoTracking();
        if (from.HasValue) q = q.Where(a => a.CreatedAt >= from.Value);
        if (to.HasValue) q = q.Where(a => a.CreatedAt <= to.Value);

        var logs = await q.OrderByDescending(a => a.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        var adminIds = logs.Select(l => l.AdminId).Distinct().ToList();
        var admins = await _db.Users.AsNoTracking().Where(u => adminIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, ct);
        var targetIds = logs.Where(l => l.TargetUserId.HasValue).Select(l => l.TargetUserId!.Value).Distinct().ToList();
        var targets = targetIds.Count > 0
            ? await _db.Users.AsNoTracking().Where(u => targetIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, ct)
            : new Dictionary<Guid, User>();

        return logs.Select(l => new AuditLogDto(
            Id: l.Id,
            AdminId: l.AdminId,
            AdminName: admins.TryGetValue(l.AdminId, out var a) ? a.FullName : "",
            Action: l.Action.ToString(),
            TargetUserId: l.TargetUserId,
            TargetUserName: l.TargetUserId.HasValue && targets.TryGetValue(l.TargetUserId.Value, out var t) ? t.FullName : null,
            TargetConversationId: l.TargetConversationId,
            TargetMessageId: l.TargetMessageId,
            TargetAttachmentId: l.TargetAttachmentId,
            Details: l.Details,
            IpAddress: l.IpAddress,
            CreatedAt: l.CreatedAt
        )).ToList();
    }

    public async Task UpdateAdminPhoneAsync(Guid adminId, string newPhone, string? ipAddress, CancellationToken ct = default)
    {
        var phone = PhoneNumber.Create(newPhone);
        var setting = await _db.AppSettings.FirstOrDefaultAsync(s => s.Key == "INITIAL_ADMIN_PHONE", ct);
        if (setting is null)
        {
            setting = new AppSetting
            {
                Key = "INITIAL_ADMIN_PHONE",
                Value = phone.E164,
                Description = "Phone number of the initial admin user (granted Admin role on registration).",
                UpdatedAt = DateTime.UtcNow
            };
            _db.AppSettings.Add(setting);
        }
        else
        {
            setting.Value = phone.E164;
            setting.UpdatedAt = DateTime.UtcNow;
        }

        _db.AuditLogs.Add(new AuditLog
        {
            AdminId = adminId,
            Action = AuditAction.ChangeAdmin,
            Details = $"Admin phone changed to {phone.E164}",
            IpAddress = ipAddress,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);
    }

    public async Task<string> GetAdminPhoneAsync(CancellationToken ct = default)
    {
        var setting = await _db.AppSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == "INITIAL_ADMIN_PHONE", ct);
        return setting?.Value ?? string.Empty;
    }

    public async Task<IReadOnlyList<MessageDto>> SearchMessagesAsync(Guid adminId, string query, int page, int pageSize, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query)) return Array.Empty<MessageDto>();
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        var q = query.Trim();

        var msgs = await _db.Messages.AsNoTracking()
            .Where(m => m.DeletedAt == null && m.Content.Contains(q))
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(ct);

        var senders = await _db.Users.AsNoTracking().Where(u => msgs.Select(m => m.SenderId).Distinct().Contains(u.Id)).ToDictionaryAsync(u => u.Id, ct);

        var result = msgs.Select(m => new MessageDto(
            Id: m.Id,
            ConversationId: m.ConversationId,
            SenderId: m.SenderId,
            SenderName: senders.TryGetValue(m.SenderId, out var s) ? s.FullName : "",
            SenderAvatarUrl: senders.TryGetValue(m.SenderId, out var s2) ? s2.AvatarUrl : null,
            Content: m.Content,
            Type: m.Type.ToString(),
            Status: m.Status.ToString(),
            ReplyToMessageId: m.ReplyToMessageId,
            ReplyToPreview: null,
            CreatedAt: m.CreatedAt,
            UpdatedAt: m.UpdatedAt,
            DeletedAt: m.DeletedAt,
            IsEdited: m.IsEdited,
            DeliveredAt: m.DeliveredAt,
            ReadAt: m.ReadAt,
            Attachments: new List<AttachmentDto>()
        )).ToList();

        _db.AuditLogs.Add(new AuditLog
        {
            AdminId = adminId,
            Action = AuditAction.ViewMessage,
            Details = $"Admin searched messages for '{query}'",
            IpAddress = null,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);
        return result;
    }
}
