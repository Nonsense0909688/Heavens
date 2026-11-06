// Minimal YAML subset parser for OpenAPI/Swagger import.
// Supports block mappings, block sequences, scalars, quoted strings,
// booleans/numbers/null, comments, and empty flow collections ([] / {}).
// Not a full YAML 1.2 implementation — enough for typical OpenAPI files.

function stripComment(line) {
  // naive: # preceded by space or at start, outside quotes
  let inS = false, inD = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inD) inS = !inS;
    else if (ch === '"' && !inS) inD = !inD;
    else if (ch === '#' && !inS && !inD && (i === 0 || line[i - 1] === ' ')) return line.slice(0, i).trimEnd();
  }
  return line;
}

function parseScalar(raw) {
  const s = String(raw).trim();
  if (s === '' || s === '~' || s.toLowerCase() === 'null') return null;
  if (s === '[]') return [];
  if (s === '{}') return {};
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    if (s.startsWith('"')) { try { return JSON.parse(s); } catch { return s.slice(1, -1); } }
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === 'true';
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d*\.\d+([eE][-+]?\d+)?$/.test(s) || /^-?\d+[eE][-+]?\d+$/.test(s)) return Number(s);
  return s;
}

function splitKey(line) {
  // find ": " or trailing ":" outside quotes/brackets
  let inS = false, inD = false, depth = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inD) inS = !inS;
    else if (ch === '"' && !inS) inD = !inD;
    else if (!inS && !inD) {
      if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') depth--;
      else if (ch === ':' && depth === 0 && (i === line.length - 1 || line[i + 1] === ' ')) {
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      }
    }
  }
  return null;
}

export function parseYaml(text) {
  const lines = String(text).split(/\r?\n/);
  const items = []; // { indent, content }
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const noComment = stripComment(raw);
    if (!noComment.trim()) continue;
    if (/^\s*(---|\.\.\.)\s*$/.test(noComment)) continue;
    const indent = (noComment.match(/^ */)[0].length);
    items.push({ indent, content: noComment.trim() });
  }
  if (!items.length) return null;

  let pos = 0;
  function peek() { return items[pos]; }

  function parseBlock(indent) {
    const first = peek();
    if (!first || first.indent < indent) return null;
    if (first.content.startsWith('- ') || first.content === '-') return parseSeq(first.indent);
    return parseMap(first.indent);
  }

  function parseMap(indent) {
    const obj = {};
    while (pos < items.length) {
      const cur = peek();
      if (cur.indent !== indent || cur.content.startsWith('- ')) break;
      const kv = splitKey(cur.content);
      if (!kv) { pos++; continue; }
      const [kRaw, vRaw] = kv;
      const key = String(parseScalar(kRaw));
      pos++;
      if (vRaw !== '') {
        obj[key] = parseScalar(vRaw);
      } else {
        const nxt = peek();
        if (!nxt || nxt.indent <= indent) obj[key] = null;
        else obj[key] = parseBlock(nxt.indent);
      }
    }
    return obj;
  }

  function parseSeq(indent) {
    const arr = [];
    while (pos < items.length) {
      const cur = peek();
      if (cur.indent !== indent || !cur.content.startsWith('-')) break;
      const rest = cur.content === '-' ? '' : cur.content.slice(2).trim();
      pos++;
      if (rest === '') {
        const nxt = peek();
        if (!nxt || nxt.indent <= indent) arr.push(null);
        else arr.push(parseBlock(nxt.indent));
      } else if (splitKey(rest)) {
        // inline first key of a map item: synthesise a line at indent+2
        items.splice(pos, 0, { indent: indent + 2, content: rest });
        arr.push(parseMap(indent + 2));
      } else {
        arr.push(parseScalar(rest));
      }
    }
    return arr;
  }

  return parseBlock(items[0].indent);
}
