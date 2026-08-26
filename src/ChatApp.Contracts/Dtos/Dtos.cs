namespace ChatApp.Contracts.Dtos;

public record UserDto(
    Guid Id,
    string FirstName,
    string LastName,
    string FullName,
    string PhoneNumber,
    string? AvatarUrl,
    bool IsOnline,
    DateTime? LastSeen,
    string Role,
    string Status,
    DateTime CreatedAt);

public record UserSummaryDto
{
    public required Guid Id { get; init; }
    public required string FullName { get; init; }
    public required string PhoneNumber { get; init; }
    public string? AvatarUrl { get; set; }
    public bool IsOnline { get; set; }
    public DateTime? LastSeen { get; set; }
}

public record ConversationDto
{
    public required Guid Id { get; init; }
    public string? Title { get; init; }
    public bool IsGroup { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public DateTime? LastMessageAt { get; init; }
    public string? LastMessagePreview { get; set; }
    public int UnreadCount { get; set; }
    public UserSummaryDto? OtherParticipant { get; set; }
}

public record MessageDto(
    Guid Id,
    Guid ConversationId,
    Guid SenderId,
    string SenderName,
    string? SenderAvatarUrl,
    string Content,
    string Type,
    string Status,
    Guid? ReplyToMessageId,
    string? ReplyToPreview,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? DeletedAt,
    bool IsEdited,
    DateTime? DeliveredAt,
    DateTime? ReadAt,
    IReadOnlyList<AttachmentDto> Attachments);

public record AttachmentDto(
    Guid Id,
    string OriginalFileName,
    long Size,
    string ContentType,
    string Type,
    string? ThumbnailUrl,
    string DownloadUrl);

public record FileUploadDto(
    Guid Id,
    string OriginalFileName,
    long Size,
    long UploadedBytes,
    int TotalChunks,
    int ReceivedChunks,
    string Status,
    DateTime CreatedAt,
    DateTime? CompletedAt);

public record AuditLogDto(
    Guid Id,
    Guid AdminId,
    string AdminName,
    string Action,
    Guid? TargetUserId,
    string? TargetUserName,
    Guid? TargetConversationId,
    Guid? TargetMessageId,
    Guid? TargetAttachmentId,
    string? Details,
    string? IpAddress,
    DateTime CreatedAt);

public record DashboardStatsDto(
    int TotalUsers,
    int OnlineUsers,
    int TotalConversations,
    int TotalMessages,
    int TotalAttachments,
    long TotalAttachmentSizeBytes,
    int TotalAdmins,
    int DisabledUsers,
    int ActiveUploads);

public record RecentActivityDto(
    Guid Id,
    string Type,
    string Description,
    DateTime CreatedAt,
    string? ActorName);
