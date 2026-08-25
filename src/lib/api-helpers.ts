import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Wrap a route handler with standard error handling.
 * Returns 401 for UNAUTHORIZED, 403 for FORBIDDEN, 400 for Zod errors, 500 otherwise.
 */
export function withErrorHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse>
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      if (message === 'UNAUTHORIZED') {
        return NextResponse.json({ error: 'احراز هویت نشده' }, { status: 401 });
      }
      if (message === 'FORBIDDEN') {
        return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 });
      }
      if (message.startsWith('NOT_FOUND:')) {
        return NextResponse.json({ error: message.slice(11) }, { status: 404 });
      }
      if (message.startsWith('BAD_REQUEST:')) {
        return NextResponse.json({ error: message.slice(13) }, { status: 400 });
      }
      if (message.startsWith('CONFLICT:')) {
        return NextResponse.json({ error: message.slice(9) }, { status: 409 });
      }
      console.error('[api-error]', err);
      return NextResponse.json({ error: 'خطای سرور' }, { status: 500 });
    }
  };
}

/**
 * Parse Zod input and throw a standardized BAD_REQUEST error on failure.
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(`BAD_REQUEST:${first?.message ?? 'ورودی نامعتبر'}`);
  }
  return result.data;
}
