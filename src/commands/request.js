// heaven get|post|put|patch|delete|head|options URL [options]
import { HeavenError } from '../core/errors.js';
import { templateFromFlags } from '../request/template.js';
import { execute } from './execute.js';
import { prepare } from '../request/prepare.js';
import { resolveEnv, buildVars } from '../request/send.js';
import { last } from '../cli/value-parsers.js';
import { cliVarsFromFlags } from './shared.js';
import { toCurl } from '../features/import-export/index.js';

export async function cmdRequest(ctx, method, url) {
  if (!url) throw new HeavenError(`Usage: heaven ${method} <url> [options]   (heaven help)`);
  const template = templateFromFlags(ctx.flags, method, url);
  if (ctx.flags.curl) {
    // Use the full URL (env base URL + query) so the printed command actually runs.
    let url = template.url;
    try {
      const { env } = resolveEnv(ctx.store, last(ctx.flags.env));
      url = prepare(template, { env, vars: buildVars(env, {}, cliVarsFromFlags(ctx.flags)) }).url;
    } catch { /* unresolved {{vars}} or no env: print the template as typed */ }
    ctx.out.write(toCurl({ ...template, url }) + '\n');
    return 0;
  }
  return execute(ctx, template);
}
