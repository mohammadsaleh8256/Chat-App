using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Components.Authorization;

namespace ChatApp.Web.Services;

/// <summary>
/// Blazor AuthenticationStateProvider backed by JWT in ProtectedLocalStorage.
/// On the server side (pre-render), returns anonymous; on the client side, decodes the stored JWT.
/// </summary>
public class JwtAuthenticationStateProvider : AuthenticationStateProvider
{
    private readonly IJwtTokenStore _tokens;
    private readonly ILogger<JwtAuthenticationStateProvider> _log;

    public JwtAuthenticationStateProvider(IJwtTokenStore tokens, ILogger<JwtAuthenticationStateProvider> log)
    {
        _tokens = tokens;
        _log = log;
        _tokens.OnAuthChanged += async () =>
        {
            var state = await GetAuthenticationStateAsync();
            NotifyAuthenticationStateChanged(Task.FromResult(state));
        };
    }

    public override async Task<AuthenticationState> GetAuthenticationStateAsync()
    {
        var token = await _tokens.GetAccessTokenAsync();
        if (string.IsNullOrEmpty(token))
        {
            return new AuthenticationState(new ClaimsPrincipal(new ClaimsIdentity()));
        }

        try
        {
            var handler = new JwtSecurityTokenHandler();
            var jwt = handler.ReadJwtToken(token);
            if (jwt.ValidTo < DateTime.UtcNow)
            {
                // token expired - try refresh
                return new AuthenticationState(new ClaimsPrincipal(new ClaimsIdentity()));
            }
            var identity = new ClaimsIdentity(jwt.Claims, "jwt");
            var user = new ClaimsPrincipal(identity);
            return new AuthenticationState(user);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Failed to decode JWT.");
            return new AuthenticationState(new ClaimsPrincipal(new ClaimsIdentity()));
        }
    }

    public async Task NotifyUserAuthenticationAsync(string token)
    {
        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);
        var identity = new ClaimsIdentity(jwt.Claims, "jwt");
        var user = new ClaimsPrincipal(identity);
        NotifyAuthenticationStateChanged(Task.FromResult(new AuthenticationState(user)));
        await Task.CompletedTask;
    }

    public Task NotifyUserLogoutAsync()
    {
        var anon = new ClaimsPrincipal(new ClaimsIdentity());
        NotifyAuthenticationStateChanged(Task.FromResult(new AuthenticationState(anon)));
        return Task.CompletedTask;
    }
}
