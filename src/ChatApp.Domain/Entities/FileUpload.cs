using ChatApp.Domain.Enums;

namespace ChatApp.Domain.Entities;

public class FileUpload
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }                  // uploader
    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string RelativePath { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/octet-stream";
    public long Size { get; set; }
    public long UploadedBytes { get; set; }
    public int TotalChunks { get; set; }
    public int ReceivedChunks { get; set; }
    public string ChunkDirectory { get; set; } = string.Empty;
    public UploadStatus Status { get; set; } = UploadStatus.Pending;
    public string? FileHash { get; set; }              // SHA-256 for integrity
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public DateTime? DeletedAt { get; set; }

    public User User { get; set; } = null!;
}

public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AdminId { get; set; }                  // admin performing the action
    public AuditAction Action { get; set; }
    public Guid? TargetUserId { get; set; }
    public Guid? TargetConversationId { get; set; }
    public Guid? TargetMessageId { get; set; }
    public Guid? TargetAttachmentId { get; set; }
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User Admin { get; set; } = null!;
}

public class RefreshToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;     // SHA-256 hash of token
    public string JwtId { get; set; } = string.Empty;          // links to JWT jti claim
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAt { get; set; }
    public string? ReplacedByToken { get; set; }
    public string? CreatedByIp { get; set; }
    public string? RevokeByIp { get; set; }
    public string? ReasonRevoked { get; set; }

    public bool IsActive => RevokedAt == null && DateTime.UtcNow < ExpiresAt;

    public User User { get; set; } = null!;
}

public class AppSetting
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
