using AutoMapper;
using ChatApp.Application.Interfaces;
using ChatApp.Contracts.Dtos;
using ChatApp.Contracts.Responses;
using ChatApp.Domain.Entities;
using ChatApp.Domain.Enums;
using ChatApp.Domain.Exceptions;
using ChatApp.Domain.ValueObjects;
using ChatApp.Infrastructure.Authentication;
using ChatApp.Infrastructure.Identity;
using ChatApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly ChatAppDbContext _db;
    private readonly ITokenService _tokenService;
    private readonly IMapper _mapper;
    private readonly ILogger<AuthService> _log;

    public AuthService(ChatAppDbContext db, ITokenService tokenService, IMapper mapper, ILogger<AuthService> log)
    {
        _db = db;
        _tokenService = tokenService;
        _mapper = mapper;
        _log = log;
    }

    public async Task<AuthResponse> RegisterAsync(string firstName, string lastName, string phoneNumber, string password, string? ipAddress, CancellationToken ct = default)
    {
        // Normalize phone
        var phone = PhoneNumber.Create(phoneNumber);

        // Check uniqueness
        var existing = await _db.Users.AnyAsync(u => u.NormalizedPhoneNumber == phone.E164, ct);
        if (existing)
            throw new DomainException("شماره تلفن قبلاً ثبت شده است.");

        // Get admin phone from settings
        var adminPhoneSetting = await _db.AppSettings.FirstOrDefaultAsync(s => s.Key == "INITIAL_ADMIN_PHONE", ct);
        var adminPhone = adminPhoneSetting?.Value;
        var isAdmin = !string.IsNullOrEmpty(adminPhone) && PhoneNumber.TryParse(adminPhone, out var ap) && ap.E164 == phone.E164;

        var user = new User
        {
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            PhoneNumber = phone.E164,
            NormalizedPhoneNumber = phone.E164,
            PhoneNumberHash = HashHelper.Sha256(phone.E164),
            UserName = phone.E164,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12),
            Role = isAdmin ? UserRole.Admin : UserRole.User,
            Status = UserStatus.Active,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            LastSeen = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        var (access, jwtId, accessExpires) = _tokenService.GenerateAccessToken(user);
        var (refresh, _) = await _tokenService.GenerateRefreshTokenAsync(user, ipAddress, jwtId, ct);

        _log.LogInformation("User registered: {Phone} (Role={Role})", user.PhoneNumber, user.Role);

        return new AuthResponse(access, refresh, accessExpires, _mapper.Map<UserDto>(user));
    }

    public async Task<AuthResponse> LoginAsync(string phoneNumber, string password, string? ipAddress, CancellationToken ct = default)
    {
        var phone = PhoneNumber.Create(phoneNumber);

        var user = await _db.Users.FirstOrDefaultAsync(u => u.NormalizedPhoneNumber == phone.E164, ct);
        if (user is null || user.DeletedAt is not null)
            throw new DomainException("شماره تلفن یا رمز عبور اشتباه است.");

        if (user.Status == UserStatus.Disabled)
            throw new DomainException("حساب کاربری شما غیرفعال شده است. با مدیر سایت تماس بگیرید.");

        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            throw new DomainException("شماره تلفن یا رمز عبور اشتباه است.");

        var (access, jwtId, accessExpires) = _tokenService.GenerateAccessToken(user);
        var (refresh, _) = await _tokenService.GenerateRefreshTokenAsync(user, ipAddress, jwtId, ct);

        user.LastSeen = DateTime.UtcNow;
        user.IsOnline = false;
        await _db.SaveChangesAsync(ct);

        _log.LogInformation("User logged in: {Phone}", user.PhoneNumber);
        return new AuthResponse(access, refresh, accessExpires, _mapper.Map<UserDto>(user));
    }

    public async Task LogoutAsync(string refreshToken, string? ipAddress, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(refreshToken)) return;
        await _tokenService.RevokeRefreshTokenAsync(refreshToken, ipAddress, "logout", null, ct);
    }

    public async Task<TokenResponse?> RefreshAsync(string accessToken, string refreshToken, string? ipAddress, CancellationToken ct = default)
    {
        var result = await _tokenService.RotateTokensAsync(accessToken, refreshToken, ipAddress, ct);
        if (result is null) return null;
        return new TokenResponse(result.Value.AccessToken, result.Value.RefreshToken, result.Value.AccessExpiresAt);
    }

    public async Task<UserDto?> GetCurrentUserAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        return user is null ? null : _mapper.Map<UserDto>(user);
    }
}
