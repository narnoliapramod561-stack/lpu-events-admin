/**
 * src/utils/security.ts
 * Application Security & Input Sanitization Utilities
 */

/**
 * Validates whether a given URL string is a safe HTTP or HTTPS URL.
 * Strictly blocks javascript:, data:, vbscript:, and relative protocol injections.
 */
export function isSafeHttpUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Block protocol-relative URLs (e.g. //attacker.com) and control characters
  if (trimmed.startsWith('//') || /[\x00-\x1F\x7F]/.test(trimmed)) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Sanitizes and normalizes an external URL.
 * Returns the valid href string if http/https, or null if invalid or unsafe.
 */
export function sanitizeSafeUrl(url: string | null | undefined): string | null {
  if (!isSafeHttpUrl(url)) {
    return null;
  }
  try {
    const parsed = new URL(url!.trim());
    return parsed.href;
  } catch {
    return null;
  }
}
