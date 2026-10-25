/**
 * 双页面联机实时验收（真实点击 + 真实 WebSocket）
 * 需要 Edge/Chrome: --remote-debugging-port=9333 http://localhost:3000
 * 覆盖：房主建房 → 第二页面加入 → 房主开局 → 客户端同步状态/手牌/回合
 * 运行: node scripts/headless-online-2p.mjs
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

async function connectWs(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  let id = 0;
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
  return {
    ws,
    send: (method, params = {}) => new Promise((res, rej) => {
      const mid = ++id;
      pending.set(mid, { resolve: res, reject: rej });
      ws.send(JSON.stringify({ id: mid, method, params }));
    }),
  };
}

async function makePage(target) {
  const cdp = await connectWs(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  const evaluate = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || '页面脚本异常');
    return r.result?.value;
  };
  return {
    cdp,
    evaluate,
    body: () => evaluate('document.body.innerText'),
    clickText: (text) => evaluate(`
      (() => {
        const btn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes(${JSON.stringify(text)}));
        if (!btn) return false;
        btn.click();
        return true;
      })()
    `),
    // React 受控输入需要用原生 setter + input 事件
    fillInput: (sel, value) => evaluate(`
      (() => {
        const el = document.querySelector(${JSON.stringify(sel)});
        if (!el) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()
    `),
    textOf: (sel) => evaluate(`(document.querySelector(${JSON.stringify(sel)})?.textContent || '')`),
    count: (sel) => evaluate(`document.querySelectorAll(${JSON.stringify(sel)}).length`),
    clickSelectorN: (sel, idx) => evaluate(`
      (() => {
        const el = document.querySelectorAll(${JSON.stringify(sel)})[${idx}];
        if (!el) return false;
        el.click();
        return true;
      })()
    `),
    reload: async () => {
      await cdp.send('Page.reload', { ignoreCache: true });
      await sleep(2600);
    },
    screenshot: async (name) => {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const file = resolve(name);
      writeFileSync(file, Buffer.from(r.data, 'base64'));
      console.log(`  INFO  截图: ${file}`);
    },
  };
}

async function waitFor(fn, timeout, label) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const v = await fn();
    if (v) return v;
    await sleep(250);
  }
  throw new Error(`${label} 超时`);
}

async function main() {
  // 浏览器级 CDP（创建新标签页）
  const version = await fetch(`${CDP}/json/version`).then(r => r.json());
  const browser = await connectWs(version.webSocketDebuggerUrl);

  let pages = await fetch(`${CDP}/json/list`).then(r => r.json());
  const hostTarget = pages.find(t => t.type === 'page' && t.url.includes('localhost:3000'));
  if (!hostTarget) throw new Error('未找到游戏页面');

  await browser.send('Target.createTarget', { url: 'http://localhost:3000' });
  await sleep(2500);
  pages = await fetch(`${CDP}/json/list`).then(r => r.json());
  const gamePages = pages.filter(t => t.type === 'page' && t.url.includes('localhost:3000'));
  // 取最新创建的那个作为客户端
  const clientTarget = gamePages.find(t => t.id !== hostTarget.id);

  const host = await makePage(hostTarget);
  const client = await makePage(clientTarget);
  const clientId = clientTarget.id;

  console.log('\n[1] 房主创建房间');
  await host.reload();
  await host.clickText('联机对战');
  await sleep(900);
  await host.clickText('创建房间');
  const roomCode = await waitFor(async () => {
    const code = (await host.textOf('.room-code')).trim();
    return /^[A-Z0-9]{5}$/.test(code) ? code : '';
  }, 10000, '房间号');
  assert(!!roomCode, '房主创建房间成功', roomCode);
  await sleep(500);

  console.log('\n[2] 第二页面加入房间');
  await client.reload();
  await client.clickText('联机对战');
  await sleep(900);
  assert((await client.body()).includes('创建房间'), '客户端进入联机大厅');
  const filled = await client.fillInput('input[placeholder^="输入房间号"]', roomCode);
  assert(filled === true, '填写房间号');
  await client.clickText('加入');
  const joined = await waitFor(async () => {
    const t = await client.body();
    return t.includes(roomCode) && t.includes('等待房主开始对局');
  }, 12000, '客户端加入房间');
  assert(!!joined, '客户端加入成功并等待开局');
  const memberCount = await client.count('.member-item');
  assert(memberCount === 2, '房间成员数=2', `实际 ${memberCount}`);
  await client.screenshot('D:/CardGameMaker/test-2p-lobby-client.png');

  // 房主端也应为 2 人
  const hostMembers = await waitFor(async () => {
    const n = await host.count('.member-item');
    return n === 2 ? n : 0;
  }, 8000, '房主端成员同步');
  assert(hostMembers === 2, '房主端成员同步为 2 人');

  console.log('\n[3] 房主开局，客户端同步');
  await host.clickText('开始对局');
  await sleep(3000);
  let hostText = await host.body();
  assert(hostText.includes('回合'), '房主进入对局');
  assert(hostText.includes('房主'), '房主对局标记');
  await sleep(1500);

  const clientBoard = await waitFor(async () => {
    const t = await client.body();
    return t.includes('回合') && t.includes('座位2');
  }, 12000, '客户端同步对局');
  assert(!!clientBoard, '客户端自动进入对局并显示座位号');
  const clientText = await client.body();
  assert(clientText.includes('牌堆'), '客户端显示牌堆信息');
  await client.screenshot('D:/CardGameMaker/test-2p-client-board.png');
  await host.screenshot('D:/CardGameMaker/test-2p-host-board.png');

  console.log('\n[4] 房主结束回合，客户端轮到行动');
  if (await host.clickText('结束出牌')) {
    await sleep(1200);
    const hostTextAfter = await host.body();
    const dm = hostTextAfter.match(/选择\s*(\d+)\s*张弃置/);
    if (dm) {
      const need = Number(dm[1]);
      for (let i = 0; i < need; i++) {
        await host.clickSelectorN('.hand-zone .game-card', i);
        await sleep(120);
      }
      await host.clickText('确认弃牌');
      await sleep(900);
    }
  }
  const clientTurn = await waitFor(async () => {
    const t = await client.body();
    return t.includes('结束出牌') || t.includes('确认弃牌');
  }, 15000, '客户端行动提示');
  assert(!!clientTurn, '客户端收到自己的操作提示');
  await client.screenshot('D:/CardGameMaker/test-2p-client-turn.png');

  console.log('\n[5] 客户端推荐出牌 / 结束出牌');
  const clientHandBefore = await client.count('.hand-zone .game-card');
  const recommendClicked = await client.clickText('推荐出牌');
  if (recommendClicked) {
    await sleep(1600);
    const ct = await client.body();
    const clientHandAfter = await client.count('.hand-zone .game-card');
    const reacted = ct.includes('推荐：') || ct.includes('AI 建议')
      || clientHandAfter !== clientHandBefore || ct.includes('弃牌阶段');
    if (reacted) {
      assert(true, '客户端推荐出牌有响应');
    } else {
      console.log('  INFO  当前无可出牌/手牌无变化，推荐可能直接结束出牌');
    }
    assert(!ct.includes('TypeError'), '客户端推荐出牌无异常');
  } else {
    console.log('  INFO  客户端当前无推荐按钮');
  }
  if (await client.clickText('结束出牌')) {
    await sleep(1200);
    const ct = await client.body();
    const cm = ct.match(/选择\s*(\d+)\s*张弃置/);
    if (cm) {
      const need = Number(cm[1]);
      for (let i = 0; i < need; i++) {
        await client.clickSelectorN('.hand-zone .game-card', i);
        await sleep(120);
      }
      await client.clickText('确认弃牌');
      await sleep(900);
    }
  }
  const clientStill = await client.body();
  assert(clientStill.includes('回合') && !clientStill.includes('TypeError'), '客户端操作后对局继续');
  // 房主端应能看到客户端操作后的日志/状态
  const hostStill = await host.body();
  assert(hostStill.includes('回合') && !hostStill.includes('TypeError'), '房主端对局继续');

  console.log(`\n===== 结果: ${passed} 通过 / ${failed} 失败 =====\n`);
  try { await browser.send('Target.closeTarget', { targetId: clientId }); } catch { /* ignore */ }
  host.cdp.ws.close();
  client.cdp.ws.close();
  browser.ws.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('双页面联机验收异常:', e);
  process.exit(1);
});
