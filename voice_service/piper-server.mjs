/**
 * CardGameMaker - Piper 离线中文 TTS 服务（零依赖 Node）
 *
 * 仅监听本机 127.0.0.1:9881，进程内串行调用 piper.exe 合成中文语音。
 * 接口：
 *   GET  /health                → { ok, service, model, voices, sampleRate, language }
 *   GET  /                      → 服务说明
 *   POST /tts  JSON {text, voice?}
 *                               → audio/wav 二进制；错误返回 JSON（中文）
 * CORS：Access-Control-Allow-Origin: *（含 OPTIONS 预检），供游戏前端 / Vite 代理调用。
 *
 * 安全/限流：text ≤ 500 字、单次合成 60s 超时、spawn 参数数组（不经 shell，避免注入）、
 * 临时 wav 用完即删、并发串行（同一时间只合成一个，防止 CPU 被打满）。
 *
 * 启动：node voice_service/piper-server.mjs
 * 目录结构（本文件同目录）：
 *   piper/piper.exe                  Piper 1.2.0 Windows 版（MIT）
 *   piper/espeak-ng-data/            音素化数据
 *   piper/voices/zh_CN-huayan-medium.onnx(.json)   中文音色 Huayan（22050Hz）
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import { promises as fs, existsSync, readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PIPER_DIR = path.join(__dirname, 'piper');
const PIPER_EXE = path.join(PIPER_DIR, 'piper.exe');
const VOICES_DIR = path.join(PIPER_DIR, 'voices');
const DEFAULT_VOICE = 'zh_CN-huayan-medium.onnx';

const HOST = process.env.PIPER_HOST || '127.0.0.1';
const PORT = Number(process.env.PIPER_PORT || 9881);
const MAX_TEXT_CHARS = 500;      // 文本上限（按 Unicode 码点计）
const SYNTH_TIMEOUT_MS = 60000;  // 单次合成超时
const MAX_BODY_BYTES = 1024 * 1024;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/** 载入模型配置（采样率/语言/音色名），失败时降级为空信息，不影响服务启动 */
function loadModelInfo() {
  const info = {
    name: DEFAULT_VOICE,
    sampleRate: null,
    language: 'zh_CN',
    voice: 'Huayan',
    quality: 'medium',
    espeakVoice: 'cmn',
  };
  try {
    const jsonPath = path.join(VOICES_DIR, DEFAULT_VOICE + '.json');
    const cfg = JSON.parse(readFileSync(jsonPath, 'utf8'));
    info.sampleRate = cfg?.audio?.sample_rate ?? null;
    info.quality = cfg?.audio?.quality ?? info.quality;
    info.espeakVoice = cfg?.espeak?.voice ?? info.espeakVoice;
  } catch {
    // 配置读取失败时保持默认值，/health 里 sampleRate 可能为 null
  }
  return info;
}

const MODEL_INFO = loadModelInfo();

function listVoices() {
  try {
    return readdirSync(VOICES_DIR)
      .filter((f) => f.endsWith('.onnx'))
      .sort();
  } catch {
    return [DEFAULT_VOICE];
  }
}

/** 统一 JSON 响应（带 CORS） */
function sendJson(res, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(statusCode, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
  });
  res.end(body);
}

/** 读取并解析 JSON 请求体（限制体积） */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', () => reject(new Error('读取请求体失败')));
  });
}

/** 校验并归一化 voice 参数：只允许 voices/ 下的 .onnx 文件名，禁止路径穿越 */
function resolveVoiceModel(voiceInput) {
  let name = typeof voiceInput === 'string' && voiceInput.trim() ? voiceInput.trim() : DEFAULT_VOICE;
  if (!name.toLowerCase().endsWith('.onnx')) name += '.onnx';
  if (!/^[A-Za-z0-9._-]+\.onnx$/i.test(name)) return { error: 'voice 参数不合法' };
  const modelPath = path.join(VOICES_DIR, name);
  if (path.dirname(modelPath) !== path.resolve(VOICES_DIR)) return { error: 'voice 参数不合法' };
  if (!existsSync(modelPath)) return { error: `音色不存在：${name}` };
  return { name, modelPath };
}

/** 合成任务串行队列：同一时刻只跑一个 piper 进程 */
let queueTail = Promise.resolve();
function enqueue(task) {
  const run = queueTail.then(task, task);
  queueTail = run.catch(() => {});
  return run;
}

/**
 * 调用 piper.exe 合成一段文本，返回 wav Buffer
 * 注意：文本走 stdin（UTF-8），参数走数组，临时文件在 finally 中删除
 */
