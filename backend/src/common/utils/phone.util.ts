/**
 * Normalize Iranian phone numbers to E.164 format.
 * Handles: 09162744975, +989162744975, 00989162744975, 989162744975
 * All become: +989162744975
 */
export class PhoneUtil {
  static normalize(raw: string): string {
    if (!raw) throw new Error('شماره تلفن الزامی است.');
    const digits = raw.replace(/\D/g, '');

    // 09162744975 (11 digits, starts with 09)
    if (digits.length === 11 && digits.startsWith('09'))
      return '+98' + digits.slice(1);

    // 9162744975 (10 digits, starts with 9)
    if (digits.length === 10 && digits.startsWith('9'))
      return '+98' + digits;

    // 989162744975 (12 digits, starts with 98)
    if (digits.length === 12 && digits.startsWith('98'))
      return '+' + digits;

    // 00989162744975 (14 digits with 00 prefix)
    if (digits.length === 14 && digits.startsWith('0098'))
      return '+' + digits.slice(2);

    // 0989162744975 (13 digits, starts with 098)
    if (digits.length === 13 && digits.startsWith('098'))
      return '+' + digits.slice(1);

    throw new Error(`شماره تلفن «${raw}» معتبر نیست. فرمت صحیح: 09162744975 یا +989162744975`);
  }

  static tryNormalize(raw: string): string | null {
    try { return PhoneUtil.normalize(raw); }
    catch { return null; }
  }

  static toDisplay(phone: string): string {
    if (!phone) return '';
    if (phone.startsWith('+98')) return '0' + phone.slice(3);
    if (phone.startsWith('98')) return '0' + phone.slice(2);
    return phone;
  }

  static hash(phone: string): string {
    // Simple SHA-256-like hash using node crypto (lazy import)
    // Returns a hex string suitable for unique indexing.
    // Note: PhoneUtil.hash requires Node.js crypto.
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(phone).digest('hex');
  }
}
