using ChatApp.Contracts.Dtos;

namespace ChatApp.Web;

public static class DisplayExtensions
{
    public static string ToDisplayPhone(this string phone)
    {
        if (string.IsNullOrEmpty(phone)) return "";
        // +989162744975 -> 09162744975
        if (phone.StartsWith("+98")) return "0" + phone[3..];
        if (phone.StartsWith("98")) return "0" + phone[2..];
        return phone;
    }

    public static string ToPersianTime(this DateTime dt)
    {
        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById("Iran Standard Time");
            var iranTime = TimeZoneInfo.ConvertTimeFromUtc(dt, tz);
            var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
            if (iranTime.Date == now.Date)
                return iranTime.ToString("HH:mm");
            if ((now - iranTime).TotalDays < 7)
                return iranTime.ToString("ddd HH:mm");
            return iranTime.ToString("yyyy/MM/dd HH:mm");
        }
        catch { return dt.ToString("yyyy/MM/dd HH:mm"); }
    }

    public static string ToRelativeTime(this DateTime dt)
    {
        var diff = DateTime.UtcNow - dt;
        if (diff.TotalMinutes < 1) return "همین حالا";
        if (diff.TotalMinutes < 60) return $"{(int)diff.TotalMinutes} دقیقه پیش";
        if (diff.TotalHours < 24) return $"{(int)diff.TotalHours} ساعت پیش";
        if (diff.TotalDays < 30) return $"{(int)diff.TotalDays} روز پیش";
        return dt.ToPersianTime();
    }

    public static string FormatFileSize(this long bytes)
    {
        if (bytes < 1024) return $"{bytes} B";
        if (bytes < 1024 * 1024) return $"{bytes / 1024.0:F1} KB";
        if (bytes < 1024 * 1024 * 1024) return $"{bytes / (1024.0 * 1024):F1} MB";
        return $"{bytes / (1024.0 * 1024 * 1024):F2} GB";
    }
}
