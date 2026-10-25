/**
 * 联机中继冒烟测试
 * 运行: node scripts/net-smoke.mjs
 */
import WebSocket from 'ws';
import { startRelay } from '../server/relay.mjs';

const PORT = 8899;
let passed = 0;
let failed = 0;

function assert(cond, name, extra = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
}

function waitFor(ws, predicate, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error('等待消息超时'));
    }, timeout);
    function onMessage(raw) {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!predicate(msg)) return;
      clearTimeout(timer);
      ws.off('message', onMessage);
      resolve(msg);
    }
    ws.on('message', onMessage);
  });
}

/** 在 timeout 内不应收到匹配的消息（用于验证广播过滤） */
function expectNone(ws, predicate, timeout = 500) {
  return new Promise((resolve) => {
    let hit = false;
    const onMessage = (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (predicate(msg)) hit = true;
      } catch { /* ignore */ }
    };
    ws.on('message', onMessage);
    setTimeout(() => {
      ws.off('message', onMessage);
      resolve(!hit);
    }, timeout);
  });
}

/** 记录连接上收到的所有消息（便于断言多条/历史消息） */
function record(ws) {
  const list = [];
  ws.on('message', (raw) => {
    try { list.push(JSON.parse(raw.toString())); } catch { /* ignore */ }
  });
  return list;
}

/** 等待记录数组中出现匹配消息 */
function waitForRecorded(list, predicate, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const hit = list.find(predicate);
      if (hit) {
        clearInterval(timer);
        resolve(hit);
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error('等待记录消息超时'));
      }
    }, 30);
  });
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function send(ws, msg) {
  ws.send(JSON.stringify(msg));
}

