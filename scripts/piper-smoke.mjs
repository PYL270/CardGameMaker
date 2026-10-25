/**
 * scripts/piper-smoke.mjs - Piper 离线中文 TTS 服务冒烟测试（零依赖 Node）
 *
 * 用法：
 *   node scripts/piper-smoke.mjs                      // 自动拉起 voice_service/piper-server.mjs（端口 19881）
 *   set PIPER_BASE_URL=http://127.0.0.1:9881 && node scripts/piper-smoke.mjs   // 测试已在运行的服务
 *
 * 验证项：/health、CORS、OPTIONS 预检、POST /tts 返回 audio/wav、RIFF/WAVE 头、
 * 采样率/声道/位深、时长>0、RMS>0、空文本与超长文本返回 400。
 * 结束后自动关闭由本脚本拉起的服务进程。
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'voice_service', 'piper-server.mjs');

const externalBase = process.env.PIPER_BASE_URL || '';
const PORT = Number(process.env.PIPER_SMOKE_PORT || 19881);
const BASE = externalBase || `http://127.0.0.1:${PORT}`;

let passed = 0;
let failed = 0;
function check(cond, name, extra = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
}

async function fetchJson(url, opts = {}, timeoutMs = 10000) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { res, text, json };
}

async function waitHealth(maxMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    try {
      const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return Date.now() - started;
    } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`等待 /health 超时（${maxMs}ms）`);
}

/** 解析 WAV：返回 {sampleRate, channels, bits, dataBytes, durationSec, rms}（PCM） */
function parseWav(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('不是合法 RIFF/WAVE 文件');
  }
  let offset = 12;
  let fmt = null;
  let dataOffset = -1;
  let dataBytes = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      dataOffset = body;
      dataBytes = Math.min(size, buf.length - body);
      break;
    }
    offset = body + size + (size % 2);
  }
  if (!fmt || dataOffset < 0) throw new Error('WAV 缺少 fmt/data 块');
  const bytesPerSample = Math.max(1, fmt.bits / 8);
  const frameBytes = bytesPerSample * fmt.channels;
  const frames = Math.floor(dataBytes / frameBytes);
  const durationSec = frames / fmt.sampleRate;

  // 计算 RMS（PCM16 为主；其他位深按比例归一化）
  let sumSq = 0;
  let count = 0;
  if (fmt.bits === 16) {
    for (let i = 0; i + 1 < dataBytes; i += 2) {
      const v = buf.readInt16LE(dataOffset + i) / 32768;
      sumSq += v * v; count++;
    }
  } else if (fmt.bits === 8) {
    for (let i = 0; i < dataBytes; i++) {
      const v = (buf[dataOffset + i] - 128) / 128;
      sumSq += v * v; count++;
    }
  } else {
    // 兜底：用字节熵近似非静音判断（通常不会走到这里）
    for (let i = 0; i < dataBytes; i++) {
      const v = (buf[dataOffset + i] - 128) / 128;
      sumSq += v * v; count++;
    }
  }
  const rms = count ? Math.sqrt(sumSq / count) : 0;
  return { ...fmt, dataBytes, durationSec, rms };
}

async function main() {
  let child = null;
  const startedAt = Date.now();
  try {
    if (!externalBase) {
      console.log(`[smoke] 启动 Piper 服务：${SERVER}（端口 ${PORT}）`);
      const nodeExe = process.execPath;
      child = spawn(nodeExe, [SERVER], {
        cwd: ROOT,
        env: { ...process.env, PIPER_PORT: String(PORT) },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let serverLog = '';
      child.stdout.on('data', (c) => { serverLog += c.toString('utf8'); });
      child.stderr.on('data', (c) => { serverLog += c.toString('utf8'); });
      child.on('exit', (code) => {
        if (code !== 0 && code !== null) console.log(`[smoke] 服务进程退出码 ${code}\n${serverLog.slice(-800)}`);
      });
      const healthMs = await waitHealth(30000);
      console.log(`[smoke] /health 就绪，启动等待 ${healthMs} ms`);
    }

    // 1) /health
    const health = await fetchJson(`${BASE}/health`);
    check(health.res.ok && health.json?.ok === true, 'GET /health 返回 ok=true', health.text.slice(0, 200));
    check(Array.isArray(health.json?.voices) && health.json.voices.length > 0, '/health 返回可用音色列表',
      JSON.stringify(health.json?.voices));
    check(health.res.headers.get('access-control-allow-origin') === '*', 'CORS：/health 带 Access-Control-Allow-Origin: *');
    console.log(`[smoke] 模型：${health.json?.model?.name} / ${health.json?.model?.language} / ${health.json?.model?.sampleRate}Hz`);

    // 2) OPTIONS 预检
    const preflight = await fetch(`${BASE}/tts`, { method: 'OPTIONS' });
    check(preflight.status === 204, 'OPTIONS /tts 预检返回 204', String(preflight.status));
    check(preflight.headers.get('access-control-allow-methods')?.includes('POST'), 'OPTIONS 允许 POST');
    check(preflight.headers.get('access-control-allow-origin') === '*', 'OPTIONS 带 CORS 允许源');

    // 3) POST /tts 正常合成
    const text = '今日之战，胜负已分。';
    const t0 = Date.now();
    const res = await fetch(`${BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(65000),
    });
    const synthMs = Date.now() - t0;
    const buf = Buffer.from(await res.arrayBuffer());
    check(res.status === 200, 'POST /tts 返回 200', String(res.status));
    check((res.headers.get('content-type') || '').includes('audio/wav'), 'Content-Type 为 audio/wav',
      res.headers.get('content-type') || '');
    check(res.headers.get('access-control-allow-origin') === '*', 'CORS：/tts 带 Access-Control-Allow-Origin: *');

    const wav = parseWav(buf);
    check(buf.length > 44, '返回非空 WAV 音频', `bytes=${buf.length}`);
    check(wav.sampleRate >= 8000 && wav.sampleRate <= 48000, '采样率合法（8k~48k）', String(wav.sampleRate));
    check(wav.channels === 1, '单声道输出', `channels=${wav.channels}`);
    check(wav.durationSec > 0.2 && wav.durationSec < 60, '音频时长 > 0 且合理', `${wav.durationSec.toFixed(3)}s`);
    check(wav.rms > 0.001, '音频非静音（RMS > 0.001）', `rms=${wav.rms.toFixed(5)}`);

    console.log(`[smoke] 合成耗时 ${synthMs} ms，WAV ${buf.length} bytes，` +
      `${wav.durationSec.toFixed(2)}s / ${wav.sampleRate}Hz / ${wav.channels}ch / ${wav.bits}bit / RMS=${wav.rms.toFixed(4)}`);

    // 4) 错误分支
    const empty = await fetch(`${BASE}/tts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '' }),
      signal: AbortSignal.timeout(10000),
    });
    check(empty.status === 400, '空文本返回 400', String(empty.status));
    const tooLong = await fetch(`${BASE}/tts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '字'.repeat(501) }), signal: AbortSignal.timeout(10000),
    });
    check(tooLong.status === 400, '超过 500 字返回 400', String(tooLong.status));

    console.log(`\n===== Piper 冒烟结果: ${passed} 通过 / ${failed} 失败（总耗时 ${Date.now() - startedAt} ms）=====\n`);
    if (failed > 0) process.exitCode = 1;
  } catch (e) {
    console.error('[smoke] 运行异常：', e.message);
    process.exitCode = 1;
  } finally {
    if (child) {
      child.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 800));
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
    }
  }
}

main();
