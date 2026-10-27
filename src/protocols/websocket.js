/** Uses the runtime's WebSocket implementation (Node 22+ or modern browsers). */
export function openWebSocket(url, { protocols, onMessage = () => {}, onOpen = () => {}, onError = () => {}, onClose = () => {} } = {}) {
  if (typeof WebSocket === 'undefined') throw new Error('WebSocket is unavailable in this runtime; use Node.js 22+');
  const socket = new WebSocket(url, protocols);
  socket.addEventListener('open', onOpen); socket.addEventListener('message', event => onMessage(event.data)); socket.addEventListener('error', onError); socket.addEventListener('close', onClose);
  return { socket, send(data) { if (socket.readyState !== WebSocket.OPEN) throw new Error('WebSocket is not open'); socket.send(typeof data === 'string' ? data : JSON.stringify(data)); }, close(code, reason) { socket.close(code, reason); } };
}
