import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCurl, toCurl, parsePostman, parseOpenAPI, toOpenAPI } from '../../src/features/import-export/index.js';
import { parseYaml } from '../../src/features/import-export/yaml.js';
import { createMockServer } from '../../src/features/mock/server.js';

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

test('YAML subset parser handles OpenAPI mappings and sequences', () => {
  const doc = parseYaml('openapi: 3.0.0\nservers:\n  - url: https://example.com\npaths:\n  /x:\n    get:\n      operationId: getX\n');
  assert.equal(doc.openapi, '3.0.0');
  assert.equal(doc.servers[0].url, 'https://example.com');
  assert.equal(doc.paths['/x'].get.operationId, 'getX');
});

test('mock server responds to fixture and returns 404 for missing route', async t => {
  const server = createMockServer({ 'GET /hello': { body: { hello: 'world' } } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const ok = await fetch(`${base}/hello`); assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { hello: 'world' });
  const missing = await fetch(`${base}/missing`); assert.equal(missing.status, 404);
});
