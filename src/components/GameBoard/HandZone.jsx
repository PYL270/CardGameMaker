import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getCardText } from '../../data/cardText';
import { audio } from '../../audio/audioManager';
import CardFace from './CardFace';
import Icon from '../ui/Icon';
import { computeCardTilt, shouldEnableCardTilt } from './cardTilt';

const TYPE_ORDER = { basic: 0, trick: 1, delay_trick: 2, equip: 3 };
const SUIT_ORDER = { spade: 0, club: 1, heart: 2, diamond: 3, sun: 4, moon: 5 };

/** 排序模式轮换顺序：类型→点数 → 花色→点数 → 点数→花色 → 名称 → 回到类型 */
export const HAND_SORT_MODES = ['type', 'suit', 'number', 'name'];
export const HAND_SORT_LABELS = { type: '类型', suit: '花色', number: '点数', name: '名称' };
export const HAND_SORT_STORAGE_KEY = 'cgm_hand_sort';
/** FLIP 动画参数（毫秒）：总时长约 300ms + 每张最多 96ms stagger */
export const HAND_FLIP_DURATION = 300;
export const HAND_FLIP_STAGGER = 16;
/** 拖拽阈值：低于该像素视为点击，避免轻触/微滑被吞 */
export const HAND_DRAG_THRESHOLD = 11;
const FLIP_EASING = 'cubic-bezier(0.22, 1.36, 0.36, 1)';

export const cardKey = (c) => c.id || `${c.name}_${c.suit}_${c.number}`;

export function normalizeHandSortMode(mode) {
  return HAND_SORT_MODES.includes(mode) ? mode : 'type';
}

export function nextHandSortMode(mode) {
  const current = normalizeHandSortMode(mode);
  const i = HAND_SORT_MODES.indexOf(current);
  return HAND_SORT_MODES[(i + 1) % HAND_SORT_MODES.length];
}

export function handSortLabel(mode) {
  return HAND_SORT_LABELS[normalizeHandSortMode(mode)];
}

const byType = (a, b) => (TYPE_ORDER[a?.type] ?? 9) - (TYPE_ORDER[b?.type] ?? 9);
const bySuit = (a, b) => (SUIT_ORDER[a?.suit] ?? 9) - (SUIT_ORDER[b?.suit] ?? 9);
const byNumber = (a, b) => (Number(a?.number) || 0) - (Number(b?.number) || 0);
const byName = (a, b) => {
  const an = a?.name || '';
  const bn = b?.name || '';
  // 中文按拼音排序；locale 不支持时回退到默认比较
  return an.localeCompare(bn, 'zh-Hans-CN') || an.localeCompare(bn);
};

/**
 * 手牌排序纯函数（不改动入参）：
 * - type：类型→点数（默认，与原行为一致）
 * - suit：花色→点数
 * - number：点数→花色
 * - name：名称（中文 localeCompare）
 */
export function sortHandCards(cards, mode) {
  if (!Array.isArray(cards)) return [];
  const list = [...cards];
  switch (normalizeHandSortMode(mode)) {
    case 'suit':
      return list.sort((a, b) => bySuit(a, b) || byNumber(a, b) || byType(a, b));
    case 'number':
      return list.sort((a, b) => byNumber(a, b) || bySuit(a, b) || byType(a, b));
    case 'name':
      return list.sort((a, b) => byName(a, b) || bySuit(a, b) || byNumber(a, b));
    case 'type':
    default:
      return list.sort((a, b) => byType(a, b) || byNumber(a, b) || bySuit(a, b));
  }
}

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // 隐私模式 / SSR
  }
  return null;
}

/** 读取持久化的排序模式；非法值/无存储回退默认“类型” */
export function loadHandSortMode(storage) {
  const store = resolveStorage(storage);
  if (!store) return 'type';
  try {
    return normalizeHandSortMode(store.getItem(HAND_SORT_STORAGE_KEY));
  } catch {
    return 'type';
  }
}

export function saveHandSortMode(mode, storage) {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(HAND_SORT_STORAGE_KEY, normalizeHandSortMode(mode));
    return true;
  } catch {
    return false;
  }
}

function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * HandZone - 底部手牌区（三国杀式布局）
 * - 点击选牌（由父组件根据当前操作决定是否可选）
 * - 单张卡片可自由拖动摆放；双击单张复位
 * - 「一键整理」按当前模式轮换排序（类型→点数 / 花色→点数 / 点数→花色 / 名称），
 *   带 FLIP 飞牌动画、扫光与合成整理音效；尊重 prefers-reduced-motion
 */
