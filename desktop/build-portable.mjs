/**
 * 打包 Windows 免安装版（Portable）
 *
 * 步骤：
 *  1. 组一个干净的 staging 目录：main.mjs + relay.mjs + web(dist) + ws 依赖
 *  2. 用 @electron/packager 生成 release/CardGameMaker-win32-x64/
 *  3. 压缩成 release/CardGameMaker-<版本>-win-x64-portable.zip
 *
 * 前置：先在项目根目录跑 `npm run build` 生成 dist/
 * 用法：node desktop/build-portable.mjs
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const require = createRequire(import.meta.url);
const packager = (await import('@electron/packager')).default;

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version || '1.0.0';
const appName = 'CardGameMaker';
const distDir = path.join(root, 'dist');
const outDir = path.join(root, 'release');

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('缺少 dist/index.html，请先在项目根目录执行 npm run build');
  process.exit(1);
}

// ---------- 1. staging ----------
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'cgm-desktop-'));
fs.cpSync(path.join(root, 'desktop', 'main.mjs'), path.join(staging, 'main.mjs'));
fs.cpSync(path.join(root, 'server', 'relay.mjs'), path.join(staging, 'relay.mjs'));
fs.mkdirSync(path.join(staging, 'web'), { recursive: true });
fs.cpSync(distDir, path.join(staging, 'web'), { recursive: true });

const icon = path.join(root, 'app.ico');
if (fs.existsSync(icon)) fs.cpSync(icon, path.join(staging, 'icon.ico'));

// 只带运行时真正需要的依赖：ws（联机中继）
const wsDir = path.join(root, 'node_modules', 'ws');
const wsPkgPath = path.join(wsDir, 'package.json');
if (!fs.existsSync(wsPkgPath)) {
  console.error('缺少 node_modules/ws，请先在项目根目录执行 npm install');
  process.exit(1);
}
const wsVersion = JSON.parse(fs.readFileSync(wsPkgPath, 'utf8')).version;
fs.mkdirSync(path.join(staging, 'node_modules'), { recursive: true });
fs.cpSync(wsDir, path.join(staging, 'node_modules', 'ws'), { recursive: true, dereference: true });

fs.writeFileSync(path.join(staging, 'package.json'), JSON.stringify({
  name: 'cardgamemaker-desktop',
  productName: appName,
  version,
  description: '类三国杀卡牌游戏：自定义武将/技能、AI 对战、局域网联机',
  main: 'main.mjs',
  type: 'module',
  homepage: 'https://github.com/PYL270/CardGameMaker',
  license: 'MIT',
  dependencies: { ws: `^${wsVersion}` },
}, null, 2));

// @electron/packager 默认要求 app 目录自己声明 electron 依赖，这里直接用本地产装的版本
const electronVersion = JSON.parse(
  fs.readFileSync(path.join(here, 'node_modules', 'electron', 'package.json'), 'utf8'),
).version;

// 优先复用 npm 安装 Electron 时已经下载好的 zip，避免打包阶段再联网
const electronZipName = `electron-v${electronVersion}-win32-x64.zip`;
const electronZipDirs = [
  process.env.ELECTRON_ZIP_DIR,
  path.join(here, '.electron-zip'),
  path.join(os.homedir(), 'AppData', 'Local', 'electron', 'Cache'),
  path.join(os.homedir(), 'Library', 'Caches', 'electron'),
  path.join(os.homedir(), '.cache', 'electron'),
].filter(Boolean);
const electronZipDir = electronZipDirs.find(d => fs.existsSync(path.join(d, electronZipName)));
if (electronZipDir) {
  console.log(`[portable] 复用本地 Electron 包：${path.join(electronZipDir, electronZipName)}`);
} else {
  console.log('[portable] 没找到本地 Electron 包，将从网络下载（慢的话可以设置 ELECTRON_MIRROR）');
}

// ---------- 2. package ----------
fs.mkdirSync(outDir, { recursive: true });
console.log(`[portable] 打包 ${appName} v${version}（Electron ${electronVersion}）...`);
const [builtDir] = await packager({
  dir: staging,
  out: outDir,
  name: appName,
  platform: 'win32',
  arch: 'x64',
  electronVersion,
  electronZipDir,
  icon: fs.existsSync(icon) ? icon : undefined,
  appVersion: version,
  overwrite: true,
  asar: true,
  prune: true,
  win32metadata: {
    CompanyName: 'CardGameMaker',
    FileDescription: 'CardGameMaker · 卡牌游戏制作器',
    ProductName: appName,
    InternalName: appName,
    OriginalFilename: `${appName}.exe`,
  },
});
// 目录改名成 CardGameMaker：解压后就是一个同名文件夹，进去双击 exe
const finalDir = path.join(outDir, appName);
if (path.basename(builtDir) !== appName) {
  fs.rmSync(finalDir, { recursive: true, force: true });
  fs.renameSync(builtDir, finalDir);
}
console.log(`[portable] 输出目录：${finalDir}`);

// ---------- 3. zip ----------
const zipName = `${appName}-win-x64-portable.zip`;
const zipPath = path.join(outDir, zipName);
fs.rmSync(zipPath, { force: true });
// 优先用系统自带 tar(bsdtar)，写出的 zip 是标准正斜杠路径、UTF-8 文件名
try {
  execFileSync('tar', ['-a', '-c', '-f', zipPath, '-C', outDir, appName], { stdio: 'inherit' });
} catch {
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Compress-Archive -Path '${finalDir}' -DestinationPath '${zipPath}' -CompressionLevel Optimal`],
  { stdio: 'inherit' });
}
const mb = (fs.statSync(zipPath).size / 1048576).toFixed(1);
console.log(`[portable] 完成：${zipPath}（${mb} MB）`);
fs.rmSync(staging, { recursive: true, force: true });
