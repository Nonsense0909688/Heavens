import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
export function createPluginRegistry() {
  const hooks = new Map();
  return Object.freeze({
    on(event, handler) { if (typeof handler !== 'function') throw new TypeError('Plugin hook must be a function'); const list = hooks.get(event) ?? []; list.push(handler); hooks.set(event, list); return () => hooks.set(event, (hooks.get(event) ?? []).filter(h => h !== handler)); },
    async run(event, context) { for (const handler of hooks.get(event) ?? []) await handler(context); },
  });
}
export async function loadPlugins(directory, registry) {
  let files; try { files = await fs.readdir(directory); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const loaded = [];
  for (const file of files.filter(f => f.endsWith('.js')).sort()) { const module = await import(pathToFileURL(path.resolve(directory, file)).href); if (typeof module.default !== 'function') throw new Error(`Plugin ${file} must default-export a function`); await module.default(registry); loaded.push(file); }
  return loaded;
}
