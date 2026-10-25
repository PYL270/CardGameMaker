/**
 * 联机房主端集成测试（真实 WebSocket + 引擎主循环 + 观战者）
 * 运行: node scripts/run-online-host-smoke.mjs
 */
import WebSocket from 'ws';
import { startRelay } from '../server/relay.mjs';
import useGameStore from '../src/store/gameStore.js';
import { net } from '../src/net/netClient.js';

const PORT = 8898;
let passed = 0;
let failed = 0;

function assert(cond, name, extra = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
}

function waitUntil(fn, timeout, label) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      let value;
      try { value = fn(); } catch { value = null; }
      if (value) {
        clearInterval(timer);
        resolve(value);
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error(`${label} 超时`));
      }
    }, 50);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function connectWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function send(ws, msg) {
  ws.send(JSON.stringify(msg));
}

function record(ws, list) {
  ws.on('message', (raw) => {
    try {
      list.push(JSON.parse(raw.toString()));
    } catch { /* ignore */ }
  });
}

/** 远端真人座位自动应答房主提示，保证对局能推进 */
function attachRemotePlayer(ws) {
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.t !== 'relay' || msg.kind !== 'prompt') return;
    const prompt = msg.prompt || {};
    let payload = { kind: 'endPlay' };
    switch (prompt.type) {
      case 'discard':
        payload = {
          kind: 'discard',
          cardIds: (prompt.cards || []).slice(0, prompt.count || 0).map(c => c.id),
        };
        break;
      case 'respond':
        payload = { kind: 'respond', cardId: null };
        break;
      case 'confirm':
        payload = { kind: 'confirm', yes: false };
        break;
      case 'selectCards':
        payload = { kind: 'selectCards', cardIds: [] };
        break;
      case 'chooseTarget':
        payload = { kind: 'chooseTarget', targetId: null };
        break;
      default:
        payload = { kind: 'endPlay' };
    }
    send(ws, { t: 'relay', to: 0, kind: 'action', requestId: msg.requestId, payload });
  });
}

function relayKind(list, kind) {
  return list.filter(m => m.t === 'relay' && m.kind === kind);
}

