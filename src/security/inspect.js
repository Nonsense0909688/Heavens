// Questions we ask about a template: "does it hold secrets?" and "where were they redacted?"
import { hasPlaceholder } from '../core/variables.js';
import { SENSITIVE_HEADERS, REDACTED } from './patterns.js';
import { redactTemplate } from './redact.js';

/** Names of literal secrets still present (for save-time warnings). */
export function findLiteralSecrets(t) {
  const found = [];
  for (const [k, v] of Object.entries(t.headers || {})) {
    if (SENSITIVE_HEADERS.has(k.toLowerCase()) && !hasPlaceholder(v)) found.push(`header ${k}`);
  }
  if (t.auth && !hasPlaceholder(t.auth.token ?? t.auth.value)) found.push('--bearer/--basic credentials');
  if (found.length === 0 && JSON.stringify(redactTemplate(t)).includes(REDACTED)) {
    found.push('sensitive-looking fields in the URL/body');
  }
  return found;
}

/** Human-readable locations of [REDACTED] values (for replay/save errors). */
export function redactedPlaces(t) {
  const places = [];
  for (const [k, v] of Object.entries(t.headers || {})) {
    if (String(v).includes(REDACTED)) places.push(`header ${k}  (re-supply with -H "${k}: …")`);
  }
  if (t.auth && JSON.stringify(t.auth).includes(REDACTED)) places.push('auth  (re-supply with --bearer / --basic)');
  for (const q of t.query || []) {
    if (q.includes(REDACTED)) places.push(`query ${q.split('=')[0]}  (re-supply with -q ${q.split('=')[0]}=…)`);
  }
  if (t.url?.includes(REDACTED)) places.push('URL query string  (re-supply the full URL)');
  if (t.body && JSON.stringify(t.body).includes(REDACTED)) places.push('request body  (re-supply with --json / --data / --form)');
  return places;
}

/** True if any part of the template was redacted (so it can't be re-sent as-is). */
export const hasRedactions = (t) => JSON.stringify(t).includes(REDACTED);
