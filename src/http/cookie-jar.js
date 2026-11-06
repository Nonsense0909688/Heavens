// File-backed cookie jar: persists Set-Cookie per origin, resends Cookie.
// --cookie-jar FILE enables it. Intentionally small: no public-suffix list.
import fs from 'node:fs';

export function parseSetCookie(header) {
  if (!header) return null;
  const parts = String(header).split(';');
  const first = parts[0].trim();
  const eq = first.indexOf('=');
  if (eq <= 0) return null;
  const cookie = { name: first.slice(0, eq).trim(), value: first.slice(eq + 1).trim(), path: '/', expires: null, secure: false };
  for (const part of parts.slice(1)) {
    const [k, v] = part.split('=').map(s => s.trim());
    const lk = (k || '').toLowerCase();
    if (lk === 'path') cookie.path = v || '/';
    else if (lk === 'max-age' && Number.isFinite(Number(v))) cookie.expires = Date.now() + Number(v) * 1000;
    else if (lk === 'expires' && v) { const t = Date.parse(v); if (Number.isFinite(t)) cookie.expires = t; }
    else if (lk === 'secure') cookie.secure = true;
  }
  return cookie;
}

export class CookieJar {
  constructor(file) {
    this.file = file;
    this.store = {}; // origin -> [{name,value,path,expires,secure}]
    if (file) this.load();
  }
  load() {
    try { this.store = JSON.parse(fs.readFileSync(this.file, 'utf8')); }
    catch { this.store = {}; }
  }
  save() {
    if (!this.file) return;
    fs.writeFileSync(this.file, JSON.stringify(this.store, null, 2) + '\n', { mode: 0o600 });
  }
  headerFor(url) {
    let u; try { u = new URL(url); } catch { return undefined; }
    const list = this.store[u.origin] ?? [];
    const now = Date.now();
    const alive = list.filter(c => !c.expires || c.expires > now);
    if (alive.length !== list.length) { this.store[u.origin] = alive; this.save(); }
    const send = alive.filter(c => u.pathname.startsWith(c.path || '/') && (!c.secure || u.protocol === 'https:'));
    return send.length ? send.map(c => `${c.name}=${c.value}`).join('; ') : undefined;
  }
  storeFromHeaders(url, headers) {
    const set = headers['set-cookie'];
    if (!set) return;
    let u; try { u = new URL(url); } catch { return; }
    const cookies = ([] .concat(set)).map(parseSetCookie).filter(Boolean);
    if (!cookies.length) return;
    const list = this.store[u.origin] ?? [];
    for (const c of cookies) {
      const i = list.findIndex(x => x.name === c.name && (x.path || '/') === (c.path || '/'));
      if (c.expires && c.expires <= Date.now()) { if (i >= 0) list.splice(i, 1); continue; }
      if (i >= 0) list[i] = c; else list.push(c);
    }
    this.store[u.origin] = list;
    this.save();
  }
}
