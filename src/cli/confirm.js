import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { HeavenError } from '../core/errors.js';

/** Ask before a write to a protected environment. `assumeYes` (--yes) skips the prompt. */
export async function confirmProtectedRequest(envName, method, { assumeYes = false } = {}) {
  if (!envName || method.toUpperCase() === 'GET') return true;
  if (assumeYes) return true;

  if (!stdin.isTTY || !stdout.isTTY) {
    throw new HeavenError(
      `Environment "${envName}" requires confirmation for ${method}. ` +
        'Run interactively, or pass --yes to confirm in advance.'
    );
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const answer = await rl.question(
      `\n\u26a0 ${method.toUpperCase()} request to protected environment "${envName}". Continue? [y/N] `
    );

    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}
