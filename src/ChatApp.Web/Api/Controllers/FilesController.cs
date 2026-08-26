using ChatApp.Application.Interfaces;
using ChatApp.Contracts.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.Web.Api.Controllers;

[ApiController]
[Route("api/files")]
[Authorize]
public class FilesController : ControllerBase
{
    private readonly IFileService _files;

    public FilesController(IFileService files) => _files = files;

    private Guid UserId()
    {
        var id = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
              ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(id, out var g) ? g : Guid.Empty;
    }

    [HttpPost("init")]
    public async Task<IActionResult> Init([FromBody] InitFileUploadRequest req, CancellationToken ct)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.FileName) || req.FileSize <= 0 || req.TotalChunks <= 0)
            return BadRequest(new { Error = "Invalid request." });

        var (uploadId, chunkDir, canResume, received) = await _files.InitUploadAsync(
            UserId(), req.FileName, req.FileSize, req.TotalChunks, req.ContentType, ct);
        return Ok(new { UploadId = uploadId, ChunkDirectory = chunkDir, CanResume = canResume, ReceivedChunks = received });
    }

    [HttpPost("{id:guid}/chunk/{index:int}")]
    [RequestSizeLimit(20 * 1024 * 1024)]  // 20MB max per chunk
    public async Task<IActionResult> UploadChunk(Guid id, int index, CancellationToken ct)
    {
        // Stream the chunk directly to the storage layer without loading entire body into memory.
        // The service layer (LocalFileStorage) already handles streaming via Stream.CopyToAsync.
        var stream = new MemoryStream();
        try
        {
            await Request.Body.CopyToAsync(stream, 81920, ct);
            stream.Position = 0;
            var (completed, received, uploaded) = await _files.UploadChunkAsync(UserId(), id, index, stream, ct);
            return Ok(new { Completed = completed, ReceivedChunks = received, UploadedBytes = uploaded });
        }
        finally
        {
            await stream.DisposeAsync();
        }
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id, [FromBody] CompleteFileUploadRequest req, CancellationToken ct)
    {
        if (req is null) return BadRequest();
        var (attachmentId, downloadUrl, thumbnailUrl) = await _files.CompleteUploadAsync(UserId(), id, req.FileHash, ct);
        return Ok(new { AttachmentId = attachmentId, DownloadUrl = downloadUrl, ThumbnailUrl = thumbnailUrl });
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        await _files.CancelUploadAsync(UserId(), id, ct);
        return Ok(new { Success = true });
    }

    [HttpGet("{id:guid}/status")]
    public async Task<IActionResult> Status(Guid id, CancellationToken ct)
    {
        var dto = await _files.GetUploadStatusAsync(UserId(), id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var (stream, contentType, fileName) = await _files.DownloadAsync(UserId(), id, ct);
        // Set Content-Disposition with proper filename encoding for RTL
        Response.Headers.ContentDisposition = $"attachment; filename*=UTF-8''{Uri.EscapeDataString(fileName)}";
        return File(stream, contentType, fileName);
    }
}
