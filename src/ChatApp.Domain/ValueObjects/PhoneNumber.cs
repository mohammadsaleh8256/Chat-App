using ChatApp.Domain.Exceptions;

namespace ChatApp.Domain.ValueObjects;

/// <summary>
/// Normalizes Iranian phone numbers to E.164 format.
/// Handles: 09162744975, +989162744975, 00989162744975, 989162744975
/// All become: +989162744975
/// </summary>
public readonly record struct PhoneNumber
{
    public string Value { get; }
    public string E164 => Value;

    private PhoneNumber(string normalized)
    {
        Value = normalized;
    }

    public static PhoneNumber Create(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            throw new DomainException("شماره تلفن الزامی است.");

        var digits = new string(raw.Where(char.IsDigit).ToArray());

        // 09162744975 (11 digits, starts with 09) -> +989162744975
        if (digits.Length == 11 && digits.StartsWith("09"))
            return new PhoneNumber("+98" + digits[1..]);

        // 9162744975 (10 digits starting with 9) -> +989162744975
        if (digits.Length == 10 && digits.StartsWith("9"))
            return new PhoneNumber("+98" + digits);

        // 989162744975 (12 digits, already starts with country code 98) -> +989162744975
        if (digits.Length == 12 && digits.StartsWith("98"))
            return new PhoneNumber("+" + digits);

        // 00989162744975 (14 digits with 00 prefix) -> strip 00 -> 989162744975 -> +989162744975
        if (digits.Length == 14 && digits.StartsWith("0098"))
            return new PhoneNumber("+" + digits[2..]);

        // Some users may type +989162744975 which becomes 00989162744975 after stripping the +
        // (length 13 because +98 prefix gives 12 digits without +, but with 00 prefix gives 14)
        // Handle 13-digit case: assume first 0 is spurious
        if (digits.Length == 13 && digits.StartsWith("098"))
            return new PhoneNumber("+" + digits[1..]);

        throw new DomainException($"شماره تلفن «{raw}» معتبر نیست. فرمت صحیح: 09162744975 یا +989162744975");
    }

    public static bool TryParse(string raw, out PhoneNumber phone)
    {
        try
        {
            phone = Create(raw);
            return true;
        }
        catch
        {
            phone = default;
            return false;
        }
    }

    public string ToDisplay() => "0" + Value[3..];   // +989162744975 -> 09162744975

    public override string ToString() => Value;

    public static implicit operator string(PhoneNumber p) => p.Value;
}
