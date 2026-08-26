using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Forms;
using Microsoft.JSInterop;

namespace ChatApp.Web.Services;

/// <summary>
/// Handles chunked/resumable file uploads from Blazor.
/// Implements progress, retry, cancel, resume.
/// </summary>
public interface IFileUploadService
{
    Task<Guid> UploadAsync(IBrowserFile file, Guid currentUserId, IProgress<FileUploadProgress> progress, CancellationToken ct = default);
    Task CancelAsync(Guid uploadId);
}

public record FileUploadProgress(long TotalBytes, long UploadedBytes, int TotalChunks, int ReceivedChunks, bool Completed);

public class FileUploadService : IFileUploadService
{
    private readonly HttpClient _http;
    private readonly ILogger<FileUploadService> _log;
    private const int DefaultChunkSize = 4 * 1024 * 1024; // 4 MB per chunk

    public FileUploadService(HttpClient http, ILogger<FileUploadService> log)
    {
        _http = http;
        _log = log;
    }

    public async Task<Guid> UploadAsync(IBrowserFile file, Guid currentUserId, IProgress<FileUploadProgress> progress, CancellationToken ct = default)
    {
        // Open stream (max file size: 50GB)
        await using var stream = file.OpenReadStream(maxAllowedSize: 50L * 1024 * 1024 * 1024, ct);
        var fileSize = file.Size;
        var chunkSize = DefaultChunkSize;
        var totalChunks = (int)Math.Ceiling(fileSize / (double)chunkSize);

        // Initialize upload
        var initReq = new { FileName = file.Name, FileSize = fileSize, TotalChunks = totalChunks, ContentType = file.ContentType };
        var initResp = await _http.PostAsJsonAsync("/api/files/init", initReq, ct);
        initResp.EnsureSuccessStatusCode();
        var initResult = await initResp.Content.ReadFromJsonAsync<InitFileResult>(ct) ?? throw new InvalidOperationException("init failed");
        var uploadId = initResult.UploadId;

        // Determine which chunks already exist (resume)
        var received = initResult.ReceivedChunks;
        var buffer = new byte[chunkSize];

        for (var i = 0; i < totalChunks; i++)
        {
            if (received > i)
            {
                // Already received - skip
                continue;
            }

            // Read this chunk
            var toRead = (int)Math.Min(chunkSize, fileSize - i * chunkSize);
            var read = await stream.ReadAsync(buffer.AsMemory(0, toRead), ct);
            if (read == 0) break;

            using var ms = new MemoryStream(buffer, 0, read);
            using var content = new StreamContent(ms);
            content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/octet-stream");

            var chunkUrl = $"/api/files/{uploadId}/chunk/{i}";
            // Retry logic with exponential backoff
            int attempt = 0;
            while (true)
            {
                ct.ThrowIfCancellationRequested();
                try
                {
                    var resp = await _http.PostAsync(chunkUrl, content, ct);
                    resp.EnsureSuccessStatusCode();
                    var chunkResult = await resp.Content.ReadFromJsonAsync<ChunkResult>(ct);
                    received = chunkResult?.ReceivedChunks ?? (i + 1);
                    break;
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    attempt++;
                    if (attempt > 5) throw new InvalidOperationException($"Chunk {i} failed after 5 attempts.", ex);
                    _log.LogWarning(ex, "Chunk {Index} failed (attempt {Attempt}), retrying...", i, attempt);
                    await Task.Delay(TimeSpan.FromSeconds(Math.Min(30, Math.Pow(2, attempt))), ct);
                    // Reset stream position to retry
                    ms.Position = 0;
                }
            }

            var uploaded = (long)((double)(i + 1) / totalChunks * fileSize);
            progress.Report(new FileUploadProgress(fileSize, uploaded, totalChunks, i + 1, false));
        }

        // Complete
        var completeResp = await _http.PostAsJsonAsync($"/api/files/{uploadId}/complete", new { UploadId = uploadId, FileHash = (string?)null }, ct);
        completeResp.EnsureSuccessStatusCode();
        progress.Report(new FileUploadProgress(fileSize, fileSize, totalChunks, totalChunks, true));

        return uploadId;
    }

    public async Task CancelAsync(Guid uploadId)
    {
        var resp = await _http.PostAsync($"/api/files/{uploadId}/cancel", content: null, CancellationToken.None);
        resp.EnsureSuccessStatusCode();
    }

    private record InitFileResult(Guid UploadId, string ChunkDirectory, bool CanResume, int ReceivedChunks);
    private record ChunkResult(bool Completed, int ReceivedChunks, long UploadedBytes);
}
