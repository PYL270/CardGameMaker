/**
 * 一键产出 GitHub Release 需要的全部附件 → release/
 *
 *   release/CardGameMaker-web.zip                 网页版（解压双击启动，无需安装）
 *   release/CardGameMaker-win-x64-portable.zip    Windows 免安装版（Electron，自带中继）
 *   release/CardGameMaker-android.apk             安卓安装包（取 apk-out 最新一个）
 *   release/CardGameMaker-source.zip              源码包（git archive，不含依赖与产物）
 *
 * 文件名不带版本号，README 里的 releases/latest/download/... 链接才能长期有效。
 *
 * 用法：
 *   node scripts/package-release.mjs              # 全部
 *   node scripts/package-release.mjs --no-desktop # 跳过 Electron 打包（快）
 *   node scripts/package-release.mjs --no-apk     # 没有 APK 时跳过
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const skipDesktop = args.includes('--no-desktop');
const skipApk = args.includes('--no-apk');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version || '1.0.0';
const releaseDir = path.join(root, 'release');
const distDir = path.join(root, 'dist');
fs.mkdirSync(releaseDir, { recursive: true });

const log = (msg) => console.log(`[release] ${msg}`);

/** 用系统自带的 Compress-Archive 压缩目录内容（不含外层目录） */
function zipDir(dir, zipPath) {
  fs.rmSync(zipPath, { force: true });
  const escaped = zipPath.replace(/'/g, "''");
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Compress-Archive -Path '${dir.replace(/'/g, "''")}\\*' -DestinationPath '${escaped}' -CompressionLevel Optimal`],
  { stdio: 'inherit' });
  const mb = (fs.statSync(zipPath).size / 1048576).toFixed(1);
  log(`${path.basename(zipPath)}  ${mb} MB`);
}

// ---------- 1. 网页版 ----------
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('缺少 dist/index.html，请先执行 npm run build');
  process.exit(1);
}
const webStage = fs.mkdtempSync(path.join(os.tmpdir(), 'cgm-web-'));
fs.cpSync(distDir, webStage, { recursive: true });
fs.cpSync(path.join(root, 'desktop', 'web-launcher'), webStage, { recursive: true });
zipDir(webStage, path.join(releaseDir, 'CardGameMaker-web.zip'));
fs.rmSync(webStage, { recursive: true, force: true });

// ---------- 2. 安卓 APK ----------
if (!skipApk) {
  const apkDir = path.join(root, 'apk-out');
  const apks = fs.existsSync(apkDir)
    ? fs.readdirSync(apkDir).filter(f => f.toLowerCase().endsWith('.apk'))
      .map(f => ({ f, t: fs.statSync(path.join(apkDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    : [];
  if (apks.length) {
    const target = path.join(releaseDir, 'CardGameMaker-android.apk');
    fs.copyFileSync(path.join(apkDir, apks[0].f), target);
    log(`${path.basename(target)}  ${(fs.statSync(target).size / 1048576).toFixed(1)} MB（来自 ${apks[0].f}）`);
  } else {
    log('apk-out/ 里没有 APK，跳过安卓包');
  }
}

// ---------- 3. Windows 免安装版 ----------
if (!skipDesktop) {
  log('打包 Windows 免安装版（首次会下载 Electron，需要几分钟）...');
  execFileSync(process.execPath, [path.join(root, 'desktop', 'build-portable.mjs')], { stdio: 'inherit', cwd: root });
}

// ---------- 4. 源码包 ----------
try {
  const sourceZip = path.join(releaseDir, 'CardGameMaker-source.zip');
  fs.rmSync(sourceZip, { force: true });
  execFileSync('git', ['archive', '--format=zip', `--prefix=CardGameMaker-${version}/`, '-o', sourceZip, 'HEAD'],
    { cwd: root, stdio: 'inherit' });
  log(`${path.basename(sourceZip)}  ${(fs.statSync(sourceZip).size / 1048576).toFixed(1)} MB`);
} catch (err) {
  log(`源码包生成失败（不是 git 仓库或没有提交）：${err.message}`);
}

log(`完成，产物在 ${releaseDir}`);
