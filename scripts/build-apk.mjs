/**
 * scripts/build-apk.mjs - CardGameMaker Android APK 构建脚本（零第三方依赖）
 *
 * 做四件事：
 *   1) vite build 生成 dist/，复制到 mobile/android/assets/www；
 *   2) aapt2 编译资源并链接 APK（含 assets）；
 *   3) javac + d8 编译 Java（MainActivity + 本地静态 HTTP 服务）并塞入 classes.dex；
 *   4) zipalign + apksigner(debug keystore) 签名，输出 public/apk/CardGameMaker-<version>.apk 与 latest.json。
 *
 * 工具链自动定位顺序：环境变量（JAVA_HOME / ANDROID_SDK_ROOT / ANDROID_HOME）
 *   → %LOCALAPPDATA%\CGM-Android\{jdk,sdk} → <项目>\mobile\tools\{jdk,android-sdk}
 * 一键安装工具链：powershell -ExecutionPolicy Bypass -File scripts/setup-android.ps1
 *
 * 直接运行：node scripts/build-apk.mjs
 * 也可被 scripts/mobile-build-plugin.mjs 的 /api/mobile/build 调用。
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wavToMono } from './wav-to-mono.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
const MOBILE = path.join(ROOT, 'mobile', 'android');
const APK_OUT_DIR = path.join(ROOT, 'public', 'apk');
const BUILD_DIR = path.join(MOBILE, 'build');
const ASSETS_DIR = path.join(MOBILE, 'assets');
const WWW_DIR = path.join(ASSETS_DIR, 'www');
const RES_DIR = path.join(MOBILE, 'res');
const GEN_DIR = path.join(BUILD_DIR, 'gen');
const CLASSES_DIR = path.join(BUILD_DIR, 'classes');
const DEX_DIR = path.join(BUILD_DIR, 'dex');
const KEYSTORE = path.join(MOBILE, 'debug.keystore');
const KEYSTORE_PASS = 'android';
const KEY_ALIAS = 'androiddebugkey';
const BUILD_TOOLS_VERSION = '34.0.0';
const PLATFORM_VERSION = 'android-34';
const MIN_SDK = 24;
const TARGET_SDK = 34;
const APP_LABEL = '卡牌游戏制作器';
const PACKAGE_NAME = 'com.cardgamemaker.app';

const ICON_DENSITIES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

function log(message) {
  console.log(`[build] ${message}`);
}

/** 写入构建进度（供 Vite 插件 /api/mobile/status 读取） */
function writeProgress(step, percent, message) {
  try {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(BUILD_DIR, 'progress.json'),
      JSON.stringify({ step, percent, message, updatedAt: new Date().toISOString() }, null, 2),
      'utf8',
    );
  } catch {
    // 进度文件失败不影响构建
  }
}

function readPackageVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    return String(pkg.version || '1.0.0');
  } catch {
    return '1.0.0';
  }
}

/** 从版本号 + 构建时间生成 versionName / versionCode（versionCode 需为递增整数） */
function makeVersionInfo(version) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  // 秒级时间戳：既用于唯一文件名，也用于 versionName，连续构建不会同名覆盖
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version) || [null, '1', '0', '0'];
  // versionCode 取构建时间的“秒级时间戳”，保证每次构建递增（Android 要求单调递增；
  // 时间戳在 2038 年前 < 2^31-1，可满足 versionCode int 上限）。
  const versionCode = Math.floor(now.getTime() / 1000);
  return {
    version,
    versionName: `${version}+b${stamp}`,
    versionCode,
    stamp,
    builtAt: now.toISOString(),
  };
}

const STABLE_APK_NAME = 'CardGameMaker-latest.apk';
const KEEP_APK_COUNT = 5;
const UNIQUE_APK_RE = /^CardGameMaker-(\d+\.\d+\.\d+)-b(\d{14})(?:-\d+)?\.apk$/;

/** 读取 JSON（失败返回 null，不抛错） */
function safeReadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** 解析唯一 APK 文件名（CardGameMaker-<version>-b<yyyymmddhhmmss>[-N].apk） */
function parseApkName(name) {
  const m = UNIQUE_APK_RE.exec(name);
  if (!m) return null;
  const stamp = m[2];
  // 文件名里的时间是本地时间，转成 ISO（UTC）便于 history 与其他时间字段比较
  const built = new Date(
    Number(stamp.slice(0, 4)),
    Number(stamp.slice(4, 6)) - 1,
    Number(stamp.slice(6, 8)),
    Number(stamp.slice(8, 10)),
    Number(stamp.slice(10, 12)),
    Number(stamp.slice(12, 14)),
  );
  return {
    version: m[1],
    versionName: `${m[1]}+b${stamp}`,
    builtAt: Number.isNaN(built.getTime()) ? null : built.toISOString(),
  };
}

