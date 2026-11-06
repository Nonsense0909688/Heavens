// heaven flow FILE.json
import fs from 'node:fs';
import path from 'node:path';
import { HeavenError } from '../core/errors.js';
import { last } from '../cli/value-parsers.js';
import { runFlow } from '../features/flow/run-flow.js';
import { statusColor, formatMs } from '../render/index.js';
import {
  isJsonOutput,
  printJson,
  checkOutputFlag,
  varsFromFlags,
  warnInsecure,
} from './shared.js';

function loadWorkflow(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new HeavenError(
      e.code === 'ENOENT'
        ? `Workflow file not found: ${file}`
        : `Cannot parse ${file}: ${e.message}`
    );
  }
}

/** One line per step, printed live as each step finishes. */
function printStep(ctx, s) {
  const { out, c } = ctx;
  const mark = s.ok ? c.green('✓') : c.red('✗');
  const status = s.status !== undefined ? statusColor(c, s.status)(String(s.status)) : c.red('ERR');
  const time = s.timeMs !== undefined ? formatMs(s.timeMs) : '';
  const extracted = s.extracted.length ? c.dim(`  → ${s.extracted.join(', ')}`) : '';

  out.write(
    ` ${mark} ${s.index}. ${c.bold(s.name)}  ${c.dim(`${s.method} ${s.url}`)}  ${status}  ${c.dim(time)}${extracted}\n`
  );
  if (s.error) out.write(`      ${c.red(s.error)}\n`);
  for (const ch of s.checks) {
    if (!ch.ok)
      out.write(`      ${c.red('✗')} ${ch.label}${ch.detail ? c.dim(` — ${ch.detail}`) : ''}\n`);
  }
}

function printSummary(ctx, report) {
  const { out, c } = ctx;
  const passed = report.steps.filter((s) => s.ok).length;
  out.write(
    `\n${report.ok ? c.green('PASSED') : c.red('FAILED')}  ${passed}/${report.steps.length + report.skipped} steps passed` +
      `${report.skipped ? c.dim(` (${report.skipped} skipped after failure)`) : ''}\n`
  );
}

export async function cmdFlow(ctx) {
  const { pos, flags, store, out, c } = ctx;
  checkOutputFlag(flags);
  const file = pos[1];
  if (!file) throw new HeavenError('Usage: heaven flow FILE.json   (heaven help flow)');

  const def = loadWorkflow(file);
  const human = !isJsonOutput(ctx);
  warnInsecure(ctx);

  if (human) out.write(`${c.bold(def.name || path.basename(file))}\n`);

  const report = await runFlow(def, {
    store,
    envName: last(flags.env) ?? def.env,
    cliVars: varsFromFlags(flags),
    record: !flags['no-history'],
    assumeYes: Boolean(flags.yes),
    onStep: human ? (step) => printStep(ctx, step) : undefined,
  });

  if (human) printSummary(ctx, report);
  else printJson(ctx, report);
  return report.exitCode;
}
