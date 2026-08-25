import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

/**
 * Hash a plaintext password using bcrypt (10 rounds).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a cryptographically secure random session token.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Normalize an Iranian phone number to local 0-prefixed 11-digit format.
 * Examples:
 *   "+98 916 274 4975" -> "09162744975"
 *   "00989162744975"   -> "09162744975"
 *   "989162744975"     -> "09162744975"
 *   "9162744975"       -> "09162744975"
 */
export function normalizePhone(phone: string): string {
  let p = phone.replace(/[^\d]/g, '');
  if (p.startsWith('0098')) p = '0' + p.slice(4);
  else if (p.startsWith('98')) p = '0' + p.slice(2);
  else if (!p.startsWith('0')) p = '0' + p;
  return p;
}

/**
 * Basic Iranian mobile number format validation.
 */
export function isValidIranMobile(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^09\d{9}$/.test(normalized);
}
