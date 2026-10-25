/**
 * EventEmitter - 事件系统
 * 游戏内所有事件的发布/订阅中心，支持优先级和取消
 */
export default class EventEmitter {
  constructor() {
    this._events = new Map();
  }

  /**
   * 注册事件监听
   * @param {string} event - 事件名
   * @param {Function} fn - 回调函数
   * @param {number} priority - 优先级(越小越先执行)
   * @returns {Function} 取消注册的函数
   */
  on(event, fn, priority = 0) {
    if (!this._events.has(event)) {
      this._events.set(event, []);
    }
    const listeners = this._events.get(event);
    const listener = { fn, priority, once: false };
    listeners.push(listener);
    listeners.sort((a, b) => a.priority - b.priority);
    return () => this.off(event, fn);
  }

  /**
   * 注册一次性监听
   */
  once(event, fn, priority = 0) {
    if (!this._events.has(event)) {
      this._events.set(event, []);
    }
    const listeners = this._events.get(event);
    listeners.push({ fn, priority, once: true });
    listeners.sort((a, b) => a.priority - b.priority);
    return () => this.off(event, fn);
  }

  /**
   * 取消监听
   */
  off(event, fn) {
    if (!this._events.has(event)) return;
    const listeners = this._events.get(event);
    const idx = listeners.findIndex(l => l.fn === fn);
    if (idx !== -1) listeners.splice(idx, 1);
  }

  /**
   * 触发事件
   * @param {string} event - 事件名
   * @param {object} data - 事件数据
   * @returns {boolean} 是否被取消
   */
  emit(event, data = {}) {
    if (!this._events.has(event)) return false;
    const listeners = this._events.get(event);
    const eventData = {
      name: event,
      canceled: false,
      data,
      cancel() { this.canceled = true; },
    };
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i];
      if (eventData.canceled) break;
      listener.fn(eventData);
      if (listener.once) {
        listeners.splice(i, 1);
        i--;
      }
    }
    return eventData.canceled;
  }

  /**
   * 异步触发事件（等待所有异步监听完成）
   */
  async emitAsync(event, data = {}) {
    if (!this._events.has(event)) return false;
    const listeners = this._events.get(event);
    const eventData = {
      name: event,
      canceled: false,
      data,
      cancel() { this.canceled = true; },
    };
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i];
      if (eventData.canceled) break;
      await listener.fn(eventData);
      if (listener.once) {
        listeners.splice(i, 1);
        i--;
      }
    }
    return eventData.canceled;
  }

  /**
   * 移除所有监听
   */
  removeAllListeners(event) {
    if (event) {
      this._events.delete(event);
    } else {
      this._events.clear();
    }
  }
}
