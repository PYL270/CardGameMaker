/**
 * CardGameMaker 联机中继服务器
 * - 房间创建/加入/离开
 * - 房间内消息中继(host 权威模式：对局逻辑只在房主端运行)
 *
 * 启动: node server/relay.mjs
 * 端口: 默认 8787，可用环境变量 RELAY_PORT 覆盖
 */
import { WebSocketServer } from 'ws';
import os from 'node:os';

const MAX_PLAYERS = 8;      // 玩家上限（不含观战者）
const MAX_SPECTATORS = 8;   // 观战者上限（独立于玩家）
const ROOM_TTL = 1000 * 60 * 60 * 6; // 6 小时无人自动清理
const CHAT_MAX_LEN = 200;       // 单条聊天最大字符数
const CHAT_HISTORY_MAX = 50;    // 房间聊天历史保留条数
const CHAT_RATE_MS = 700;       // 每连接聊天限流间隔
const RELAY_BURST = 60;         // relay 消息令牌桶容量（允许正常突发）
const RELAY_REFILL_PER_SEC = 30; // relay 消息每秒回填速率

const rooms = new Map(); // code -> { code, members: Map<ws,{id,seat,name,role,lastChatAt}>, nextSeat, spectatorSeq, chat:[], chatSeq, createdAt }
let roomSeq = 0;

/** 规范化聊天文本：去控制字符、折叠空白、trim、最多 CHAT_MAX_LEN 个字符（Unicode 码点） */
function normalizeChatText(raw) {
  if (typeof raw !== 'string') return '';
  let text = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return Array.from(text).slice(0, CHAT_MAX_LEN).join('');
}

function send(ws, msg) {
  try {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  } catch {
    // 忽略发送失败
  }
}

function roomInfo(room, ws) {
  const members = [...room.members.entries()]
    .map(([member, info]) => ({
      id: info.id,
      seat: info.seat,
      name: info.name,
      role: info.role || 'player',
      connected: member.readyState === 1,
    }))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'player' ? -1 : 1;
      if (a.seat === null || a.seat === undefined) return 1;
      if (b.seat === null || b.seat === undefined) return -1;
      return a.seat - b.seat;
    });
  const info = room.members.get(ws);
  const role = info ? (info.role || 'player') : null;
  const seat = info ? info.seat : null;
  const playerCount = members.filter(m => m.role === 'player').length;
  const spectatorCount = members.filter(m => m.role === 'spectator').length;
  return {
    t: 'room',
    code: room.code,
    seat,
    role,
    id: info ? info.id : null,
    isHost: role === 'player' && seat === 0,
    members,
    playerCount,
    spectatorCount,
  };
}

