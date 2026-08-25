using System.Net.Http.Headers;
using ChatApp.Web.Services;

namespace ChatApp.Web.Services;

/// <summary>
/// DelegatingHandler that automatically attaches the JWT access token
/// from IJwtTokenStore to each outgoing request.
/// </summary>
public class HttpJwtHandler : DelegatingHandler
{
    private readonly IJwtTokenStore _tokens;

    public HttpJwtHandler(IJwtTokenStore tokens)
    {
        _tokens = tokens;
        InnerHandler = new HttpClientHandler();
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        // Attach Authorization header if we have a token and the request doesn't already
        if (request.Headers.Authorization is null)
        {
            var token = await _tokens.GetAccessTokenAsync();
            if (!string.IsNullOrEmpty(token))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            }
        }

        var response = await base.SendAsync(request, ct);

        // If 401, try to refresh once
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized && !request.Headers.Contains("X-Retried"))
        {
            var refresh = await _tokens.GetRefreshTokenAsync();
            var access = await _tokens.GetAccessTokenAsync();
            if (!string.IsNullOrEmpty(refresh) && !string.IsNullOrEmpty(access))
            {
                var refreshReq = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh")
                {
                    Content = new StringContent(
                        System.Text.Json.JsonSerializer.Serialize(new { AccessToken = access, RefreshToken = refresh }),
                        System.Text.Encoding.UTF8,
                        "application/json")
                };
                refreshReq.Headers.Add("X-Retried", "true");
                var refreshResp = await base.SendAsync(refreshReq, ct);
                if (refreshResp.IsSuccessStatusCode)
                {
                    var tokenResp = await refreshResp.Content.ReadFromJsonAsync<TokenResponse>(ct);
                    if (tokenResp is not null)
                    {
                        await _tokens.SetTokensAsync(tokenResp.AccessToken, tokenResp.RefreshToken);
                        // Retry original request with new token
                        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenResp.AccessToken);
                        return await base.SendAsync(request, ct);
                    }
                }
                else
                {
                    // Refresh failed - clear tokens (user must log in again)
                    await _tokens.ClearAsync();
                }
            }
        }

        return response;
    }
}

public record TokenResponse(string AccessToken, string RefreshToken, DateTime ExpiresAt);
