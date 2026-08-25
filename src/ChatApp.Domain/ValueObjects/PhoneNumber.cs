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

        // 09162744975 -> +989162744975
        if (digits.Length == 11 && digits.StartsWith("09"))
            return new PhoneNumber("+98" + digits[1..]);

        // 9162744975 (10 digits starting with 9) -> +989162744975
        if (digits.Length == 10 && digits.StartsWith("9"))
            return new PhoneNumber("+98" + digits);

        // +98 9162744975 already (12 digits starting with 98)
        if (digits.Length == 12 && digits.StartsWith("98"))
            return new PhoneNumber("+" + digits);

        // 00989162744975 stripped to 989162744975 (13 digits)
        if (digits.Length == 13 && digits.StartsWith("989"))
            return new PhoneNumber("+" + digits[..12] + digits[12..]);

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
