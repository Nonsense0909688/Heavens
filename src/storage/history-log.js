// History is a JSON-lines file (one entry per line, newest last).
import fs from 'node:fs';

export const HISTORY_MAX = 1000;  // when the log grows past this...
export const HISTORY_KEEP = 800;  // ...it is trimmed down to the newest this-many

export function readHistory(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const entries = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { entries.push(JSON.parse(line)); } catch { /* skip a corrupt line rather than lose everything */ }
  }
  return entries;
}

/** Append an entry, assigning the next id. Returns the id. */
export function appendHistory(file, entry) {
  let all = readHistory(file);
  const id = all.reduce((max, e) => Math.max(max, Number(e?.id) || 0), 0) + 1;
  const full = { id, time: new Date().toISOString(), ...entry };
  all.push(full);

  if (all.length > HISTORY_MAX) {            // too long: rewrite the file with only the newest entries
    all = all.slice(-HISTORY_KEEP);
    fs.writeFileSync(file, all.map((e) => JSON.stringify(e)).join('\n') + '\n', { mode: 0o600 });
  } else {
    fs.appendFileSync(file, JSON.stringify(full) + '\n', { mode: 0o600 });
  }
  return id;
}