function broadcastRoom(room, except) {
  for (const member of room.members.keys()) {
    if (member !== except) send(member, roomInfo(room, member));
  }
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function leaveRoom(ws, reason = 'left') {
  const room = ws._room;
  if (!room) return;
  const info = room.members.get(ws);
  room.members.delete(ws);
  ws._room = null;

  if (room.members.size === 0) {
    rooms.delete(room.code);
    return;
  }
  // 房主离开：解散房间（观战者离开不影响房间）
  if (info && info.role !== 'spectator' && info.seat === 0) {
    for (const member of room.members.keys()) {
      send(member, { t: 'closed', message: '房主已离开，房间解散' });
      member._room = null;
    }
    rooms.delete(room.code);
    return;
  }
  for (const member of room.members.keys()) {
    send(member, roomInfo(room, member));
    if (reason === 'disconnected') {
      send(member, { t: 'notice', message: `${info?.name || '一名玩家'} 已断开连接` });
    }
  }
}

function handle(ws, msg) {
  switch (msg.t) {
    case 'create': {
      if (ws._room) leaveRoom(ws);
      const code = generateCode();
      const name = String(msg.name || '房主').slice(0, 16);
      const room = {
        code,
        members: new Map([[ws, { id: 'p0', seat: 0, name, role: 'player', lastChatAt: 0 }]]),
        nextSeat: 1,
        spectatorSeq: 0,
        chat: [],
        chatSeq: 0,
        createdAt: Date.now(),
      };
      rooms.set(code, room);
      ws._room = room;
      ws._seat = 0;
      ws._role = 'player';
      ws._id = 'p0';
      ws._name = name;
      send(ws, roomInfo(room, ws));
      send(ws, { t: 'chatHistory', messages: [] });
      // 清理空房
      const timer = setInterval(() => {
        if (!rooms.has(code)) return clearInterval(timer);
        if (Date.now() - room.createdAt > ROOM_TTL) {
          clearInterval(timer);
          rooms.delete(code);
        }
      }, 60 * 1000);
      if (timer.unref) timer.unref();
      break;
    }
    case 'join': {
      const code = String(msg.code || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) return send(ws, { t: 'error', message: '房间不存在或已解散' });
      const spectate = msg.spectate === true || msg.spectate === 'true';
      // 观战者不占玩家位/不递增 nextSeat，单独受 MAX_SPECTATORS 限制
      const role = spectate ? 'spectator' : 'player';
      const currentCount = [...room.members.values()].filter(m => (m.role || 'player') === role).length;
      if (spectate && currentCount >= MAX_SPECTATORS) {
        return send(ws, { t: 'error', message: '观战人数已满' });
      }
      if (!spectate && currentCount >= MAX_PLAYERS) {
        return send(ws, { t: 'error', message: '房间玩家已满' });
      }
      if (ws._room) leaveRoom(ws);
      const name = String(msg.name || (spectate ? `观战者${currentCount + 1}` : `玩家${room.nextSeat + 1}`)).slice(0, 16);
      if (spectate) {
        const id = `s${++room.spectatorSeq}`;
        room.members.set(ws, { id, seat: null, name, role: 'spectator', lastChatAt: 0 });
        ws._room = room;
        ws._seat = null;
        ws._role = 'spectator';
        ws._id = id;
        ws._name = name;
      } else {
        const seat = room.nextSeat++;
        const id = `p${seat}`;
        room.members.set(ws, { id, seat, name, role: 'player', lastChatAt: 0 });
        ws._room = room;
        ws._seat = seat;
        ws._role = 'player';
        ws._id = id;
        ws._name = name;
      }
      send(ws, roomInfo(room, ws));
      // 新成员补发最近聊天历史（最多 50 条）
      send(ws, { t: 'chatHistory', messages: room.chat.slice(-CHAT_HISTORY_MAX) });
      broadcastRoom(room, ws);
      break;
    }
    case 'leave': {
      leaveRoom(ws);
      break;
    }
    case 'chat': {
      const room = ws._room;
      if (!room) return send(ws, { t: 'error', message: '尚未加入房间' });
      const info = room.members.get(ws);
      if (!info) return send(ws, { t: 'error', message: '尚未加入房间' });
      const text = normalizeChatText(msg.text);
      if (!text) return; // 空消息/纯空白/纯控制字符：忽略
      const now = Date.now();
      if (info.lastChatAt && now - info.lastChatAt < CHAT_RATE_MS) {
        return send(ws, { t: 'error', message: '聊天过于频繁，请稍后再试' });
      }
      info.lastChatAt = now;
      const message = {
        id: `${room.code}_${++room.chatSeq}`,
        senderId: info.id,
        name: info.name,
        role: info.role || 'player',
        seat: info.seat,
        text,
        ts: new Date().toISOString(),
      };
      room.chat.push(message);
      if (room.chat.length > CHAT_HISTORY_MAX) room.chat.splice(0, room.chat.length - CHAT_HISTORY_MAX);
      // 广播给房间内所有人（含发送者）；name/senderId/seat 由服务端决定，客户端无法伪造
      for (const member of room.members.keys()) send(member, { t: 'chat', message });
      break;
    }
    case 'relay': {
      const room = ws._room;
      if (!room) return send(ws, { t: 'error', message: '尚未加入房间' });
      const senderInfo = room.members.get(ws);
      if (!senderInfo) return send(ws, { t: 'error', message: '尚未加入房间' });
      // 观战者不能伪造操作/发送中继
      if ((senderInfo.role || 'player') === 'spectator') {
        return send(ws, { t: 'error', message: '观战者不能操作' });
      }
      // 令牌桶限流：只针对普通客户端（房主座位 0 是权威端，每步广播 state/effect/prompt，
      // 限流会丢关键消息；恶意客户端也拿不到座位 0）。桶 60 / 每秒回 30，足够正常操作，只挡恶意刷屏
      if ((senderInfo.seat ?? -1) !== 0) {
        const now = Date.now();
        const tokens = Math.min(
          RELAY_BURST,
          ((senderInfo.relayTokens ?? RELAY_BURST))
            + ((now - (senderInfo.relayLastAt || now)) / 1000) * RELAY_REFILL_PER_SEC,
        );
        senderInfo.relayLastAt = now;
        if (tokens < 1) return send(ws, { t: 'error', message: '操作过于频繁，请稍后再试' });
        senderInfo.relayTokens = tokens - 1;
      }
      const payload = { t: 'relay', from: senderInfo.role === 'spectator' ? null : senderInfo.seat };
      for (const key of Object.keys(msg)) {
        if (key === 't' || key === 'to') continue;
        payload[key] = msg[key];
      }
      const to = msg.to;
      if (to === 'players') {
        // 广播给所有玩家（含房主），不含观战者
        for (const [member, info] of room.members.entries()) {
          if (member !== ws && (info.role || 'player') === 'player') send(member, payload);
        }
      } else if (to === 'spectators') {
        // 广播给所有观战者
        for (const [member, info] of room.members.entries()) {
          if ((info.role || 'player') === 'spectator') send(member, payload);
        }
      } else if (typeof to === 'number') {
        // 按座位号定向（仅玩家）
        for (const [member, info] of room.members.entries()) {
          if ((info.role || 'player') === 'player' && info.seat === to) send(member, payload);
        }
      } else {
        // to=null/undefined：广播给房间内其他所有人（玩家+观战者）
        for (const member of room.members.keys()) {
          if (member !== ws) send(member, payload);
        }
      }
      break;
    }
    case 'ping': {
      send(ws, { t: 'pong', time: msg.time || Date.now() });
      break;
    }
    case 'lanip': {
      // 返回本机局域网 IPv4 地址（供房主生成手机扫码地址）
      const ips = [];
      for (const list of Object.values(os.networkInterfaces())) {
        for (const info of list || []) {
          if (info.family === 'IPv4' && !info.internal) ips.push(info.address);
        }
      }
      // 常见局域网网段优先，避免虚拟网卡排在前面
      const score = (ip) => {
        if (ip.startsWith('192.168.')) return 0;
        if (ip.startsWith('10.')) return 1;
        if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
        return 3;
      };
      ips.sort((a, b) => score(a) - score(b));
      send(ws, { t: 'lanip', ips });
      break;
    }
    default:
      break;
  }
}

/**
 * 启动中继服务
 * @param {number} port
 * @returns {WebSocketServer}
 */
export function startRelay(port = Number(process.env.RELAY_PORT || 8787)) {
  const wss = new WebSocketServer({
    port,
    host: '0.0.0.0',
    // 单帧上限：正常对局消息（状态快照/提示）远小于 64KB，防止恶意超大帧占用内存
    maxPayload: 64 * 1024,
  });

  wss.on('connection', (ws) => {
    ws._room = null;
    ws._role = null;
    ws._id = null;
    ws._seat = null;
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      try {
        handle(ws, msg);
      } catch (e) {
        send(ws, { t: 'error', message: `服务器处理出错: ${e.message}` });
      }
    });
    ws.on('close', () => leaveRoom(ws, 'disconnected'));
    ws.on('error', () => leaveRoom(ws, 'disconnected'));
  });

  wss.on('listening', () => {
    console.log(`[relay] WebSocket 服务器已启动: ws://0.0.0.0:${port}`);
    console.log('[relay] 局域网联机：同一 WiFi 下用 http://本机IP:3000 访问并连接 ws://本机IP:8787');
  });

  wss.on('error', (err) => {
    console.error('[relay] 服务器错误:', err.message);
  });

  return wss;
}

// 直接运行: node server/relay.mjs
const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  /relay\.mjs$/.test(process.argv[1]);

if (isDirectRun) {
  startRelay();
}
