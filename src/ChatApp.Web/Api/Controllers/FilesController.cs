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
        var (uploadId, chunkDir, canResume, received) = await _files.InitUploadAsync(UserId(), req.FileName, req.FileSize, req.TotalChunks, req.ContentType, ct);
        return Ok(new { UploadId = uploadId, ChunkDirectory = chunkDir, CanResume = canResume, ReceivedChunks = received });
    }

    [HttpPost("{id:guid}/chunk/{index:int}")]
    [RequestSizeLimit(long.MaxValue)]
    [RequestFormLimits(MultipartBodyLengthLimit = long.MaxValue)]
    public async Task<IActionResult> UploadChunk(Guid id, int index, CancellationToken ct)
    {
        if (Request.ContentLength is null) return BadRequest("Missing content length.");
        using var ms = new MemoryStream((int)Request.ContentLength.Value);
        await Request.Body.CopyToAsync(ms, ct);
        ms.Position = 0;
        var (completed, received, uploaded) = await _files.UploadChunkAsync(UserId(), id, index, ms, ct);
        return Ok(new { Completed = completed, ReceivedChunks = received, UploadedBytes = uploaded });
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id, [FromBody] CompleteFileUploadRequest req, CancellationToken ct)
    {
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
        return File(stream, contentType, fileName);
    }
}