export default function HandZone({
  cards = [],
  selectedCards = [],
  recommendedKey = '',
  canSelect,
  dimDisabled = false,
  onToggleCard,
  hint = '',
  emptyText = '暂无手牌',
  onInfo,
}) {
  const [offsets, setOffsets] = useState({});
  const [sortMode, setSortMode] = useState(() => loadHandSortMode());
  const [animating, setAnimating] = useState(false);
  const [shining, setShining] = useState(false);
  const [flipTick, setFlipTick] = useState(0);
  const [dragId, setDragId] = useState(null);
  const [autoOverlap, setAutoOverlap] = useState(0);
  const drag = useRef(null);
  const cardsRef = useRef(null);
  const suppressClick = useRef(false);
  const suppressTimer = useRef(null);
  const api = useRef({});
  const wrapRefs = useRef(new Map());
  const flipRef = useRef(null);       // { rects } 待下一次 layout 生效的 FLIP 快照
  const flipTimer = useRef(null);     // FLIP 内联样式清理计时
  const animTimer = useRef(null);     // 按钮禁用/动画状态计时
  const shineTimer = useRef(null);    // 扫光移除计时

  const stableMove = useRef(null);
  const stableUp = useRef(null);
  if (!stableMove.current) stableMove.current = (e) => api.current.move(e);
  if (!stableUp.current) stableUp.current = () => api.current.up();

  api.current.move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.hypot(dx, dy) < HAND_DRAG_THRESHOLD) return;
    d.moved = true;
    if (e.cancelable) e.preventDefault();
    setOffsets(prev => ({ ...prev, [d.id]: { x: d.bx + dx, y: d.by + dy } }));
  };

  api.current.up = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    window.removeEventListener('pointermove', stableMove.current);
    window.removeEventListener('pointerup', stableUp.current);
    window.removeEventListener('pointercancel', stableUp.current);
    if (d.moved) {
      suppressClick.current = true;
      if (suppressTimer.current) clearTimeout(suppressTimer.current);
      suppressTimer.current = setTimeout(() => {
        suppressClick.current = false;
      }, 300);
    }
    setDragId(null);
  };

  const startDrag = (e, card) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (animating) return; // 飞牌动画期间不开始拖拽，避免与 FLIP 抢 transform
    e.stopPropagation(); // 不触发整块面板拖动
    const id = cardKey(card);
    drag.current = {
      id,
      x0: e.clientX,
      y0: e.clientY,
      bx: offsets[id]?.x || 0,
      by: offsets[id]?.y || 0,
      moved: false,
    };
    setDragId(id);
    window.addEventListener('pointermove', stableMove.current, { passive: false });
    window.addEventListener('pointerup', stableUp.current);
    window.addEventListener('pointercancel', stableUp.current);
  };

  // 手牌变化时，清理已不存在的手动位置
  const idsKey = cards.map(cardKey).join('|');
  useEffect(() => {
    const alive = new Set(cards.map(cardKey));
    setOffsets(prev => {
      let changed = false;
      const next = {};
      for (const key of Object.keys(prev)) {
        if (alive.has(key)) next[key] = prev[key];
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [idsKey]);

  // 排序模式持久化（刷新后保留）
  useEffect(() => {
    saveHandSortMode(sortMode);
  }, [sortMode]);

  // 统一布局复位：清除手动位置（保持当前排序模式）
  useEffect(() => {
    const handler = () => {
      setOffsets({});
    };
    window.addEventListener('cgm:reset-layout', handler);
    return () => window.removeEventListener('cgm:reset-layout', handler);
  }, []);

  // 卸载清理
  useEffect(() => () => {
    window.removeEventListener('pointermove', stableMove.current);
    window.removeEventListener('pointerup', stableUp.current);
    window.removeEventListener('pointercancel', stableUp.current);
    if (flipTimer.current) clearTimeout(flipTimer.current);
    if (shineTimer.current) clearTimeout(shineTimer.current);
    if (animTimer.current) clearTimeout(animTimer.current);
    if (suppressTimer.current) clearTimeout(suppressTimer.current);
  }, []);

  // FLIP：DOM 重排后计算旧/新位置差，先落到旧位置再过渡回新位置
  useLayoutEffect(() => {
    const pending = flipRef.current;
    if (!pending) return;
    flipRef.current = null;
    const { rects } = pending;
    const nodes = [];
    wrapRefs.current.forEach((wrap, id) => {
      const first = rects.get(id);
      const cardEl = wrap?.firstElementChild;
      if (!first || !wrap || !cardEl) return;
      const last = wrap.getBoundingClientRect();
      nodes.push({
        cardEl,
        dx: first.left - last.left,
        dy: first.top - last.top,
        index: Number(cardEl.dataset.flipIndex || 0),
      });
    });
    if (nodes.length === 0) return;
    nodes.forEach(({ cardEl, dx, dy }) => {
      cardEl.style.transition = 'none';
      cardEl.style.transform = `translate(${dx}px, ${dy}px) scale(1.06) rotate(${dx >= 0 ? 0.9 : -0.9}deg)`;
      cardEl.style.zIndex = '3';
    });
    // 强制一次回流，保证起始帧生效后再开启过渡（下一帧回落到自然位置）
    void document.body.offsetHeight;
    nodes.forEach(({ cardEl, index }) => {
      const delay = Math.min(index * HAND_FLIP_STAGGER, 96);
      cardEl.style.transition = `transform ${HAND_FLIP_DURATION}ms ${FLIP_EASING} ${delay}ms`;
      cardEl.style.transform = '';
    });
    if (flipTimer.current) clearTimeout(flipTimer.current);
    flipTimer.current = setTimeout(() => {
      nodes.forEach(({ cardEl }) => {
        cardEl.style.transition = '';
        cardEl.style.transform = '';
        cardEl.style.zIndex = '';
      });
    }, HAND_FLIP_DURATION + 140);
  }, [flipTick]);

  const displayCards = sortHandCards(cards, sortMode);
  const nextMode = nextHandSortMode(sortMode);

  // 手牌较多或屏幕较窄时，自动增加负间距，让整手牌尽量完整落在可视区域内。
  // 只改外层 wrap 的 margin，不动卡片自身 transform，避免干扰拖拽与 FLIP。
  useLayoutEffect(() => {
    const el = cardsRef.current;
    if (!el) return undefined;

    const measure = () => {
      const wraps = el.querySelectorAll('.hand-card-wrap');
      if (wraps.length < 2) {
        setAutoOverlap(prev => (prev === 0 ? prev : 0));
        return;
      }
      const styles = window.getComputedStyle(el);
      const gap = parseFloat(styles.columnGap || styles.gap) || 0;
      const baseOverlap = parseFloat(styles.getPropertyValue('--hand-overlap')) || 0;
      const cardWidth = wraps[0].offsetWidth || 0;
      // clientWidth 含左右 padding；手牌实际可占用宽度要扣掉 padding，
      // 否则最后一张会贴边甚至被 overflow 裁掉几像素。
      const padX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
      const available = Math.max(0, el.clientWidth - padX);
      if (!cardWidth || !available) return;
      const natural = wraps.length * cardWidth + (wraps.length - 1) * (gap + baseOverlap);
      const overflow = natural - available;
      if (overflow <= 4) {
        setAutoOverlap(prev => (prev === 0 ? prev : 0));
        return;
      }
      const needed = Math.ceil(overflow / (wraps.length - 1));
      // 最多叠到卡片宽度的 64%，再窄就交给横向滚动，避免完全看不清牌面。
      const cap = Math.round(cardWidth * 0.64);
      const next = -Math.min(needed, cap);
      setAutoOverlap(prev => (prev === next ? prev : next));
    };

    // 直接测量而不用 requestAnimationFrame：后台标签页/无头环境里 rAF 会被节流，
    // 会导致手牌第一次渲染时没有及时收拢。
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [displayCards.length, sortMode]);

  const arrange = () => {
    if (animating || cards.length === 0) return;
    const reduce = prefersReducedMotion();
    // 清理上一轮可能残留的 FLIP 内联样式计时，避免新旧动画互相覆盖
    if (flipTimer.current) {
      clearTimeout(flipTimer.current);
      flipTimer.current = null;
    }
    // 1) 先记录每张牌当前（可能被手动拖动过）的位置
    const rects = new Map();
    wrapRefs.current.forEach((wrap, id) => {
      const rect = wrap?.getBoundingClientRect?.();
      if (rect) rects.set(id, rect);
    });
    // 2) 切到下一排序模式并清除手动偏移（同一次 commit 完成 DOM 重排）
    setOffsets({});
    setSortMode(nextHandSortMode(sortMode));
    setAnimating(true);
    try {
      audio.playSfx('shuffle');
    } catch {
      // 音频未解锁/不可用时静默失败
    }
    if (reduce) {
      // 尊重减少动态效果：直接排序，不做位移动画与扫光
      if (animTimer.current) clearTimeout(animTimer.current);
      animTimer.current = setTimeout(() => setAnimating(false), 120);
      return;
    }
    flipRef.current = { rects };
    setFlipTick(t => t + 1);
    setShining(true);
    if (shineTimer.current) clearTimeout(shineTimer.current);
    shineTimer.current = setTimeout(() => setShining(false), 520);
    if (animTimer.current) clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => setAnimating(false), HAND_FLIP_DURATION + 140);
  };

  const resetCard = (card) => {
    const id = cardKey(card);
    setOffsets(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // 丝滑 tilt：pointermove 写入 --tilt-x / --tilt-y（拖拽 / FLIP / 手机 / reduced-motion 禁用）
  const resetTilt = (e) => {
    const el = e?.currentTarget;
    if (!el) return;
    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
  };
  const handleCardPointerMove = (e) => {
    const el = e.currentTarget;
    const enabled = shouldEnableCardTilt({
      pointerType: e.pointerType,
      reducedMotion: prefersReducedMotion(),
      dragging: !!dragId,
      flipping: animating || shining,
      width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    });
    if (!enabled) { resetTilt(e); return; }
    const rect = el.getBoundingClientRect();
    const tilt = computeCardTilt(e.clientX, e.clientY, rect, 4);
    el.style.setProperty('--tilt-x', `${tilt.x}deg`);
    el.style.setProperty('--tilt-y', `${tilt.y}deg`);
  };

  const sortTitle = `一键整理：当前按${handSortLabel(sortMode)}排序 · 下次点击按${handSortLabel(nextMode)} · 清除手动位置`;

  return (
    <div className={`hand-zone ${shining ? 'hand-shining' : ''}`}>
      {shining && <div className="hand-shine" key={`shine-${flipTick}`} aria-hidden="true" />}
      <div className="hand-toolbar">
        <span className="hand-title">你的手牌</span>
        <span className="hand-count-badge">{`手牌 ${cards.length}`}</span>
        <span
          className="hand-sort-badge"
          title={`当前：按${handSortLabel(sortMode)} · 下次点击：按${handSortLabel(nextMode)}`}>
          {`按${handSortLabel(sortMode)}`}
          <small>{`下次${handSortLabel(nextMode)}`}</small>
        </span>
        <span className="hand-hint">{hint}</span>
        <button
          className="btn btn-small hand-sort-btn"
          onClick={arrange}
          disabled={cards.length === 0 || animating}
          aria-busy={animating || undefined}
          title={sortTitle}>
          <Icon name="refresh" size={14} className={animating ? 'is-spinning' : ''} />
          <span>{animating ? '整理中…' : '一键整理'}</span>
        </button>
      </div>

      <div
        className="hand-cards"
        ref={cardsRef}
        style={{ '--hand-auto-overlap': `${autoOverlap}px` }}>
        {cards.length === 0 && <span className="empty-hand">{emptyText}</span>}
        {displayCards.map((card, index) => {
          const id = cardKey(card);
          const off = offsets[id];
          const selectable = canSelect ? canSelect(card) : false;
          const selected = selectedCards.some(c => cardKey(c) === id);
          const recommended = !!recommendedKey && recommendedKey === id;
          const info = getCardText(card.name);
          return (
            <div
              key={id}
              className={`hand-card-wrap ${selected ? 'selected-wrap' : ''}`}
              ref={(el) => {
                if (el) wrapRefs.current.set(id, el);
                else wrapRefs.current.delete(id);
              }}
              style={{
                transform: `translate(${off?.x || 0}px, ${off?.y || 0}px)`,
                zIndex: dragId === id ? 60 : (off ? 40 : 1),
              }}>
              <div
                className={`game-card hand-card ${card.suit} card-type-${card.type || 'basic'} ${selected ? 'selected' : ''} ${recommended ? 'recommended-card' : ''} `
                  + `${selectable ? 'selectable-card' : ''} `
                  + `${dimDisabled && !selectable ? 'disabled-card' : ''} `
                  + `${dragId === id ? 'dragging-card' : ''}`}
                style={{ '--breath-delay': `${(index % 8) * 0.36}s` }}
                data-flip-index={index}
                onPointerDown={(e) => { resetTilt(e); startDrag(e, card); }}
                onPointerMove={handleCardPointerMove}
                onPointerLeave={resetTilt}
                onClick={() => {
                  if (suppressClick.current) return;
                  if (!selectable) {
                    audio.playSfx('error');
                    return;
                  }
                  audio.playSfx('select');
                  onToggleCard?.(card);
                }}
                onContextMenu={onInfo
                  ? (e) => {
                    e.preventDefault();
                    onInfo({
                      title: `${card.name}`,
                      desc: info.detail || info.brief || '暂无说明',
                    }, e);
                  }
                  : undefined}
                onDoubleClick={() => resetCard(card)}>
                <CardFace card={card} info={info} onInfo={onInfo} />
                {recommended && <span className="hand-recommend-badge" aria-hidden="true">荐</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
