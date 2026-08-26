using ChatApp.Contracts.Dtos;
using ChatApp.Contracts.Responses;
using ChatApp.Domain.Entities;

namespace ChatApp.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(string firstName, string lastName, string phoneNumber, string password, string? ipAddress, CancellationToken ct = default);
    Task<AuthResponse> LoginAsync(string phoneNumber, string password, string? ipAddress, CancellationToken ct = default);
    Task LogoutAsync(string refreshToken, string? ipAddress, CancellationToken ct = default);
    Task<TokenResponse?> RefreshAsync(string accessToken, string refreshToken, string? ipAddress, CancellationToken ct = default);
    Task<UserDto?> GetCurrentUserAsync(Guid userId, CancellationToken ct = default);
}

public interface IUserService
{
    Task<IReadOnlyList<UserSummaryDto>> ListUsersAsync(Guid currentUserId, string? search, int page, int pageSize, CancellationToken ct = default);
    Task<UserDto?> GetUserAsync(Guid id, CancellationToken ct = default);
    Task<UserDto?> GetProfileAsync(Guid userId, CancellationToken ct = default);
    Task<UserDto> UpdateProfileAsync(Guid userId, string firstName, string lastName, string? avatarUrl, string? bio, CancellationToken ct = default);
    Task UpdatePresenceAsync(Guid userId, bool isOnline, CancellationToken ct = default);
    Task<IReadOnlyList<UserSummaryDto>> GetOnlineUsersAsync(CancellationToken ct = default);
}

public interface IConversationService
{
    Task<ConversationDto> CreateOrGetAsync(Guid currentUserId, Guid otherUserId, CancellationToken ct = default);
    Task<IReadOnlyList<ConversationDto>> ListConversationsAsync(Guid currentUserId, int page, int pageSize, CancellationToken ct = default);
    Task<ConversationDto?> GetConversationAsync(Guid currentUserId, Guid conversationId, CancellationToken ct = default);
    Task<bool> BelongsToConversationAsync(Guid userId, Guid conversationId, CancellationToken ct = default);
    Task MarkConversationReadAsync(Guid userId, Guid conversationId, CancellationToken ct = default);
}

public interface IMessageService
{
    Task<MessageDto> SendTextAsync(Guid senderId, Guid conversationId, string content, Guid? replyToMessageId, CancellationToken ct = default);
    Task<MessageDto> SendWithAttachmentAsync(Guid senderId, Guid conversationId, string? content, Guid attachmentId, string messageType, Guid? replyToMessageId, CancellationToken ct = default);
    Task<IReadOnlyList<MessageDto>> GetMessagesAsync(Guid userId, Guid conversationId, int page, int pageSize, CancellationToken ct = default);
    Task<IReadOnlyList<MessageDto>> GetMessagesBeforeAsync(Guid userId, Guid conversationId, DateTime before, int pageSize, CancellationToken ct = default);
    Task<MessageDto?> GetMessageAsync(Guid userId, Guid messageId, CancellationToken ct = default);
    Task MarkDeliveredAsync(Guid userId, Guid conversationId, CancellationToken ct = default);
    Task MarkReadAsync(Guid userId, Guid messageId, CancellationToken ct = default);
    Task DeleteAsync(Guid userId, Guid messageId, CancellationToken ct = default);
    Task<MessageDto> ForwardAsync(Guid userId, Guid messageId, Guid targetConversationId, CancellationToken ct = default);
    Task<int> GetUnreadCountAsync(Guid userId, Guid conversationId, CancellationToken ct = default);
}

public interface IFileService
{
    Task<(Guid UploadId, string ChunkDirectory, bool CanResume, int ReceivedChunks)> InitUploadAsync(Guid userId, string fileName, long fileSize, int totalChunks, string contentType, CancellationToken ct = default);
    Task<(bool Completed, int ReceivedChunks, long UploadedBytes)> UploadChunkAsync(Guid userId, Guid uploadId, int chunkIndex, Stream chunkStream, CancellationToken ct = default);
    Task<(Guid AttachmentId, string DownloadUrl, string? ThumbnailUrl)> CompleteUploadAsync(Guid userId, Guid uploadId, string? fileHash, CancellationToken ct = default);
    Task<(Stream Stream, string ContentType, string FileName)> DownloadAsync(Guid userId, Guid attachmentId, CancellationToken ct = default);
    Task CancelUploadAsync(Guid userId, Guid uploadId, CancellationToken ct = default);
    Task<FileUploadDto?> GetUploadStatusAsync(Guid userId, Guid uploadId, CancellationToken ct = default);
}

public interface IAdminService
{
    Task<DashboardStatsDto> GetDashboardStatsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<UserDto>> ListUsersAsync(string? search, string? phone, int page, int pageSize, CancellationToken ct = default);
    Task<UserDto?> GetUserAsync(Guid id, CancellationToken ct = default);
    Task<UserDto> ChangeUserRoleAsync(Guid adminId, Guid userId, string role, string? ipAddress, CancellationToken ct = default);
    Task<UserDto> ChangeUserStatusAsync(Guid adminId, Guid userId, string status, string? ipAddress, CancellationToken ct = default);
    Task<IReadOnlyList<ConversationDto>> ListUserConversationsAsync(Guid adminId, Guid userId, string? ipAddress, int page, int pageSize, CancellationToken ct = default);
    Task<IReadOnlyList<MessageDto>> ListConversationMessagesAsync(Guid adminId, Guid conversationId, string? ipAddress, int page, int pageSize, CancellationToken ct = default);
    Task<IReadOnlyList<AuditLogDto>> ListAuditLogsAsync(DateTime? from, DateTime? to, int page, int pageSize, CancellationToken ct = default);
    Task UpdateAdminPhoneAsync(Guid adminId, string newPhone, string? ipAddress, CancellationToken ct = default);
    Task<string> GetAdminPhoneAsync(CancellationToken ct = default);
    Task<IReadOnlyList<MessageDto>> SearchMessagesAsync(Guid adminId, string query, int page, int pageSize, CancellationToken ct = default);
}

public interface IPresenceService
{
    Task UserConnectedAsync(Guid userId, string connectionId, CancellationToken ct = default);
    Task UserDisconnectedAsync(Guid userId, string connectionId, CancellationToken ct = default);
    Task<bool> IsUserOnlineAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<Guid>> GetOnlineUserIdsAsync(CancellationToken ct = default);
    Task<DateTime> GetUserLastSeenAsync(Guid userId, CancellationToken ct = default);
}

public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? PhoneNumber { get; }
    string? Role { get; }
    bool IsAuthenticated { get; }
    bool IsAdmin { get; }
    string? IpAddress { get; }
    string? UserAgent { get; }
}