async function synthesize(text, modelPath) {
  const tmpWav = path.join(
    os.tmpdir(),
    `cgm-piper-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`,
  );
  const startedAt = Date.now();
  try {
    const wavBuffer = await new Promise((resolve, reject) => {
      const args = ['--model', modelPath, '--output_file', tmpWav];
      const child = spawn(PIPER_EXE, args, {
        cwd: PIPER_DIR,          // espeak-ng-data / dll 均相对 piper.exe 所在目录
        windowsHide: true,
        stdio: ['pipe', 'ignore', 'pipe'],
      });
      const errChunks = [];
      let settled = false;
      const finish = (err, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve(value);
      };
      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
        finish(new Error(`合成超时（>${SYNTH_TIMEOUT_MS / 1000}s）`));
      }, SYNTH_TIMEOUT_MS);

      child.on('error', (err) => finish(new Error(`无法启动 Piper：${err.message}`)));
      child.stderr.on('data', (chunk) => {
        if (errChunks.length < 20) errChunks.push(chunk.toString('utf8'));
      });
      child.on('close', (code) => {
        if (settled) return;
        if (code !== 0) {
          finish(new Error(`Piper 退出码 ${code}${errChunks.length ? '：' + errChunks.join('').slice(-300) : ''}`));
          return;
        }
        // 读取合成结果，随后由 finally 删除临时文件
        fs.readFile(tmpWav)
          .then((buf) => finish(null, buf))
          .catch((e) => finish(new Error(`读取合成结果失败：${e.message}`)));
      });
      // 文本经 stdin 传入（单段），UTF-8；行内换行压成空格避免被拆成多段
      const safeText = String(text).replace(/\r?\n/g, ' ').trim() + '\n';
      child.stdin.end(Buffer.from(safeText, 'utf8'));
    });
    console.log(`[piper-server] 合成完成 ${Date.now() - startedAt}ms，${wavBuffer.length} bytes`);
    return wavBuffer;
  } finally {
    fs.unlink(tmpWav).catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  } catch {
    sendJson(res, 400, { ok: false, error: '请求地址不合法' });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'piper-tts',
      model: MODEL_INFO,
      voice: DEFAULT_VOICE,
      voices: listVoices(),
      port: PORT,
      maxTextChars: MAX_TEXT_CHARS,
      timeoutMs: SYNTH_TIMEOUT_MS,
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/') {
    sendJson(res, 200, {
      ok: true,
      service: 'CardGameMaker Piper 离线中文 TTS',
      endpoints: ['GET /health', 'POST /tts {text, voice?}'],
      model: MODEL_INFO,
      port: PORT,
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/tts') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      sendJson(res, 400, { ok: false, error: e.message || '请求体不合法' });
      return;
    }
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      sendJson(res, 400, { ok: false, error: 'text 不能为空' });
      return;
    }
    const charCount = [...text].length;
    if (charCount > MAX_TEXT_CHARS) {
      sendJson(res, 400, { ok: false, error: `文本超过 ${MAX_TEXT_CHARS} 字限制（当前 ${charCount} 字）` });
      return;
    }
    const voiceRes = resolveVoiceModel(body.voice);
    if (voiceRes.error) {
      sendJson(res, 400, { ok: false, error: voiceRes.error });
      return;
    }

    const startedAt = Date.now();
    console.log(`[piper-server] 收到合成请求 chars=${charCount} voice=${voiceRes.name}`);
    try {
      const wav = await enqueue(() => synthesize(text, voiceRes.modelPath));
      if (!wav || wav.length <= 44) {
        sendJson(res, 502, { ok: false, error: 'Piper 未返回有效音频' });
        return;
      }
      console.log(`[piper-server] 请求完成 ${Date.now() - startedAt}ms`);
      res.writeHead(200, {
        ...CORS_HEADERS,
        'Content-Type': 'audio/wav',
        'Content-Length': wav.length,
        'Cache-Control': 'no-store',
        'X-Piper-Voice': voiceRes.name,
        'X-Piper-Ms': String(Date.now() - startedAt),
      });
      res.end(wav);
    } catch (e) {
      console.error(`[piper-server] 合成失败：${e.message}`);
      sendJson(res, 500, { ok: false, error: `合成失败：${e.message}` });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: '接口不存在' });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[piper-server] 端口 ${PORT} 已被占用，请更换 PIPER_PORT 或先关闭旧服务`);
  } else {
    console.error('[piper-server] 服务启动失败：', err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log('============================================================');
  console.log('  CardGameMaker - Piper 离线中文 TTS 服务');
  console.log(`  监听: http://${HOST}:${PORT}`);
  console.log(`  音色: ${MODEL_INFO.voice} / ${MODEL_INFO.language} / ${MODEL_INFO.sampleRate || '?'}Hz（${DEFAULT_VOICE}）`);
  console.log(`  接口: GET /health, POST /tts {text, voice?}`);
  console.log(`  限制: 文本≤${MAX_TEXT_CHARS}字，单次合成≤${SYNTH_TIMEOUT_MS / 1000}s，串行处理`);
  console.log('  关闭本窗口即停止服务');
  console.log('============================================================');
});

function shutdown(signal) {
  console.log(`\n[piper-server] 收到 ${signal}，正在关闭服务...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { server, synthesize, resolveVoiceModel, MAX_TEXT_CHARS, SYNTH_TIMEOUT_MS };
