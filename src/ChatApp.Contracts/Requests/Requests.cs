namespace ChatApp.Contracts.Requests;

public record RegisterRequest(
    string FirstName,
    string LastName,
    string PhoneNumber,
    string Password);

public record LoginRequest(
    string PhoneNumber,
    string Password);

public record RefreshTokenRequest(string AccessToken, string RefreshToken);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public record UpdateProfileRequest(string FirstName, string LastName, string? AvatarUrl, string? Bio);

public record CreateConversationRequest(Guid OtherUserId);

public record SendMessageRequest(
    string Content,
    string MessageType = "Text",
    Guid? ReplyToMessageId = null,
    Guid? AttachmentId = null);

public record InitFileUploadRequest(
    string FileName,
    long FileSize,
    int TotalChunks,
    string ContentType);

public record UploadChunkRequest(
    Guid UploadId,
    int ChunkIndex,
    int TotalChunks,
    string? ChunkHash);

public record CompleteFileUploadRequest(Guid UploadId, string? FileHash);

public record UpdateUserRoleRequest(string Role);

public record UpdateUserStatusRequest(string Status);

public record UpdateAdminPhoneRequest(string PhoneNumber);

public record SendMessageSearchRequest(string Query, int Page = 1, int PageSize = 50);
