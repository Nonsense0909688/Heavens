// Helpers used by several commands.
//
// Every command receives a `ctx` object (built in cli.js):
//   ctx.pos    positional words        ctx.flags  parsed flags
//   ctx.out    stdout (data)           ctx.err    stderr (messages)
//   ctx.c      colours for stderr      ctx.cout   colours for stdout
//   ctx.store  disk access
// Rule: machine-readable data -> stdout. Human diagnostics -> stderr.
import { HeavenError } from '../core/errors.js';
import { parseKeyValues } from '../cli/value-parsers.js';

export const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
export const isMethod = (s) => METHODS.includes(String(s).toLowerCase());

// Names for saved requests / environments.
export const NAME_RE = /^[\w.-]+$/;

export const isJsonOutput = (ctx) => ctx.flags.output === 'json';
export const printJson = (ctx, data) => ctx.out.write(JSON.stringify(data, null, 2) + '\n');

/** `--output` only supports "json". */
export function checkOutputFlag(flags) {
  if (flags.output !== undefined && flags.output !== 'json') {
    throw new HeavenError(
      `Unknown --output "${flags.output}". Only "json" is supported (to save a body use -o FILE).`
    );
  }
}

/** --var k=v flags -> { k: v } */
export const varsFromFlags = (flags) => parseKeyValues(flags.var, '--var');

/** Same, plus --base-url (an explicit --var baseUrl=... wins). */
export function cliVarsFromFlags(flags) {
  const vars = varsFromFlags(flags);
  if (flags['base-url']) vars.baseUrl ??= flags['base-url'];
  return vars;
}

/** --insecure: skip TLS certificate checks for this process. */
export function applyInsecure(flags) {
  if (flags.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

/** Apply --insecure and warn (used by execute, bench, and flow alike). */
export function warnInsecure(ctx) {
  if (ctx.flags.insecure) {
    applyInsecure(ctx.flags);
    ctx.err.write(ctx.c.yellow('warning: TLS certificate verification is disabled (--insecure)\n'));
  }
}

/** "foo" or "-5" style numeric flag -> validated number, or the default when absent. */
export function numberFlag(value, fallback) {
  return value !== undefined ? Number(value) : fallback;
}
