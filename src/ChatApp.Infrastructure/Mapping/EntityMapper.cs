using ChatApp.Contracts.Dtos;
using ChatApp.Domain.Entities;

namespace ChatApp.Infrastructure.Mapping;

/// <summary>
/// Manual, allocation-friendly mappers between Domain entities and DTOs.
/// Replaces AutoMapper (which is no longer free for commercial use).
/// </summary>
public static class EntityMapper
{
    public static UserDto ToDto(this User u, bool isOnline = false)
        => new(u.Id, u.FirstName, u.LastName, u.FullName, u.PhoneNumber,
               u.AvatarUrl, isOnline || u.IsOnline, u.LastSeen, u.Role.ToString(),
               u.Status.ToString(), u.CreatedAt);

    public static UserSummaryDto ToSummary(this User u, bool isOnline = false)
        => new()
        {
            Id = u.Id,
            FullName = u.FullName,
            PhoneNumber = u.PhoneNumber,
            AvatarUrl = u.AvatarUrl,
            IsOnline = isOnline || u.IsOnline,
            LastSeen = u.LastSeen
        };

    public static ConversationDto ToDto(this Conversation c, User? other, int unreadCount)
        => new()
        {
            Id = c.Id,
            Title = c.Title,
            IsGroup = c.IsGroup,
            CreatedAt = c.CreatedAt,
            UpdatedAt = c.UpdatedAt,
            LastMessageAt = c.LastMessageAt,
            LastMessagePreview = c.LastMessagePreview,
            UnreadCount = unreadCount,
            OtherParticipant = other?.ToSummary()
        };

    public static FileUploadDto ToDto(this FileUpload f)
        => new(f.Id, f.OriginalFileName, f.Size, f.UploadedBytes,
               f.TotalChunks, f.ReceivedChunks, f.Status.ToString(),
               f.CreatedAt, f.CompletedAt);

    public static AttachmentDto ToDto(this MessageAttachment a)
        => new(a.Id, a.OriginalFileName, a.Size, a.ContentType,
               a.Type.ToString(), a.ThumbnailPath, $"/api/files/{a.Id}");
}