/** 生成 history 条目：优先复用上一版 latest.json 中同文件 sha256，避免每次重新哈希 5 个 23MB 包 */
function buildHistoryEntry(file, prevByFile) {
  const stat = fs.statSync(file);
  const name = path.basename(file);
  const parsed = parseApkName(name);
  const prev = prevByFile.get(name);
  let checksum = null;
  if (prev && prev.size === stat.size && prev.sha256) checksum = prev.sha256;
  if (!checksum) checksum = sha256(file);
  return {
    file: name,
    versionName: (parsed && parsed.versionName) || (prev && prev.versionName) || null,
    size: stat.size,
    // 时间以文件名中的构建时间为准（同一文件的 prev.builtAt 可能来自旧版本脚本的时区处理，不沿用）
    builtAt: (parsed && parsed.builtAt) || (prev && prev.builtAt) || stat.mtime.toISOString(),
    url: `/apk/${name}`,
    sha256: checksum,
  };
}

function firstExisting(candidates) {
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * 定位 JDK 与 Android SDK，返回各工具绝对路径与可用性。
 * @param {string} [root] 项目根目录（默认本仓库）
 */
export function locateToolchain(root = ROOT) {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const base = process.env.CGM_ANDROID_HOME || path.join(localAppData, 'CGM-Android');

  // ---- JDK ----
  const jdkCandidates = [];
  if (process.env.JAVA_HOME) jdkCandidates.push(process.env.JAVA_HOME);
  const jdkRoot = path.join(base, 'jdk');
  if (fs.existsSync(jdkRoot)) {
    for (const name of fs.readdirSync(jdkRoot)) jdkCandidates.push(path.join(jdkRoot, name));
  }
  jdkCandidates.push(
    path.join(root, 'mobile', 'tools', 'jdk'),
    path.join(root, 'mobile', 'tools', 'jdk17'),
  );
  let javaHome = null;
  for (const c of jdkCandidates) {
    if (c && fs.existsSync(path.join(c, 'bin', 'javac.exe'))) { javaHome = c; break; }
  }
  const exe = (name) => (javaHome ? path.join(javaHome, 'bin', name) : null);

  // ---- Android SDK ----
  const sdkCandidates = [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    path.join(base, 'sdk'),
    path.join(root, 'mobile', 'tools', 'android-sdk'),
  ].filter(Boolean);
  let sdkRoot = null;
  for (const c of sdkCandidates) {
    if (fs.existsSync(path.join(c, 'cmdline-tools'))) { sdkRoot = c; break; }
  }
  if (!sdkRoot) {
    for (const c of sdkCandidates) {
      if (fs.existsSync(c)) { sdkRoot = c; break; }
    }
  }

  const buildTools = sdkRoot ? path.join(sdkRoot, 'build-tools', BUILD_TOOLS_VERSION) : null;
  const androidJar = sdkRoot ? path.join(sdkRoot, 'platforms', PLATFORM_VERSION, 'android.jar') : null;
  const aapt2 = firstExisting(buildTools ? [path.join(buildTools, 'aapt2.exe'), path.join(buildTools, 'aapt2')] : []);
  const zipalign = firstExisting(buildTools ? [path.join(buildTools, 'zipalign.exe'), path.join(buildTools, 'zipalign')] : []);
  const d8Jar = buildTools ? path.join(buildTools, 'lib', 'd8.jar') : null;
  const apksignerJar = buildTools ? path.join(buildTools, 'lib', 'apksigner.jar') : null;

  const missing = [];
  if (!javaHome) missing.push('JDK 17（javac）');
  if (!sdkRoot) missing.push('Android SDK');
  if (!aapt2) missing.push(`build-tools/${BUILD_TOOLS_VERSION}（aapt2）`);
  if (!zipalign) missing.push(`build-tools/${BUILD_TOOLS_VERSION}（zipalign）`);
  if (!androidJar || !fs.existsSync(androidJar)) missing.push(`platforms/${PLATFORM_VERSION}（android.jar）`);
  if (!d8Jar || !fs.existsSync(d8Jar)) missing.push('d8.jar');
  if (!apksignerJar || !fs.existsSync(apksignerJar)) missing.push('apksigner.jar');

  return {
    base,
    javaHome,
    javac: exe('javac.exe'),
    java: exe('java.exe'),
    jar: exe('jar.exe'),
    keytool: exe('keytool.exe'),
    sdkRoot,
    buildTools,
    aapt2,
    zipalign,
    androidJar,
    d8Jar,
    apksignerJar,
    available: missing.length === 0,
    missing,
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || ROOT,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    windowsHide: true,
    timeout: options.timeout || 30 * 60 * 1000,
    env: { ...process.env, ...(options.env || {}) },
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (output.trim()) console.log(output.trim());
  if (result.error) throw new Error(`执行失败：${path.basename(command)}：${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`命令失败(退出码 ${result.status})：${path.basename(command)} ${args.slice(0, 2).join(' ')}\n${output.slice(-3000)}`);
  }
  return output;
}

function walkFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, predicate, out);
    else if (!predicate || predicate(full)) out.push(full);
  }
  return out;
}

function ensureKeystore(tc) {
  if (fs.existsSync(KEYSTORE)) return;
  log(`生成 debug 签名 keystore：${KEYSTORE}`);
  run(tc.keytool, [
    '-genkeypair', '-v',
    '-keystore', KEYSTORE,
    '-storepass', KEYSTORE_PASS,
    '-keypass', KEYSTORE_PASS,
    '-alias', KEY_ALIAS,
    '-keyalg', 'RSA',
    '-keysize', '2048',
    '-validity', '10000',
    '-dname', 'CN=CardGameMaker Debug, OU=Dev, O=CardGameMaker, L=Local, S=Local, C=CN',
  ]);
}

function prepareAssets() {
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    throw new Error('dist/index.html 不存在，vite build 可能失败');
  }
  fs.rmSync(WWW_DIR, { recursive: true, force: true });
  fs.mkdirSync(WWW_DIR, { recursive: true });
  fs.cpSync(dist, WWW_DIR, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(dist, src);
      if (rel === 'apk' || rel.startsWith(`apk${path.sep}`)) return false;
      // 网页 / PWA 都没引用 .ico，只留给桌面端，APK 里不带
      if (rel.toLowerCase().endsWith('.ico')) return false;
      return true;
    },
  });
  // 防止递归打包：vite build 会把 public/ 原样复制到 dist，其中 public/apk 里的旧 APK/latest.json
  // 不应再被塞进新 APK 的 assets；复制时已过滤，这里再兜底清理一次。
  fs.rmSync(path.join(WWW_DIR, 'apk'), { recursive: true, force: true });

  // 背景音乐 WAV 是 22.05kHz 双声道 16-bit，APK 里降成单声道可省约 2.3MB，听感几乎无差别
  for (const name of ['bgm-shanhe.wav', 'bgm-zhangu.wav']) {
    const file = path.join(WWW_DIR, 'audio', name);
    if (!fs.existsSync(file)) continue;
    const before = fs.statSync(file).size;
    const mono = wavToMono(fs.readFileSync(file));
    if (!mono) continue;
    fs.writeFileSync(file, mono);
    log(`音频瘦身 ${name}: ${(before / 1024 / 1024).toFixed(2)}MB → ${(mono.length / 1024 / 1024).toFixed(2)}MB`);
  }

  // 确保 audio 等 public 资源存在（vite build 已复制 public/ 到 dist）
  const count = walkFiles(WWW_DIR, null).length;
  log(`Vite 产物已复制到 assets/www（${count} 个文件，已排除 apk/ 与 .ico）`);
}

function prepareResources() {
  const icon = path.join(ROOT, 'public', 'icons', 'icon-192.png');
  if (!fs.existsSync(icon)) throw new Error(`缺少图标：${icon}`);
  fs.rmSync(RES_DIR, { recursive: true, force: true });
  for (const dir of Object.keys(ICON_DENSITIES)) {
    const target = path.join(RES_DIR, dir);
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(icon, path.join(target, 'ic_launcher.png'));
  }
  log(`资源已生成（图标 ${Object.keys(ICON_DENSITIES).length} 个密度）`);
}

function prepareManifest(versionInfo) {
  const templatePath = path.join(MOBILE, 'AndroidManifest.xml');
  let manifest = fs.readFileSync(templatePath, 'utf8');
  manifest = manifest
    .replace(/@VERSION_CODE@/g, String(versionInfo.versionCode))
    .replace(/@VERSION_NAME@/g, versionInfo.versionName);
  if (manifest.includes('@VERSION_')) throw new Error('AndroidManifest 版本占位符替换失败');
  const out = path.join(BUILD_DIR, 'AndroidManifest.xml');
  fs.writeFileSync(out, manifest, 'utf8');
  return out;
}

function sha256(file) {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function readBadging(tc, apk) {
  try {
    const out = run(tc.aapt2, ['dump', 'badging', apk]);
    const pick = (re) => {
      const m = re.exec(out);
      return m ? m[1] : null;
    };
    return {
      packageName: pick(/package: name='([^']+)'/),
      versionCode: pick(/versionCode='([^']+)'/),
      versionName: pick(/versionName='([^']+)'/),
      label: pick(/application-label:'([^']+)'/),
      minSdk: pick(/sdkVersion:'([^']+)'/),
      targetSdk: pick(/targetSdkVersion:'([^']+)'/),
    };
  } catch (e) {
    log(`aapt2 dump badging 解析失败：${e.message}`);
    return null;
  }
}

function verifySignature(tc, apk) {
  try {
    const out = run(tc.java, ['-cp', tc.apksignerJar, 'com.android.apksigner.ApkSignerTool', 'verify', '--verbose', '--print-certs', apk]);
    return {
      verified: /Verified using v\d+ scheme/.test(out) || /Verified using v1 scheme/.test(out) || out.includes('Verified'),
      detail: out.trim().split('\n').slice(0, 8).join('\n'),
    };
  } catch (e) {
    log(`apksigner verify 失败：${e.message}`);
    return { verified: false, detail: e.message.slice(0, 500) };
  }
}

export async function buildApk() {
  const startedAt = Date.now();
  const tc = locateToolchain();
  if (!tc.available) {
    throw new Error(`Android 工具链不完整，缺少：${tc.missing.join('、')}。请先运行：powershell -ExecutionPolicy Bypass -File scripts/setup-android.ps1`);
  }
  const versionInfo = makeVersionInfo(readPackageVersion());
  fs.mkdirSync(APK_OUT_DIR, { recursive: true });
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  fs.rmSync(path.join(BUILD_DIR, 'progress.json'), { force: true });

  log(`工具链：JDK=${tc.javaHome}`);
  log(`工具链：SDK=${tc.sdkRoot}`);
  log(`版本：versionName=${versionInfo.versionName} versionCode=${versionInfo.versionCode}`);
  writeProgress('toolchain', 5, '工具链就绪');

  // 1) Vite 构建前端
  writeProgress('vite', 10, 'Vite 构建前端...');
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(viteBin)) throw new Error('未找到 vite，请先在项目根目录安装依赖（pnpm install）');
  run(process.execPath, [viteBin, 'build'], { cwd: ROOT });

  // 2) 资源 / assets / manifest
  writeProgress('assets', 30, '准备 assets 与资源...');
  prepareAssets();
  prepareResources();
  const manifestPath = prepareManifest(versionInfo);
  ensureKeystore(tc);

  // 3) aapt2 编译 + 链接
  writeProgress('aapt2', 45, 'aapt2 编译/链接...');
  const resZip = path.join(BUILD_DIR, 'resources.zip');
  const pngs = walkFiles(RES_DIR, (f) => f.endsWith('.png'));
  run(tc.aapt2, ['compile', '-o', resZip, ...pngs]);
  const baseApk = path.join(BUILD_DIR, 'base-unsigned.apk');
  fs.rmSync(GEN_DIR, { recursive: true, force: true });
  fs.mkdirSync(GEN_DIR, { recursive: true });
  run(tc.aapt2, [
    'link',
    '-o', baseApk,
    '-I', tc.androidJar,
    '--manifest', manifestPath,
    '-R', resZip,
    '--java', GEN_DIR,
    '--min-sdk-version', String(MIN_SDK),
    '--target-sdk-version', String(TARGET_SDK),
    '--auto-add-overlay',
  ]);
  // 注意：aapt2 在 Windows 上用 -A 添加 assets 会把 zip 条目写成反斜杠（assets\www\...），
  // Android AssetManager 只认正斜杠，因此这里不用 aapt2 -A，而改用 JDK jar 添加 assets/www，
  // 保证 APK 内条目为 assets/www/index.html 形式。
  run(tc.jar, ['uf', baseApk, '-C', MOBILE, 'assets/www']);

  // 4) javac + d8
  writeProgress('javac', 60, 'javac 编译 Java...');
  const javaFiles = walkFiles(path.join(MOBILE, 'java'), (f) => f.endsWith('.java'))
    .concat(walkFiles(GEN_DIR, (f) => f.endsWith('.java')));
  if (javaFiles.length === 0) throw new Error('没有找到 Java 源文件');
  fs.rmSync(CLASSES_DIR, { recursive: true, force: true });
  fs.mkdirSync(CLASSES_DIR, { recursive: true });
  // 说明：Android 的 android.jar 不含 java.lang.invoke.LambdaMetafactory，若用
  // -bootclasspath android.jar + -source 8 会编译失败；改用 --release 8（JDK 自带 API 签名）
  // + classpath android.jar（提供 android.* 类），d8 会负责 lambda desugar。
  run(tc.javac, [
    '-encoding', 'UTF-8',
    '--release', '8',
    '-classpath', tc.androidJar,
    '-d', CLASSES_DIR,
    ...javaFiles,
  ]);

  writeProgress('d8', 70, 'd8 生成 classes.dex...');
  fs.rmSync(DEX_DIR, { recursive: true, force: true });
  fs.mkdirSync(DEX_DIR, { recursive: true });
  const classFiles = walkFiles(CLASSES_DIR, (f) => f.endsWith('.class'));
  run(tc.java, [
    '-cp', tc.d8Jar,
    'com.android.tools.r8.D8',
    '--min-api', String(MIN_SDK),
    '--release',
    '--output', DEX_DIR,
    ...classFiles,
  ]);
  const dexFile = path.join(DEX_DIR, 'classes.dex');
  if (!fs.existsSync(dexFile)) throw new Error('d8 未生成 classes.dex');

  // 5) 打包 dex + zipalign
  writeProgress('package', 80, '打包 classes.dex 并 zipalign...');
  run(tc.jar, ['uf', baseApk, '-C', DEX_DIR, 'classes.dex']);
  const alignedApk = path.join(BUILD_DIR, 'base-aligned.apk');
  run(tc.zipalign, ['-f', '-p', '4', baseApk, alignedApk]);

  // 6) 唯一文件名 + 签名（每次构建新文件，绝不覆盖历史包）
  writeProgress('sign', 88, 'apksigner 签名...');
  fs.mkdirSync(APK_OUT_DIR, { recursive: true });
  let apkName = `CardGameMaker-${versionInfo.version}-b${versionInfo.stamp}.apk`;
  let apkPath = path.join(APK_OUT_DIR, apkName);
  for (let dup = 2; fs.existsSync(apkPath); dup++) {
    apkName = `CardGameMaker-${versionInfo.version}-b${versionInfo.stamp}-${dup}.apk`;
    apkPath = path.join(APK_OUT_DIR, apkName);
  }
  run(tc.java, [
    '-cp', tc.apksignerJar,
    'com.android.apksigner.ApkSignerTool',
    'sign',
    '--ks', KEYSTORE,
    '--ks-key-alias', KEY_ALIAS,
    '--ks-pass', `pass:${KEYSTORE_PASS}`,
    '--key-pass', `pass:${KEYSTORE_PASS}`,
    '--out', apkPath,
    alignedApk,
  ]);

  // 7) 验收：aapt2 badging + apksigner verify + 签名信息
  writeProgress('verify', 93, '验收 APK...');
  const badging = readBadging(tc, apkPath);
  const signature = verifySignature(tc, apkPath);
  // apksigner 默认会额外生成 .idsig（v4 签名附属文件），普通安装/分发不需要，清掉保持目录干净
  fs.rmSync(`${apkPath}.idsig`, { force: true });
  const size = fs.statSync(apkPath).size;
  const checksum = sha256(apkPath);

  // 8) 稳定别名 + latest.json（stableUrl/history）+ 历史自动清理
  writeProgress('publish', 97, '生成 latest 别名并清理历史...');
  const stablePath = path.join(APK_OUT_DIR, STABLE_APK_NAME);
  fs.copyFileSync(apkPath, stablePath);

  // 清理旧格式 APK（task-36 时代的 CardGameMaker-<version>.apk 无 -b 时间戳）与残留 .idsig
  for (const name of fs.readdirSync(APK_OUT_DIR)) {
    const full = path.join(APK_OUT_DIR, name);
    if (name === STABLE_APK_NAME) continue;
    if (/\.idsig$/i.test(name)) {
      fs.rmSync(full, { force: true });
      continue;
    }
    if (!/\.apk$/i.test(name) || !/^CardGameMaker-/.test(name)) continue;
    if (!parseApkName(name)) {
      fs.rmSync(full, { force: true });
      log(`清理旧格式/无效 APK：${name}`);
    }
  }

  // 仅保留最近 KEEP_APK_COUNT 个唯一 APK（按文件 mtime 倒序；新包 mtime 最新）
  const uniqueApks = fs.readdirSync(APK_OUT_DIR)
    .filter(name => name !== STABLE_APK_NAME && parseApkName(name))
    .map(name => {
      const full = path.join(APK_OUT_DIR, name);
      return { name, full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  const keptApks = uniqueApks.slice(0, KEEP_APK_COUNT);
  const removedApks = uniqueApks.slice(KEEP_APK_COUNT);
  for (const item of removedApks) {
    fs.rmSync(item.full, { force: true });
    log(`清理超出保留数量的旧 APK：${item.name}`);
  }
  // history 基于“保留列表”，最新在前；同秒构建时用 unshift 校正新包位置
  const prevLatest = safeReadJson(path.join(APK_OUT_DIR, 'latest.json'));
  const prevByFile = new Map(((prevLatest && prevLatest.history) || []).map(h => [h.file, h]));
  const history = keptApks.map(item => buildHistoryEntry(item.full, prevByFile));
  const newIndex = history.findIndex(h => h.file === apkName);
  if (newIndex > 0) history.unshift(history.splice(newIndex, 1)[0]);
  // 本次新包用精确 builtAt（文件名只有秒级），保证 history 与 latest 时间一致
  const newEntry = history.find(h => h.file === apkName);
  if (newEntry) {
    newEntry.builtAt = versionInfo.builtAt;
    newEntry.versionName = versionInfo.versionName;
  }

  const latest = {
    // 兼容旧字段：file/size/url/sha256 指向本次唯一包
    version: versionInfo.version,
    versionName: versionInfo.versionName,
    versionCode: versionInfo.versionCode,
    file: apkName,
    size,
    url: `/apk/${apkName}`,
    sha256: checksum,
    builtAt: versionInfo.builtAt,
    package: PACKAGE_NAME,
    label: APP_LABEL,
    minSdk: MIN_SDK,
    targetSdk: TARGET_SDK,
    badging,
    signatureVerified: signature.verified,
    // 新增：固定别名 + 最近 5 个历史
    stableUrl: `/apk/${STABLE_APK_NAME}`,
    history,
  };
  fs.writeFileSync(path.join(APK_OUT_DIR, 'latest.json'), JSON.stringify(latest, null, 2) + '\n', 'utf8');
  writeProgress('done', 100, '构建完成');

  log(`APK 输出：${apkPath}`);
  log(`稳定别名：${stablePath}`);
  log(`APK 大小：${(size / 1024 / 1024).toFixed(2)} MB`);
  log(`sha256：${checksum}`);
  log(`签名校验：${signature.verified ? '通过' : '未通过'}`);
  if (badging) log(`badging：package=${badging.packageName} label=${badging.label} versionCode=${badging.versionCode} versionName=${badging.versionName} minSdk=${badging.minSdk}`);
  log(`历史保留：${history.length}/${KEEP_APK_COUNT} 个（最新：${apkName}）`);
  log(`耗时：${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  console.log(`[build:result] ${JSON.stringify(latest)}`);
  return latest;
}

// 只有直接运行（node scripts/build-apk.mjs）才执行构建；被插件 import 时不执行。
const isMain = (() => {
  try {
    return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMain) {
  buildApk().catch((err) => {
    console.error(`[build] 构建失败：${err && err.stack ? err.stack : err}`);
    try {
      writeProgress('error', 0, String(err && err.message ? err.message : err));
    } catch { /* ignore */ }
    process.exitCode = 1;
  });
}
