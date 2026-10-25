/**
 * 手牌 3D 倾斜纯函数（丝滑 tilt）。
 * 返回 CSS 变量用角度：x = rotateY（左右），y = rotateX（上下）。
 * - 指针在牌中心 → 0
 * - 指针到边缘 → ±maxDeg
 * - 斜对角按比例限幅（不会超过 maxDeg）
 * - 非法输入/宽高为 0 → {x:0,y:0}
 */
export const CARD_TILT_MAX_DEG = 4;

export function computeCardTilt(px, py, rect, maxDeg = CARD_TILT_MAX_DEG) {
  const zero = { x: 0, y: 0 };
  if (!rect) return zero;
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return zero;
  if (!Number.isFinite(Number(px)) || !Number.isFinite(Number(py))) return zero;
  const max = Math.min(12, Math.max(0, Number.isFinite(Number(maxDeg)) ? Number(maxDeg) : CARD_TILT_MAX_DEG));
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  const nx = clamp(((Number(px) - Number(rect.left || 0)) / width) * 2 - 1);
  const ny = clamp(((Number(py) - Number(rect.top || 0)) / height) * 2 - 1);
  const round = (v) => Math.round(v * 100) / 100;
  return { x: round(nx * max), y: round(-ny * max) };
}

/**
 * 是否启用手牌 tilt：
 * - 触摸/手机窄屏不启用（避免误触与性能问题）
 * - 拖拽/FLIP/整理动画期间禁用
 * - prefers-reduced-motion 禁用
 */
export function shouldEnableCardTilt({
  pointerType = 'mouse',
  reducedMotion = false,
  dragging = false,
  flipping = false,
  width = 1440,
} = {}) {
  if (pointerType === 'touch' || pointerType === 'pen') return false;
  if (reducedMotion) return false;
  if (dragging || flipping) return false;
  const w = Number(width);
  if (Number.isFinite(w) && w > 0 && w <= 720) return false;
  return true;
}
