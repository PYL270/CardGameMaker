import { useEffect, useRef, useState } from 'react';

const STORAGE_PREFIX = 'cgm_panel_';

function readPos(storageKey) {
  try {
    if (typeof localStorage === 'undefined') return { x: 0, y: 0 };
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.x === 'number' && typeof p.y === 'number') return p;
    }
  } catch {
    // ignore
  }
  return { x: 0, y: 0 };
}

/**
 * usePanelDrag - 面板/牌区拖拽
 * - 按住面板或卡牌拖动即可移位（移动超过 8px 才判定为拖拽，避免影响点击选牌）
 * - 双击空白处复位；位置保存到 localStorage
 * - 监听 window 的 cgm:reset-layout 事件可统一复位
 *
 * @param {string} name 位置存储名（如 action / hand）
 */
export default function usePanelDrag(name) {
  const storageKey = `${STORAGE_PREFIX}${name}`;
  const [pos, setPos] = useState(() => readPos(storageKey));
  const [dragging, setDragging] = useState(false);
  const posRef = useRef(pos);
  const session = useRef(null);
  const justDragged = useRef(false);
  const justDraggedTimer = useRef(null);
  const api = useRef({});

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  // 稳定的事件函数（便于 add/removeEventListener 成对调用）
  const stableMove = useRef(null);
  const stableFinish = useRef(null);
  if (!stableMove.current) stableMove.current = (e) => api.current.move(e);
  if (!stableFinish.current) stableFinish.current = () => api.current.finish();

  api.current.move = (e) => {
    const s = session.current;
    if (!s) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (!s.moved && Math.hypot(dx, dy) < 8) return;
    s.moved = true;
    if (!dragging) setDragging(true);
    if (e.cancelable) e.preventDefault();
    const maxX = (typeof window !== 'undefined' ? window.innerWidth : 1200) * 0.55;
    const maxY = (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.55;
    const next = {
      x: Math.max(-maxX, Math.min(maxX, s.bx + dx)),
      y: Math.max(-maxY, Math.min(maxY, s.by + dy)),
    };
    posRef.current = next;
    setPos(next);
  };

  api.current.finish = () => {
    const s = session.current;
    if (!s) return;
    session.current = null;
    window.removeEventListener('pointermove', stableMove.current);
    window.removeEventListener('pointerup', stableFinish.current);
    window.removeEventListener('pointercancel', stableFinish.current);
    if (s.moved) {
      justDragged.current = true;
      // 拖拽后的 click 用于抑制误选；超过 300ms 无 click 自动清除
      if (justDraggedTimer.current) clearTimeout(justDraggedTimer.current);
      justDraggedTimer.current = setTimeout(() => {
        justDragged.current = false;
      }, 300);
      try {
        localStorage.setItem(storageKey, JSON.stringify(posRef.current));
      } catch {
        // ignore
      }
    }
    setDragging(false);
  };

  api.current.down = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    // 按钮/输入框等交互元素上不启动拖拽
    if (e.target.closest && e.target.closest('button, input, select, textarea, a, [data-no-drag]')) return;
    session.current = {
      x0: e.clientX,
      y0: e.clientY,
      bx: posRef.current.x,
      by: posRef.current.y,
      moved: false,
    };
    justDragged.current = false;
    if (justDraggedTimer.current) clearTimeout(justDraggedTimer.current);
    window.addEventListener('pointermove', stableMove.current, { passive: false });
    window.addEventListener('pointerup', stableFinish.current);
    window.addEventListener('pointercancel', stableFinish.current);
  };

  // 统一复位
  const reset = () => {
    setPos({ x: 0, y: 0 });
    posRef.current = { x: 0, y: 0 };
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  // 统一复位事件
  useEffect(() => {
    const handler = () => reset();
    window.addEventListener('cgm:reset-layout', handler);
    return () => window.removeEventListener('cgm:reset-layout', handler);
  }, [storageKey]);

  // 卸载兜底清理
  useEffect(() => () => {
    window.removeEventListener('pointermove', stableMove.current);
    window.removeEventListener('pointerup', stableFinish.current);
    window.removeEventListener('pointercancel', stableFinish.current);
  }, []);

  /** 若刚刚发生过拖拽，则吞掉本次 click（防止拖动后误选牌） */
  const consumeDrag = () => {
    const v = justDragged.current;
    justDragged.current = false;
    return v;
  };

  return { pos, dragging, onPointerDown: (e) => api.current.down(e), consumeDrag, reset };
}
