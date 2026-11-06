// Sends one fully-resolved request and returns a normalized response object.
import { performance } from 'node:perf_hooks';
import { HeavenError } from '../core/errors.js';
import { toNetworkError } from './network-errors.js';
import { buildFetchBody } from './request-body.js';
import { readBody } from './read-body.js';
import { decodeBody } from './decode-body.js';
import { CookieJar } from './cookie-jar.js';

export const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024; // 10 MB kept in memory for display

/** Flatten fetch Headers into a plain object (set-cookie stays an array). */
function collectHeaders(res) {
  const headers = {};
  res.headers.forEach((v, k) => { headers[k] = v; });
  const cookies = res.headers.getSetCookie?.() ?? [];
  if (cookies.length) headers['set-cookie'] = cookies;
  return headers;
}

function proxyUrlFrom(opts) {
  if (opts.proxy) return opts.proxy;
  const u = (() => { try { return new URL(opts.url); } catch { return null; } })();
  if (!u) return undefined;
  const noProxy = (process.env.NO_PROXY ?? process.env.no_proxy ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (noProxy.some(h => h === '*' || u.hostname.toLowerCase() === h || u.hostname.toLowerCase().endsWith('.' + h))) return undefined;
  return u.protocol === 'https:' ? (process.env.HTTPS_PROXY ?? process.env.https_proxy) : (process.env.HTTP_PROXY ?? process.env.http_proxy);
}

async function dispatcherFor(proxy) {
  if (!proxy) return undefined;
  try {
    const { ProxyAgent } = await import('undici');
    return new ProxyAgent(proxy);
  } catch {
    throw new HeavenError(`Proxy support needs the optional "undici" package (npm i undici) for --proxy ${proxy}`);
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * @param req   resolved request from request/prepare.js
 * @param opts  { outputFile, onChunk, discard, maxBuffer, cookieJar, cookieJarFile, retry, retryDelay, proxy }
 */
export async function executeRequest(req, opts = {}) {
  const { outputFile, onChunk, discard = false, maxBuffer = DEFAULT_MAX_BUFFER, retry = 0, retryDelay = 500, proxy, cookieJar, cookieJarFile } = opts;
  const jar = cookieJar ?? (cookieJarFile ? new CookieJar(cookieJarFile) : undefined);
  const attempts = Math.max(0, Number(retry) || 0) + 1;
  const dispatcher = await dispatcherFor(proxyUrlFrom({ ...opts, url: req.url, proxy }));

  const headers = { ...(req.headers ?? {}) };
  if (jar) {
    const hasCookie = Object.keys(headers).some(k => k.toLowerCase() === 'cookie');
    const cookie = jar.headerFor(req.url);
    if (cookie && !hasCookie) headers.cookie = cookie;
  }

  const init = {
    method: req.method,
    headers,
    redirect: req.follow === false ? 'manual' : 'follow',
    ...(dispatcher ? { dispatcher } : {}),
  };

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const t0 = performance.now();
    let res;
    try {
      res = await fetch(req.url, {
        ...init,
        signal: AbortSignal.timeout(req.timeout),
        ...(await buildFetchBody(req.body)),
      });
    } catch (e) {
      lastError = toNetworkError(e, req);
      if (attempt < attempts) { await sleep(retryDelay * attempt); continue; }
      throw lastError;
    }
    const ttfbMs = performance.now() - t0;

    // Retry transient 5xx / 429 before consuming the body.
    if (attempt < attempts && (res.status === 429 || res.status >= 500)) {
      try { await res.body?.cancel(); } catch { /* ignore */ }
      await sleep(retryDelay * attempt);
      continue;
    }

    const responseHeaders = collectHeaders(res);
    if (jar) jar.storeFromHeaders(res.url || req.url, responseHeaders);
    const contentType = responseHeaders['content-type'] || '';
    let body;
    try {
      body = await readBody(res, { outputFile, onChunk, discard, maxBuffer });
    } catch (e) {
      throw toNetworkError(e, req);
    }
    const timeMs = performance.now() - t0;
    const decoded = decodeBody(body.buffer, contentType, body.truncated);
    return {
      url: res.url || req.url,
      status: res.status,
      statusText: res.statusText,
      ok: res.status < 400,
      redirected: res.redirected,
      headers: responseHeaders,
      contentType,
      timeMs,
      ttfbMs,
      size: body.size,
      truncated: body.truncated,
      saved: body.saved,
      buffer: body.buffer,
      text: decoded.text,
      json: decoded.json,
      binary: decoded.binary,
      contentLength: responseHeaders['content-length'] ? Number(responseHeaders['content-length']) : undefined,
    };
  }
  throw lastError ?? new HeavenError('Request failed');
}
