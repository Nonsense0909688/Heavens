// Program entry: parse arguments, build the shared context, run the command, map errors to exit codes.
import { parseArgs } from './cli/parse-args.js';
import { HeavenError, EXIT } from './core/errors.js';
import { Store } from './storage/store.js';
import { locateHome } from './storage/locate-home.js';
import { makeColors } from './render/index.js';
import { dispatch } from './router.js';

/** @param io optional { stdout, stderr } streams (handy for tests) */
export async function main(argv, io = {}) {
  const out = io.stdout ?? process.stdout;
  const err = io.stderr ?? process.stderr;

  try {
    const { _: pos, flags } = parseArgs(argv);
    if (flags['no-color']) process.env.NO_COLOR = '1';
    if (flags.color) { process.env.FORCE_COLOR = '1'; delete process.env.NO_COLOR; }

    const ctx = {
      pos,
      flags,
      out,
      err,
      c: makeColors(err), // colours for messages (stderr)
      cout: makeColors(out), // colours for data (stdout)
      store: new Store(locateHome()),
    };
    return await dispatch(ctx);
  } catch (e) {
    const c = makeColors(err);
    if (e instanceof HeavenError) {
      err.write(`${c.red('error:')} ${e.message}\n`);
      return e.exitCode;
    }
    err.write(`${c.red('unexpected error:')} ${process.env.HEAVEN_DEBUG ? e.stack : e.message}\n`);
    return EXIT.USAGE;
  }
}
