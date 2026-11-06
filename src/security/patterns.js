// What counts as "sensitive". Shared by redaction and the save/env warnings.

export const SENSITIVE_HEADERS = new Set([
  'authorization', 'proxy-authorization', 'cookie', 'set-cookie',
  'x-api-key', 'api-key', 'x-auth-token', 'x-access-token', 'x-csrf-token',
]);

export const SENSITIVE_HEADER_RE = /api[_-]?key|secret|token|auth|cookie|password|credential/i;

// Key names (query params, JSON fields, env vars) that look like secrets.
export const SENSITIVE_KEY = /pass(word|wd)?|secret|token|api[_-]?key|auth|signature|credential/i;

export const REDACTED = '[REDACTED]';
