// heaven get|post|put|patch|delete|head|options URL [options]
import { HeavenError } from '../core/errors.js';
import { templateFromFlags } from '../request/template.js';
import { execute } from './execute.js';
import { toCurl } from '../features/import-export/index.js';

export async function cmdRequest(ctx, method, url) {
  if (!url) throw new HeavenError(`Usage: heaven ${method} <url> [options]   (heaven help)`);
  const template = templateFromFlags(ctx.flags, method, url);
  if (ctx.flags.curl) { ctx.out.write(toCurl(template) + '\n'); return 0; }
  return execute(ctx, template);
}
