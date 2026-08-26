using ChatApp.Contracts.Dtos;

namespace ChatApp.Contracts.Responses;

public record AuthResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    UserDto User);

public record TokenResponse(string AccessToken, string RefreshToken, DateTime ExpiresAt);

public record LogoutResponse(bool Success);

public record CreateConversationResponse(Guid Id, bool AlreadyExists);

public record SendMessageResponse(Guid Id, string Status, DateTime CreatedAt);

public record InitFileUploadResponse(Guid UploadId, string ChunkDirectory, bool CanResume, int ReceivedChunks);

public record UploadChunkResponse(bool Completed, int ReceivedChunks, long UploadedBytes);

public record CompleteFileUploadResponse(Guid AttachmentId, string DownloadUrl, string? ThumbnailUrl);

public record MessageReadReceiptDto(Guid MessageId, Guid UserId, DateTime ReadAt);
