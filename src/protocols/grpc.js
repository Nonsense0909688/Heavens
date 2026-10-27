/** gRPC-over-HTTP/2 requires a transport implementation; this helper builds a protobuf payload frame. */
export function grpcFrame(messageBytes, compressed = false) {
  const bytes = Buffer.from(messageBytes); const frame = Buffer.alloc(5 + bytes.length);
  frame[0] = compressed ? 1 : 0; frame.writeUInt32BE(bytes.length, 1); bytes.copy(frame, 5); return frame;
}
export function parseGrpcFrames(input) {
  const bytes = Buffer.from(input); const frames = []; let offset = 0;
  while (offset < bytes.length) { if (bytes.length - offset < 5) throw new Error('Incomplete gRPC frame header'); const compressed = bytes[offset] === 1; const length = bytes.readUInt32BE(offset + 1); if (bytes.length - offset - 5 < length) throw new Error('Incomplete gRPC frame payload'); frames.push({ compressed, data: bytes.subarray(offset + 5, offset + 5 + length) }); offset += 5 + length; }
  return frames;
}
