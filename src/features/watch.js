import fs from 'node:fs';
/** Watch one or more files and debounce reruns; returns a disposer for tests and clean shutdown. */
export function watchFiles(files, run, { debounceMs = 200, watchImpl = fs.watch } = {}) {
  if (!Array.isArray(files) || !files.length) throw new TypeError('At least one file is required');
  let timer; let closed = false; const watchers = [];
  const trigger = () => { clearTimeout(timer); timer = setTimeout(() => { if (!closed) Promise.resolve().then(run).catch(() => {}); }, debounceMs); };
  for (const file of files) watchers.push(watchImpl(file, trigger));
  return () => { closed = true; clearTimeout(timer); for (const watcher of watchers) watcher.close(); };
}
