/**
 * src/utils/security.ts
 * Application Security & Input Sanitization Utilities
 */

/**
 * Normalizes any user-entered URL.
 * Automatically adds https:// if no protocol was supplied (e.g. forms.gle -> https://forms.gle).
 * Validates that dangerous schemes (javascript:, data:, vbscript:) are rejected.
 */
export function normalizeRegistrationUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let trimmed = raw.trim();
  if (!trimmed) return null;

  // Block malicious schemes and control characters
  if (/^javascript:/i.test(trimmed) || /^data:/i.test(trimmed) || /^vbscript:/i.test(trimmed) || /[\x00-\x1F\x7F]/.test(trimmed)) {
    return null;
  }

  // Prepend https:// if no protocol is present
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    trimmed = `https://${trimmed.replace(/^\/+/, '')}`;
  }

  return trimmed;
}

/**
 * Validates whether a given URL string is a safe HTTP or HTTPS URL.
 * Automatically handles domain links without explicit protocols.
 * Strictly blocks javascript:, data:, vbscript:, and control character injections.
 */
export function isSafeHttpUrl(url: string | null | undefined): boolean {
  const normalized = normalizeRegistrationUrl(url);
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
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
  const normalized = normalizeRegistrationUrl(url);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * Sanitizes text content against CSV / Spreadsheet Formula Injection (CWE-1236).
 * Prepends a single quote if the field starts with =, +, -, @, tab, or CR.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);
  // Neutralize formula triggers
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}
