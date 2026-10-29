/**
 * 一键启动：中继服务器 + Vite 开发服务器（浏览器自动打开）
 * - 单实例：如果游戏已在运行，只打开浏览器，不重复启动
 * - 打开浏览器会等待成功后再退出；失败则保留窗口提示网址
 * - 中继端口被占用时跳过中继，不影响单机游戏
 * 用法: node scripts/launch.mjs
 */
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { startRelay } from '../server/relay.mjs';
import { startBuildService } from '../server/build-apk.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const configFile = fileURLToPath(new URL('../vite.config.js', import.meta.url));
const logFile = fileURLToPath(new URL('../launcher.log', import.meta.url));
const relayPort = Number(process.env.RELAY_PORT || 8787);
const webPort = Number(process.env.PORT || 3000);
const webUrl = `http://localhost:${webPort}/`;

/** 追加启动日志（排查用） */
function logLine(msg) {
  try {
    appendFileSync(logFile, `[${new Date().toLocaleTimeString()}] ${msg}\n`);
  } catch {
    // 忽略日志失败
  }
}

/** 执行命令并等待结束 */
function runCmd(cmd, args, timeout = 5000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let child;
    try {
      child = execFile(cmd, args, { windowsHide: true }, (err) => {
        finish({ ok: !err, error: err ? err.message : '' });
      });
    } catch (e) {
      finish({ ok: false, error: e.message });
      return;
    }
    setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      finish({ ok: false, error: 'timeout' });
    }, timeout).unref?.();
  });
}

/**
 * 打开默认浏览器（依次尝试多种方式，成功即返回）
 * @returns {Promise<boolean>}
 */
async function openBrowser(url) {
  const attempts = process.platform === 'win32'
    ? [
      // PowerShell 的 Start-Process 最可靠，优先尝试
      ['powershell', ['-NoProfile', '-Command', `Start-Process '${url}'`]],
      ['cmd', ['/c', `start "" "${url}"`]],
      ['explorer.exe', [url]],
    ]
    : process.platform === 'darwin'
      ? [['open', [url]]]
      : [['xdg-open', [url]]];

  for (const [cmd, args] of attempts) {
    const result = await runCmd(cmd, args);
    logLine(`open ${cmd} -> ${result.ok ? 'ok' : 'fail'} ${result.error || ''}`);
    if (result.ok) {
      // 等待浏览器进程真正拉起，避免本进程立即退出导致打开失败
      await new Promise(resolve => setTimeout(resolve, 900));
      return true;
    }
  }
  return false;
}

/** 检测本机端口是否已被监听 */
function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch { /* ignore */ }
      resolve(v);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(800, () => done(false));
  });
}

/** 检测游戏网页是否已可访问（优先 IPv4，避免 localhost 解析差异） */
async function webAlive() {
  const urls = [`http://127.0.0.1:${webPort}/`, webUrl];
  for (const url of urls) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 1200);
      const res = await fetch(url, { signal: ctl.signal });
      clearTimeout(timer);
      if (res.ok) return true;
    } catch {
      // 继续尝试下一个地址
    }
  }
  return false;
}

console.log('==========================================');
console.log('  CardGameMaker 启动中...');
console.log('==========================================');
logLine('launch start');

// 单实例：已在运行则只打开浏览器
if (await webAlive()) {
  console.log(`[web] 游戏已在运行：${webUrl}`);
  logLine(`already running ${webUrl}`);
  const opened = await openBrowser(webUrl);
  if (opened) {
    console.log('[web] 已为你打开浏览器，无需重复启动。');
    logLine('already running: browser opened');
    process.exit(0);
  }
  console.log('[web] 自动打开浏览器失败，请手动访问上面的地址。');
  console.log('     本窗口保持打开，游戏服务仍在运行；关闭本窗口不会停止已运行的游戏。');
  logLine('already running: browser open failed, keep console open');
  // 保持窗口，方便用户看到网址
  await new Promise(() => {});
}

let relay = null;
if (await portInUse(relayPort)) {
  console.warn(`[relay] 端口 ${relayPort} 已被占用，跳过中继服务器（联机可能不可用）`);
  logLine(`relay port ${relayPort} in use, skipped`);
} else {
  try {
    relay = startRelay(relayPort);
  } catch (e) {
    console.warn('[relay] 中继服务器启动失败，联机功能不可用：', e.message);
    logLine(`relay start failed: ${e.message}`);
  }
}

// APK 构建服务（仅监听 127.0.0.1:8890，供设置页「生成安装包」调用）
try {
  startBuildService(Number(process.env.BUILD_PORT || 8890));
} catch (e) {
  console.warn('[build] 构建服务启动失败，APK 打包按钮不可用：', e.message);
  logLine(`build service failed: ${e.message}`);
}

const server = await createServer({
  configFile,
  root,
  server: {
    host: true,
    port: webPort,
    open: false, // 由本脚本统一打开，避免 open 失效
  },
});

await server.listen();

const info = server.resolvedUrls;
const localUrl = info?.local?.[0] || webUrl;
console.log('[web] 本机地址: ' + localUrl);
logLine(`web listening ${localUrl}`);
if (info?.network?.length) {
  console.log('[web] 局域网地址: ' + info.network.join(' , '));
  console.log('[relay] 局域网联机时服务器地址请填: ws://<本机IP>:' + relayPort);
}
console.log('按 Ctrl+C 结束游戏并关闭服务器。');

// 等浏览器成功打开（可通过 NO_OPEN=1 关闭）
if (process.env.NO_OPEN !== '1') {
  const opened = await openBrowser(localUrl);
  logLine(`fresh start: browser ${opened ? 'opened' : 'open failed'}`);
  if (!opened) {
    console.log('[web] 自动打开浏览器失败，请手动访问：' + localUrl);
  }
}

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  console.log('\n正在关闭...');
  try { await server.close(); } catch { /* ignore */ }
  try { relay?.close(); } catch { /* ignore */ }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
