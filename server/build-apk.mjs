/**
 * CardGameMaker — 本地 APK 构建服务
 *
 * 为什么需要它：浏览器沙箱里没有文件系统和编译器，无法直接生成 APK。
 * 这个服务跑在电脑上，接收前端的构建请求，依次执行：
 *   1. vite build            → 生成 dist/
 *   2. cap sync android      → 把 dist 同步进 Android 工程
 *   3. gradlew assembleRelease → 产出签名 APK
 *
 * 只监听 127.0.0.1，不对外网/局域网暴露（构建能力不该给陌生人）。
 *
 * 接口：
 *   GET  /health              → { ok, ready, missing[] }
 *   POST /build               → { jobId }
 *   GET  /status?jobId=xxx    → { state, stage, percent, log[], apk }
 *   GET  /download?jobId=xxx  → APK 文件流
 *   POST /cancel?jobId=xxx    → 取消
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.BUILD_PORT || 8890);
const APK_DIR = path.join(root, 'apk-out');
const BUILD_COUNT_FILE = path.join(root, 'android', 'build-count.json');

/** 工具链位置（可用环境变量覆盖） */
const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const JAVA_HOME = process.env.CGM_JAVA_HOME || process.env.JAVA_HOME || path.join(LOCALAPPDATA, 'jdk-21');
const ANDROID_HOME = process.env.CGM_ANDROID_HOME || process.env.ANDROID_HOME || path.join(LOCALAPPDATA, 'android-sdk');

/** 分阶段权重，用于估算总进度 */
const STAGES = [
  { key: 'icons', label: '同步图标 (make-icons)', weight: 4 },
  { key: 'web', label: '构建网页资源 (vite build)', weight: 14 },
  { key: 'sync', label: '同步到 Android 工程 (cap sync)', weight: 8 },
  { key: 'gradle', label: '编译 APK (gradle assembleRelease)', weight: 74 },
];

const MAX_LOG_LINES = 300;

/** 当前任务（单任务队列：个人工具，同时只跑一个） */
let job = null;
let queue = Promise.resolve();

// ---------------------------------------------------------------- 工具函数

function findNpm() {
  const candidates = [
    path.join(path.dirname(process.execPath), 'npm.cmd'),
    path.join(LOCALAPPDATA, 'node-v24.22.1', 'npm.cmd'),
  ];
  return candidates.find(p => existsSync(p)) || 'npm.cmd';
}

function buildEnv() {
  const extra = [
    path.join(JAVA_HOME, 'bin'),
    path.join(ANDROID_HOME, 'platform-tools'),
    path.dirname(process.execPath),
  ].filter(Boolean);
  return {
    ...process.env,
    JAVA_HOME,
    ANDROID_HOME,
    ANDROID_SDK_ROOT: ANDROID_HOME,
    PATH: [...extra, process.env.PATH || ''].join(path.delimiter),
  };
}

function readJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}

/** 检查工具链是否齐备 */
function checkToolchain() {
  const missing = [];
  if (!existsSync(path.join(JAVA_HOME, 'bin', 'javac.exe'))) missing.push(`JDK 21（找不到 ${JAVA_HOME}）`);
  if (!existsSync(path.join(ANDROID_HOME, 'platform-tools'))) missing.push(`Android SDK（找不到 ${ANDROID_HOME}）`);
  if (!existsSync(path.join(root, 'android', 'gradlew.bat'))) missing.push('Android 工程（android/ 目录缺失）');
  if (!existsSync(path.join(root, 'node_modules', '@capacitor', 'cli'))) missing.push('Capacitor 依赖（npm install 未完成）');
  return missing;
}

/** 估算各阶段进度 */
function stagePercent(stageKey, line) {
  const stage = STAGES.find(s => s.key === stageKey);
  if (!stage) return 0;
  const before = STAGES.slice(0, STAGES.findIndex(s => s.key === stageKey))
    .reduce((sum, s) => sum + s.weight, 0);
  let within = 0.5;
  if (stageKey === 'gradle') {
    // gradle 没有稳定的百分比，用已完成 task 数量做粗略估计
    const m = line.match(/^> Task /);
    if (m) job.gradleTasks = (job.gradleTasks || 0) + 1;
    within = Math.min(0.92, (job.gradleTasks || 0) / 120);
  } else if (stageKey === 'web') {
    if (line.includes('modules transformed')) within = 0.7;
    if (line.includes('built in')) within = 1;
  } else if (stageKey === 'sync') {
    if (line.includes('copy android')) within = 0.6;
    if (line.includes('update android')) within = 1;
  }
  return Math.round(before + stage.weight * within);
}

