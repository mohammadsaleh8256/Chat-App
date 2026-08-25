using AutoMapper;
using ChatApp.Application.Interfaces;
using ChatApp.Contracts.Dtos;
using ChatApp.Domain.Entities;
using ChatApp.Domain.Enums;
using ChatApp.Domain.Exceptions;
using ChatApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Services;

public class MessageService : IMessageService
{
    private readonly ChatAppDbContext _db;
    private readonly IMapper _mapper;

    public MessageService(ChatAppDbContext db, IMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    public async Task<MessageDto> SendTextAsync(Guid senderId, Guid conversationId, string content, Guid? replyToMessageId, CancellationToken ct = default)
    {
        await AssertMemberAsync(senderId, conversationId, ct);

        var msg = new Message
        {
            ConversationId = conversationId,
            SenderId = senderId,
            Content = content.Trim(),
            Type = MessageType.Text,
            Status = MessageStatus.Sent,
            ReplyToMessageId = replyToMessageId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Messages.Add(msg);

        // Update conversation last message
        var conv = await _db.Conversations.FirstOrDefaultAsync(c => c.Id == conversationId, ct);
        if (conv is not null)
        {
            conv.LastMessageAt = msg.CreatedAt;
            conv.LastMessagePreview = msg.Content.Length > 200 ? msg.Content[..200] : msg.Content;
            conv.UpdatedAt = msg.CreatedAt;
        }
        await _db.SaveChangesAsync(ct);

        return await BuildDtoAsync(msg.Id, ct);
    }

    public async Task<MessageDto> SendWithAttachmentAsync(Guid senderId, Guid conversationId, string? content, Guid attachmentId, string messageType, Guid? replyToMessageId, CancellationToken ct = default)
    {
        await AssertMemberAsync(senderId, conversationId, ct);

        if (!Enum.TryParse<MessageType>(messageType, true, out var type))
            type = MessageType.File;

        var upload = await _db.FileUploads.FirstOrDefaultAsync(f => f.Id == attachmentId, ct)
            ?? throw new EntityNotFoundException("FileUpload", attachmentId);
        if (upload.UserId != senderId)
            throw new AuthorizationException();

        var attachmentType = DetermineAttachmentType(upload.OriginalFileName, upload.ContentType);
        var msg = new Message
        {
            ConversationId = conversationId,
            SenderId = senderId,
            Content = content?.Trim() ?? string.Empty,
            Type = type,
            Status = MessageStatus.Sent,
            ReplyToMessageId = replyToMessageId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Messages.Add(msg);
        await _db.SaveChangesAsync(ct);

        var ma = new MessageAttachment
        {
            MessageId = msg.Id,
            FileUploadId = upload.Id,
            Type = attachmentType,
            OriginalFileName = upload.OriginalFileName,
            StoredFileName = upload.StoredFileName,
            RelativePath = upload.RelativePath,
            ContentType = upload.ContentType,
            Size = upload.Size
        };
        _db.MessageAttachments.Add(ma);

        // Update conversation preview
        var conv = await _db.Conversations.FirstOrDefaultAsync(c => c.Id == conversationId, ct);
        if (conv is not null)
        {
            conv.LastMessageAt = msg.CreatedAt;
            conv.LastMessagePreview = $"📎 {upload.OriginalFileName}";
            conv.UpdatedAt = msg.CreatedAt;
        }
        await _db.SaveChangesAsync(ct);

        return await BuildDtoAsync(msg.Id, ct);
    }

    public async Task<IReadOnlyList<MessageDto>> GetMessagesAsync(Guid userId, Guid conversationId, int page, int pageSize, CancellationToken ct = default)
    {
        await AssertMemberAsync(userId, conversationId, ct);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var msgs = await _db.Messages.AsNoTracking()
            .Where(m => m.ConversationId == conversationId && m.DeletedAt == null)
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(ct);

        return await BuildDtosAsync(msgs, ct);
    }

    public async Task<IReadOnlyList<MessageDto>> GetMessagesBeforeAsync(Guid userId, Guid conversationId, DateTime before, int pageSize, CancellationToken ct = default)
    {
        await AssertMemberAsync(userId, conversationId, ct);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var msgs = await _db.Messages.AsNoTracking()
            .Where(m => m.ConversationId == conversationId && m.DeletedAt == null && m.CreatedAt < before)
            .OrderByDescending(m => m.CreatedAt)
            .Take(pageSize)
            .ToListAsync(ct);

        return await BuildDtosAsync(msgs, ct);
    }

    public async Task<MessageDto?> GetMessageAsync(Guid userId, Guid messageId, CancellationToken ct = default)
    {
        var msg = await _db.Messages.AsNoTracking().FirstOrDefaultAsync(m => m.Id == messageId, ct);
        if (msg is null) return null;
        await AssertMemberAsync(userId, msg.ConversationId, ct);
        return await BuildDtoAsync(msg.Id, ct);
    }

    public async Task MarkDeliveredAsync(Guid userId, Guid conversationId, CancellationToken ct = default)
    {
        var msgs = await _db.Messages
            .Where(m => m.ConversationId == conversationId && m.SenderId != userId && m.Status == MessageStatus.Sent && m.DeletedAt == null)
            .ToListAsync(ct);
        foreach (var m in msgs)
        {
            m.Status = MessageStatus.Delivered;
            m.DeliveredAt ??= DateTime.UtcNow;
        }
        await _db.SaveChangesAsync(ct);
    }

    public async Task MarkReadAsync(Guid userId, Guid messageId, CancellationToken ct = default)
    {
        var msg = await _db.Messages.FirstOrDefaultAsync(m => m.Id == messageId, ct);
        if (msg is null) return;
        await AssertMemberAsync(userId, msg.ConversationId, ct);

        if (msg.SenderId != userId && msg.Status != MessageStatus.Read)
        {
            msg.Status = MessageStatus.Read;
            msg.ReadAt ??= DateTime.UtcNow;
        }

        // Add read receipt (idempotent)
        var receiptExists = await _db.MessageReadReceipts.AnyAsync(r => r.MessageId == messageId && r.UserId == userId, ct);
        if (!receiptExists && msg.SenderId != userId)
        {
            _db.MessageReadReceipts.Add(new MessageReadReceipt
            {
                MessageId = messageId,
                UserId = userId,
                ReadAt = DateTime.UtcNow
            });
        }

        // Mark all prior unread messages in this conversation as read too
        var prior = await _db.Messages
            .Where(m => m.ConversationId == msg.ConversationId && m.SenderId != userId && m.Status != MessageStatus.Read && m.CreatedAt <= msg.CreatedAt)
            .ToListAsync(ct);
        foreach (var p in prior)
        {
            p.Status = MessageStatus.Read;
            p.ReadAt ??= DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid userId, Guid messageId, CancellationToken ct = default)
    {
        var msg = await _db.Messages.FirstOrDefaultAsync(m => m.Id == messageId, ct)
            ?? throw new EntityNotFoundException("Message", messageId);
        if (msg.SenderId != userId)
            throw new AuthorizationException("فقط فرستنده می‌تواند پیام را حذف کند.");
        msg.DeletedAt = DateTime.UtcNow;
        msg.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<MessageDto> ForwardAsync(Guid userId, Guid messageId, Guid targetConversationId, CancellationToken ct = default)
    {
        var orig = await _db.Messages.AsNoTracking().FirstOrDefaultAsync(m => m.Id == messageId, ct)
            ?? throw new EntityNotFoundException("Message", messageId);
        await AssertMemberAsync(userId, targetConversationId, ct);

        var msg = new Message
        {
            ConversationId = targetConversationId,
            SenderId = userId,
            Content = orig.Content,
            Type = orig.Type,
            Status = MessageStatus.Sent,
            ForwardedFromMessageId = messageId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Messages.Add(msg);

        var conv = await _db.Conversations.FirstOrDefaultAsync(c => c.Id == targetConversationId, ct);
        if (conv is not null)
        {
            conv.LastMessageAt = msg.CreatedAt;
            conv.LastMessagePreview = msg.Content.Length > 200 ? msg.Content[..200] : msg.Content;
            conv.UpdatedAt = msg.CreatedAt;
        }
        await _db.SaveChangesAsync(ct);

        // Copy attachments if any
        var attachments = await _db.MessageAttachments.AsNoTracking().Where(a => a.MessageId == messageId).ToListAsync(ct);
        foreach (var a in attachments)
        {
            _db.MessageAttachments.Add(new MessageAttachment
            {
                MessageId = msg.Id,
                FileUploadId = a.FileUploadId,
                Type = a.Type,
                OriginalFileName = a.OriginalFileName,
                StoredFileName = a.StoredFileName,
                RelativePath = a.RelativePath,
                ContentType = a.ContentType,
                Size = a.Size,
                ThumbnailPath = a.ThumbnailPath
            });
        }
        await _db.SaveChangesAsync(ct);

        return await BuildDtoAsync(msg.Id, ct);
    }

    public Task<int> GetUnreadCountAsync(Guid userId, Guid conversationId, CancellationToken ct = default)
    {
        return (
            from p in _db.ConversationParticipants.AsNoTracking()
            where p.ConversationId == conversationId && p.UserId == userId
            select p.LastReadAt
        ).SelectMany(lastRead => _db.Messages.AsNoTracking().Where(m =>
            m.ConversationId == conversationId &&
            m.SenderId != userId &&
            m.DeletedAt == null &&
            (lastRead == null || m.CreatedAt > lastRead)))
         .CountAsync(ct);
    }

    private async Task AssertMemberAsync(Guid userId, Guid conversationId, CancellationToken ct)
    {
        var isMember = await _db.ConversationParticipants.AnyAsync(p => p.ConversationId == conversationId && p.UserId == userId, ct);
        if (!isMember) throw new AuthorizationException();
    }

    private async Task<MessageDto> BuildDtoAsync(Guid msgId, CancellationToken ct)
    {
        var list = await BuildDtosAsync(new List<Message> { (await _db.Messages.AsNoTracking().FirstAsync(m => m.Id == msgId, ct)) }, ct);
        return list[0];
    }

    private async Task<IReadOnlyList<MessageDto>> BuildDtosAsync(List<Message> msgs, CancellationToken ct)
    {
        if (msgs.Count == 0) return Array.Empty<MessageDto>();
        var ids = msgs.Select(m => m.Id).ToList();
        var senders = await _db.Users.AsNoTracking().Where(u => msgs.Select(m => m.SenderId).Distinct().Contains(u.Id)).ToDictionaryAsync(u => u.Id, ct);
        var replyIds = msgs.Where(m => m.ReplyToMessageId.HasValue).Select(m => m.ReplyToMessageId!.Value).ToList();
        var replies = replyIds.Count > 0
            ? await _db.Messages.AsNoTracking().Where(m => replyIds.Contains(m.Id)).ToDictionaryAsync(m => m.Id, ct)
            : new Dictionary<Guid, Message>();
        var attachments = await _db.MessageAttachments.AsNoTracking().Where(a => ids.Contains(a.MessageId)).ToListAsync(ct);

        var result = new List<MessageDto>();
        foreach (var m in msgs)
        {
            var dto = new MessageDto(
                Id: m.Id,
                ConversationId: m.ConversationId,
                SenderId: m.SenderId,
                SenderName: senders.TryGetValue(m.SenderId, out var s) ? s.FullName : "",
                SenderAvatarUrl: senders.TryGetValue(m.SenderId, out var s2) ? s2.AvatarUrl : null,
                Content: m.Content,
                Type: m.Type.ToString(),
                Status: m.Status.ToString(),
                ReplyToMessageId: m.ReplyToMessageId,
                ReplyToPreview: m.ReplyToMessageId.HasValue && replies.TryGetValue(m.ReplyToMessageId.Value, out var r) ? r.Content : null,
                CreatedAt: m.CreatedAt,
                UpdatedAt: m.UpdatedAt,
                DeletedAt: m.DeletedAt,
                IsEdited: m.IsEdited,
                DeliveredAt: m.DeliveredAt,
                ReadAt: m.ReadAt,
                Attachments: attachments.Where(a => a.MessageId == m.Id).Select(a => new AttachmentDto(
                    Id: a.Id,
                    OriginalFileName: a.OriginalFileName,
                    Size: a.Size,
                    ContentType: a.ContentType,
                    Type: a.Type.ToString(),
                    ThumbnailUrl: a.ThumbnailPath,
                    DownloadUrl: $"/api/files/{a.Id}"
                )).ToList()
            );
            result.Add(dto);
        }
        return result;
    }

    private static AttachmentType DetermineAttachmentType(string fileName, string contentType)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext switch
        {
            ".jpg" or ".jpeg" or ".png" or ".gif" or ".webp" or ".bmp" => AttachmentType.Image,
            ".mp4" or ".mov" or ".avi" or ".mkv" or ".webm" => AttachmentType.Video,
            ".mp3" or ".wav" or ".ogg" or ".m4a" or ".flac" => AttachmentType.Audio,
            ".pdf" => AttachmentType.Pdf,
            ".zip" => AttachmentType.Zip,
            ".rar" => AttachmentType.Rar,
            ".doc" or ".docx" => AttachmentType.Document,
            ".xls" or ".xlsx" => AttachmentType.Spreadsheet,
            ".ppt" or ".pptx" => AttachmentType.Presentation,
            ".txt" or ".md" => AttachmentType.Text,
            _ => AttachmentType.Other
        };
    }
}
