using ChatApp.Domain.Entities;
using ChatApp.Domain.Enums;
using ChatApp.Infrastructure.Authentication;
using ChatApp.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Persistence;

public static class DbSeeder
{
    public static async Task SeedAsync(ChatAppDbContext db, string initialAdminPhone)
    {
        // Ensure AppSettings row for INITIAL_ADMIN_PHONE exists
        var adminSetting = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == "INITIAL_ADMIN_PHONE");
        var phone = PhoneNumber.Create(initialAdminPhone);
        if (adminSetting is null)
        {
            db.AppSettings.Add(new AppSetting
            {
                Key = "INITIAL_ADMIN_PHONE",
                Value = phone.E164,
                Description = "Phone number of the initial admin user (granted Admin role on registration).",
                UpdatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }
        else if (!string.Equals(adminSetting.Value, phone.E164, StringComparison.OrdinalIgnoreCase))
        {
            adminSetting.Value = phone.E164;
            adminSetting.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }

        // Note: We don't auto-create admin user. The first user that registers with the configured phone
        // will automatically be granted Admin role by AuthService.RegisterAsync.
        // This avoids hardcoding credentials in source code.
    }
}
