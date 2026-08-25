using System.Net;
using ChatApp.Contracts.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.Web.Services;

public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _log;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> log) => _log = log;

    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        var traceId = System.Diagnostics.Activity.Current?.Id ?? ctx.TraceIdentifier;
        var (status, code, message) = ex switch
        {
            Domain.Exceptions.EntityNotFoundException e => (HttpStatusCode.NotFound, "NOT_FOUND", e.Message),
            Domain.Exceptions.AuthorizationException a => (HttpStatusCode.Forbidden, "FORBIDDEN", a.Message),
            Domain.Exceptions.BusinessRuleViolationException b => (HttpStatusCode.BadRequest, "BUSINESS_RULE", b.Message),
            Domain.Exceptions.DomainException d => (HttpStatusCode.BadRequest, "DOMAIN_ERROR", d.Message),
            UnauthorizedAccessException => (HttpStatusCode.Unauthorized, "UNAUTHORIZED", "احراز هویت نشده‌اید."),
            Microsoft.AspNetCore.SignalR.HubException h => (HttpStatusCode.BadRequest, "HUB_ERROR", h.Message),
            _ => (HttpStatusCode.InternalServerError, "INTERNAL_ERROR", "خطای داخلی سرور رخ داد.")
        };

        if (status == HttpStatusCode.InternalServerError)
        {
            _log.LogError(ex, "Unhandled exception. TraceId={TraceId}", traceId);
        }
        else
        {
            _log.LogWarning(ex, "Handled domain error ({Code}). TraceId={TraceId}", code, traceId);
        }

        if (ctx.Response.HasStarted) return false;

        ctx.Response.StatusCode = (int)status;
        ctx.Response.ContentType = "application/json; charset=utf-8";

        var payload = System.Text.Json.JsonSerializer.Serialize(new ApiErrorResponse(
            Error: code,
            Message: message,
            Detail: null,
            TraceId: traceId,
            Code: code,
            ValidationErrors: null));

        await ctx.Response.WriteAsync(payload, ct);
        return true;
    }
}
