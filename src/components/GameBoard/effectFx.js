/**
 * 演出特效管线纯函数：引擎 ui effect → fx 描述 / 队列 / URL 预览参数。
 * 全部防御性读取，未知事件返回 null，不抛错。
 */

export const FX_KINDS = ['execution', 'dying', 'judge', 'heal', 'thunder'];

const DEFAULT_DURATION = {
  execution: 1400,
  dying: 2000,
  judge: 1900,
  heal: 1100,
  thunder: 420,
};

const FALLBACK_CARD = {
  spade: '♠', club: '♣', heart: '♥', diamond: '♦', sun: '☀', moon: '☾',
};

function nameOf(entity, fallback = '') {
  if (!entity) return fallback;
  if (typeof entity === 'string') return entity;
  return entity.name || fallback;
}

function cardOf(card) {
  if (!card || typeof card !== 'object') return null;
  const suit = card.suit || 'spade';
  return {
    name: card.name || '判定牌',
    suit,
    suitSymbol: FALLBACK_CARD[suit] || '♠',
    numberDisplay: card.numberDisplay || (card.number !== undefined ? String(card.number) : '?'),
    isRed: card.isRed === true || suit === 'heart' || suit === 'diamond',
  };
}

/**
 * 引擎 effect → fx 描述；非演出类返回 null。
 * 支持：death / dying / judge / heal / thunder（damage.nature==='thunder'）。
 */
export function mapEffectToFx(effect) {
  if (!effect || typeof effect !== 'object') return null;
  const type = effect.type;
  const player = effect.player || effect.target || null;
  const playerName = nameOf(player, effect.playerName || '');
  const sourceName = nameOf(effect.source, effect.sourceName || '');
  const id = effect.id || `${type || 'fx'}-${Date.now()}`;

  if (type === 'death') {
    const reason = effect.reason || '';
    const victimEntity = effect.victim || player || null;
    const victimCharacter = (victimEntity && victimEntity.character)
      || effect.character || effect.victimCharacter || null;
    const victimImage = effect.victimImage
      || (victimCharacter && victimCharacter.imageUrl)
      || (victimEntity && victimEntity.imageUrl)
      || '';
    const victimHp = Number.isFinite(Number(effect.victimHp ?? (victimEntity && victimEntity.hp)))
      ? Number(effect.victimHp ?? victimEntity.hp)
      : null;
    const victimGroup = effect.victimGroup
      || (victimCharacter && victimCharacter.group)
      || (victimEntity && victimEntity.group)
      || '';
    return {
      kind: 'execution',
      id: `exec-${id}`,
      victim: playerName || '未知角色',
      victimImage,
      victimHp,
      victimGroup,
      source: sourceName,
      reason,
      text: effect.text || ((sourceName || reason === 'execution') ? '斩' : '阵亡'),
      duration: DEFAULT_DURATION.execution,
    };
  }
  if (type === 'dying') {
    return {
      kind: 'dying',
      id: `dying-${id}`,
      player: playerName || '未知角色',
      source: sourceName,
      duration: DEFAULT_DURATION.dying,
    };
  }
  if (type === 'judge') {
    const success = effect.success !== false;
    return {
      kind: 'judge',
      id: `judge-${id}`,
      player: playerName,
      card: cardOf(effect.card),
      delayCard: effect.delayCard?.name || effect.delayCardName || '',
      success,
      text: success ? '判定生效' : '判定不中',
      duration: DEFAULT_DURATION.judge,
    };
  }
  if (type === 'heal') {
    const num = Number(effect.num);
    return {
      kind: 'heal',
      id: `heal-${id}`,
      player: playerName || '未知角色',
      num: Number.isFinite(num) && num > 0 ? num : 1,
      duration: DEFAULT_DURATION.heal,
    };
  }
  const isThunder = type === 'thunder'
    || (type === 'damage' && (
      effect.nature === 'thunder'
      || effect.damageType === 'thunder'
      || effect.element === 'thunder'
      || effect.card?.name === '闪电'
      || effect.cardName === '闪电'
    ));
  if (isThunder) {
    return {
      kind: 'thunder',
      id: `thunder-${id}`,
      player: playerName || '',
      duration: DEFAULT_DURATION.thunder,
    };
  }
  return null;
}

/** 入队：最多保留 max 个待播；heal/execution 会关闭濒死脉搏 */
export function enqueueFx(queue, fx, max = 3) {
  const list = Array.isArray(queue) ? queue : [];
  if (!fx || !fx.kind) return list;
  let next = list;
  if ((fx.kind === 'heal' || fx.kind === 'execution') && next.some(item => item.kind === 'dying')) {
    next = next.filter(item => item.kind !== 'dying');
  }
  const appended = [...next, fx];
  return appended.length > max ? appended.slice(appended.length - max) : appended;
}

/** 出队：播放完当前特效后移除队首 */
export function shiftFx(queue) {
  return Array.isArray(queue) && queue.length ? queue.slice(1) : [];
}

export function fxDuration(fx) {
  const d = Number(fx?.duration);
  if (Number.isFinite(d) && d > 0) return d;
  return DEFAULT_DURATION[fx?.kind] || 1000;
}

/** 解析 ?fx=execution|dying|judge|heal|thunder（可带 name/source） */
export function parseFxPreview(search) {
  const raw = typeof search === 'string' ? search : '';
  let params;
  try {
    params = new URLSearchParams(raw.replace(/^\?/, ''));
  } catch {
    return null;
  }
  const kind = (params.get('fx') || '').trim().toLowerCase();
  if (!FX_KINDS.includes(kind)) return null;
  return {
    kind,
    name: params.get('name') || '',
    source: params.get('source') || '',
  };
}

/** 预览参数 → fx 描述（供 App 全局播放一次） */
export function buildPreviewFx({ kind, name = '', source = '' } = {}) {
  if (!FX_KINDS.includes(kind)) return null;
  const player = name || '测试武将';
  const from = source || '测试来源';
  const base = { id: `preview-${kind}` };
  switch (kind) {
    case 'execution':
      return { ...base, kind, victim: player, source: from, text: source === '阵亡' ? '阵亡' : '斩', duration: DEFAULT_DURATION.execution };
    case 'dying':
      return { ...base, kind, player, source: from, duration: DEFAULT_DURATION.dying };
    case 'judge':
      return {
        ...base,
        kind,
        player,
        card: { name: '闪电', suit: 'spade', suitSymbol: '♠', numberDisplay: 'A', isRed: false },
        delayCard: '闪电',
        success: source !== 'fail',
        text: source !== 'fail' ? '判定生效' : '判定不中',
        duration: DEFAULT_DURATION.judge,
      };
    case 'heal':
      return { ...base, kind, player, num: 2, duration: DEFAULT_DURATION.heal };
    case 'thunder':
      return { ...base, kind, player, duration: DEFAULT_DURATION.thunder };
    default:
      return null;
  }
}
