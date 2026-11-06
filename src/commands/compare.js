// heaven compare NAME --env A --env B      heaven compare get /path --env A --env B
import { HeavenError, NetworkError, EXIT } from '../core/errors.js';
import { templateFromFlags, mergeTemplate } from '../request/template.js';
import { sendTemplate } from '../request/send.js';
import { compareResponses } from '../features/compare/compare-responses.js';
import { printTable, statusColor, formatBytes, formatMs, shortValue } from '../render/index.js';
import { isMethod, isJsonOutput, printJson, checkOutputFlag, varsFromFlags } from './shared.js';

/** Either `compare get /path` (ad-hoc) or `compare NAME` (saved request). */
function targetFromArgs(ctx) {
  const { pos, flags, store } = ctx;
  if (isMethod(pos[1]) && pos[2]) {
    const template = templateFromFlags(flags, pos[1], pos[2]);
    return { template, label: `${template.method} ${template.url}` };
  }
  if (pos[1]) {
    return { template: mergeTemplate(store.getRequest(pos[1]), templateFromFlags(flags)), label: pos[1] };
  }
  throw new HeavenError('Usage: heaven compare NAME --env A --env B   |   heaven compare get /path --env A --env B');
}

/** Send to both environments in parallel. A network failure on one side is reported, not thrown. */
async function sendToBoth(ctx, template, envs) {
  const cliVars = varsFromFlags(ctx.flags);
  const attempt = (envName) => sendTemplate(ctx.store, template, { envName, cliVars, record: false, assumeYes: Boolean(ctx.flags.yes) })
    .then((s) => ({ ok: true, res: s.res }), (error) => ({ ok: false, error }));
  const sides = await Promise.all(envs.map(attempt));

  for (const side of sides) {
    if (!side.ok && !(side.error instanceof NetworkError)) throw side.error;   // config errors abort
  }
  return sides;
}

function printSummary(ctx, result, envs) {
  const { out, c } = ctx;
  const col = (s) => statusColor(c, s)(String(s));
  printTable([
    ['status', col(result.status.a), col(result.status.b), result.status.same ? c.green('✓') : c.red('✗ differs')],
    ['time', formatMs(result.time.a), formatMs(result.time.b), c.dim('(informational)')],
    ['size', formatBytes(result.size.a), formatBytes(result.size.b), ''],
  ], ['', envs[0], envs[1], ''], (s) => out.write(s), c);
}

function printDiffSection(ctx, title, diffs, envs, ignore) {
  const { out, c } = ctx;
  out.write('\n');
  if (!diffs.length) {
    const note = ignore.length && title === 'body' ? c.dim(` (ignoring ${ignore.join(', ')})`) : '';
    out.write(`${title}: ${c.green('identical')}${note}\n`);
    return;
  }
  out.write(c.red(`${title}: ${diffs.length} difference${diffs.length > 1 ? 's' : ''}`) + '\n');
  for (const d of diffs) {
    if (d.type === 'changed' || d.type === 'type') {
      out.write(`  ${c.yellow('~')} ${d.path}   ${shortValue(d.a)} ${c.dim('→')} ${shortValue(d.b)}${d.type === 'type' ? c.dim('  (type changed)') : ''}\n`);
    } else if (d.type === 'added') {
      out.write(`  ${c.green('+')} ${d.path}   ${c.dim(`only in ${envs[1]}:`)} ${shortValue(d.b)}\n`);
    } else {
      out.write(`  ${c.red('-')} ${d.path}   ${c.dim(`only in ${envs[0]}:`)} ${shortValue(d.a)}\n`);
    }
  }
}

export async function cmdCompare(ctx) {
  const { flags, out, err, c } = ctx;
  checkOutputFlag(flags);

  const envs = flags.env || [];
  if (envs.length !== 2) throw new HeavenError('compare needs exactly two environments, e.g.  --env dev --env prod');

  const { template, label } = targetFromArgs(ctx);
  const ignore = (flags.ignore || []).flatMap((s) => s.split(',')).map((s) => s.trim()).filter(Boolean);

  const [A, B] = await sendToBoth(ctx, template, envs);
  if (!A.ok || !B.ok) {
    [[envs[0], A], [envs[1], B]].forEach(([name, side]) => { if (!side.ok) err.write(c.red(`${name}: ${side.error.message}\n`)); });
    return EXIT.NETWORK;
  }

  const result = compareResponses(A.res, B.res, { ignore, headers: flags.headers });
  const exitCode = result.identical ? EXIT.OK : EXIT.DIFF;

  if (isJsonOutput(ctx)) { printJson(ctx, { request: label, environments: envs, ...result }); return exitCode; }

  out.write(`${c.bold('compare')} ${label}   ${c.cyan(envs[0])} ${c.dim('⇄')} ${c.magenta(envs[1])}\n\n`);
  printSummary(ctx, result, envs);
  printDiffSection(ctx, 'body', result.body.diffs, envs, ignore);
  if (result.headers) printDiffSection(ctx, 'headers', result.headers, envs, ignore);
  if (!result.identical) out.write(c.dim('\nDifferences are not necessarily bugs — they may be intentional between environments.\n'));
  return exitCode;
}
