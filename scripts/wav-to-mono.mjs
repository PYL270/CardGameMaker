/**
 * 纯 JS 的 WAV 立体声 → 单声道转换（不依赖 ffmpeg）。
 * 只处理最常见的 PCM 16-bit / 双声道格式，其它格式原样返回 null。
 */
export function wavToMono(input) {
  if (!Buffer.isBuffer(input) || input.length < 44) return null;
  if (input.toString('ascii', 0, 4) !== 'RIFF' || input.toString('ascii', 8, 12) !== 'WAVE') return null;

  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= input.length) {
    const id = input.toString('ascii', offset, offset + 4);
    const size = input.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ' && body + 16 <= input.length) {
      fmt = {
        audioFormat: input.readUInt16LE(body),
        channels: input.readUInt16LE(body + 2),
        sampleRate: input.readUInt32LE(body + 4),
        bits: input.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = { start: body, size: Math.min(size, input.length - body) };
    }
    offset = body + size + (size % 2);
  }

  if (!fmt || !data) return null;
  if (fmt.audioFormat !== 1 || fmt.bits !== 16 || fmt.channels !== 2) return null;

  const frames = Math.floor(data.size / 4);
  if (frames <= 0) return null;

  const out = Buffer.alloc(44 + frames * 2);
  out.write('RIFF', 0, 'ascii');
  out.writeUInt32LE(36 + frames * 2, 4);
  out.write('WAVE', 8, 'ascii');
  out.write('fmt ', 12, 'ascii');
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(fmt.sampleRate, 24);
  out.writeUInt32LE(fmt.sampleRate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36, 'ascii');
  out.writeUInt32LE(frames * 2, 40);

  for (let i = 0; i < frames; i++) {
    const left = input.readInt16LE(data.start + i * 4);
    const right = input.readInt16LE(data.start + i * 4 + 2);
    out.writeInt16LE((left + right) >> 1, 44 + i * 2);
  }
  return out;
}
