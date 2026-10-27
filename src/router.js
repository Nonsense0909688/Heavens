// Decide which command a user typed. Commands live in ./commands/.
import fs from 'node:fs';
import { HeavenError, EXIT } from './core/errors.js';
import { GENERAL, COMMANDS } from './cli/help.js';
import * as cmd from './commands/index.js';

const version = () => JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const looksLikeUrl = (s) => /^(https?:\/\/|\/|localhost[:/]|\d{1,3}(\.\d{1,3}){3}[:/])/i.test(s);

// command word -> handler
const COMMAND_TABLE = {
  save: cmd.cmdSave,
  run: cmd.cmdRun,
  list: cmd.cmdList,
  ls: cmd.cmdList,
  rm: cmd.cmdRm,
  env: cmd.cmdEnv,
  history: cmd.cmdHistory,
  replay: cmd.cmdReplay,
  compare: cmd.cmdCompare,
  flow: cmd.cmdFlow,
  bench: cmd.cmdBench,
  init: cmd.cmdInit,
  import: cmd.cmdImport,
  export: cmd.cmdExport,
  mock: cmd.cmdMock,
};

export async function dispatch(ctx) {
  const { pos, flags, out } = ctx;

  if (flags.version) { out.write(version() + '\n'); return EXIT.OK; }

  // `heaven` / `heaven help [topic]`
  const first = pos[0];
  if (!first || first === 'help') {
    const topic = pos[1];
    out.write(topic && COMMANDS[topic] ? COMMANDS[topic] : GENERAL);
    return EXIT.OK;
  }

  const name = first.toLowerCase();
  if (flags.help) { out.write(COMMANDS[name] ?? GENERAL); return EXIT.OK; }

  // `heaven get /x`  or the shortcut  `heaven /x`  (= GET)
  if (cmd.METHODS.includes(name)) return cmd.cmdRequest(ctx, name, pos[1]);
  if (looksLikeUrl(first)) return cmd.cmdRequest(ctx, 'get', first);

  const handler = Object.hasOwn(COMMAND_TABLE, name) ? COMMAND_TABLE[name] : undefined;
  if (!handler) throw new HeavenError(`Unknown command "${first}". Run: heaven help`);
  return handler(ctx);
}
