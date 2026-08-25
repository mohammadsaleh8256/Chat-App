using AutoMapper;
using ChatApp.Application.Interfaces;
using ChatApp.Contracts.Dtos;
using ChatApp.Domain.Exceptions;
using ChatApp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly ChatAppDbContext _db;
    private readonly IMapper _mapper;
    private readonly IPresenceService _presence;

    public UserService(ChatAppDbContext db, IMapper mapper, IPresenceService presence)
    {
        _db = db;
        _mapper = mapper;
        _presence = presence;
    }

    public async Task<IReadOnlyList<UserSummaryDto>> ListUsersAsync(Guid currentUserId, string? search, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var q = _db.Users.AsNoTracking().Where(u => u.Id != currentUserId && u.DeletedAt == null);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(u => u.FirstName.Contains(s) || u.LastName.Contains(s) || u.FullName.Contains(s) || u.PhoneNumber.Contains(s));
        }

        var users = await q
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(ct);

        var dtos = _mapper.Map<List<UserSummaryDto>>(users);
        // Update online status from presence
        var onlineIds = (await _presence.GetOnlineUserIdsAsync(ct)).ToHashSet();
        foreach (var d in dtos)
        {
            d.GetType().GetProperty(nameof(UserSummaryDto.IsOnline))!
                .SetValue(d, onlineIds.Contains(d.Id));
        }
        return dtos;
    }

    public async Task<UserDto?> GetUserAsync(Guid id, CancellationToken ct = default)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);
        return user is null ? null : _mapper.Map<UserDto>(user);
    }

    public async Task<UserDto?> GetProfileAsync(Guid userId, CancellationToken ct = default)
    {
        return await GetUserAsync(userId, ct);
    }

    public async Task<UserDto> UpdateProfileAsync(Guid userId, string firstName, string lastName, string? avatarUrl, string? bio, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct) ?? throw new EntityNotFoundException("User", userId);
        user.FirstName = firstName.Trim();
        user.LastName = lastName.Trim();
        if (avatarUrl is not null) user.AvatarUrl = avatarUrl;
        if (bio is not null) user.Bio = bio;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return _mapper.Map<UserDto>(user);
    }

    public async Task UpdatePresenceAsync(Guid userId, bool isOnline, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return;
        user.IsOnline = isOnline;
        user.LastSeen = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<UserSummaryDto>> GetOnlineUsersAsync(CancellationToken ct = default)
    {
        var onlineIds = (await _presence.GetOnlineUserIdsAsync(ct)).ToList();
        if (onlineIds.Count == 0) return Array.Empty<UserSummaryDto>();
        var users = await _db.Users.AsNoTracking().Where(u => onlineIds.Contains(u.Id)).ToListAsync(ct);
        return _mapper.Map<List<UserSummaryDto>>(users);
    }
}
