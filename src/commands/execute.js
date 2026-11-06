// Send a template, show the result, and decide the exit code.
// Used by: <method>, run, replay.
import { HeavenError, EXIT } from '../core/errors.js';
import { last } from '../cli/value-parsers.js';
import { sendTemplate } from '../request/send.js';
import { evaluate } from '../assertions/evaluate.js';
import { checkOutputFlag, cliVarsFromFlags, warnInsecure } from './shared.js';
import { showResponse, printRequestVerbose } from './show-response.js';

/** Flags that control how the response body is consumed. */
function engineOptions(flags, out) {
  const engine = {};
  if (flags['output-file']) engine.outputFile = flags['output-file']; // stream to disk
  if (flags.stream) engine.onChunk = (chunk) => out.write(chunk); // print as it arrives
  if (flags['max-buffer'] !== undefined) {
    const megabytes = Number(flags['max-buffer']);
    if (!(megabytes > 0))
      throw new HeavenError('--max-buffer must be a positive number of megabytes');
    engine.maxBuffer = Math.floor(megabytes * 1024 * 1024);
  }
  if (flags['cookie-jar']) engine.cookieJarFile = flags['cookie-jar'];
  if (flags.retry !== undefined) {
    const n = Number(flags.retry);
    if (!Number.isInteger(n) || n < 0 || n > 10) throw new HeavenError('--retry must be an integer 0-10');
    engine.retry = n;
  }
  if (flags['retry-delay'] !== undefined) {
    const ms = Number(flags['retry-delay']);
    if (!Number.isFinite(ms) || ms < 0) throw new HeavenError('--retry-delay must be a non-negative number of milliseconds');
    engine.retryDelay = ms;
  }
  if (flags.proxy) engine.proxy = flags.proxy;
  return engine;
}

/** 0 ok · 4 expectation failed · 2 HTTP error (unless the user expected a status or passed --no-fail). */
function exitCodeFor(res, template, checks, flags) {
  if (checks && !checks.passed) return EXIT.ASSERT;
  const userExpectedStatus = template.expect?.status !== undefined;
  if (res.status >= 400 && !userExpectedStatus && !flags['no-fail']) return EXIT.HTTP;
  return EXIT.OK;
}

export function formatDryRun(request, c) {
  return [
    c.bold(' DRY RUN ') + c.dim('— Request not sent'),
    '',
    `${c.dim('Method:')}  ${c.cyan(request.method ?? 'GET')}`,
    `${c.dim('URL:')}     ${c.green(request.url ?? '(not set)')}`,
    `${c.dim('Headers:')} ${c.gray(JSON.stringify(request.headers ?? {}, null, 2))}`,
    `${c.dim('Query:')}   ${c.gray(JSON.stringify(request.query ?? []))}`,
    `${c.dim('Body:')}    ${c.gray(JSON.stringify(request.body ?? null, null, 2))}`,
    `${c.dim('Auth:')}    ${c.magenta(JSON.stringify(request.auth ?? null))}`,
    `${c.dim('Timeout:')} ${c.gray(request.timeout ?? 'Default')}`,
    `${c.dim('Redirects:')} ${request.follow === false ? c.red('Disabled') : c.green('Enabled')}`,
  ].join('\n');
}

export async function execute(ctx, template, { historyName, envName } = {}) {
  const { flags, err, c, out } = ctx;
  checkOutputFlag(flags);

  warnInsecure(ctx);

  const dryRun = Boolean(flags['dry-run']);

  const sent = await sendTemplate(ctx.store, template, {
    envName: envName ?? last(flags.env),
    cliVars: cliVarsFromFlags(flags),
    engine: engineOptions(flags, out),
    historyName,
    record: !flags['no-history'],
    dryRun,
    onPrepared: flags.verbose ? (resolved) => printRequestVerbose(ctx, resolved) : undefined,
  });

  if (sent.dryRun) {
    out.write(formatDryRun(sent.resolved, c) + '\n');
    return 0;
  }

  const checks = template.expect ? evaluate(template.expect, sent.res) : null;
  showResponse(ctx, sent, checks);
  return exitCodeFor(sent.res, template, checks, flags);
}
