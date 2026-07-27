/**
 * Input Validation Utilities for Edge Functions.
 *
 * Lightweight schema validation without external dependencies.
 * All validation errors return safe, user-facing messages.
 */

import * as response from './response.ts';

// ─── Validation Types ───────────────────────────────────────────────────────

type FieldType = 'string' | 'number' | 'boolean' | 'uuid' | 'email' | 'url' | 'array' | 'object';

interface FieldRule {
  type: FieldType;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: readonly string[];
  pattern?: RegExp;
}

export type Schema = Record<string, FieldRule>;

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Regex Patterns ─────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/.+/;

// ─── Core Validation ────────────────────────────────────────────────────────

/**
 * Validates an object against a schema definition.
 *
 * @param data - The input data object to validate
 * @param schema - The validation schema
 * @returns ValidationResult with valid flag and error messages
 */
export function validate(data: Record<string, unknown>, schema: Schema): ValidationResult {
  const errors: string[] = [];

  for (const [field, rule] of Object.entries(schema)) {
    const value = data[field];

    // Check required fields
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required.`);
      continue;
    }

    // Skip optional fields that are not provided
    if (value === undefined || value === null) {
      continue;
    }

    // Type checks
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`${field} must be a string.`);
          continue;
        }
        if (rule.minLength !== undefined && value.length < rule.minLength) {
          errors.push(`${field} must be at least ${rule.minLength} characters.`);
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          errors.push(`${field} must be at most ${rule.maxLength} characters.`);
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${field} has an invalid format.`);
        }
        if (rule.enum && !rule.enum.includes(value)) {
          errors.push(`${field} must be one of: ${rule.enum.join(', ')}.`);
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push(`${field} must be a number.`);
          continue;
        }
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${field} must be at least ${rule.min}.`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${field} must be at most ${rule.max}.`);
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`${field} must be a boolean.`);
        }
        break;

      case 'uuid':
        if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
          errors.push(`${field} must be a valid UUID.`);
        }
        break;

      case 'email':
        if (typeof value !== 'string' || !EMAIL_REGEX.test(value)) {
          errors.push(`${field} must be a valid email address.`);
        }
        break;

      case 'url':
        if (typeof value !== 'string' || !URL_REGEX.test(value)) {
          errors.push(`${field} must be a valid URL.`);
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`${field} must be an array.`);
        }
        break;

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          errors.push(`${field} must be an object.`);
        }
        break;
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates input and returns a 422 response if invalid, or null if valid.
 *
 * Usage:
 * ```ts
 * const invalid = validateOrRespond(body, schema);
 * if (invalid) return invalid;
 * // body is valid, continue
 * ```
 */
export function validateOrRespond(data: Record<string, unknown>, schema: Schema): Response | null {
  const result = validate(data, schema);
  if (!result.valid) {
    return response.validationError('VALIDATION_ERROR', result.errors.join(' '));
  }
  return null;
}

/**
 * Safely parses JSON from a Request body.
 * Returns the parsed object or a 400 error response.
 */
export async function parseJsonBody(req: Request): Promise<Record<string, unknown> | Response> {
  try {
    const text = await req.text();
    if (!text || text.trim() === '') {
      return response.badRequest('EMPTY_BODY', 'Request body is required.');
    }
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return response.badRequest('INVALID_BODY', 'Request body must be a JSON object.');
    }
    return parsed as Record<string, unknown>;
  } catch {
    return response.badRequest('INVALID_JSON', 'Request body must be valid JSON.');
  }
}

/**
 * Validates a UUID string parameter.
 */
export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Extracts and validates pagination parameters from URL search params.
 * Enforces min/max bounds.
 */
export function parsePagination(url: URL): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20)
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
