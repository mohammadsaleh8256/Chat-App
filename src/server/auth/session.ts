import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { generateSessionToken } from './password';

export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || 'messenger_session';
const SESSION_TTL_DAYS = 30;

interface CreateSessionInput {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
}

interface SessionUser {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'ADMIN';
  avatarUrl?: string | null;
}

/**
 * Create a new session in DB and set the cookie.
 */
export async function createSession(input: CreateSessionInput): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: {
      token,
      userId: input.userId,
      expiresAt,
      userAgent: input.userAgent?.slice(0, 500),
      ipAddress: input.ipAddress,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  return token;
}

/**
 * Get the current authenticated user from the session cookie.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    await db.user.update({
      where: { id: session.userId },
      data: { lastSeenAt: new Date() },
    }).catch(() => {});

    return {
      id: session.user.id,
      phone: session.user.phone,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      role: session.user.role,
      avatarUrl: session.user.avatarUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Destroy the current session (logout).
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } }).catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Require an authenticated user; throws if not.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}

/**
 * Require an admin user; throws if not admin.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('FORBIDDEN');
  return user;
}

export type { SessionUser };