async function main() {
  if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = WebSocket;
  }

  const wss = startRelay(PORT);
  await new Promise(resolve => wss.once('listening', resolve));

  const store = useGameStore;
  store.getState().initNet();

  console.log('\n[1] 房主创建房间');
  const ok = await store.getState().onlineCreate({
    serverUrl: `ws://127.0.0.1:${PORT}`,
    name: '主机测试',
  });
  assert(ok === true, '连接服务器并创建房间');
  const roomCode = await waitUntil(() => store.getState().online.roomCode, 5000, '房间号');
  assert(typeof roomCode === 'string' && roomCode.length === 5, '获得房间号', roomCode);
  assert(store.getState().online.isHost === true, '当前用户为房主');

  console.log('\n[2] 玩家 + 观战者加入');
  const url = `ws://127.0.0.1:${PORT}`;
  const playerWs = await connectWs(url);
  send(playerWs, { t: 'join', code: roomCode, name: '远端玩家' });
  const playerRoomMsg = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('玩家房间信息超时')), 5000);
    playerWs.on('message', (raw) => {
      let m;
      try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.t === 'room' && m.seat === 1) {
        clearTimeout(timer);
        resolve(m);
      }
    });
  });
  assert(playerRoomMsg.role === 'player' && playerRoomMsg.playerCount === 2,
    '玩家加入获得座位 1 / role=player', `seat=${playerRoomMsg.seat}`);

  const specMsgs = [];
  const specWs = await connectWs(url);
  record(specWs, specMsgs);
  send(specWs, { t: 'join', code: roomCode, name: '观战者甲', spectate: true });
  await waitUntil(() => specMsgs.some(m => m.t === 'room' && m.role === 'spectator'), 5000, '观战房间信息');
  const specRoomMsg = specMsgs.find(m => m.t === 'room' && m.role === 'spectator');
  assert(specRoomMsg.seat === null && specRoomMsg.isHost === false,
    '观战者 seat=null / isHost=false');
  assert(specRoomMsg.spectatorCount === 1 && specRoomMsg.playerCount === 2,
    'roomInfo 区分观战者与玩家');
  await waitUntil(() => store.getState().online.members.length === 3, 5000, '房主成员同步');
  assert(store.getState().online.playerCount === 2 && store.getState().online.spectatorCount === 1,
    '房主 store playerCount=2 / spectatorCount=1（观战不占玩家位）');

  const playerMsgs = [];
  record(playerWs, playerMsgs);
  attachRemotePlayer(playerWs);

  console.log('\n[3] 房主开始对局（观战者不计入玩家数）');
  const started = await store.getState().hostStartOnline(3);
  assert(started === true, '联机对局启动');
  assert(store.getState().online.playerCount === 3, 'playerCount=3（2 真人 + 1 AI，不含观战者）');
  const state = await waitUntil(() => {
    const gs = store.getState().gameState;
    return gs && gs.players?.length === 3 ? gs : null;
  }, 5000, '对局状态');
  assert(state.players.length === 3, '创建 3 名玩家（房主 + 远端真人 + AI 补位）');
  assert(state.players.filter(p => p.isAI).length === 1, '不足座位由 AI 补齐');

  console.log('\n[4] 观战者收到 start + 公共 state（无手牌/无 prompt）');
  await waitUntil(() => relayKind(specMsgs, 'start').length > 0, 5000, '观战 start');
  const specStart = relayKind(specMsgs, 'start')[0];
  assert(specStart && specStart.config?.playerCount === 3, '观战者收到 start（playerCount=3）');
  const specStateMsg = await waitUntil(
    () => relayKind(specMsgs, 'state').find(m => m.state?.players?.length === 3),
    5000,
    '观战 state',
  );
  assert(specStateMsg.state.players.every(p => p.handCards === undefined),
    '观战者 state 为公共视图（所有玩家无 handCards）');
  assert(specStateMsg.state.players.every(p => p && typeof p.equips === 'object')
    && specStateMsg.state.currentPlayerId !== undefined, '观战 state 含完整桌面信息');
  await sleep(300);
  assert(relayKind(specMsgs, 'prompt').length === 0, '观战者收不到任何 prompt');
  assert(relayKind(specMsgs, 'effect').length > 0 || relayKind(specMsgs, 'state').length > 1,
    '观战者持续收到 state/effect 演出事件');

  const playerStateMsg = await waitUntil(
    () => relayKind(playerMsgs, 'state').find(m => m.state?.players?.some(
      p => p.seatNum === 1 && Array.isArray(p.handCards),
    )),
    5000,
    '玩家私有 state',
  );
  assert(!!playerStateMsg, '远端玩家收到含自己手牌的 seat 视图 state');
  assert(playerStateMsg.state.players.find(p => p.seatNum === 0).handCards === undefined,
    '远端玩家看不到房主手牌');

  console.log('\n[5] 观战者中途加入补发 start + state');
  const spec2Msgs = [];
  const spec2 = await connectWs(url);
  record(spec2, spec2Msgs);
  send(spec2, { t: 'join', code: roomCode, name: '观战者乙', spectate: true });
  const spec2State = await waitUntil(
    () => relayKind(spec2Msgs, 'state').find(m => m.state?.players?.length === 3),
    6000,
    '中途观战补发 state',
  );
  assert(!!spec2State, '中途加入的观战者收到公共 state');
  assert(relayKind(spec2Msgs, 'start').length > 0, '中途加入的观战者收到 start');
  assert(spec2State.state.players.every(p => p.handCards === undefined),
    '中途观战 state 不泄露手牌');

  console.log('\n[6] 模拟人类操作并等待对局结束');
  const auto = setInterval(() => {
    const s = store.getState();
    const pa = s.pendingAction;
    if (!pa) return;
    if (pa.type === 'play') s.resolveAction({ type: 'endPlay' });
    else if (pa.type === 'discard') s.resolveAction(pa.player.handCards.slice(0, pa.count));
    else if (pa.type === 'respond') s.resolveAction(null);
    else if (pa.type === 'confirm') s.resolveAction(false);
    else if (pa.type === 'equipReplace') s.resolveAction(null);
  }, 40);

  let finished = false;
  try {
    await waitUntil(() => store.getState().gameState?.status === 'finished', 60000, '对局结束');
    finished = true;
  } catch {
    finished = false;
  }
  clearInterval(auto);

  const final = store.getState().gameState;
  assert(finished, '联机对局可正常结束', `round=${final?.round} status=${final?.status}`);
  assert((final?.round || 0) >= 1, '对局推进了回合', `round=${final?.round}`);
  assert(store.getState().logs.length > 0, '对局有日志输出');
  assert(relayKind(spec2Msgs, 'prompt').length === 0, '中途观战者同样收不到 prompt');

  console.log('\n[7] 离开房间');
  store.getState().leaveOnline();
  assert(store.getState().online.roomCode === null, '离开后清空房间状态');
  assert(store.getState().online.connected === false, '离开后断开连接');
  assert(store.getState().online.spectator === false && store.getState().online.role === 'player',
    '离开后重置 spectator/role');

  try { playerWs.close(); } catch { /* ignore */ }
  try { specWs.close(); } catch { /* ignore */ }
  try { spec2.close(); } catch { /* ignore */ }

  console.log('\n[8] 客户端 onlineJoin(spectate=true) 路径');
  const rawHost = await connectWs(url);
  send(rawHost, { t: 'create', name: '观察房主' });
  const rawRoom = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('观察房主房间超时')), 5000);
    rawHost.on('message', (raw) => {
      let m;
      try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.t === 'room' && m.seat === 0) {
        clearTimeout(timer);
        resolve(m);
      }
    });
  });
  const joined = await store.getState().onlineJoin({
    serverUrl: url,
    code: rawRoom.code,
    name: '观战客户端',
    spectate: true,
  });
  assert(joined === true, 'onlineJoin 支持 spectate 参数');
  await waitUntil(() => store.getState().online.role === 'spectator', 5000, '观战客户端加入');
  const specOnline = store.getState().online;
  assert(specOnline.spectator === true && specOnline.role === 'spectator',
    '客户端 online.spectator/role 标记为观战者');
  assert(specOnline.seat === null && specOnline.isHost === false, '观战客户端无座位/非房主');
  assert(store.getState().pendingAction === null, '观战客户端 pendingAction 恒为 null');
  store.getState().leaveOnline();
  try { rawHost.close(); } catch { /* ignore */ }
  assert(store.getState().online.spectator === false && store.getState().online.role === 'player',
    '观战客户端离开后重置角色');

  console.log('\n[9] store 聊天监听 / 未读 / 本地屏蔽');
  const st = () => store.getState();
  // 注入极简 localStorage，验证屏蔽名单持久化 key（仅本机，不经过网络）
  const fakeStorage = {};
  globalThis.localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(fakeStorage, k) ? fakeStorage[k] : null),
    setItem: (k, v) => { fakeStorage[k] = String(v); },
    removeItem: (k) => { delete fakeStorage[k]; },
  };
  store.setState(s => ({
    chatMuted: [],
    online: {
      ...s.online,
      active: true,
      connected: true,
      roomCode: 'TEST',
      clientId: 'p0',
      chatMessages: [],
      chatUnread: 0,
    },
  }));
  const msg1 = {
    id: 'm1', senderId: 'p1', name: '玩家B', role: 'player', seat: 1, text: '你好', ts: '2026-01-01T00:00:01.000Z',
  };
  net.emit('chat', { t: 'chat', message: msg1 });
  assert(st().online.chatMessages.length === 1 && st().online.chatUnread === 1,
    'chat 监听追加消息并计未读');
  net.emit('chat', { t: 'chat', message: { ...msg1, id: 'm2', senderId: 'p0' } });
  assert(st().online.chatUnread === 1, '自己发送的消息不计未读');
  assert(st().isChatMuted(msg1) === false, '默认未屏蔽');

  const muted = st().toggleChatMute(msg1);
  assert(muted === true && st().isChatMuted({ senderId: 'p1' }) === true,
    'toggleChatMute 按 senderId 屏蔽');
  assert(fakeStorage['cgm_chat_muted']
    && JSON.parse(fakeStorage['cgm_chat_muted']).some(e => (typeof e === 'string' ? e === 'p1' : e.id === 'p1')),
    '屏蔽名单持久化到 localStorage cgm_chat_muted');
  store.setState(s => ({ online: { ...s.online, chatUnread: 0 } }));
  net.emit('chat', { t: 'chat', message: { ...msg1, id: 'm3', text: '被屏蔽消息' } });
  assert(st().online.chatMessages.length === 3 && st().online.chatUnread === 0,
    '已屏蔽发送者的消息不增加未读');
  assert(st().isChatMuted({ name: '玩家B' }) === true, 'isChatMuted 也支持按 name 判断');

  store.setState(s => ({ online: { ...s.online, chatUnread: 5 } }));
  st().markChatRead();
  assert(st().online.chatUnread === 0, 'markChatRead 清零未读');

  net.emit('chatHistory', {
    t: 'chatHistory',
    messages: [
      { ...msg1, id: 'h1', text: '历史1', ts: '2026-01-01T00:00:02.000Z' },
      { ...msg1, id: 'h2', text: '历史2', ts: '2026-01-01T00:00:03.000Z' },
    ],
  });
  assert(st().online.chatMessages.some(m => m.id === 'h1') && st().online.chatUnread === 0,
    'chatHistory 合并历史且不计未读');

  store.setState(s => ({ online: { ...s.online, active: false, connected: false, roomCode: null } }));
  const sendOffline = st().sendChat('hi');
  assert(sendOffline === false && String(st().online.error || '').length > 0,
    'sendChat 未在房间时拒绝并设置 error');
  store.setState(s => ({ online: { ...s.online, active: true, connected: true, roomCode: 'TEST' } }));
  assert(st().sendChat('   ') === false, 'sendChat 空白文本拒绝');

  st().toggleChatMute('p2');
  st().leaveOnline();
  assert(st().online.chatMessages.length === 0 && st().online.chatUnread === 0
    && st().online.clientId === null, '离开房间重置聊天消息/未读/clientId');
  assert(st().isChatMuted('p2') && st().chatMuteList().some(e => (typeof e === 'string' ? e === 'p2' : e.id === 'p2')),
    '屏蔽名单离开房间后保留（本地）');
  st().clearChatMuted();
  assert(st().chatMuted.length === 0 && st().isChatMuted('p2') === false, 'clearChatMuted 清空');
  delete globalThis.localStorage;

  wss.close();
  console.log(`\n===== 结果: ${passed} 通过 / ${failed} 失败 =====\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('联机房主测试异常:', e);
  process.exit(1);
});
