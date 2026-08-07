/*
 * In-memory OTP store used only in development for local testing.
 * Not suitable for production — lives only in process memory.
 */

type Entry = { otp: string; expiresAt: number };

const STORE = new Map<string, Entry>();

export function setDevOtp(email: string, otp: string, ttlMs = 5 * 60_000) {
  const expiresAt = Date.now() + ttlMs;
  STORE.set(email.toLowerCase(), { otp, expiresAt });
}

export function verifyDevOtp(email: string, otp: string) {
  const entry = STORE.get(email.toLowerCase());
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    STORE.delete(email.toLowerCase());
    return false;
  }
  const ok = entry.otp === otp;
  if (ok) STORE.delete(email.toLowerCase());
  return ok;
}

export function clearExpired() {
  const now = Date.now();
  for (const [k, v] of STORE.entries()) {
    if (v.expiresAt <= now) STORE.delete(k);
  }
}

export function peekDevOtp(email: string) {
  const entry = STORE.get(email.toLowerCase());
  return entry ? entry.otp : null;
}
