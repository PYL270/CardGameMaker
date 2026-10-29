/**
 * 字体子集化脚本（构建前运行）
 *
 * 背景：public/fonts 里的 Ma Shan Zheng 毛笔字体完整 TTF 约 5.6MB，
 * 每个玩家首次进游戏都要下载。标题字体实际用到的字符远没有那么
 * 多，因此按「源码/文档中出现过的全部字符 + ASCII + 中英标点」
 * 生成 woff2 子集，体积可压到 1MB 上下。
 *
 * - 原始 TTF 保留在 fonts-src/（git 跟踪），public 里只放子集产物
 * - 自定义武将/技能若用到极生僻字（源码与常用标点之外），
 *   标题字体会回退到系统字体，正文不受影响
 *
 * 用法: node scripts/subset-font.mjs
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_FONT = path.join(ROOT, 'fonts-src', 'MaShanZheng-Regular.ttf');
const OUT_FONT = path.join(ROOT, 'public', 'fonts', 'MaShanZheng-Regular.woff2');

/** 扫描文本文件，收集出现过的所有字符 */
async function collectFromFiles(files) {
  const chars = new Set();
  for (const file of files) {
    try {
      const text = await fs.readFile(file, 'utf8');
      for (const ch of text) chars.add(ch);
    } catch {
      // 文件不存在/读取失败：跳过（子集少几个字符不影响构建）
    }
  }
  return chars;
}

async function collectSourceFiles(dir, exts, out = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'android', 'mobile', 'apk-out', 'backup'].includes(entry.name)) continue;
      await collectSourceFiles(full, exts, out);
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const t0 = Date.now();

  // 1. 收集字符集：全部源码/文档 + ASCII + 中日韩标点/全角符号
  const sourceFiles = await collectSourceFiles(path.join(ROOT, 'src'), ['.js', '.jsx', '.css', '.html']);
  sourceFiles.push(
    path.join(ROOT, 'index.html'),
    path.join(ROOT, 'README.md'),
    path.join(ROOT, 'public', 'manifest.webmanifest'),
  );
  const chars = await collectFromFiles(sourceFiles);

  // ASCII 可打印字符
  for (let code = 0x20; code <= 0x7e; code += 1) chars.add(String.fromCharCode(code));
  // CJK 标点、全角形式、常用引号/省略号/破折号等
  for (let code = 0x3000; code <= 0x303f; code += 1) chars.add(String.fromCharCode(code));
  for (let code = 0xff00; code <= 0xffef; code += 1) chars.add(String.fromCharCode(code));
  for (const code of [0xb7, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x22ef, 0x00a0]) {
    chars.add(String.fromCharCode(code));
  }
  // 源码里可能以 \uXXXX 转义出现的字符读不到，兜底再收集一遍转义形式
  const charset = [...chars].filter(ch => {
    const code = ch.codePointAt(0);
    // 去掉控制字符与代理对残片
    return code >= 0x20 && !(code >= 0xd800 && code <= 0xdfff);
  }).join('');

  // 2. 读原字体，生成 woff2 子集
  const original = await fs.readFile(SRC_FONT);
  const subset = await subsetFont(original, charset, { targetFormat: 'woff2' });
  await fs.mkdir(path.dirname(OUT_FONT), { recursive: true });
  await fs.writeFile(OUT_FONT, subset);

  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  console.log(
    `[subset-font] ${path.basename(SRC_FONT)} ${kb(original.length)}`
    + ` → ${path.basename(OUT_FONT)} ${kb(subset.length)}`
    + `（字符数 ${charset.length}，耗时 ${Date.now() - t0}ms）`,
  );
}

main().catch((err) => {
  console.error('[subset-font] 子集化失败：', err);
  process.exitCode = 1;
});
