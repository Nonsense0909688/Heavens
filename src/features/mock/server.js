import http from 'node:http';
export function createMockServer(fixtures = {}) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost'); const key = `${req.method} ${url.pathname}`; const fixture = fixtures[key];
    if (!fixture) { res.writeHead(404, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'No mock fixture', key })); return; }
    res.writeHead(fixture.status ?? 200, { 'content-type': 'application/json', ...(fixture.headers ?? {}) }); res.end(typeof fixture.body === 'string' ? fixture.body : JSON.stringify(fixture.body ?? {}));
  });
}
