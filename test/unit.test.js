import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// security / redact
import { redactHeaders, redactKeyValue, redactUrl, redactBodyText, redactTemplate } from '../src/security/redact.js';
import { findLiteralSecrets, redactedPlaces } from '../src/security/inspect.js';

// core
import { Resolver } from '../src/core/variables.js';
import { parsePath, getPath } from '../src/core/jsonpath.js';

// assertions
import { parseJsonExpect, parseStatusExpect, expectFromFlags, parseAssertHeader } from '../src/assertions/parse.js';
import { evaluate } from '../src/assertions/evaluate.js';
import { validateJsonSchema } from '../src/assertions/schema.js';

// request
import { joinBase, looksLikeUrl } from '../src/request/url.js';
import { prepare } from '../src/request/prepare.js';
import { templateFromFlags, mergeTemplate } from '../src/request/template.js';

// storage
import { readHistory, appendHistory } from '../src/storage/history-log.js';
import { readJson, writeJson } from '../src/storage/json-file.js';

// http cookies
import { parseSetCookie } from '../src/http/cookie-jar.js';

// completion
import { bashScript, zshScript, powershellScript } from '../src/commands/completion.js';

function tmpFile(t, name = 'f') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'heaven-unit-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, name);
}

// ── redact ──
test('redactHeaders masks authorization but keeps Bearer prefix', () => {
  assert.deepEqual(redactHeaders({ Authorization: 'Bearer abc' }), { Authorization: 'Bearer [REDACTED]' });
  assert.deepEqual(redactHeaders({ 'x-api-key': 'k' }), { 'x-api-key': '[REDACTED]' });
  assert.deepEqual(redactHeaders({ 'X-Custom-Secret': 's' }), { 'X-Custom-Secret': '[REDACTED]' });
  assert.deepEqual(redactHeaders({ 'Content-Type': 'text/plain' }), { 'Content-Type': 'text/plain' });
});
test('redactHeaders keeps placeholders', () => {
  assert.deepEqual(redactHeaders({ Authorization: '{{token}}' }), { Authorization: '{{token}}' });
});
test('redactKeyValue masks sensitive keys only', () => {
  assert.equal(redactKeyValue('token=abc'), 'token=[REDACTED]');
  assert.equal(redactKeyValue('page=2'), 'page=2');
  assert.equal(redactKeyValue('token=@file'), 'token=@file');
});
test('redactUrl masks query secrets', () => {
  assert.equal(redactUrl('https://x/?a=1&token=abc'), 'https://x/?a=1&token=[REDACTED]');
  assert.equal(redactUrl('https://x/?a=1'), 'https://x/?a=1');
});
test('redactUrl tolerates missing url', () => {
  assert.equal(redactUrl(undefined), undefined);
  assert.equal(redactUrl(null), null);
});
test('redactBodyText masks JSON secrets', () => {
  assert.equal(redactBodyText('{"password":"hunter2","name":"a"}'), '{"password":"[REDACTED]","name":"a"}');
});
test('redactBodyText masks form raw bodies', () => {
  assert.equal(redactBodyText('user=a&password=hunter2'), 'user=a&password=[REDACTED]');
  assert.equal(redactBodyText('plain text'), 'plain text');
});
test('redactTemplate does not crash on missing url and redacts raw body', () => {
  const t = redactTemplate({ body: { type: 'raw', value: 'token=abc&x=1' } });
  assert.equal(t.body.value, 'token=[REDACTED]&x=1');
  assert.equal(t.url, undefined);
});
test('findLiteralSecrets flags literal but not placeholder secrets', () => {
  assert.ok(findLiteralSecrets({ headers: { Authorization: 'Bearer abc' } }).length);
  assert.equal(findLiteralSecrets({ headers: { Authorization: '{{token}}' } }).length, 0);
});
test('redactedPlaces handles missing url', () => {
  assert.deepEqual(redactedPlaces({}), []);
});

