/**
 * 出牌桌面展示 / 弃牌特效的纯函数（防御性读取引擎事件，未知返回 null）。
 */

const MAX_DISCARD_CARDS = 3;

function nameOf(entity, fallback = '') {
  if (!entity) return fallback;
  if (typeof entity === 'string') return entity;
  return entity.name || fallback;
}

function normalizeCard(card) {
  if (!card || typeof card !== 'object') return null;
  const name = card.name || card.cardName || '';
  if (!name) return null;
  const suit = card.suit || 'spade';
  return {
    name,
    suit,
    suitSymbol: card.suitSymbol || { spade: '♠', club: '♣', heart: '♥', diamond: '♦', sun: '☀', moon: '☾' }[suit] || '🂠',
    numberDisplay: card.numberDisplay || (card.number !== undefined ? String(card.number) : ''),
    isRed: card.isRed === true || suit === 'heart' || suit === 'diamond',
    type: card.type || 'basic',
  };
}

/** 出牌事件 → 桌面展示卡片；无 card 数据（技能/武器）返回 null */
export function mapTableCardEffect(effect) {
  if (!effect || typeof effect !== 'object' || effect.type !== 'card') return null;
  const card = normalizeCard(effect.card || (effect.cardName ? { name: effect.cardName } : null));
  if (!card) return null;
  const playerName = nameOf(effect.player, effect.playerName || '') || '玩家';
  const targetName = nameOf(effect.target, effect.targetName || '')
    || nameOf(Array.isArray(effect.targets) ? effect.targets[0] : null, '');
  const id = effect.id || effect.effectId || `table-${Date.now()}`;
  return { id: `table-${id}`, card, playerName, targetName, duration: 1500 };
}

/** discard 事件 → 弃牌特效描述；cards 为空/未知事件返回 null */
export function mapDiscardEffect(effect) {
  if (!effect || typeof effect !== 'object' || effect.type !== 'discard') return null;
  const rawCards = Array.isArray(effect.cards)
    ? effect.cards
    : (effect.card ? [effect.card] : []);
  const cards = rawCards
    .map(normalizeCard)
    .filter(Boolean)
    .slice(0, MAX_DISCARD_CARDS);
  if (cards.length === 0) return null;
  const playerName = nameOf(effect.player, effect.playerName || '') || '玩家';
  const id = effect.id || effect.effectId || `discard-${Date.now()}`;
  return {
    id: `discard-${id}`,
    playerName,
    cards,
    count: cards.length,
    reason: String(effect.reason || ''),
    duration: 1100,
  };
}

/** 弃牌队列：连续事件排队，最多保留 max 个待播 */
export function enqueueDiscard(queue, fx, max = 3) {
  const list = Array.isArray(queue) ? queue : [];
  if (!fx || !fx.cards || fx.cards.length === 0) return list;
  const appended = [...list, fx];
  return appended.length > max ? appended.slice(appended.length - max) : appended;
}

export function shiftDiscard(queue) {
  return Array.isArray(queue) && queue.length ? queue.slice(1) : [];
}

/** 减少动态效果时只保留信息，不做飞散 */
export function discardMotionEnabled(scope = globalThis) {
  try {
    return !(scope && typeof scope.matchMedia === 'function'
      && scope.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return true;
  }
}
