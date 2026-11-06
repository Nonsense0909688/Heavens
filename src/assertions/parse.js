// Turn --expect-* flags (and flow "expect" blocks) into a normalized expectation object.
import fs from 'node:fs';
import { HeavenError } from '../core/errors.js';

const parseLiteral = (s) => { try { return JSON.parse(s); } catch { return s; } };

/**
 * One --expect-json value:
 *   "data.id=5"  "name~^An"  "count>3"  "items!=[]"  "user.email" (just: exists)
 */
export function parseJsonExpect(str) {
  const m = /^([^=!<>~]+?)\s*(!=|=|>|<|~)\s*([\s\S]*)$/.exec(str);
  if (!m) return { path: str.trim(), exists: true };

  const [, path, op, raw] = m;
  switch (op) {
    case '=': return { path, equals: parseLiteral(raw) };
    case '!=': return { path, notEquals: parseLiteral(raw) };
    case '>': return { path, gt: Number(raw) };
    case '<': return { path, lt: Number(raw) };
    case '~': return { path, matches: raw };
    default: throw new HeavenError(`Bad --expect-json "${str}"`);
  }
}

/** "200" -> 200 · "200,201" -> [200,201] · "2xx" -> "2xx" */
export function parseStatusExpect(s) {
  const parts = String(s).split(',').map((p) => p.trim());
  const parsed = parts.map((p) => {
    if (/^\d{3}$/.test(p)) return Number(p);
    if (/^[1-5]xx$/i.test(p)) return p.toLowerCase();
    return null;
  });
  if (parsed.includes(null)) throw new HeavenError(`Bad --expect-status "${s}". Use 200, 200,201 or 2xx`);
  return parsed.length === 1 ? parsed[0] : parsed;
}

function parseMaxTime(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new HeavenError('--expect-time must be a positive number of milliseconds');
  return n;
}

/** "Name: value" | "Name=value" | "Name" -> [name, want] for --assert-header */
export function parseAssertHeader(str) {
  const colon = str.indexOf(':');
  const eq = str.indexOf('=');
  const cut = colon !== -1 && (eq === -1 || colon < eq) ? colon : eq;
  if (cut <= 0) return [str.trim(), true];
  return [str.slice(0, cut).trim(), str.slice(cut + 1).trim()];
}

/** --json-schema accepts inline JSON or a path to a schema file. */
export function loadJsonSchema(value) {
  const s = String(value).trim();
  if (s.startsWith('{')) {
    try { return JSON.parse(s); } catch (e) { throw new HeavenError(`--json-schema is not valid JSON: ${e.message}`); }
  }
  try { return JSON.parse(fs.readFileSync(s, 'utf8')); }
  catch (e) { throw new HeavenError(`Cannot load --json-schema ${s}: ${e.code === 'ENOENT' ? 'file not found' : e.message}`); }
}

/** Collect every --expect-* flag into one expectation object (or undefined if none given). */
export function expectFromFlags(flags) {
  const e = {};
  if (flags['expect-status'] !== undefined) e.status = parseStatusExpect(flags['expect-status']);
  if (flags['expect-time'] !== undefined) e.maxTime = parseMaxTime(flags['expect-time']);
  if (flags['expect-json']?.length) e.json = flags['expect-json'].map(parseJsonExpect);
  if (flags['expect-contains']?.length) e.contains = [...flags['expect-contains']];
  if (flags['assert-body']?.length) e.contains = [...(e.contains ?? []), ...flags['assert-body']];
  if (flags['assert-header']?.length) e.headers = Object.fromEntries(flags['assert-header'].map(parseAssertHeader));
  if (flags['json-schema'] !== undefined) e.jsonSchema = loadJsonSchema(flags['json-schema']);
  return Object.keys(e).length ? e : undefined;
}

/** Accept the friendlier flow-file shapes: json as {path: value} map, contains as a single string. */
export function normalizeExpect(e) {
  if (!e) return null;
  const out = { ...e };
  if (out.json && !Array.isArray(out.json)) {
    out.json = Object.entries(out.json).map(([path, equals]) => ({ path, equals }));
  }
  if (typeof out.contains === 'string') out.contains = [out.contains];
  return out;
}
