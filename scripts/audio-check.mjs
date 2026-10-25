/**
 * 内置 BGM 循环质量检查：时长、边界连续性、非静音
 * 运行: node scripts/audio-check.mjs
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { SFX_CATEGORIES, SFX_SLOTS, BUILTIN_SFX, SFX_TUNING, getSfxTuning } from '../src/audio/sfxCatalog.js';

let passed = 0;
let failed = 0;
const assert = (cond, name, extra = '') => {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
};

function readWav(path) {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`不是 WAV: ${path}`);
  }
  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = buf.subarray(body, body + size);
    }
    offset = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error(`WAV 结构不完整: ${path}`);
  const bytes = fmt.bitsPerSample / 8;
  const frames = Math.floor(data.length / (bytes * fmt.channels));
  const samples = [];
  for (let i = 0; i < frames; i++) {
    const ch = [];
    for (let c = 0; c < fmt.channels; c++) {
      ch.push(data.readInt16LE((i * fmt.channels + c) * bytes) / 32768);
    }
    samples.push(ch);
  }
  return { fmt, frames, samples };
}

for (const name of ['bgm-shanhe.wav', 'bgm-zhangu.wav']) {
  console.log(`\n[${name}]`);
  const path = new URL(`../public/audio/${name}`, import.meta.url);
  let wav;
  try { wav = readWav(path); } catch (e) {
    assert(false, `${name} 可读取`, e.message);
    continue;
  }
  const { fmt, frames, samples } = wav;
  const duration = frames / fmt.sampleRate;
  console.log(`  INFO  ${duration.toFixed(2)}s · ${fmt.channels}ch · ${fmt.sampleRate}Hz`);
  assert(fmt.channels === 2, '立体声');
  assert(duration > 15 && duration < 40, '时长在 15~40 秒', `${duration.toFixed(2)}s`);

  const first = samples[0];
  const last = samples[samples.length - 1];
  const jump = Math.max(...first.map((v, i) => Math.abs(v - last[i])));
  assert(jump < 0.02, '首尾电平连续（无爆音间隙）', `jump=${jump.toFixed(5)}`);

  let sum = 0;
  const n = Math.min(frames, fmt.sampleRate * 2);
  for (let i = 0; i < n; i++) sum += samples[i][0] ** 2 + samples[i][1] ** 2;
  const rms = Math.sqrt(sum / (n * 2));
  assert(rms > 0.02, '前 2 秒非静音', `rms=${rms.toFixed(3)}`);
}

console.log('\n[新增免费曲目]');
for (const name of ['bgm-shenyang.mp3', 'bgm-ripples.mp3', 'bgm-guzheng.mp3']) {
  const path = new URL(`../public/audio/${name}`, import.meta.url);
  const ok = existsSync(path);
  assert(ok, `${name} 存在`);
  if (!ok) continue;
  const size = statSync(path).size;
  const head = readFileSync(path).subarray(0, 3);
  const isMp3 = (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33)
    || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0);
  assert(size > 1024 * 1024 && isMp3, `${name} 是有效 MP3 且有实际内容`, `${size} bytes`);
}
assert(existsSync(new URL('../public/audio/MUSIC_CREDITS.md', import.meta.url)), '音乐授权/来源文件存在');

console.log('\n[CC0 音效采样]');
assert(SFX_CATEGORIES.length === 4, '音效分类共 4 类', SFX_CATEGORIES.length);
const emptyCategories = SFX_CATEGORIES.filter(cat => !SFX_SLOTS.some(slot => slot.category === cat.id));
assert(emptyCategories.length === 0, '每个音效分类都有槽位', emptyCategories.map(c => c.id).join(','));
assert(SFX_SLOTS.length === 20, '音效槽位共 20 个', SFX_SLOTS.length);
const missingSampleMap = SFX_SLOTS.filter(slot => !slot.sample || !slot.category);
assert(missingSampleMap.length === 0, '每个音效槽位都有 sample/category', missingSampleMap.map(s => s.key).join(','));
assert(Object.keys(BUILTIN_SFX).length === 20, 'BUILTIN_SFX 映射 20 个槽位', Object.keys(BUILTIN_SFX).length);
assert(SFX_SLOTS.every(slot => BUILTIN_SFX[slot.key] === slot.sample),
  'BUILTIN_SFX 与 slots sample 一致');

for (const slot of SFX_SLOTS) {
  const url = new URL(`../public${slot.sample}`, import.meta.url);
  const exists = existsSync(url);
  assert(exists, `${slot.key} 采样存在`, slot.sample);
  if (!exists) continue;
  const buf = readFileSync(url);
  const size = buf.length;
  const isOgg = buf.toString('ascii', 0, 4) === 'OggS';
  const isWav = buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE';
  const extOk = slot.sample.endsWith('.ogg') ? isOgg : slot.sample.endsWith('.wav') ? isWav : (isOgg || isWav);
  assert(extOk && size > 1024, `${slot.key} OGG/WAV 头有效且有内容`, `${size} bytes`);
  if (isWav) {
    try {
      const wav = readWav(url);
      const duration = wav.frames / wav.fmt.sampleRate;
      assert(duration > 0.02, `${slot.key} WAV 时长 > 0`, `${duration.toFixed(2)}s`);
    } catch (e) {
      assert(false, `${slot.key} WAV 可解析`, e.message);
    }
  }
}
const samplePaths = new Set(SFX_SLOTS.map(slot => slot.sample));
assert(samplePaths.size === 20, '20 个采样路径互不重复', samplePaths.size);
assert(existsSync(new URL('../public/audio/SFX_CREDITS.md', import.meta.url)), '音效 CC0 授权文件存在');

console.log('\n[音效时长/响度校准]');
assert(SFX_SLOTS.every(slot => SFX_TUNING[slot.key]), '每个音效槽都有时长/响度校准');
assert(SFX_SLOTS.every(slot => getSfxTuning(slot.key).maxDuration > 0), '每个音效都有 maxDuration');
assert(SFX_SLOTS.every(slot => {
  const gain = getSfxTuning(slot.key).gain;
  return Number.isFinite(gain) && gain > 0 && gain <= 2;
}), '每个音效 gain 在 0~2');
assert(getSfxTuning('sfx:shuffle').maxDuration <= 0.5, '洗牌音效不超过 0.5s（对齐整理动画）');
assert(getSfxTuning('sfx:click').maxDuration <= 0.15, '点击音效不超过 0.15s');
assert(getSfxTuning('sfx:turn').maxDuration <= 0.6, '回合提示不超过 0.6s');
assert(SFX_SLOTS.find(s => s.key === 'sfx:shuffle').sample.endsWith('shuffle.wav'), '洗牌使用短 WAV 采样');
const shufflePath = new URL('../public/audio/sfx/card/shuffle.wav', import.meta.url);
if (existsSync(shufflePath)) {
  const wav = readWav(shufflePath);
  const duration = wav.frames / wav.fmt.sampleRate;
  assert(duration > 0.25 && duration <= 0.5, '洗牌 WAV 时长 0.25~0.5s', `${duration.toFixed(2)}s`);
}

console.log(`\n===== 结果: ${passed} 通过 / ${failed} 失败 =====\n`);
process.exit(failed > 0 ? 1 : 0);
