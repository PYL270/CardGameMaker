/**
 * 安卓/手机尺寸实时验收（CDP 移动端模拟）
 * 需先启动 Edge/Chrome: --remote-debugging-port=9333 http://localhost:3000
 * 运行: node scripts/headless-mobile-check.mjs
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CDP = 'http://127.0.0.1:9333';
let passed = 0;
let failed = 0;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function assert(cond, name, extra = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
}

async function main() {
  const targets = await fetch(`${CDP}/json/list`).then(r => r.json());
  const page = targets.find(t => t.type === 'page' && t.url.includes('localhost:3000'))
    || targets.find(t => t.type === 'page');
  if (!page) throw new Error('未找到页面，请确认 CDP 已启动');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  let msgId = 0;
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve: res, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(m.error.message));
      else res(m.result);
    }
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP 连接失败')); });

  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++msgId;
    pending.set(id, { resolve: res, reject: rej });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || '脚本异常');
    return r.result?.value;
  };
  const body = () => evaluate('document.body.innerText');
  const clickText = (text) => evaluate(`
    (() => {
      const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').includes(${JSON.stringify(text)}));
      if (!b) return false;
      b.click();
      return true;
    })()
  `);
  const noOverflow = () => evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2');
  const screenshot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(name), Buffer.from(r.data, 'base64'));
    console.log(`  INFO  截图: ${resolve(name)}`);
  };
  const reload = async () => {
    await send('Page.reload', { ignoreCache: true });
    await sleep(2600);
  };

  console.log('\n[1] 手机主菜单');
  await reload();
  let text = await body();
  assert(text.includes('CardGameMaker'), '手机尺寸下主菜单渲染');
  assert(await noOverflow(), '主菜单无横向溢出');
  await screenshot('D:/CardGameMaker/test-mobile-menu.png');

  console.log('\n[2] 手机选将');
  assert(await clickText('开始游戏'), '点击开始游戏');
  await sleep(1000);
  text = await body();
  assert(text.includes('游戏设置'), '进入选将页');
  assert(await noOverflow(), '选将页无横向溢出');
  await screenshot('D:/CardGameMaker/test-mobile-setup.png');

  console.log('\n[3] 手机对局');
  assert(await clickText('开始对局'), '点击开始对局');
  await sleep(2600);
  text = await body();
  assert(text.includes('回合') && text.includes('牌堆'), '手机进入对局');
  assert(await noOverflow(), '对局界面无横向溢出');
  await screenshot('D:/CardGameMaker/test-mobile-board.png');

  const handCount = await evaluate("document.querySelectorAll('.hand-zone .game-card').length");
  assert(handCount > 0, '手机端显示手牌', `cards=${handCount}`);
  if (await clickText('结束出牌')) {
    await sleep(1200);
    const discardMatch = (await body()).match(/选择\s*(\d+)\s*张弃置/);
    if (discardMatch) {
      const need = Number(discardMatch[1]);
      for (let i = 0; i < need; i++) {
        await evaluate(`document.querySelectorAll('.hand-zone .game-card')[${i}]?.click()`);
        await sleep(120);
      }
      await clickText('确认弃牌');
      await sleep(800);
    }
  }
  assert(await noOverflow(), '操作后仍无横向溢出');
  await screenshot('D:/CardGameMaker/test-mobile-board2.png');

  console.log('\n[4] 手机联机大厅与扫码');
  await reload();
  assert(await clickText('联机对战'), '进入联机大厅');
  await sleep(800);
  assert(await clickText('创建房间'), '创建房间');
  const roomCode = await (async () => {
    const start = Date.now();
    while (Date.now() - start < 10000) {
      const c = await evaluate("(document.querySelector('.room-code')?.textContent || '').trim()");
      if (/^[A-Z0-9]{5}$/.test(c)) return c;
      await sleep(250);
    }
    return '';
  })();
  assert(!!roomCode, '手机大厅创建房间成功', roomCode);

  const qrOk = await (async () => {
    const start = Date.now();
    while (Date.now() - start < 10000) {
      const src = await evaluate("document.querySelector('.qr-img')?.getAttribute('src') || ''");
      if (src.startsWith('data:image')) return true;
      await sleep(300);
    }
    return false;
  })();
  assert(qrOk, '生成手机加入二维码');
  const qrUrl = await evaluate("document.querySelector('.qr-url')?.textContent || ''");
  assert(qrUrl.includes('?room=') && qrUrl.includes(roomCode), '二维码地址含房间号', qrUrl);
  assert(await noOverflow(), '联机大厅无横向溢出');
  await screenshot('D:/CardGameMaker/test-mobile-lobby.png');

  console.log(`\n===== 结果: ${passed} 通过 / ${failed} 失败 =====\n`);
  ws.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('手机端验收异常:', e);
  process.exit(1);
});