async function main() {
  const wss = startRelay(PORT);
  const url = `ws://127.0.0.1:${PORT}`;
  await new Promise(resolve => wss.once('listening', resolve));

  const a = await connect(url);
  const b = await connect(url);

  console.log('\n[1] 创建房间');
  send(a, { t: 'create', name: '房主A' });
  const roomA = await waitFor(a, m => m.t === 'room' && m.seat === 0);
  assert(!!roomA.code && roomA.code.length === 5, '生成 5 位房间号', roomA.code);
  assert(roomA.seat === 0, '创建者座位为 0(房主)');
  assert(roomA.members.length === 1, '房间初始 1 人');

  console.log('\n[1b] 局域网地址');
  send(a, { t: 'lanip' });
  const lanMsg = await waitFor(a, m => m.t === 'lanip');
  assert(Array.isArray(lanMsg.ips), '返回局域网地址列表', JSON.stringify(lanMsg.ips));

  console.log('\n[2] 加入房间');
  send(b, { t: 'join', code: roomA.code, name: '玩家B' });
  const roomB = await waitFor(b, m => m.t === 'room' && m.seat === 1);
  assert(roomB.seat === 1, '加入者座位为 1');
  const roomA2 = await waitFor(a, m => m.t === 'room' && m.members.length === 2);
  assert(roomA2.members.length === 2, '房主收到成员更新(2 人)');
  assert(roomA2.seat === 0 && roomA2.isHost === true,
    '成员更新后房主仍保持座位0/房主身份', `seat=${roomA2.seat} isHost=${roomA2.isHost}`);

  console.log('\n[3] 定向中继');
  send(b, { t: 'relay', to: 0, kind: 'client-action', value: 42 });
  const got = await waitFor(a, m => m.t === 'relay' && m.kind === 'client-action');
  assert(got.from === 1 && got.value === 42, '客户端→房主定向消息', JSON.stringify(got));

  console.log('\n[4] 广播中继');
  send(a, { t: 'relay', kind: 'host-state', value: 'state-1' });
  const got2 = await waitFor(b, m => m.t === 'relay' && m.kind === 'host-state');
  assert(got2.from === 0 && got2.value === 'state-1', '房主→客户端广播消息');

  console.log('\n[5] 错误处理');
  const c = await connect(url);
  send(c, { t: 'join', code: 'ZZZZZ', name: '路人' });
  const err = await waitFor(c, m => m.t === 'error');
  assert(/不存在/.test(err.message), '加入不存在的房间返回错误', err.message);
  c.close();

  console.log('\n[6] 离开房间');
  send(b, { t: 'leave' });
  const roomA3 = await waitFor(a, m => m.t === 'room' && m.members.length === 1);
  assert(roomA3.members.length === 1, '成员离开后房间更新');

  console.log('\n[7] 房主离开解散房间');
  const d = await connect(url);
  send(d, { t: 'join', code: roomA.code, name: '玩家D' });
  const roomD = await waitFor(d, m => m.t === 'room' && typeof m.seat === 'number');
  assert(roomD.seat > 0, '新成员获得非房主座位', `seat=${roomD.seat}`);
  send(a, { t: 'leave' });
  const closed = await waitFor(d, m => m.t === 'closed');
  assert(!!closed, '房主离开后房间解散通知');

  console.log('\n[8] 观战者协议');
  const e = await connect(url);
  send(a, { t: 'create', name: '观战房主' });
  const roomHost2 = await waitFor(a, m => m.t === 'room' && m.seat === 0);
  const code2 = roomHost2.code;
  send(d, { t: 'join', code: code2, name: '玩家D2' });
  await waitFor(d, m => m.t === 'room' && m.seat === 1);
  send(e, { t: 'join', code: code2, name: '观战E', spectate: true });
  const roomE = await waitFor(e, m => m.t === 'room' && m.role === 'spectator');
  assert(roomE.seat === null && roomE.role === 'spectator' && roomE.isHost === false,
    '观战者 seat=null / role=spectator / isHost=false');
  assert(roomE.playerCount === 2 && roomE.spectatorCount === 1,
    'roomInfo 区分 playerCount 与 spectatorCount');
  assert(roomE.members.filter(m => m.role === 'player').length === 2
    && roomE.members.filter(m => m.role === 'spectator').length === 1,
    'room members 带 role 字段');

  send(e, { t: 'relay', to: 0, kind: 'hack', value: 1 });
  const denied = await waitFor(e, m => m.t === 'error' && /观战者不能操作/.test(m.message || ''));
  assert(!!denied, '观战者 relay 被拒绝（不能伪造操作）');

  const noSpecAtPlayer = expectNone(d, m => m.t === 'relay' && m.kind === 'spectator-only');
  send(a, { t: 'relay', to: 'spectators', kind: 'spectator-only', value: 7 });
  const specMsg = await waitFor(e, m => m.t === 'relay' && m.kind === 'spectator-only');
  assert(specMsg.from === 0 && specMsg.value === 7, 'to:spectators 发给观战者');
  assert(await noSpecAtPlayer, 'to:spectators 不会发给玩家');

  const noPlayerAtSpec = expectNone(e, m => m.t === 'relay' && m.kind === 'players-only');
  send(d, { t: 'relay', to: 'players', kind: 'players-only', value: 9 });
  const playerMsg = await waitFor(a, m => m.t === 'relay' && m.kind === 'players-only');
  assert(playerMsg.from === 1 && playerMsg.value === 9, 'to:players 广播给所有玩家（含房主）');
  assert(await noPlayerAtSpec, 'to:players 不会发给观战者');

  send(a, { t: 'relay', kind: 'all-broadcast', value: 'x' });
  const allMsg = await waitFor(e, m => m.t === 'relay' && m.kind === 'all-broadcast');
  assert(allMsg.value === 'x', '默认广播（to 为空）会发给观战者');

  send(e, { t: 'leave' });
  const roomAfterSpec = await waitFor(a, m => m.t === 'room' && m.spectatorCount === 0);
  assert(roomAfterSpec.code === code2 && roomAfterSpec.playerCount === 2,
    '观战者离开不影响房间/玩家数');

  // 观战上限独立于玩家上限（MAX_SPECTATORS=8）
  const extraSpectators = [];
  for (let i = 0; i < 8; i++) {
    const s = await connect(url);
    send(s, { t: 'join', code: code2, name: `观战${i}`, spectate: true });
    await waitFor(s, m => m.t === 'room');
    extraSpectators.push(s);
  }
  const s9 = await connect(url);
  send(s9, { t: 'join', code: code2, name: '观战9', spectate: true });
  const capErr = await waitFor(s9, m => m.t === 'error');
  assert(/观战人数已满/.test(capErr.message || ''), '观战人数上限 8 独立于玩家上限', capErr.message);

  console.log('\n[9] 房间聊天');
  const chatHost = await connect(url);
  const chatHostMsgs = record(chatHost);
  send(chatHost, { t: 'create', name: '聊主' });
  const chatRoom = await waitFor(chatHost, m => m.t === 'room' && m.seat === 0);
  const emptyHist = await waitForRecorded(chatHostMsgs, m => m.t === 'chatHistory');
  assert(Array.isArray(emptyHist.messages) && emptyHist.messages.length === 0, '新房聊天历史为空');

  const chatPlayer = await connect(url);
  const chatPlayerMsgs = record(chatPlayer);
  send(chatPlayer, { t: 'join', code: chatRoom.code, name: '聊客' });
  await waitFor(chatPlayer, m => m.t === 'room' && m.seat === 1);
  const playerHist = await waitForRecorded(chatPlayerMsgs, m => m.t === 'chatHistory');
  assert(Array.isArray(playerHist.messages), '新成员加入收到 chatHistory');

  // 玩家发聊天（带伪造字段，服务端必须忽略）
  send(chatPlayer, { t: 'chat', text: '  你好   世界  ', name: '伪造名', senderId: 'p9', seat: 99, role: 'spectator' });
  const hostChat = await waitForRecorded(chatHostMsgs, m => m.t === 'chat' && m.message?.text === '你好 世界');
  const playerChat = await waitForRecorded(chatPlayerMsgs, m => m.t === 'chat' && m.message?.text === '你好 世界');
  assert(hostChat.message.senderId === 'p1' && hostChat.message.name === '聊客'
    && hostChat.message.role === 'player' && hostChat.message.seat === 1,
    '服务端固定 senderId/name/role/seat（忽略客户端伪造字段）');
  assert(hostChat.message.text === '你好 世界', '聊天文本 trim/折叠空白');
  assert(playerChat.message.id === hostChat.message.id, '发送者也会收到自己的聊天（同一 id）');
  assert(typeof hostChat.message.id === 'string' && typeof hostChat.message.ts === 'string',
    '聊天消息含 id/ts');

  // 观战者加入：补历史 + 可发言
  const chatSpec = await connect(url);
  const chatSpecMsgs = record(chatSpec);
  send(chatSpec, { t: 'join', code: chatRoom.code, name: '聊观', spectate: true });
  await waitFor(chatSpec, m => m.t === 'room' && m.role === 'spectator');
  const specHist = await waitForRecorded(chatSpecMsgs, m => m.t === 'chatHistory');
  assert(specHist.messages.some(m => m.text === '你好 世界'), '观战者加入收到历史聊天');
  send(chatSpec, { t: 'chat', text: '观战发言' });
  const specChat = await waitForRecorded(chatHostMsgs, m => m.t === 'chat' && m.message?.text === '观战发言');
  assert(specChat.message.senderId === 's1' && specChat.message.role === 'spectator'
    && specChat.message.seat === null, '观战者可发聊天且身份由服务端决定');
  assert(chatPlayerMsgs.some(m => m.t === 'chat' && m.message?.text === '观战发言'),
    '玩家能收到观战者的聊天');

  // 200 字截断
  send(chatHost, { t: 'chat', text: '字'.repeat(250) });
  const longChat = await waitForRecorded(chatHostMsgs, m => m.t === 'chat' && m.message?.text?.startsWith('字'));
  assert(Array.from(longChat.message.text).length === 200, '超长聊天截断为 200 字',
    `实际 ${Array.from(longChat.message.text).length}`);

  // 空消息忽略（不广播）
  const beforeEmpty = chatHostMsgs.filter(m => m.t === 'chat').length;
  send(chatPlayer, { t: 'chat', text: '   \n\t  ' });
  await new Promise(resolve => setTimeout(resolve, 400));
  const afterEmpty = chatHostMsgs.filter(m => m.t === 'chat').length;
  assert(afterEmpty === beforeEmpty, '空消息/纯空白消息被忽略');

  // 700ms 限流：第一条成功、紧接着第二条报错且不广播
  await new Promise(resolve => setTimeout(resolve, 800));
  send(chatHost, { t: 'chat', text: '限流A' });
  await waitForRecorded(chatHostMsgs, m => m.t === 'chat' && m.message?.text === '限流A');
  send(chatHost, { t: 'chat', text: '限流B' });
  const rateErr = await waitForRecorded(chatHostMsgs, m => m.t === 'error' && /频繁/.test(m.message || ''));
  assert(!!rateErr, '同一连接 700ms 内第二次聊天被限流');
  await new Promise(resolve => setTimeout(resolve, 300));
  assert(!chatHostMsgs.some(m => m.t === 'chat' && m.message?.text === '限流B'),
    '被限流的聊天不会广播');

  chatHost.close();
  chatPlayer.close();
  chatSpec.close();

  a.close();
  d.close();
  e.close();
  s9.close();
  extraSpectators.forEach(s => s.close());
  wss.close();

  console.log(`\n===== 结果: ${passed} 通过 / ${failed} 失败 =====\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('联机测试异常:', e);
  process.exit(1);
});
