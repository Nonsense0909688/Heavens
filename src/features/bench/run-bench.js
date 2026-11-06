// Load generator: fire `count` requests with at most `concurrency` in flight.
// Response bodies are read and discarded (never buffered).
import { performance } from 'node:perf_hooks';
import { executeRequest } from '../../http/engine.js';
import { latencySummary, countBy, round2 } from './stats.js';

/** Turn raw samples into the final report. */
function summarize(samples, count, concurrency, wallMs) {
  const answered = samples.filter((s) => !s.error);
  const failures = samples.filter((s) => s.error || s.status >= 400).length;
  return {
    requests: count,
    concurrency: Math.min(concurrency, count),
    durationMs: round2(wallMs),
    requestsPerSecond: round2((count / wallMs) * 1000),
    failures,
    errorRate: round2((failures / count) * 100),
    statuses: countBy(answered.map((s) => s.status)),
    errors: countBy(samples.filter((s) => s.error).map((s) => s.error)),
    latencyMs: latencySummary(answered.map((s) => s.ms)),
  };
}

export async function runBench(resolved, { count, concurrency, onProgress, engine = {} }) {
  const samples = [];
  let next = 0;                       // shared counter: each worker claims the next request number
  const startedAt = performance.now();

  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= count) return;
      const s = performance.now();
      try {
        const r = await executeRequest(resolved, { discard: true, ...engine });
        samples.push({ ms: performance.now() - s, status: r.status, size: r.size });
      } catch (e) {
        samples.push({ ms: performance.now() - s, error: e.message });
      }
      if (onProgress) onProgress(samples.length, count);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker));
  return summarize(samples, count, concurrency, performance.now() - startedAt);
}
