// Run an expectation against a response. Each kind of check is its own small function
// that returns { ok, label, detail? }, so adding a new check is easy.
import { isDeepStrictEqual } from 'node:util';
import { getPath } from '../core/jsonpath.js';
import { normalizeExpect } from './parse.js';
import { validateJsonSchema } from './schema.js';

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const show = (v) => { const s = JSON.stringify(v); return s && s.length > 60 ? s.slice(0, 57) + '…' : s; };
const check = (ok, label, detail) => ({ ok, label, detail });

// ── status / time / headers / body text ──────────────────────────────

/** spec is 200, "200", "2xx", or a list of those. */
const statusMatches = (spec, status) =>
  [].concat(spec).some((s) => {
    if (typeof s === 'number') return s === status;
    if (/^\d{3}$/.test(String(s).trim())) return Number(s) === status;
    return String(status)[0] === String(s).trim().toLowerCase()[0];
  });

function checkStatus(spec, res) {
  const ok = statusMatches(spec, res.status);
  return check(ok, `status is ${[].concat(spec).join(' or ')}`, ok ? undefined : `got ${res.status}`);
}

function checkTime(maxMs, res) {
  const ok = res.timeMs <= maxMs;
  return check(ok, `response time ≤ ${maxMs} ms`, ok ? undefined : `took ${Math.round(res.timeMs)} ms`);
}

function checkHeader(name, want, res) {
  const got = res.headers[name.toLowerCase()];
  const ok = want === true ? got !== undefined : String(got).toLowerCase() === String(want).toLowerCase();
  return check(
    ok,
    `header ${name}${want === true ? ' exists' : ` = ${want}`}`,
    ok ? undefined : `got ${got === undefined ? 'nothing' : got}`,
  );
}

function checkContains(needle, res) {
  return check(typeof res.text === 'string' && res.text.includes(needle), `body contains "${needle}"`);
}

// ── JSON body checks (one function per operator) ─────────────────────

const notFound = 'path not found';
const detailFor = (ok, found, value) => (ok ? undefined : found ? `got ${show(value)}` : notFound);

const JSON_CHECKS = {
  equals(j, found, value) {
    // Deep-equal, but let "5" match 5 for scalars (values from the CLI are strings).
    const ok = found && (isDeepStrictEqual(value, j.equals) ||
      (typeof value !== 'object' && value !== null && String(value) === String(j.equals)));
    return [ok, `= ${show(j.equals)}`, detailFor(ok, found, value)];
  },
  notEquals(j, found, value) {
    return [!found || !isDeepStrictEqual(value, j.notEquals), `!= ${show(j.notEquals)}`];
  },
  gtlt(j, found, value) {
    const n = Number(value);
    const isGt = j.gt !== undefined;
    const ok = found && (isGt ? n > j.gt : n < j.lt);
    return [ok, `${isGt ? '>' : '<'} ${j.gt ?? j.lt}`, detailFor(ok, found, value)];
  },
  matches(j, found, value) {
    const ok = found && new RegExp(j.matches).test(String(value));
    return [ok, `matches /${j.matches}/`, detailFor(ok, found, value)];
  },
  type(j, found, value) {
    const ok = found && typeOf(value) === j.type;
    return [ok, `is ${j.type}`, found ? (ok ? undefined : `got ${typeOf(value)}`) : notFound];
  },
  exists(j, found) {
    return [found, 'exists', found ? undefined : notFound];
  },
};

function pickJsonCheck(j) {
  if ('equals' in j) return JSON_CHECKS.equals;
  if ('notEquals' in j) return JSON_CHECKS.notEquals;
  if ('gt' in j || 'lt' in j) return JSON_CHECKS.gtlt;
  if ('matches' in j) return JSON_CHECKS.matches;
  if ('type' in j) return JSON_CHECKS.type;
  return JSON_CHECKS.exists;
}

function checkJson(j, res) {
  if (res.json === undefined) return check(false, `json ${j.path}`, 'response body is not JSON');
  const { found, value } = getPath(res.json, j.path);
  const [ok, text, detail] = pickJsonCheck(j)(j, found, value);
  return check(ok, `json ${j.path} ${text}`, detail);
}

// ── public entry point ───────────────────────────────────────────────

/** @returns { passed: boolean, checks: [{ ok, label, detail? }] } */
export function evaluate(expectRaw, res) {
  const e = normalizeExpect(expectRaw);
  if (!e) return { passed: true, checks: [] };

  const checks = [];
  if (e.status !== undefined) checks.push(checkStatus(e.status, res));
  if (e.maxTime !== undefined) checks.push(checkTime(e.maxTime, res));
  for (const [name, want] of Object.entries(e.headers || {})) checks.push(checkHeader(name, want, res));
  for (const needle of e.contains || []) checks.push(checkContains(needle, res));
  for (const j of e.json || []) checks.push(checkJson(j, res));
  const schema = e.jsonSchema ?? e.schema;
  if (schema !== undefined) {
    if (res.json === undefined) checks.push(check(false, 'json schema', 'response body is not JSON'));
    else {
      const errors = validateJsonSchema(res.json, schema);
      checks.push(check(errors.length === 0, 'json schema', errors.length ? errors.slice(0, 5).join('; ') : undefined));
    }
  }

  return { passed: checks.every((c) => c.ok), checks };
}
