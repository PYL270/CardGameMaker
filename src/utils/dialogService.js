/**
 * 全局游戏内对话框服务
 *
 * 原生 window.confirm / alert 会弹出浏览器自己的窗口，和整体的墨玉鎏金界面完全不是一回事。
 * 这里把请求交给 <GameDialog />，由它用游戏内样式承接，调用方只关心 Promise 结果。
 *
 * 约定：
 * - confirmDialog(options) => Promise<boolean>，默认 true
 * - alertDialog(options)   => Promise<void>
 * - 没有挂载 handler 时（例如音频/背景管理在非 React 环境被调用）安全地立即 resolve，
 *   绝不阻塞调用方。
 */
let handler = null;

export function setDialogHandler(fn) {
  if (typeof fn !== 'function') return () => {};
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

function toOptions(options) {
  if (typeof options === 'string') return { message: options };
  return options && typeof options === 'object' ? options : {};
}

/** 确认框：resolve(true / false) */
export function confirmDialog(options = {}) {
  const payload = { kind: 'confirm', ...toOptions(options) };
  if (!handler) return Promise.resolve(true);
  try {
    return Promise.resolve(handler(payload)).then(
      value => value !== false,
      () => true
    );
  } catch {
    return Promise.resolve(true);
  }
}

/** 提示框：resolve()。也接受纯字符串，方便直接替换 window.alert */
export function alertDialog(options = {}) {
  const payload = { kind: 'alert', ...toOptions(options) };
  if (!handler) return Promise.resolve();
  try {
    return Promise.resolve(handler(payload)).then(
      () => undefined,
      () => undefined
    );
  } catch {
    return Promise.resolve();
  }
}
