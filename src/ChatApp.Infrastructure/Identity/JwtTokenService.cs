using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ChatApp.Domain.Entities;
using ChatApp.Infrastructure.Authentication;
using ChatApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace ChatApp.Infrastructure.Identity;

public interface ITokenService
{
    (string AccessToken, string JwtId, DateTime ExpiresAt) GenerateAccessToken(User user);
    Task<(string RefreshToken, DateTime ExpiresAt)> GenerateRefreshTokenAsync(User user, string? ipAddress, string jwtId, CancellationToken ct = default);
    Task<bool> ValidateRefreshTokenAsync(string refreshToken, string accessToken, CancellationToken ct = default);
    Task RevokeRefreshTokenAsync(string refreshToken, string? ipAddress, string? reason, string? replacedBy, CancellationToken ct = default);
    Task RevokeAllUserTokensAsync(Guid userId, string? reason, CancellationToken ct = default);
    Task<(string AccessToken, string RefreshToken, DateTime AccessExpiresAt)?> RotateTokensAsync(string expiredAccessToken, string refreshToken, string? ipAddress, CancellationToken ct = default);
    ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);
}

public class JwtTokenService : ITokenService
{
    private readonly ChatAppDbContext _db;
    private readonly IConfiguration _cfg;

    private SymmetricSecurityKey SigningKey => new(Encoding.UTF8.GetBytes(_cfg["Jwt:Secret"]!));
    private string Issuer => _cfg["Jwt:Issuer"] ?? "ChatApp";
    private string Audience => _cfg["Jwt:Audience"] ?? "ChatApp";

    private int AccessTokenMinutes => int.TryParse(_cfg["Jwt:AccessTokenMinutes"], out var m) ? m : 15;
    private int RefreshTokenDays => int.TryParse(_cfg["Jwt:RefreshTokenDays"], out var d) ? d : 30;

    public JwtTokenService(ChatAppDbContext db, IConfiguration cfg)
    {
        _db = db;
        _cfg = cfg;
    }

    public (string AccessToken, string JwtId, DateTime ExpiresAt) GenerateAccessToken(User user)
    {
        var jwtId = Guid.NewGuid().ToString("N");
        var expiresAt = DateTime.UtcNow.AddMinutes(AccessTokenMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, jwtId),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.UserName ?? user.PhoneNumber),
            new(ClaimTypes.MobilePhone, user.PhoneNumber),
            new(ClaimTypes.GivenName, user.FirstName),
            new(ClaimTypes.Surname, user.LastName),
            new(ClaimTypes.Role, user.Role.ToString().ToLowerInvariant()),
            new("role", user.Role.ToString().ToLowerInvariant()),
            new("phone", user.PhoneNumber),
            new("name", user.FullName)
        };

        var creds = new SigningCredentials(SigningKey, SecurityAlgorithms.HmacSha256Signature);
        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAt,
            signingCredentials: creds);

        var handler = new JwtSecurityTokenHandler();
        return (handler.WriteToken(token), jwtId, expiresAt);
    }

    public async Task<(string RefreshToken, DateTime ExpiresAt)> GenerateRefreshTokenAsync(User user, string? ipAddress, string jwtId, CancellationToken ct = default)
    {
        var raw = HashHelper.GenerateToken(64);
        var expiresAt = DateTime.UtcNow.AddDays(RefreshTokenDays);

        var rt = new RefreshToken
        {
            UserId = user.Id,
            TokenHash = HashHelper.Sha256(raw),
            JwtId = jwtId,
            ExpiresAt = expiresAt,
            CreatedByIp = ipAddress
        };
        _db.RefreshTokens.Add(rt);
        await _db.SaveChangesAsync(ct);

        return (raw, expiresAt);
    }

    public async Task<bool> ValidateRefreshTokenAsync(string refreshToken, string accessToken, CancellationToken ct = default)
    {
        var hash = HashHelper.Sha256(refreshToken);
        var token = await _db.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == hash, ct);
        if (token is null || !token.IsActive)
            return false;

        // verify it belongs to same user as access token (expired)
        var principal = GetPrincipalFromExpiredToken(accessToken);
        if (principal is null) return false;
        var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId)) return false;
        if (token.UserId != userId) return false;

        return true;
    }

    public async Task RevokeRefreshTokenAsync(string refreshToken, string? ipAddress, string? reason, string? replacedBy, CancellationToken ct = default)
    {
        var hash = HashHelper.Sha256(refreshToken);
        var token = await _db.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == hash, ct);
        if (token is null || !token.IsActive) return;

        token.RevokedAt = DateTime.UtcNow;
        token.RevokeByIp = ipAddress;
        token.ReasonRevoked = reason;
        token.ReplacedByToken = replacedBy;
        await _db.SaveChangesAsync(ct);
    }

    public async Task RevokeAllUserTokensAsync(Guid userId, string? reason, CancellationToken ct = default)
    {
        var tokens = await _db.RefreshTokens
            .Where(x => x.UserId == userId && x.RevokedAt == null && x.ExpiresAt > DateTime.UtcNow)
            .ToListAsync(ct);
        foreach (var t in tokens)
        {
            t.RevokedAt = DateTime.UtcNow;
            t.ReasonRevoked = reason ?? "logout-all";
        }
        await _db.SaveChangesAsync(ct);
    }

    public async Task<(string AccessToken, string RefreshToken, DateTime AccessExpiresAt)?> RotateTokensAsync(string expiredAccessToken, string refreshToken, string? ipAddress, CancellationToken ct = default)
    {
        var hash = HashHelper.Sha256(refreshToken);
        var old = await _db.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == hash, ct);
        if (old is null || !old.IsActive) return null;

        var principal = GetPrincipalFromExpiredToken(expiredAccessToken);
        if (principal is null) return null;

        var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId)) return null;

        var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId, ct);
        if (user is null || user.Status != Domain.Enums.UserStatus.Active) return null;

        var (newAccess, newJwtId, accessExpires) = GenerateAccessToken(user);
        var (newRefresh, _) = await GenerateRefreshTokenAsync(user, ipAddress, newJwtId, ct);

        // Revoke old refresh token, replaced by new one
        old.RevokedAt = DateTime.UtcNow;
        old.RevokeByIp = ipAddress;
        old.ReasonRevoked = "rotated";
        old.ReplacedByToken = newRefresh;
        await _db.SaveChangesAsync(ct);

        return (newAccess, newRefresh, accessExpires);
    }

    public ClaimsPrincipal? GetPrincipalFromExpiredToken(string token)
    {
        var tv = new TokenValidationParameters
        {
            ValidateAudience = false,
            ValidateIssuer = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = SigningKey,
            ValidateLifetime = false,
            ClockSkew = TimeSpan.Zero
        };
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var principal = handler.ValidateToken(token, tv, out var _);
            return principal;
        }
        catch
        {
            return null;
        }
    }
}
