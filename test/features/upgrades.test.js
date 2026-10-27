import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCurl, toCurl, parsePostman, parseOpenAPI, toOpenAPI } from '../../src/features/import-export/index.js';
import { benchmarkDetails, runRampUp } from '../../src/features/bench/advanced-stats.js';
import { toJUnit, toHtmlReport } from '../../src/features/reports/index.js';
import { grpcFrame, parseGrpcFrames } from '../../src/protocols/grpc.js';
import { createPluginRegistry } from '../../src/plugins/registry.js';
import { createMockServer } from '../../src/features/mock/server.js';
import { createServer } from 'node:http';

test('cURL import and export preserve method, URL, headers, and body', () => {
  const req = parseCurl("curl -X POST -H 'content-type: application/json' --data-raw '{\"x\":1}' https://example.com/api");
  assert.equal(req.method, 'POST'); assert.equal(req.url, 'https://example.com/api');
  assert.equal(req.headers['content-type'], 'application/json'); assert.equal(req.body.value, '{"x":1}');
  assert.match(toCurl(req), /--data-raw/);
});

test('Postman nested items and OpenAPI paths import', () => {
  assert.equal(parsePostman({ item: [{ name: 'folder', item: [{ name: 'get', request: { method: 'GET', url: { raw: 'https://example.com/x' } } }] }] }).length, 1);
  const reqs = parseOpenAPI({ openapi: '3.0.0', servers: [{ url: 'https://example.com' }], paths: { '/x': { get: { operationId: 'getX' } } } });
  assert.equal(reqs[0].url, 'https://example.com/x'); assert.equal(toOpenAPI(reqs).paths['/x'].get.summary, 'getX');
});

test('benchmark details include percentiles and histogram', () => {
  const result = benchmarkDetails([10, 20, 60, 80], 50);
  assert.equal(result.latencyMs.p50, 20); assert.deepEqual(result.histogram, { '0-50ms': 2, '50-100ms': 2 });
});

test('ramp-up executes each request exactly once and captures errors', async () => {
  const result = await runRampUp({ count: 8, maxConcurrency: 3, runOne: async i => { if (i === 2) throw new Error('nope'); return i; } });
  assert.equal(result.results.length, 8); assert.deepEqual(result.results[2], { error: 'nope' });
  assert.equal(result.results.filter(x => typeof x === 'number').length, 7);
});

test('JUnit and HTML reports escape untrusted content', () => {
  const report = { steps: [{ name: '<script>', ok: false, error: '<broken>', timeMs: 20 }] };
  assert.match(toJUnit(report), /&lt;script&gt;/); assert.match(toHtmlReport(report), /&lt;broken&gt;/);
});

test('gRPC frames round-trip payloads and reject truncation', () => {
  const payload = Buffer.from([1, 2, 3]); assert.deepEqual(parseGrpcFrames(grpcFrame(payload))[0].data, payload);
  assert.throws(() => parseGrpcFrames(Buffer.from([0, 0])), /Incomplete/);
});

test('plugin registry runs hooks in registration order', async () => {
  const registry = createPluginRegistry(); const seen = [];
  registry.on('request', async ctx => seen.push(ctx.value)); registry.on('request', ctx => seen.push(ctx.value + 1));
  await registry.run('request', { value: 3 }); assert.deepEqual(seen, [3, 4]);
});

test('mock server responds to fixture and returns 404 for missing route', async t => {
  const server = createMockServer({ 'GET /hello': { body: { hello: 'world' } } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const ok = await fetch(`${base}/hello`); assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { hello: 'world' });
  const missing = await fetch(`${base}/missing`); assert.equal(missing.status, 404);
});

test('authorization helpers create bearer and basic headers', async () => {
  const { authorizationHeaders, refreshOAuth2Token } = await import('../../src/protocols/auth.js');
  assert.deepEqual(authorizationHeaders({ bearer: 'abc' }), { authorization: 'Bearer abc' });
  assert.equal(authorizationHeaders({ basic: 'user:pass' }).authorization, `Basic ${Buffer.from('user:pass').toString('base64')}`);
  const result = await refreshOAuth2Token({ tokenUrl: 'https://example.test/token', refreshToken: 'r', clientId: 'id', fetchImpl: async (_url, init) => ({ ok: true, status: 200, json: async () => ({ access_token: 'new', grant_type: new URLSearchParams(init.body).get('grant_type') }) }) });
  assert.equal(result.access_token, 'new'); assert.equal(result.grant_type, 'refresh_token');
});
