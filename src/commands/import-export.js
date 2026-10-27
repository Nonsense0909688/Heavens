import fs from 'node:fs';
import { HeavenError } from '../core/errors.js';
import { readImportFile, toOpenAPI } from '../features/import-export/index.js';

export async function cmdImport(ctx) {
  const file = ctx.pos[1];
  if (!file) throw new HeavenError('Usage: heaven import FILE --format curl|postman|openapi');
  const format = ctx.flags.format ?? (file.endsWith('.yaml') || file.endsWith('.yml') ? 'openapi' : 'postman');
  try { ctx.out.write(JSON.stringify(readImportFile(file, format), null, 2) + '\n'); return 0; }
  catch (error) { throw new HeavenError(`Import failed: ${error.message}`); }
}

export async function cmdExport(ctx) {
  const file = ctx.pos[1];
  if (!file) throw new HeavenError('Usage: heaven export FILE.json --format openapi');
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const requests = Array.isArray(parsed) ? parsed : [parsed];
    const format = ctx.flags.format ?? 'openapi';
    if (!['openapi', 'swagger'].includes(format)) throw new Error(`Unsupported export format: ${format}`);
    ctx.out.write(JSON.stringify(toOpenAPI(requests), null, 2) + '\n'); return 0;
  } catch (error) { throw new HeavenError(`Export failed: ${error.message}`); }
}
