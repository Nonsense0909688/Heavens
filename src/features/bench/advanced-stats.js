import { latencySummary } from './stats.js';
export function benchmarkDetails(latencies, bucketWidth = 50) {
  if (!(bucketWidth > 0)) throw new TypeError('bucketWidth must be positive');
  const histogram = {};
  for (const ms of latencies) { const start = Math.floor(ms / bucketWidth) * bucketWidth; const key = `${start}-${start + bucketWidth}ms`; histogram[key] = (histogram[key] ?? 0) + 1; }
  return { latencyMs: latencySummary(latencies), histogram };
}
export async function runRampUp({ count, maxConcurrency, runOne }) {
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(maxConcurrency) || maxConcurrency < 1) throw new TypeError('count and maxConcurrency must be positive integers');
  const results = new Array(count); let next = 0; const started = Date.now();
  const workers = Array.from({ length: Math.min(count, maxConcurrency) }, async () => {
    while (true) { const index = next++; if (index >= count) return; try { results[index] = await runOne(index); } catch (error) { results[index] = { error: error.message }; } }
  });
  await Promise.all(workers);
  return { results, durationMs: Date.now() - started };
}
