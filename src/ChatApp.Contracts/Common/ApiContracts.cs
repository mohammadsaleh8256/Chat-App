namespace ChatApp.Contracts.Common;

public record ApiErrorResponse(
    string Error,
    string Message,
    string? Detail,
    string? TraceId,
    string? Code,
    IDictionary<string, string[]>? ValidationErrors = null);

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int TotalCount,
    int Page,
    int PageSize)
{
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasNext => Page < TotalPages;
    public bool HasPrevious => Page > 1;
}

public record CursorResult<T>(
    IReadOnlyList<T> Items,
    string? NextCursor,
    bool HasMore);
