/**
 * 装备栏纯函数：固定槽位数、空槽占位、满槽替换选项。
 * 引擎契约：player.equipLimit / player.equipCards；旧数据回退 equips（对象）。
 */

export const DEFAULT_EQUIP_LIMIT = 3;
export const EQUIP_LIMIT_MIN = 1;
export const EQUIP_LIMIT_MAX = 6;

const EQUIP_TYPE_LABELS = {
  weapon: '武器',
  armor: '防具',
  horse: '坐骑',
  treasure: '宝物',
  equip: '装备',
};

export function normalizeEquipLimit(value, fallback = DEFAULT_EQUIP_LIMIT) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    const f = Number(fallback);
    return Number.isFinite(f) ? Math.min(EQUIP_LIMIT_MAX, Math.max(EQUIP_LIMIT_MIN, Math.round(f))) : DEFAULT_EQUIP_LIMIT;
  }
  return Math.min(EQUIP_LIMIT_MAX, Math.max(EQUIP_LIMIT_MIN, Math.round(n)));
}

export function equipTypeLabel(card) {
  const key = card?.subtype || card?.equipType || card?.type;
  if (key === 'horse_def') return '防御马';
  if (key === 'horse_atk') return '进攻马';
  return EQUIP_TYPE_LABELS[key] || EQUIP_TYPE_LABELS[card?.type] || '装备';
}

function slotKeyOf(card, index) {
  return card?.slotKey ?? card?.slot ?? card?.equipSlot ?? String(index);
}

/** 当前装备 → 有牌的槽位选项（数组/对象都兼容） */
export function equipChoiceEntries(current) {
  if (Array.isArray(current)) {
    return current
      .map((item, index) => {
        if (!item) return null;
        // 引擎契约：[{ slot, card }]；也兼容 [card]（旧/测试数据）
        if (item.card) {
          return { slotKey: item.slotKey ?? item.slot ?? item.equipSlot ?? String(index), card: item.card };
        }
        return { slotKey: slotKeyOf(item, index), card: item };
      })
      .filter(Boolean);
  }
  if (current && typeof current === 'object') {
    return Object.entries(current)
      .filter(([, card]) => card)
      .map(([slotKey, card]) => ({ slotKey, card }));
  }
  return [];
}

export function firstEquipSlot(current) {
  return equipChoiceEntries(current)[0]?.slotKey ?? null;
}

/** 渲染固定槽位框：equipLimit（回退 equipSlots/3）个，已用/上限计数 */
export function buildEquipSlots(player) {
  const limit = normalizeEquipLimit(player?.equipLimit ?? player?.equipSlots);
  const source = player?.equipCards ?? player?.equips ?? [];
  const entries = equipChoiceEntries(source);
  const count = Math.max(limit, Array.isArray(source) ? source.length : 0, entries.length);
  const slots = Array.from({ length: count }, (_, index) => {
    const filled = entries[index] || null;
    return {
      slotKey: filled?.slotKey || `empty-${index}`,
      card: filled?.card || null,
      index,
    };
  });
  return {
    limit,
    count,
    used: entries.length,
    slots,
    title: `装备 (${entries.length}/${limit})`,
  };
}
