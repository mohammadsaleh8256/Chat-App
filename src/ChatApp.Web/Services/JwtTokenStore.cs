using Microsoft.AspNetCore.Components.Server.ProtectedBrowserStorage;

namespace ChatApp.Web.Services;

public interface IJwtTokenStore
{
    Task<string?> GetAccessTokenAsync();
    Task<string?> GetRefreshTokenAsync();
    Task SetTokensAsync(string accessToken, string refreshToken);
    Task ClearAsync();
    event Func<Task>? OnAuthChanged;
}

public class JwtTokenStore : IJwtTokenStore
{
    private readonly ProtectedLocalStorage _storage;
    public event Func<Task>? OnAuthChanged;

    public JwtTokenStore(ProtectedLocalStorage storage)
    {
        _storage = storage;
    }

    public async Task<string?> GetAccessTokenAsync()
    {
        try
        {
            var result = await _storage.GetAsync<string>("access_token");
            return result.Success ? result.Value : null;
        }
        catch { return null; }
    }

    public async Task<string?> GetRefreshTokenAsync()
    {
        try
        {
            var result = await _storage.GetAsync<string>("refresh_token");
            return result.Success ? result.Value : null;
        }
        catch { return null; }
    }

    public async Task SetTokensAsync(string accessToken, string refreshToken)
    {
        await _storage.SetAsync("access_token", accessToken);
        await _storage.SetAsync("refresh_token", refreshToken);
        OnAuthChanged?.Invoke();
    }

    public async Task ClearAsync()
    {
        try { await _storage.DeleteAsync("access_token"); } catch { }
        try { await _storage.DeleteAsync("refresh_token"); } catch { }
        OnAuthChanged?.Invoke();
    }
}
