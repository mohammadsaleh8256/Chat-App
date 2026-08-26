using ChatApp.Application.Interfaces;
using ChatApp.Contracts.Dtos;
using ChatApp.Infrastructure.Mapping;
using ChatApp.Domain.Entities;
using ChatApp.Domain.Enums;
using ChatApp.Domain.Exceptions;
using ChatApp.Domain.ValueObjects;
using ChatApp.Infrastructure.Authentication;
using ChatApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ChatApp.Infrastructure.Services;

public class FileService : IFileService
{
    private readonly ChatAppDbContext _db;
    private readonly IFileStorage _storage;
    private readonly ILogger<FileService> _log;
    private readonly long _maxChunkSize;

    public FileService(ChatAppDbContext db, IFileStorage storage, IConfiguration cfg, ILogger<FileService> log)
    {
        _db = db;
        _storage = storage;
        _log = log;
        _maxChunkSize = long.TryParse(cfg["FileStorage:MaxChunkSize"], out var s) ? s : 5L * 1024 * 1024;
    }

    public async Task<(Guid UploadId, string ChunkDirectory, bool CanResume, int ReceivedChunks)> InitUploadAsync(Guid userId, string fileName, long fileSize, int totalChunks, string contentType, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(fileName)) throw new DomainException("نام فایل الزامی است.");
        if (fileSize <= 0) throw new DomainException("اندازه فایل نامعتبر است.");
        if (totalChunks <= 0) throw new DomainException("تعداد قطعات نامعتبر است.");

        var safeName = Path.GetFileName(fileName);
        var ext = Path.GetExtension(safeName);
        var uploadId = Guid.NewGuid();
        var storedName = $"{uploadId:N}{ext}";
        var chunkDir = $"_chunks/{uploadId:N}";
        var relativePath = $"attachments/{DateTime.UtcNow:yyyy/MM}/{storedName}";

        var upload = new FileUpload
        {
            Id = uploadId,
            UserId = userId,
            OriginalFileName = safeName,
            StoredFileName = storedName,
            RelativePath = relativePath,
            ChunkDirectory = chunkDir,
            ContentType = contentType,
            Size = fileSize,
            TotalChunks = totalChunks,
            ReceivedChunks = 0,
            UploadedBytes = 0,
            Status = UploadStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.FileUploads.Add(upload);
        await _db.SaveChangesAsync(ct);

        var (received, _) = await _storage.GetChunkMapAsync(chunkDir, totalChunks, ct);
        if (received > 0)
        {
            upload.Status = UploadStatus.Uploading;
            upload.ReceivedChunks = received;
            await _db.SaveChangesAsync(ct);
        }

        return (uploadId, chunkDir, received > 0, received);
    }

    public async Task<(bool Completed, int ReceivedChunks, long UploadedBytes)> UploadChunkAsync(Guid userId, Guid uploadId, int chunkIndex, Stream chunkStream, CancellationToken ct = default)
    {
        var upload = await _db.FileUploads.FirstOrDefaultAsync(f => f.Id == uploadId, ct)
            ?? throw new EntityNotFoundException("FileUpload", uploadId);
        if (upload.UserId != userId) throw new AuthorizationException();
        if (upload.Status == UploadStatus.Completed) throw new DomainException("این فایل قبلاً کامل شده است.");
        if (upload.Status == UploadStatus.Cancelled) throw new DomainException("آپلود لغو شده است.");
        if (chunkIndex < 0 || chunkIndex >= upload.TotalChunks) throw new DomainException("شماره قطعه نامعتبر است.");

        upload.Status = UploadStatus.Uploading;
        await _storage.SaveChunkAsync(chunkStream, upload.ChunkDirectory, chunkIndex, ct);

        var (received, _) = await _storage.GetChunkMapAsync(upload.ChunkDirectory, upload.TotalChunks, ct);
        upload.ReceivedChunks = received;
        upload.UploadedBytes = (long)((double)received / upload.TotalChunks * upload.Size);
        upload.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return (received == upload.TotalChunks, received, upload.UploadedBytes);
    }

