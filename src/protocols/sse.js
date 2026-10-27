export async function consumeSSE(url, { headers = {}, signal, onEvent = () => {} } = {}) {
  const response = await fetch(url, { headers: { accept: 'text/event-stream', ...headers }, signal });
  if (!response.ok || !response.body) throw new Error(`SSE request failed: HTTP ${response.status}`);
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let event = { data: [], type: 'message', id: undefined }; const seen = [];
  const dispatch = () => { if (!event.data.length) { event = { data: [], type: 'message', id: undefined }; return; } const value = { event: event.type, data: event.data.join('\n'), id: event.id }; seen.push(value); onEvent(value); event = { data: [], type: 'message', id: undefined }; };
  while (true) { const { done, value } = await reader.read(); buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done }); const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? ''; for (const line of lines) { if (!line) { dispatch(); continue; } if (line.startsWith(':')) continue; const i = line.indexOf(':'); const field = i < 0 ? line : line.slice(0, i); const val = i < 0 ? '' : line.slice(i + 1).replace(/^ /, ''); if (field === 'data') event.data.push(val); else if (field === 'event') event.type = val; else if (field === 'id' && !val.includes('\0')) event.id = val; } if (done) break; }
  dispatch(); return seen;
}
