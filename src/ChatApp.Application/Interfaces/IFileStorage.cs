using ChatApp.Domain.Enums;

namespace ChatApp.Application.Interfaces;

public interface IFileStorage
{
    Task<string> SaveAsync(Stream stream, string fileName, string contentType, string subDirectory, CancellationToken ct = default);
    Task<Stream> OpenReadAsync(string relativePath, CancellationToken ct = default);
    Task DeleteAsync(string relativePath, CancellationToken ct = default);
    Task<bool> ExistsAsync(string relativePath, CancellationToken ct = default);
    Task<string> SaveChunkAsync(Stream chunkStream, string chunkDirectory, int chunkIndex, CancellationToken ct = default);
    Task MergeChunksAsync(string chunkDirectory, string outputPath, int totalChunks, CancellationToken ct = default);
    Task CleanupChunksAsync(string chunkDirectory, CancellationToken ct = default);
    string GetPublicUrl(string relativePath);
    string GetStorageRoot();
    string GetThumbnailUrl(string? thumbnailPath);
    Task DeleteChunkAsync(string chunkDirectory, int chunkIndex, CancellationToken ct = default);
    Task<long> GetFileSizeAsync(string relativePath, CancellationToken ct = default);
    Task<(int ReceivedChunks, bool[] ChunkMap)> GetChunkMapAsync(string chunkDirectory, int totalChunks, CancellationToken ct = default);
    AttachmentType DetectAttachmentType(string fileName, string contentType);
}
