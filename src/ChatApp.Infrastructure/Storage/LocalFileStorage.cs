using System.Security.Cryptography;
using ChatApp.Application.Interfaces;
using ChatApp.Domain.Enums;
using ChatApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ChatApp.Infrastructure.Storage;

public class LocalFileStorage : IFileStorage
{
    private readonly string _root;
    private readonly ILogger<LocalFileStorage> _log;
    private const string ChunksSubDir = "_chunks";

    public LocalFileStorage(IConfiguration cfg, ILogger<LocalFileStorage> log)
    {
        var configured = cfg["FileStorage:Root"];
        _root = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(AppContext.BaseDirectory, "uploads")
            : configured!;

        if (!Path.IsPathRooted(_root)) _root = Path.GetFullPath(_root);
        Directory.CreateDirectory(_root);
        _log = log;
    }

    public string GetStorageRoot() => _root;

    private string Resolve(string relativePath)
    {
        var full = Path.GetFullPath(Path.Combine(_root, relativePath));
        if (!full.StartsWith(_root, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Path traversal detected.");
        return full;
    }

    public async Task<string> SaveAsync(Stream stream, string fileName, string contentType, string subDirectory, CancellationToken ct = default)
    {
        var safeSub = SanitizeSubDir(subDirectory);
        var dir = Path.Combine(_root, safeSub);
        Directory.CreateDirectory(dir);

        var ext = Path.GetExtension(fileName);
        var stored = $"{Guid.NewGuid():N}{ext}";
        var full = Path.Combine(dir, stored);

        await using (var fs = new FileStream(full, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
        {
            await stream.CopyToAsync(fs, 81920, ct);
        }
        return Path.Combine(safeSub, stored).Replace('\\', '/');
    }

    public Task<Stream> OpenReadAsync(string relativePath, CancellationToken ct = default)
    {
        var full = Resolve(relativePath);
        if (!File.Exists(full)) throw new FileNotFoundException("File not found.", full);
        return Task.FromResult<Stream>(new FileStream(full, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true));
    }

    public Task DeleteAsync(string relativePath, CancellationToken ct = default)
    {
        var full = Resolve(relativePath);
        if (File.Exists(full)) File.Delete(full);
        return Task.CompletedTask;
    }

    public Task<bool> ExistsAsync(string relativePath, CancellationToken ct = default)
    {
        return Task.FromResult(File.Exists(Resolve(relativePath)));
    }

    public async Task<string> SaveChunkAsync(Stream chunkStream, string chunkDirectory, int chunkIndex, CancellationToken ct = default)
    {
        var dir = Resolve(chunkDirectory);
        Directory.CreateDirectory(dir);
        var chunkPath = Path.Combine(dir, $"{chunkIndex:D8}.part");

        await using (var fs = new FileStream(chunkPath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, useAsync: true))
        {
            await chunkStream.CopyToAsync(fs, 81920, ct);
        }
        return chunkPath;
    }

    public async Task MergeChunksAsync(string chunkDirectory, string outputPath, int totalChunks, CancellationToken ct = default)
    {
        var srcDir = Resolve(chunkDirectory);
        var outPath = Resolve(outputPath);
        Directory.CreateDirectory(Path.GetDirectoryName(outPath)!);

        await using (var dest = new FileStream(outPath, FileMode.Create, FileAccess.Write, FileShare.None, 81920, useAsync: true))
        {
            for (var i = 0; i < totalChunks; i++)
            {
                var chunk = Path.Combine(srcDir, $"{i:D8}.part");
                if (!File.Exists(chunk))
                    throw new InvalidOperationException($"Chunk {i} missing in upload.");

                using var src = new FileStream(chunk, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
                await src.CopyToAsync(dest, 81920, ct);
            }
        }
    }

    public Task CleanupChunksAsync(string chunkDirectory, CancellationToken ct = default)
    {
        var dir = Resolve(chunkDirectory);
        if (Directory.Exists(dir))
        {
            try { Directory.Delete(dir, recursive: true); } catch { /* ignore */ }
        }
        return Task.CompletedTask;
    }

    public Task DeleteChunkAsync(string chunkDirectory, int chunkIndex, CancellationToken ct = default)
    {
        var dir = Resolve(chunkDirectory);
        var chunk = Path.Combine(dir, $"{chunkIndex:D8}.part");
        if (File.Exists(chunk)) File.Delete(chunk);
        return Task.CompletedTask;
    }

    public async Task<long> GetFileSizeAsync(string relativePath, CancellationToken ct = default)
    {
        var full = Resolve(relativePath);
        var fi = new FileInfo(full);
        return fi.Exists ? fi.Length : 0;
    }

    public async Task<(int ReceivedChunks, bool[] ChunkMap)> GetChunkMapAsync(string chunkDirectory, int totalChunks, CancellationToken ct = default)
    {
        var dir = Resolve(chunkDirectory);
        var map = new bool[totalChunks];
        var received = 0;
        if (Directory.Exists(dir))
        {
            for (var i = 0; i < totalChunks; i++)
            {
                if (File.Exists(Path.Combine(dir, $"{i:D8}.part")))
                {
                    map[i] = true;
                    received++;
                }
            }
        }
        return (received, map);
    }

    public string GetPublicUrl(string relativePath) => $"/api/files/raw?path={Uri.EscapeDataString(relativePath)}";

    public string GetThumbnailUrl(string? thumbnailPath) =>
        string.IsNullOrEmpty(thumbnailPath) ? string.Empty : GetPublicUrl(thumbnailPath);

    private static string SanitizeSubDir(string sub)
    {
        var parts = sub.Split('/', '\\', StringSplitOptions.RemoveEmptyEntries);
        var cleaned = parts.Select(p => new string(p.Where(ch => char.IsLetterOrDigit(ch) || ch == '_' || ch == '-').ToArray()));
        return string.Join('/', cleaned);
    }

    public AttachmentType DetectAttachmentType(string fileName, string contentType)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        var ctLower = (contentType ?? string.Empty).ToLowerInvariant();
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
            _ when ctLower.StartsWith("image/") => AttachmentType.Image,
            _ when ctLower.StartsWith("video/") => AttachmentType.Video,
            _ when ctLower.StartsWith("audio/") => AttachmentType.Audio,
            _ => AttachmentType.Other
        };
    }
}