function pushLog(text, stream = 'out') {
  if (!job) return;
  const lines = String(text).split(/\r?\n/).filter(l => l.trim());
  for (const line of lines) {
    job.log.push({ t: Date.now(), stream, text: line });
    job.percent = Math.max(job.percent, stagePercent(job.stage, line));
  }
  if (job.log.length > MAX_LOG_LINES) job.log.splice(0, job.log.length - MAX_LOG_LINES);
}

/** 执行一条命令，边跑边把输出塞进 job.log */
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    // Windows 的 shell:true 会把完整命令拼进 cmd /c；路径含空格（如 C:\Program Files\nodejs\npm.cmd）
    // 时必须自己加引号，否则 cmd 只认到 "C:\Program"。
    const spawnCmd = process.platform === 'win32' && /\s/.test(cmd) ? `"${cmd}"` : cmd;
    const child = spawn(spawnCmd, args, {
      cwd: opts.cwd || root,
      env: buildEnv(),
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    job.child = child;
    child.stdout.on('data', d => pushLog(d.toString(), 'out'));
    child.stderr.on('data', d => pushLog(d.toString(), 'err'));
    child.on('error', err => reject(new Error(`${cmd} 启动失败：${err.message}`)));
    child.on('close', code => {
      job.child = null;
      if (job.cancelled) return reject(new Error('已取消'));
      if (code !== 0) return reject(new Error(`${cmd} ${args.join(' ')} 退出码 ${code}`));
      resolve();
    });
  });
}

/**
 * 图标工厂：从 branding/icon-base.png 生成所有平台的图标（网页 / Android / app.ico）。
 * 脚本自己带 hash 缓存，源图没变时 0.1 秒就返回，所以每次打包都跑一遍很便宜。
 * 这样换图标只需要改 branding/icon-base.png，不需要手动碰 android/ 里的任何文件。
 */
async function syncIcons() {
  const script = path.join(root, 'scripts', 'make-icons.ps1');
  if (!existsSync(script)) {
    pushLog('图标工厂脚本缺失，跳过（沿用现有图标）', 'err');
    return;
  }
  if (!existsSync(path.join(root, 'branding', 'icon-base.png'))) {
    pushLog('branding/icon-base.png 缺失，跳过图标同步', 'err');
    return;
  }
  await run('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass',
    '-File', `"${script}"`,
  ]);
}

// ---------------------------------------------------------------- 构建流程

