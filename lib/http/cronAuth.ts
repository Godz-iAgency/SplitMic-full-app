import { timingSafeEqual } from "node:crypto";

/**
 * Shared bearer-token check for scheduled endpoints (`app/api/cron/*`).
 * Deliberately scheduler-agnostic: any cron service that can send a GET with
 * an `Authorization: Bearer <secret>` header works (Vercel Cron sends
 * exactly that shape automatically).
 */
export function isAuthorizedCronRequest(
  request: Request,
  secret: string,
): boolean {
  const provided = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!provided) return false;
  return secretsMatch(provided, secret);
}

/** Constant-time compare so a wrong secret can't be guessed by timing. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
