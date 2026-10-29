/**
 * 生成 README 用的游戏截图（无头 Edge + CDP，无需手动点）
 *
 * 前置：
 *   1. npm run build
 *   2. 用任意静态服务器把 dist/ 跑在 http://127.0.0.1:4173
 *      （例：npx serve dist -l 4173，或 node scripts/screenshots.mjs 自带的提示）
 * 用法：
 *   node scripts/screenshots.mjs
 * 输出：
 *   docs/screenshots/*.jpg
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(root, 'docs', 'screenshots');
const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:4173';
const PORT = Number(process.env.SHOT_CDP_PORT || 9444);
const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const browser = EDGE_CANDIDATES.find(p => fs.existsSync(p));
if (!browser) {
  console.error('找不到 Edge / Chrome，无法截图');
  process.exit(1);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const profile = path.join(os.tmpdir(), `cgm-shots-profile-${Date.now()}`);

const child = spawn(browser, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--hide-scrollbars', '--mute-audio', 'about:blank',
], { stdio: 'ignore' });

let target;
for (let i = 0; i < 80 && !target; i++) {
  try {
    const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
    target = list.find(t => t.type === 'page');
  } catch { /* 浏览器还没起来 */ }
  if (!target) await sleep(250);
}
if (!target) {
  console.error('浏览器调试端口没起来');
  child.kill();
  process.exit(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let msgId = 0;
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) rej(new Error(m.error.message)); else res(m.result);
  }
};
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP 连接失败')); });
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++msgId;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || '脚本异常');
  return r.result?.value;
};

await send('Page.enable');
await send('Runtime.enable');

const click = async (text, wait = 900) => {
  const r = await evaluate(`(() => {
    const el = [...document.querySelectorAll('button')]
      .find(b => (b.innerText || '').replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(text)}));
    if (!el) return 'NOT_FOUND';
    el.click();
    return 'OK';
  })()`);
  if (r !== 'OK') console.warn(`  ! 没找到按钮：${text}`);
  await sleep(wait);
  return r;
};

/** 自绘下拉底层是真 <select>，直接改值并广播 change，最稳 */
const setSelect = async (index, value) => {
  const r = await evaluate(`(() => {
    const el = document.querySelectorAll('select.ui-select-native')[${index}];
    if (!el) return 'NO_SELECT';
    const opt = [...el.options].find(o => o.textContent.includes(${JSON.stringify(value)}));
    if (!opt) return 'NO_OPTION';
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(el, opt.value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return 'OK';
  })()`);
  await sleep(350);
  return r;
};

async function capture(name, { width, height, mobile = false, url = '/', steps = [] }) {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: mobile ? 2 : 1, mobile, screenWidth: width, screenHeight: height,
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
  await send('Page.navigate', { url: BASE + url });
  await sleep(2600);
  for (const step of steps) await step();
  await sleep(700);
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92, captureBeyondViewport: false });
  const file = path.join(OUT, `${name}.jpg`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  const kb = (fs.statSync(file).size / 1024).toFixed(0);
  console.log(`  ${path.relative(root, file)}  ${kb} KB`);
}

const desktop = { width: 1440, height: 900 };
const setupFourPlayers = async () => {
  await click('布阵', 1200);
  await setSelect(0, '4人');
  const heroes = ['曹操', '关羽', '张飞', '诸葛亮'];
  for (let i = 0; i < heroes.length; i++) await setSelect(2 + i, heroes[i]);
};

console.log('开始截图 ...');
await capture('01-dashboard', { ...desktop });
await capture('02-setup', { ...desktop, steps: [setupFourPlayers] });
await capture('03-board', { ...desktop, steps: [setupFourPlayers, () => click('开始对局', 3200)] });
await capture('04-workshop', { ...desktop, steps: [() => click('武将编辑器', 2200)] });
await capture('05-skills', { ...desktop, steps: [() => click('技能编辑器', 2200)] });
await capture('06-online', { ...desktop, steps: [() => click('联机对战', 2200)] });
await capture('07-settings', { ...desktop, steps: [() => click('设置', 2000)] });
await capture('08-appearance', { ...desktop, steps: [() => click('背景设置', 2000)] });
await capture('09-mobile-panel', { width: 390, height: 844, mobile: true });
await capture('10-mobile-board', { width: 390, height: 844, mobile: true, url: '/?quick=1' });

ws.close();
child.kill();
try {
  fs.rmSync(profile, { recursive: true, force: true });
} catch {
  // 浏览器进程还没完全退出时临时目录可能删不掉，不影响截图结果
}
console.log('截图完成 → docs/screenshots');
