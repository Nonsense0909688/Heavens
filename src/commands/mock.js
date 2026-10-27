import fs from 'node:fs';
import { HeavenError } from '../core/errors.js';
import { createMockServer } from '../features/mock/server.js';

export async function cmdMock(ctx) {
  const file = ctx.pos[1];
  if (!file) throw new HeavenError('Usage: heaven mock fixtures.json [--port 8080]');
  let fixtures;
  try { fixtures = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new HeavenError(`Cannot load mock fixtures: ${error.message}`); }
  const port = Number(ctx.flags.port ?? 8080);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new HeavenError('--port must be an integer from 0 to 65535');
  const server = createMockServer(fixtures);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const address = server.address();
  ctx.err.write(`Mock server listening on http://127.0.0.1:${address.port}\n`);
  await new Promise(resolve => { const stop = () => server.close(resolve); process.once('SIGINT', stop); process.once('SIGTERM', stop); });
  return 0;
}