async function runBuild() {
  const pkg = readJson(path.join(root, 'package.json'), { version: '1.0.0' });
  const versionName = pkg.version || '1.0.0';

  // versionCode 必须每次递增，否则无法覆盖安装
  const count = readJson(BUILD_COUNT_FILE, { build: 0 });
  const versionCode = (count.build || 0) + 1;

  job.state = 'running';
  job.stage = 'icons';
  job.percent = 1;
  pushLog(`开始构建 v${versionName} (build ${versionCode})`);

  // 0. 图标同步（源图没变时自动跳过）
  await syncIcons();
  job.percent = 4;

  // 1. 网页构建
  job.stage = 'web';
  await run(findNpm(), ['run', 'build']);
  job.percent = 18;

  // 2. 同步进 Android 工程
  job.stage = 'sync';
  await run(process.execPath, [path.join('node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), 'sync', 'android']);
  job.percent = 25;

  // 3. Gradle 打包
  job.stage = 'gradle';
  await run('gradlew.bat', [
    'assembleRelease', '--no-daemon',
    `-PcgmVersionName=${versionName}`,
    `-PcgmVersionCode=${versionCode}`,
  ], { cwd: path.join(root, 'android') });
  job.percent = 97;

  // 4. 收集产物
  const built = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  if (!existsSync(built)) throw new Error('构建完成但没找到 APK 产物');

  mkdirSync(APK_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const apkName = `CardGameMaker-v${versionName}-${stamp}-b${versionCode}.apk`;
  const apkPath = path.join(APK_DIR, apkName);
  copyFileSync(built, apkPath);

  // 只保留最新一个包：旧包对分享没用，堆着只会让人分不清该发哪个
  let removed = 0;
  for (const f of readdirSync(APK_DIR)) {
    if (f === apkName || !f.toLowerCase().endsWith('.apk')) continue;
    try { unlinkSync(path.join(APK_DIR, f)); removed++; } catch { /* 被占用就留着 */ }
  }
  if (removed) pushLog(`已清理 ${removed} 个旧安装包`);

  writeFileSync(BUILD_COUNT_FILE, JSON.stringify({ build: versionCode }, null, 2));

  job.state = 'done';
  job.percent = 100;
  job.apk = { name: apkName, path: apkPath, size: statSync(apkPath).size, versionName, versionCode };
  pushLog(`完成：${apkName}（${(job.apk.size / 1024 / 1024).toFixed(1)} MB）`);
}

function startJob() {
  job = {
    id: `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    state: 'queued',
    stage: null,
    percent: 0,
    log: [],
    apk: null,
    cancelled: false,
    startedAt: Date.now(),
    finishedAt: null,
    gradleTasks: 0,
  };
  const current = job;

  queue = queue.then(async () => {
    try {
      await runBuild();
    } catch (err) {
      current.state = current.cancelled ? 'cancelled' : 'error';
      current.error = err.message;
      pushLog(`失败：${err.message}`, 'err');
    } finally {
      current.finishedAt = Date.now();
      current.child = null;
    }
  });

  return current.id;
}

// ---------------------------------------------------------------- HTTP

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export function startBuildService(port = PORT) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const p = url.pathname;

    if (p === '/health') {
      const missing = checkToolchain();
      return json(res, 200, { ok: missing.length === 0, missing, busy: job?.state === 'running' || job?.state === 'queued' });
    }

    if (p === '/build' && req.method === 'POST') {
      const missing = checkToolchain();
      if (missing.length) return json(res, 400, { error: '工具链不完整', missing });
      if (job && (job.state === 'running' || job.state === 'queued')) {
        return json(res, 409, { error: '已有构建任务在进行', jobId: job.id });
      }
      const jobId = startJob();
      return json(res, 200, { jobId });
    }

    if (p === '/status') {
      const id = url.searchParams.get('jobId');
      if (!job || (id && job.id !== id)) return json(res, 404, { error: '没有这个构建任务' });
      const stage = STAGES.find(s => s.key === job.stage);
      return json(res, 200, {
        jobId: job.id,
        state: job.state,
        stage: job.stage,
        stageLabel: stage ? stage.label : '',
        percent: job.percent,
        log: job.log.slice(-60),
        apk: job.apk,
        error: job.error || null,
        elapsedMs: (job.finishedAt || Date.now()) - job.startedAt,
      });
    }

    if (p === '/download') {
      const id = url.searchParams.get('jobId');
      if (!job || job.state !== 'done' || !job.apk || (id && job.id !== id)) {
        return json(res, 404, { error: 'APK 还没准备好' });
      }
      const file = path.join(APK_DIR, job.apk.name);
      if (!existsSync(file)) return json(res, 404, { error: 'APK 文件已丢失，请重新构建' });
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="${job.apk.name}"`,
        'Content-Length': statSync(file).size,
      });
      createReadStream(file).pipe(res);
      return;
    }

    if (p === '/reveal' && req.method === 'POST') {
      if (!job || job.state !== 'done' || !job.apk) {
        return json(res, 400, { error: 'APK 还没准备好' });
      }
      const file = path.join(APK_DIR, job.apk.name);
      if (!existsSync(file)) return json(res, 404, { error: 'APK 文件已丢失，请重新构建' });
      // 在资源管理器中打开并选中该文件，用户可直接拖到 QQ / 微信
      spawn('explorer.exe', [`/select,${file}`], { detached: true, stdio: 'ignore' }).unref();
      return json(res, 200, { ok: true, path: file });
    }

    if (p === '/cancel' && req.method === 'POST') {
      if (job && job.state === 'running') {
        job.cancelled = true;
        try { job.child?.kill('SIGTERM'); } catch { /* ignore */ }
        return json(res, 200, { ok: true });
      }
      return json(res, 400, { error: '没有正在进行的任务' });
    }

    json(res, 404, { error: 'not found' });
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`[build] APK 构建服务: http://127.0.0.1:${port}`);
  });
  server.on('error', (e) => {
    console.warn(`[build] 构建服务启动失败（${e.code}），「生成安装包」按钮将不可用`);
  });
  return server;
}

// 直接运行本文件时独立起服务
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startBuildService();
}
