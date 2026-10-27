import fs from 'node:fs';

function unquote(value) {
  const s = String(value ?? '');
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) return s.slice(1, -1);
  return s;
}

/** Parse the common, portable subset of cURL syntax into a Heaven request template. */
export function parseCurl(input) {
  const tokens = String(input).match(/(?:[^\s"']+|"(?:\\.|[^"\\])*"|'(?:[^']|'\\'' )*')+/g) ?? [];
  const result = { method: 'GET', headers: {} };
  let explicitMethod = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = unquote(tokens[i]);
    if (token === 'curl') continue;
    if (['-X', '--request'].includes(token)) { result.method = unquote(tokens[++i]).toUpperCase(); explicitMethod = true; }
    else if (['-H', '--header'].includes(token)) {
      const header = unquote(tokens[++i]); const at = header.indexOf(':');
      if (at < 1) throw new Error(`Invalid cURL header: ${header}`);
      result.headers[header.slice(0, at).trim()] = header.slice(at + 1).trim();
    } else if (['-d', '--data', '--data-raw', '--data-binary'].includes(token)) {
      result.body = { type: 'raw', value: unquote(tokens[++i]) };
      if (!explicitMethod) result.method = 'POST';
    } else if (token === '-u' || token === '--user') {
      result.auth = { type: 'basic', value: unquote(tokens[++i]) };
    } else if (token === '-I' || token === '--head') result.method = 'HEAD';
    else if (/^https?:\/\//i.test(token)) result.url = token;
  }
  if (!result.url) throw new Error('No HTTP URL found in cURL input');
  return result;
}

function shellQuote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
export function toCurl(request) {
  if (!request?.url) throw new Error('Request URL is required');
  const args = ['curl', '-X', shellQuote(request.method ?? 'GET')];
  for (const [key, value] of Object.entries(request.headers ?? {})) args.push('-H', shellQuote(`${key}: ${value}`));
  if (request.auth?.type === 'bearer') args.push('-H', shellQuote(`Authorization: Bearer ${request.auth.token}`));
  if (request.auth?.type === 'basic') args.push('-u', shellQuote(request.auth.value));
  if (request.body) args.push('--data-raw', shellQuote(typeof request.body === 'object' && 'value' in request.body ? request.body.value : JSON.stringify(request.body)));
  args.push(shellQuote(request.url));
  return args.join(' ');
}

export function parsePostman(collection) {
  const requests = [];
  const visit = items => { for (const item of items ?? []) {
    if (item.item) { visit(item.item); continue; }
    const req = item.request; if (!req) continue;
    const url = typeof req.url === 'string' ? req.url : req.url?.raw;
    if (!url) continue;
    const headers = Object.fromEntries((req.header ?? []).filter(h => !h.disabled).map(h => [h.key, h.value]));
    const out = { name: item.name, method: String(req.method ?? 'GET').toUpperCase(), url, headers };
    const raw = req.body?.raw; if (raw !== undefined) out.body = { type: 'raw', value: raw };
    requests.push(out);
  }};
  visit(collection.item);
  return requests;
}

export function parseOpenAPI(spec, baseUrl) {
  const server = baseUrl ?? spec.servers?.[0]?.url ?? '';
  const requests = [];
  for (const [route, methods] of Object.entries(spec.paths ?? {})) for (const [method, operation] of Object.entries(methods ?? {})) {
    if (!['get','post','put','patch','delete','head','options'].includes(method.toLowerCase())) continue;
    requests.push({ name: operation.operationId ?? operation.summary ?? `${method.toUpperCase()} ${route}`, method: method.toUpperCase(), url: `${server.replace(/\/$/, '')}${route}`, headers: {} });
  }
  return requests;
}

export function readImportFile(file, format) {
  const text = fs.readFileSync(file, 'utf8');
  if (format === 'curl') return [parseCurl(text)];
  const parsed = JSON.parse(text);
  if (format === 'postman') return parsePostman(parsed);
  if (format === 'openapi' || format === 'swagger') return parseOpenAPI(parsed);
  throw new Error(`Unsupported import format: ${format}`);
}

export function toOpenAPI(requests) {
  const paths = {};
  for (const request of requests) {
    const url = new URL(request.url, 'http://heaven.invalid');
    paths[url.pathname] ??= {};
    paths[url.pathname][String(request.method ?? 'GET').toLowerCase()] = {
      summary: request.name ?? `${request.method ?? 'GET'} ${url.pathname}`,
      responses: { default: { description: 'Response' } },
    };
  }
  return { openapi: '3.1.0', info: { title: 'Heaven export', version: '1.0.0' }, paths };
}