// ── variables ──
test('Resolver resolves simple and nested vars', () => {
  const r = new Resolver({ a: 'hello', b: '{{a}} world' });
  assert.equal(r.str('{{b}}'), 'hello world');
});
test('Resolver collects all missing names', () => {
  const r = new Resolver({});
  r.str('{{x}} and {{y}}');
  assert.throws(() => r.assertComplete(), /\{\{x\}\}.*\{\{y\}\}/s);
});
test('Resolver resolves $env', () => {
  process.env.HEAVEN_TEST_VAR = 'from-env';
  const r = new Resolver({});
  assert.equal(r.str('{{$env.HEAVEN_TEST_VAR}}'), 'from-env');
  delete process.env.HEAVEN_TEST_VAR;
});
test('Resolver leaves non-string input alone', () => {
  const r = new Resolver({});
  assert.equal(r.str(42), 42);
});

// ── jsonpath ──
test('parsePath and getPath walk indexes and quoted keys', () => {
  assert.deepEqual(parsePath('a.b[0]'), ['a', 'b', 0]);
  assert.equal(getPath({ a: { b: [10] } }, 'a.b[0]').value, 10);
  assert.equal(getPath({ a: 1 }, 'missing').found, false);
});

// ── assertions parse ──
test('parseJsonExpect handles equals, gt, matches, exists', () => {
  assert.deepEqual(parseJsonExpect('id=5'), { path: 'id', equals: 5 });
  assert.deepEqual(parseJsonExpect('count>3'), { path: 'count', gt: 3 });
  assert.deepEqual(parseJsonExpect('name~^An'), { path: 'name', matches: '^An' });
  assert.deepEqual(parseJsonExpect('user.email'), { path: 'user.email', exists: true });
});
test('parseStatusExpect accepts number, list, and 2xx', () => {
  assert.equal(parseStatusExpect('200'), 200);
  assert.deepEqual(parseStatusExpect('200,201'), [200, 201]);
  assert.equal(parseStatusExpect('2xx'), '2xx');
  assert.throws(() => parseStatusExpect('abc'), /Bad --expect-status/);
});
test('parseAssertHeader parses colon, equals, and bare forms', () => {
  assert.deepEqual(parseAssertHeader('X-A: 1'), ['X-A', '1']);
  assert.deepEqual(parseAssertHeader('X-A=1'), ['X-A', '1']);
  assert.deepEqual(parseAssertHeader('X-A'), ['X-A', true]);
});
test('expectFromFlags wires assert-header, assert-body, json-schema', () => {
  const e = expectFromFlags({ 'assert-header': ['X-A: 1'], 'assert-body': ['hello'], 'json-schema': '{"type":"object"}' });
  assert.deepEqual(e.headers, { 'X-A': '1' });
  assert.deepEqual(e.contains, ['hello']);
  assert.deepEqual(e.jsonSchema, { type: 'object' });
});
test('expectFromFlags loads json-schema from file', (t) => {
  const f = tmpFile(t, 'schema.json');
  fs.writeFileSync(f, JSON.stringify({ type: 'object', required: ['id'] }));
  const e = expectFromFlags({ 'json-schema': f });
  assert.deepEqual(e.jsonSchema.required, ['id']);
});

// ── assertions evaluate ──
const res = (over = {}) => ({ status: 200, timeMs: 10, headers: { 'x-a': '1' }, text: '{"id":5,"name":"Anish"}', json: { id: 5, name: 'Anish' }, ...over });
test('evaluate status: number, string number, and 2xx', () => {
  assert.equal(evaluate({ status: 200 }, res()).passed, true);
  assert.equal(evaluate({ status: '200' }, res()).passed, true);
  assert.equal(evaluate({ status: '2xx' }, res({ status: 201 })).passed, true);
  assert.equal(evaluate({ status: '2xx' }, res({ status: 404 })).passed, false);
});
test('evaluate json checks', () => {
  assert.equal(evaluate({ json: [{ path: 'id', equals: 5 }] }, res()).passed, true);
  assert.equal(evaluate({ json: [{ path: 'id', gt: 3 }] }, res()).passed, true);
  assert.equal(evaluate({ json: [{ path: 'id', gt: 10 }] }, res()).passed, false);
  assert.equal(evaluate({ json: [{ path: 'missing', exists: true }] }, res()).passed, false);
});
test('evaluate headers, contains, and time', () => {
  assert.equal(evaluate({ headers: { 'x-a': '1' } }, res()).passed, true);
  assert.equal(evaluate({ headers: { 'x-a': true } }, res()).passed, true);
  assert.equal(evaluate({ contains: ['Anish'] }, res()).passed, true);
  assert.equal(evaluate({ maxTime: 5 }, res()).passed, false);
});
test('evaluate json-schema pass and fail', () => {
  const schema = { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } };
  assert.equal(evaluate({ jsonSchema: schema }, res()).passed, true);
  assert.equal(evaluate({ jsonSchema: schema }, res({ json: { name: 'x' } })).passed, false);
  assert.equal(evaluate({ jsonSchema: schema }, res({ json: undefined })).passed, false);
});

