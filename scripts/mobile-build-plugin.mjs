/**
 * scripts/mobile-build-plugin.mjs - Vite 插件：手机 APK 构建接口（dev / preview 中间件）
 *
 * 供设置页「生成手机 APK」调用：
 *   GET  /api/mobile/status  -> { available, building, progress, log:[...], apk:{...}|null, error }
 *   POST /api/mobile/build   -> 启动 scripts/build-apk.mjs（后台），返回 202；构建中再请求返回 409
 *
 * 安全：构建仅允许本机（127.0.0.1 / ::1）触发；生产静态模式没有本中间件，不可构建。
 * 持久化：构建完成后把结果写入 public/apk/latest.json，Vite public 静态提供 /apk/latest.json 与 APK 下载。
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { locateToolchain } from './build-apk.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APK_DIR = path.join(ROOT, 'public', 'apk');
const LATEST_JSON = path.join(APK_DIR, 'latest.json');
const PROGRESS_JSON = path.join(ROOT, 'mobile', 'android', 'build', 'progress.json');
const BUILD_SCRIPT = path.join(ROOT, 'scripts', 'build-apk.mjs');
const LOG_LIMIT = 400;

const state = {
  building: false,
  log: [],
  error: null,
  startedAt: 0,
  finishedAt: 0,
};

function pushLog(line) {
  const text = String(line).replace(/\r/g, '');
  for (const part of text.split('\n')) {
    const trimmed = part.trimEnd();
    if (!trimmed) continue;
    state.log.push(trimmed);
  }
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** 读取最新 APK 信息（latest.json + 实际文件大小/mtime 校验） */
function readApkInfo() {
  const latest = readJson(LATEST_JSON);
  if (!latest) return null;
  const file = path.join(APK_DIR, latest.file || '');
  if (!latest.file || !fs.existsSync(file)) return null;
  const stat = fs.statSync(file);
  // 稳定别名（固定分享链接/二维码）：latest 指向本次唯一包，stableUrl 始终指向最新副本
  const stableFile = 'CardGameMaker-latest.apk';
  const stablePath = path.join(APK_DIR, stableFile);
  const stableStat = fs.existsSync(stablePath) ? fs.statSync(stablePath) : null;
  return {
    file: latest.file,
    version: latest.version || null,
    versionName: latest.versionName || null,
    versionCode: latest.versionCode || null,
    size: stat.size,
    url: latest.url || `/apk/${latest.file}`,
    sha256: latest.sha256 || null,
    builtAt: latest.builtAt || stat.mtime.toISOString(),
    mtime: stat.mtime.toISOString(),
    package: latest.package || null,
    label: latest.label || null,
    signatureVerified: latest.signatureVerified === true,
    // 一键打包器新增字段（透传给设置页）
    stableUrl: latest.stableUrl || `/apk/${stableFile}`,
    stableFile: stableStat ? stableFile : null,
    stableSize: stableStat ? stableStat.size : null,
    history: Array.isArray(latest.history) ? latest.history : [],
  };
}

function readProgress() {
  return readJson(PROGRESS_JSON);
}

function isLocalRequest(req) {
  const addr = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function sendJson(res, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) { resolve(''); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(''));
  });
}

function startBuild(res) {
  if (state.building) {
    sendJson(res, 409, { ok: false, error: 'APK 正在构建中，请稍候（可通过 /api/mobile/status 轮询进度）' });
    return;
  }
  state.building = true;
  state.error = null;
  state.startedAt = Date.now();
  state.finishedAt = 0;
  state.log = [];
  pushLog(`[plugin] 开始构建 APK：${new Date().toISOString()}`);

  let child;
  try {
    child = spawn(process.execPath, [BUILD_SCRIPT], {
      cwd: ROOT,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
  } catch (e) {
    state.building = false;
    state.error = `无法启动构建进程：${e.message}`;
    sendJson(res, 500, { ok: false, error: state.error });
    return;
  }

  child.stdout.on('data', (chunk) => pushLog(chunk.toString('utf8')));
  child.stderr.on('data', (chunk) => pushLog(chunk.toString('utf8')));
  child.on('error', (err) => {
    state.error = `构建进程错误：${err.message}`;
    pushLog(`[plugin] ${state.error}`);
  });
  child.on('close', (code) => {
    state.building = false;
    state.finishedAt = Date.now();
    if (code !== 0) {
      state.error = `APK 构建失败（退出码 ${code}），请查看日志`;
      pushLog(`[plugin] ${state.error}`);
      return;
    }
    // 解析构建脚本输出的 [build:result] JSON 并写入 latest.json（持久化，重启 Vite 后仍可读）
    let result = null;
    for (let i = state.log.length - 1; i >= 0; i--) {
      const line = state.log[i];
      const marker = '[build:result] ';
      if (line.startsWith(marker)) {
        try { result = JSON.parse(line.slice(marker.length)); } catch { result = null; }
        break;
      }
    }
    if (result) {
      try {
        fs.mkdirSync(APK_DIR, { recursive: true });
        fs.writeFileSync(LATEST_JSON, JSON.stringify(result, null, 2) + '\n', 'utf8');
        pushLog(`[plugin] 已写入 latest.json：${result.version || ''} ${result.file || ''}`);
      } catch (e) {
        state.error = `写入 latest.json 失败：${e.message}`;
      }
    } else if (!readJson(LATEST_JSON)) {
      state.error = '构建结束但未找到 latest.json / 构建结果';
    }
    pushLog(`[plugin] 构建完成，用时 ${((state.finishedAt - state.startedAt) / 1000).toFixed(1)}s`);
  });

  sendJson(res, 202, {
    ok: true,
    started: true,
    message: 'APK 构建已开始，请轮询 /api/mobile/status 查看进度',
  });
}

function createMiddleware() {
  return async (req, res, next) => {
    let pathname = '';
    try {
      pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    } catch {
      next();
      return;
    }
    if (!pathname.startsWith('/api/mobile/')) {
      next();
      return;
    }

    if (pathname === '/api/mobile/status' && (req.method === 'GET' || req.method === 'HEAD')) {
      const tc = locateToolchain(ROOT);
      sendJson(res, 200, {
        ok: true,
        available: tc.available,
        missing: tc.missing,
        toolchain: tc.available ? {
          javaHome: tc.javaHome,
          sdkRoot: tc.sdkRoot,
          buildTools: tc.buildTools,
        } : null,
        building: state.building,
        progress: state.building ? readProgress() : (readProgress() || null),
        startedAt: state.startedAt || null,
        finishedAt: state.finishedAt || null,
        log: state.log.slice(-120),
        apk: readApkInfo(),
        error: state.error,
      });
      return;
    }

    if (pathname === '/api/mobile/build' && req.method === 'POST') {
      if (!isLocalRequest(req)) {
        sendJson(res, 403, { ok: false, error: '仅允许本机（127.0.0.1）触发 APK 构建' });
        return;
      }
      await readBody(req);
      const tc = locateToolchain(ROOT);
      if (!tc.available) {
        sendJson(res, 503, {
          ok: false,
          error: `Android 工具链未安装/不完整：${tc.missing.join('、')}。请先运行 scripts/setup-android.ps1`,
        });
        return;
      }
      startBuild(res);
      return;
    }

    sendJson(res, 404, { ok: false, error: '接口不存在（可用：GET /api/mobile/status、POST /api/mobile/build）' });
  };
}

/** Vite 插件入口 */
export default function mobileBuildPlugin() {
  const middleware = createMiddleware();
  return {
    name: 'cgm-mobile-build',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
