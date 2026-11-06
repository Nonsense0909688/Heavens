// heaven bench NAME|URL [-n 100] [-c 10] [--max-p95 MS]
import { HeavenError, EXIT } from '../core/errors.js';
import { last } from '../cli/value-parsers.js';
import { templateFromFlags, mergeTemplate } from '../request/template.js';
import { prepare } from '../request/prepare.js';
import { resolveEnv, buildVars } from '../request/send.js';
import { runBench } from '../features/bench/run-bench.js';
import { statusColor, formatMs } from '../render/index.js';
import { isMethod, isJsonOutput, printJson, checkOutputFlag, cliVarsFromFlags, warnInsecure, numberFlag } from './shared.js';
import { looksLikeUrl } from '../request/url.js';

/** `bench get /x`, `bench /x`, `bench https://...`, `bench example.com/x`, or `bench saved-name`. */
function targetFromArgs(ctx) {
  const { pos, flags, store } = ctx;
  if (isMethod(pos[1]) && pos[2]) return templateFromFlags(flags, pos[1], pos[2]);
  if (pos[1] && looksLikeUrl(pos[1])) return templateFromFlags(flags, 'get', pos[1]);
  if (pos[1]) return mergeTemplate(store.getRequest(pos[1]), templateFromFlags(flags));
  throw new HeavenError('Usage: heaven bench NAME|URL [-n 100] [-c 10]');
}

function readLimits(flags) {
  const count = numberFlag(flags.count, 100);
  const concurrency = numberFlag(flags.concurrency, 10);
  if (!Number.isInteger(count) || count < 1 || count > 100000) throw new HeavenError('-n must be an integer between 1 and 100000');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 1000) throw new HeavenError('-c must be an integer between 1 and 1000');
  return { count, concurrency };
}

function printReport(ctx, r, maxP95, p95Exceeded) {
  const { out, c } = ctx;
  const L = r.latencyMs;
  const statuses = Object.entries(r.statuses).map(([s, n]) => `${statusColor(c, Number(s))(s)}×${n}`).join('  ') || c.dim('none');

  out.write(`${c.bold('requests')}   ${r.requests} in ${formatMs(r.durationMs)}  (${r.requestsPerSecond} req/s)\n`);
  out.write(`${c.bold('errors')}     ${r.failures > 0 ? c.red(`${r.failures} (${r.errorRate}%)`) : c.green('0')}\n`);
  out.write(`${c.bold('status')}     ${statuses}\n`);
  out.write(`${c.bold('latency')}    min ${L.min} · mean ${L.mean} · p50 ${L.p50} · p90 ${L.p90} · p95 ${L.p95} · p99 ${L.p99} · max ${L.max}  ${c.dim('(ms)')}\n`);
  for (const [msg, n] of Object.entries(r.errors)) out.write(c.red(`  ${n}× ${msg}\n`));
  if (maxP95 !== undefined) {
    out.write(p95Exceeded ? c.red(`✗ p95 ${L.p95} ms exceeds limit ${maxP95} ms\n`) : c.green(`✓ p95 within ${maxP95} ms\n`));
  }
}

export async function cmdBench(ctx) {
  const { flags, store, err, c } = ctx;
  checkOutputFlag(flags);

  const template = targetFromArgs(ctx);
  const { count, concurrency } = readLimits(flags);

  warnInsecure(ctx);
  const { env } = resolveEnv(store, last(flags.env));
  const resolved = prepare(template, { env, vars: buildVars(env, {}, cliVarsFromFlags(flags)) });

  const quiet = flags.silent || isJsonOutput(ctx);
  if (!flags.silent && !isJsonOutput(ctx)) {
    err.write(c.dim(`${resolved.method} ${resolved.url} · ${count} requests · ${concurrency} concurrent\n`));
  }

  const showProgress = !flags.silent && err.isTTY;
  const report = await runBench(resolved, {
    count, concurrency,
    onProgress: showProgress ? (done, total) => err.write(`\r${c.dim(`${done}/${total}`)}`) : undefined,
    engine: { retry: flags.retry !== undefined ? Number(flags.retry) : 0, retryDelay: flags['retry-delay'] !== undefined ? Number(flags['retry-delay']) : 500, proxy: flags.proxy, cookieJarFile: flags['cookie-jar'] },
  });
  if (showProgress) err.write('\r\x1b[K');                  // erase the progress line

  const maxP95 = flags['max-p95'] !== undefined ? Number(flags['max-p95']) : undefined;
  const p95Exceeded = maxP95 !== undefined && report.latencyMs.p95 !== null && report.latencyMs.p95 > maxP95;

  if (isJsonOutput(ctx)) {
    printJson(ctx, { target: `${resolved.method} ${resolved.url}`, ...report, p95Exceeded: maxP95 !== undefined ? p95Exceeded : undefined });
  } else {
    printReport(ctx, report, maxP95, p95Exceeded);
  }

  if (p95Exceeded) return EXIT.ASSERT;
  return report.failures > 0 ? EXIT.HTTP : EXIT.OK;
}
