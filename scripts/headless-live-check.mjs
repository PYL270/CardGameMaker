/**
 * 无头浏览器实时验收（真实点击）
 * 需要先启动 Edge/Chrome: --remote-debugging-port=9333 http://localhost:3000
 * 覆盖：主菜单 → 单机选将 → 开局 → 牌区拖拽 → 出牌/弃牌 → 联机大厅建房 → 联机开局
 * 运行: node scripts/headless-live-check.mjs
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CDP = 'http://127.0.0.1:9333';
let passed = 0;
let failed = 0;

function assert(cond, name, extra = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const targets = await fetch(`${CDP}/json/list`).then(r => r.json());
  const page = targets.find(t => t.type === 'page' && t.url.includes('localhost:3000'))
    || targets.find(t => t.type === 'page');
  if (!page) throw new Error('未找到浏览器页面，请确认 CDP 端口已启动');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  let msgId = 0;

  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(m.error.message));
      else resolve(m.result);
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('CDP 连接失败'));
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || '页面脚本异常');
    return r.result?.value;
  };

  const bodyText = () => evaluate('document.body.innerText');
  const clickText = (text) => evaluate(`
    (() => {
      const btn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes(${JSON.stringify(text)}));
      if (!btn) return false;
      btn.click();
      return true;
    })()
  `);
  const clickSelector = (sel) => evaluate(`
    (() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return false;
      el.click();
      return true;
    })()
  `);
  const clickSelectorN = (sel, idx) => evaluate(`
    (() => {
      const el = document.querySelectorAll(${JSON.stringify(sel)})[${idx}];
      if (!el) return false;
      el.click();
      return true;
    })()
  `);
  const countSelector = (sel) => evaluate(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
  const textOf = (sel) => evaluate(`(document.querySelector(${JSON.stringify(sel)})?.textContent || '')`);
  const screenshot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(name), Buffer.from(r.data, 'base64'));
    console.log(`  INFO  截图: ${resolve(name)}`);
  };
  const reload = async () => {
    await send('Page.reload', { ignoreCache: true });
    await sleep(2600);
  };

  // ============ 单机流程 ============
  await reload();
  let text = await bodyText();
  assert(text.includes('CardGameMaker'), '主菜单渲染');
  assert(text.includes('联机对战'), '主菜单包含联机入口');

  console.log('\n[0] 音频设置页');
  assert(await clickText('音频设置'), '主菜单进入音频设置');
  await sleep(600);
  text = await bodyText();
  assert(text.includes('背景音乐') && text.includes('内置 · 山河') && text.includes('上传音频'),
    '音频页支持 BGM / 自定义上传');
  const sliderCount = await countSelector('.audio-slider-row input[type=range]');
  assert(sliderCount >= 3, '音频页包含主/BGM/音效音量滑杆', `sliders=${sliderCount}`);
  assert(await clickText('返回'), '从音频页返回');
  await sleep(700);

  console.log('\n[0b] 背景设置页');
  assert(await clickText('背景设置'), '主菜单进入背景设置');
  await sleep(600);
  text = await bodyText();
  assert(text.includes('山河云海') && text.includes('自定义背景') && text.includes('启用动态效果'),
    '背景页支持动态预设 / 自定义上传');
  assert(await clickText('返回'), '从背景设置返回');
  await sleep(700);

  console.log('\n[1] 进入单机游戏设置');
  assert(await clickText('开始游戏'), '点击开始游戏');
  await sleep(1000);
  text = await bodyText();
  assert(text.includes('游戏设置'), '进入游戏设置页');
  assert(text.includes('开始对局'), '存在开始对局按钮');
  const optionInfo = await evaluate(`
    (() => {
      const s = [...document.querySelectorAll('.setup-panel select')][1];
      if (!s) return null;
      return {
        count: s.options.length,
        hasClassic: [...s.querySelectorAll('optgroup')].some(g => (g.label || '').includes('经典')),
      };
    })()
  `);
  assert(!!optionInfo && optionInfo.hasClassic && optionInfo.count > 10, '选将面板包含经典武将',
    JSON.stringify(optionInfo));

  // 选择孙权（主动技能：制衡）
  const selectedHero = await evaluate(`
    (() => {
      const selects = [...document.querySelectorAll('.setup-panel select')];
      if (selects.length < 2) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(selects[1], 'cls_sunquan');
      selects[1].dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
  assert(selectedHero === true, '选择经典武将孙权');
  await sleep(500);
  text = await bodyText();
  assert(text.includes('制衡'), '选将后显示技能设置说明');
  await screenshot('D:/CardGameMaker/test-setup.png');

  console.log('\n[2] 开始对局');
  assert(await clickText('开始对局'), '点击开始对局');
  await sleep(2200);
  text = await bodyText();
  assert(text.includes('回合'), '进入对局并显示回合信息');
  assert(text.includes('牌堆'), '显示牌堆信息');
  assert(text.includes('出牌阶段') || text.includes('结束出牌'), '进入出牌交互');
  assert(text.includes('孙权') && text.includes('制衡'), '角色卡显示武将技能');
  assert(text.includes('推荐出牌') && text.includes('自动'), '提供推荐出牌/自动按钮');
  assert(text.includes('种子'), '显示牌堆种子');
  assert(/牌堆\s*\d+\/\d+/.test(text), '左上角显示牌堆剩余/总数', (text.match(/牌堆[^\n]*/) || [''])[0]);
  const shanBlocked = await evaluate(`(() => {
    const cards = [...document.querySelectorAll('.hand-zone .game-card')];
    const shan = cards.find(c => c.querySelector('.card-name')?.textContent === '闪');
    if (!shan) return { found: false };
    shan.click();
    return {
      found: true,
      selected: shan.classList.contains('selected'),
      hint: document.querySelector('.recommend-hint')?.textContent || '',
    };
  })()`);
  assert(!shanBlocked.found || shanBlocked.selected === false,
    '出牌阶段不能主动选择【闪】', JSON.stringify(shanBlocked));

  // 点击牌面右上角类型印，应弹出说明面板且不误选牌
  const sealInfo = await evaluate(`(() => {
    const seal = document.querySelector('.hand-zone .card-seal.clickable');
    if (!seal) return { found: false };
    const card = seal.closest('.game-card');
    const name = card?.querySelector('.card-name')?.textContent || '';
    seal.click();
    return { found: true, name };
  })()`);
  await sleep(250);
  const infoPanelText = await evaluate("document.querySelector('.info-panel')?.innerText || ''");
  assert(sealInfo.found && infoPanelText.includes(sealInfo.name),
    '点击牌面类型印弹出说明', `name=${sealInfo.name}, panel=${infoPanelText.slice(0, 40)}`);
  const infoMisSelect = await evaluate("!!document.querySelector('.hand-zone .game-card.selected')");
  assert(!infoMisSelect, '查看牌说明不会误选牌');
  await evaluate(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))`);
  await sleep(150);
  assert(!(await evaluate("!!document.querySelector('.info-panel')")), '点击空白处可关闭说明');
  await evaluate("document.querySelector('.info-close')?.click()");
  await sleep(200);
  assert(!(await evaluate("!!document.querySelector('.info-panel')")), '说明面板可关闭');

  await screenshot('D:/CardGameMaker/test-board.png');

  console.log('\n[2a] 主动技能【制衡】');
  assert(await clickText('制衡'), '点击主动技能【制衡】');
  await sleep(600);
  text = await bodyText();
  assert(text.includes('选择手牌'), '打开技能选牌面板');
  await clickSelector('.hand-zone .game-card');
  await sleep(300);
  assert(await clickText('确认'), '确认技能选牌');
  await sleep(1000);
  text = await bodyText();
  assert(text.includes('回合') && !text.includes('TypeError'), '技能结算后对局继续');
  await screenshot('D:/CardGameMaker/test-skill.png');

  console.log('\n[2b] 卡牌详细说明');
  assert(await clickText('说明'), '点击卡牌说明按钮');
  await sleep(600);
  text = await bodyText();
  assert(text.includes('卡牌与技能说明'), '打开说明面板');
  assert(text.includes('造成1点伤害') && text.includes('勤学'), '说明包含卡牌与技能详情');
  await screenshot('D:/CardGameMaker/test-guide.png');
  assert(await clickText('关闭'), '关闭说明面板');
  await sleep(400);

  console.log('\n[3] 牌区拖拽(防遮挡)');
  // 新版布局设置：先派发复位事件确保初始位置
  await evaluate(`window.dispatchEvent(new Event('cgm:reset-layout'))`);
  await sleep(300);
  const beforeDrag = await evaluate(`document.querySelector('.action-panel')?.style.transform || ''`);
  assert(beforeDrag === '' || beforeDrag === 'translate(0px, 0px)' || beforeDrag === 'none',
    '牌区初始位置', beforeDrag);

  const dragDispatched = await evaluate(`
    (() => {
      const el = document.querySelector('.action-panel');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const x = r.left + 20, y = r.top + 20;
      const opts = (cx, cy) => ({
        bubbles: true, cancelable: true, clientX: cx, clientY: cy,
        button: 0, buttons: 1, pointerId: 7, pointerType: 'mouse', isPrimary: true,
      });
      el.dispatchEvent(new PointerEvent('pointerdown', opts(x, y)));
      window.dispatchEvent(new PointerEvent('pointermove', opts(x + 140, y + 90)));
      window.dispatchEvent(new PointerEvent('pointerup', opts(x + 140, y + 90)));
      return true;
    })()
  `);
  assert(dragDispatched === true, '派发拖拽事件');
  await sleep(500);
  const afterDrag = await evaluate(`document.querySelector('.action-panel')?.style.transform || ''`);
  assert(!!afterDrag && afterDrag.includes('140px') && afterDrag.includes('90px'),
    '拖动牌区生效', afterDrag);
  await screenshot('D:/CardGameMaker/test-drag.png');

  // 新版布局设置：通过面板「恢复默认布局」复位
  await clickText('布局');
  await sleep(400);
  assert(await clickText('恢复默认布局'), '布局设置面板提供恢复默认布局');
  await sleep(400);
  await clickText('关闭');
  await sleep(300);
  const resetPos = await evaluate(`document.querySelector('.action-panel')?.style.transform || ''`);
  assert(resetPos === '' || resetPos === 'translate(0px, 0px)' || resetPos === 'none',
    '布局复位生效', resetPos);

  console.log('\n[4] 推荐出牌/出牌/弃牌交互');
  const beforeHand = await countSelector('.hand-zone .game-card');
  const beforeLogCount = await countSelector('.log-line');
  if (await clickText('推荐出牌')) {
    // 名将杀式布局默认收起日志，且出牌动画+AI节奏需要时间：轮询等待实际生效
    let afterHand = beforeHand;
    let afterLogCount = beforeLogCount;
    let recommendActed = false;
    for (let i = 0; i < 12; i++) {
      await sleep(400);
      text = await bodyText();
      afterHand = await countSelector('.hand-zone .game-card');
      afterLogCount = await countSelector('.log-line');
      recommendActed = afterHand < beforeHand || afterLogCount > beforeLogCount
        || text.includes('弃牌阶段') || text.includes('AI1的回合');
      if (recommendActed) break;
    }
    assert(!text.includes('TypeError') && recommendActed, '推荐出牌实际生效', `hand ${beforeHand}->${afterHand}, log ${beforeLogCount}->${afterLogCount}`);
  }
  let cardCount = await countSelector('.hand-zone .game-card');
  if (cardCount > 0) {
    const playableIndex = await evaluate(`
      (() => {
        const cards = [...document.querySelectorAll('.hand-zone .game-card')];
        return cards.findIndex(c => !c.classList.contains('disabled-card'));
      })()
    `);
    if (playableIndex >= 0) {
      await clickSelectorN('.hand-zone .game-card', playableIndex);
      await sleep(400);
      const hasTarget = await countSelector('.target-list button');
      if (hasTarget > 0) await clickSelector('.target-list button');
      await sleep(300);
    }
    const canConfirm = await evaluate(`
      (() => {
        const btn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('确认出牌'));
        return btn ? !btn.disabled : false;
      })()
    `);
    if (canConfirm) {
      await clickText('确认出牌');
      await sleep(450);
      await screenshot('D:/CardGameMaker/test-motion.png');
      await sleep(1000);
      text = await bodyText();
      assert(!text.includes('TypeError') && text.includes('回合'), '成功打出一张牌且对局继续');
    } else {
      console.log('  INFO  未满足出牌条件，跳过实牌打出');
    }
  } else {
    console.log('  INFO  当前无手牌，跳过出牌');
  }

  if (await clickText('结束出牌')) {
    await sleep(1200);
  }

  // 弃牌阶段：按提示数量选牌并确认
  text = await bodyText();
  const discardMatch = text.match(/选择\s*(\d+)\s*张弃置/);
  if (discardMatch) {
    const need = Number(discardMatch[1]);
    for (let i = 0; i < need; i++) {
      await clickSelectorN('.hand-zone .game-card', i);
      await sleep(150);
    }
    await sleep(300);
    const discarded = await clickText('确认弃牌');
    assert(discarded === true, `弃牌阶段完成(${need} 张)`);
    await sleep(1200);
  } else {
    console.log('  INFO  本回合无需弃牌');
  }
  text = await bodyText();
  assert(text.includes('回合') && !text.includes('TypeError'), '出牌/弃牌流程后对局仍在运行');
  await screenshot('D:/CardGameMaker/test-board2.png');

  // ============ 联机流程 ============
  console.log('\n[5] 联机大厅：创建房间');
  await reload();
  await clickText('联机对战');
  await sleep(900);
  text = await bodyText();
  assert(text.includes('创建房间'), '进入联机大厅');
  assert(text.includes('高级设置'), '中继地址收进高级设置');

  assert(await clickText('创建房间'), '点击创建房间');
  const roomCode = await (async () => {
    const start = Date.now();
    while (Date.now() - start < 10000) {
      const code = (await textOf('.room-code')).trim();
      if (/^[A-Z0-9]{5}$/.test(code)) return code;
      await sleep(250);
    }
    return '';
  })();
  assert(!!roomCode, '成功创建房间', `房间号=${roomCode}`);
  text = await bodyText();
  assert(text.includes('房主'), '房主身份标记');
  await screenshot('D:/CardGameMaker/test-online-lobby.png');

  console.log('\n[6] 联机开局');
  assert(await clickText('开始对局'), '房主点击开始对局');
  await sleep(2600);
  text = await bodyText();
  assert(text.includes('回合'), '联机对局已开始');
  assert(text.includes('房主'), '对局界面显示房主标记');
  await screenshot('D:/CardGameMaker/test-online-board.png');
  if (await clickText('结束出牌')) await sleep(1000);
  text = await bodyText();
  assert(text.includes('回合') && !text.includes('TypeError'), '联机对局推进正常');

  console.log(`\n===== 结果: ${passed} 通过 / ${failed} 失败 =====\n`);
  ws.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('实时验收异常:', e);
  process.exit(1);
});