    public async Task<(Guid AttachmentId, string DownloadUrl, string? ThumbnailUrl)> CompleteUploadAsync(Guid userId, Guid uploadId, string? fileHash, CancellationToken ct = default)
    {
        var upload = await _db.FileUploads.FirstOrDefaultAsync(f => f.Id == uploadId, ct)
            ?? throw new EntityNotFoundException("FileUpload", uploadId);
        if (upload.UserId != userId) throw new AuthorizationException();

        var (received, _) = await _storage.GetChunkMapAsync(upload.ChunkDirectory, upload.TotalChunks, ct);
        if (received != upload.TotalChunks)
            throw new DomainException($"فقط {received} از {upload.TotalChunks} قطعه دریافت شده است. لطفاً آپلود را ادامه دهید.");

        await _storage.MergeChunksAsync(upload.ChunkDirectory, upload.RelativePath, upload.TotalChunks, ct);

        if (!string.IsNullOrEmpty(fileHash))
        {
            await using var fs = await _storage.OpenReadAsync(upload.RelativePath, ct);
            fs.Position = 0;
            var actualHash = HashHelper.Sha256(fs);
            if (!string.Equals(actualHash, fileHash, StringComparison.OrdinalIgnoreCase))
            {
                _log.LogWarning("File hash mismatch for upload {UploadId}. Expected={Expected}, Actual={Actual}", uploadId, fileHash, actualHash);
            }
            upload.FileHash = fileHash;
        }

        upload.Status = UploadStatus.Completed;
        upload.CompletedAt = DateTime.UtcNow;
        upload.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _storage.CleanupChunksAsync(upload.ChunkDirectory, ct);

        return (upload.Id, $"/api/files/{upload.Id}", null);
    }

    public async Task<(Stream Stream, string ContentType, string FileName)> DownloadAsync(Guid userId, Guid attachmentId, CancellationToken ct = default)
    {
        // Try MessageAttachment first
        var ma = await _db.MessageAttachments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == attachmentId, ct);
        if (ma is not null)
        {
            var msg = await _db.Messages.AsNoTracking().FirstOrDefaultAsync(m => m.Id == ma.MessageId, ct);
            if (msg is not null)
            {
                var isMember = await _db.ConversationParticipants.AnyAsync(p => p.ConversationId == msg.ConversationId && p.UserId == userId, ct);
                if (!isMember) throw new AuthorizationException();
            }
            var stream = await _storage.OpenReadAsync(ma.RelativePath, ct);
            return (stream, ma.ContentType, ma.OriginalFileName);
        }

        // Fallback: direct FileUpload (uploader only)
        var upload = await _db.FileUploads.AsNoTracking().FirstOrDefaultAsync(f => f.Id == attachmentId, ct)
            ?? throw new EntityNotFoundException("Attachment", attachmentId);
        if (upload.UserId != userId) throw new AuthorizationException();
        var s = await _storage.OpenReadAsync(upload.RelativePath, ct);
        return (s, upload.ContentType, upload.OriginalFileName);
    }

    public async Task CancelUploadAsync(Guid userId, Guid uploadId, CancellationToken ct = default)
    {
        var upload = await _db.FileUploads.FirstOrDefaultAsync(f => f.Id == uploadId, ct)
            ?? throw new EntityNotFoundException("FileUpload", uploadId);
        if (upload.UserId != userId) throw new AuthorizationException();
        upload.Status = UploadStatus.Cancelled;
        upload.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await _storage.CleanupChunksAsync(upload.ChunkDirectory, ct);
    }

    public async Task<FileUploadDto?> GetUploadStatusAsync(Guid userId, Guid uploadId, CancellationToken ct = default)
    {
        var upload = await _db.FileUploads.AsNoTracking().FirstOrDefaultAsync(f => f.Id == uploadId, ct);
        if (upload is null) return null;
        if (upload.UserId != userId) throw new AuthorizationException();
        return upload.ToDto();
    }
}
