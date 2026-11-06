// Translate low-level fetch/Node errors into friendly HeavenError / NetworkError messages.
import { HeavenError, NetworkError } from '../core/errors.js';

const TLS_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
]);

export function toNetworkError(e, req) {
  if (e instanceof HeavenError) return e;

  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
    return new NetworkError(`Request timed out after ${req.timeout} ms`, 'ETIMEDOUT');
  }

  const code = e?.cause?.code || e?.code;
  if (code === 'ERR_INVALID_URL') return new HeavenError(`Invalid URL: ${req.url}`);
  if (code === 'ECONNREFUSED') return new NetworkError(`Connection refused (${req.url}). Is the server running?`, code);
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    let host; try { host = new URL(req.url).hostname; } catch { return new HeavenError(`Invalid URL: ${req.url}`); }
    return new NetworkError(`DNS lookup failed for ${host}`, code);
  }
  if (code === 'ECONNRESET') return new NetworkError('Connection reset by server', code);
  if (TLS_CODES.has(code)) {
    return new NetworkError(`TLS certificate verification failed (${code}). Use --insecure only for targets you trust.`, code);
  }
  if (e instanceof TypeError && !e.cause) return new HeavenError(`Invalid request: ${e.message}`);
  return new NetworkError(e?.cause?.message || e?.message || String(e), code);
}
