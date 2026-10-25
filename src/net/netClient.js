/**
 * NetClient - 浏览器端 WebSocket 客户端（单例）
 * 负责连接中继服务器、房间与消息收发
 */

class Emitter {
  constructor() {
    this.handlers = new Map();
  }
  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event).push(fn);
    return () => this.off(event, fn);
  }
  off(event, fn) {
    const list = this.handlers.get(event);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
  emit(event, ...args) {
    const list = this.handlers.get(event);
    if (!list) return;
    for (const fn of [...list]) {
      try {
        fn(...args);
      } catch (e) {
        console.error(`net handler [${event}] error:`, e);
      }
    }
  }
}

export class NetClient extends Emitter {
  constructor() {
    super();
    this.ws = null;
    this.url = '';
    this.connected = false;
    this._bindOnce = false;
  }

  /** 根据当前页面地址推导默认中继地址 */
  static defaultUrl() {
    if (typeof window === 'undefined') return 'ws://localhost:8787';
    const host = window.location.hostname || 'localhost';
    return `ws://${host}:8787`;
  }

  /**
   * 连接服务器（重复连接会复用）
   * @param {string} url
   * @returns {Promise<void>}
   */
  connect(url) {
    const target = url || NetClient.defaultUrl();
    if (this.ws && this.connected && this.url === target) return Promise.resolve();

    this.close();
    this.url = target;

    return new Promise((resolve, reject) => {
      let settled = false;
      let ws;
      try {
        ws = new WebSocket(target);
      } catch (e) {
        reject(new Error(`无法创建连接: ${e.message}`));
        return;
      }
      this.ws = ws;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { ws.close(); } catch { /* ignore */ }
        reject(new Error('连接超时，请检查服务器是否已启动'));
      }, 5000);

      ws.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.connected = true;
        this.emit('connect');
        resolve();
      };

      ws.onmessage = (evt) => {
        let msg;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }
        if (!msg || !msg.t) return;
        this.emit(msg.t, msg);
        this.emit('message', msg);
      };

      ws.onerror = () => {
        if (settled) {
          this.emit('error', { message: '连接出错' });
          return;
        }
        settled = true;
        clearTimeout(timer);
        reject(new Error(`无法连接服务器 ${target}`));
      };

      ws.onclose = () => {
        this.connected = false;
        this.emit('disconnect');
      };
    });
  }

  send(msg) {
    if (!this.ws || this.ws.readyState !== 1) {
      this.emit('error', { message: '尚未连接到服务器' });
      return false;
    }
    try {
      this.ws.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  createRoom(name) {
    this.send({ t: 'create', name });
  }

  /**
   * 加入房间
   * @param {string} code 房间号
   * @param {string} name 昵称
   * @param {{spectate?: boolean}} [opts] spectate=true 以观战者身份加入
   */
  joinRoom(code, name, { spectate = false } = {}) {
    this.send({ t: 'join', code, name, spectate: spectate === true });
  }

  /** 中继消息；to=null 广播给房间内其他人 */
  relay(to, payload) {
    this.send({ t: 'relay', to, ...payload });
  }

  /** 发送房间聊天（服务端负责 trim/限流/身份字段） */
  sendChat(text) {
    this.send({ t: 'chat', text });
  }

  leave() {
    this.send({ t: 'leave' });
  }

  close() {
    const ws = this.ws;
    this.ws = null;
    this.connected = false;
    if (ws) {
      try { ws.close(); } catch { /* ignore */ }
    }
  }
}

export const net = new NetClient();