// ── schema validator ──
test('validateJsonSchema checks type, required, enum, and items', () => {
  assert.deepEqual(validateJsonSchema(5, { type: 'integer' }), []);
  assert.ok(validateJsonSchema('x', { type: 'integer' }).length);
  assert.ok(validateJsonSchema({}, { required: ['id'] }).length);
  assert.ok(validateJsonSchema(3, { enum: [1, 2] }).length);
  assert.ok(validateJsonSchema([1, 'x'], { items: { type: 'integer' } }).length);
  assert.deepEqual(validateJsonSchema([1, 2], { items: { type: 'integer' } }), []);
});

// ── request url ──
test('looksLikeUrl matches bare hosts but not saved names', () => {
  assert.equal(looksLikeUrl('example.com/x'), true);
  assert.equal(looksLikeUrl('api.example.com'), true);
  assert.equal(looksLikeUrl('get-users'), false);
  assert.equal(looksLikeUrl('localhost:3000/x'), true);
  assert.equal(looksLikeUrl('/users'), true);
  assert.equal(looksLikeUrl('https://x.com/a'), true);
});
test('joinBase guesses scheme for bare hosts and localhost', () => {
  assert.equal(joinBase('example.com/x', undefined), 'https://example.com/x');
  assert.equal(joinBase('localhost:3000/x', undefined), 'http://localhost:3000/x');
  assert.equal(joinBase('/users', 'http://a.test/'), 'http://a.test/users');
  assert.throws(() => joinBase('/users', undefined), /no base URL/);
});
test('joinBase treats bare hosts as absolute even with a base URL set', () => {
  assert.equal(joinBase('example.com/x', 'http://a.test'), 'https://example.com/x');
  assert.equal(joinBase('users', 'http://a.test'), 'http://a.test/users');
});
test('prepare resolves vars, base URL, and query', () => {
  const out = prepare({ method: 'GET', url: '/users', query: ['id={{id}}'] }, { vars: { baseUrl: 'http://a.test', id: '42' } });
  assert.equal(out.url, 'http://a.test/users?id=42');
});
test('templateFromFlags + mergeTemplate overrides headers case-insensitively', () => {
  const base = { method: 'GET', url: '/a', headers: { 'X-A': '1' } };
  const over = templateFromFlags({ header: ['x-a: 2'] });
  assert.deepEqual(mergeTemplate(base, over).headers, { 'x-a': '2' });
});

// ── storage ──
test('history append assigns monotonic ids even after last line removed', (t) => {
  const f = tmpFile(t, 'history.jsonl');
  const id1 = appendHistory(f, { name: 'a' });
  const id2 = appendHistory(f, { name: 'b' });
  assert.equal(id2, id1 + 1);
  // simulate manual edit dropping the last line, then appending again
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n').slice(0, 1);
  fs.writeFileSync(f, lines.join('\n') + '\n');
  const all = readHistory(f);
  assert.equal(all.length, 1);
  const id3 = appendHistory(f, { name: 'c' });
  assert.equal(id3, id1 + 1);
});
test('readJson/writeJson round-trip', (t) => {
  const f = tmpFile(t, 'x.json');
  writeJson(f, { a: 1 });
  assert.deepEqual(readJson(f, {}), { a: 1 });
  assert.deepEqual(readJson(f + '.missing', { d: 1 }), { d: 1 });
});

// ── cookies ──
test('parseSetCookie parses name, value, path, and expiry', () => {
  const c = parseSetCookie('sid=abc; Path=/api; Max-Age=60');
  assert.equal(c.name, 'sid'); assert.equal(c.value, 'abc'); assert.equal(c.path, '/api');
  assert.ok(c.expires > Date.now());
});

// ── completion ──
test('completion scripts mention heaven and commands', () => {
  assert.match(bashScript(), /complete -F _heaven heaven hv/);
  assert.match(bashScript(), /bench/);
  assert.match(zshScript(), /#compdef heaven/);
  assert.match(powershellScript(), /Register-ArgumentCompleter/);
});
