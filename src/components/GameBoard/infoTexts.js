/**
 * 状态说明文案：状态徽章 / 技能标签 / 牌面类型印共用
 */
export const STATUS_INFO = {
  jiu: {
    label: '酒',
    title: '酒 · 状态',
    desc: '本回合已使用【酒】：下一张【杀】伤害+1。打出【杀】后该状态消失；回合结束也会清除。',
  },
  dying: {
    label: '濒死',
    title: '濒死 · 状态',
    desc: '体力降至 0，正在等待【桃】救援；无人救起则阵亡。',
  },
  low: {
    label: '危险',
    title: '危险 · 低体力',
    desc: '体力仅剩 1 点，很容易被一次伤害击败，注意防御或回复。',
  },
  turned: {
    label: '翻面',
    title: '翻面 · 状态',
    desc: '回合被跳过：下一次轮到你时，会跳过你的整个回合。',
  },
  chained: {
    label: '横置',
    title: '横置 · 状态',
    desc: '处于横置（连环）状态：受到属性伤害时会传导给其他横置角色。',
  },
  kongcheng: {
    label: '空城',
    title: '空城 · 技能状态',
    desc: '诸葛亮锁定技：没有手牌时，不能成为【杀】和【决斗】的目标。',
  },
};

export const STATUS_KEYS = Object.keys(STATUS_INFO);

export function statusChipList(player = {}) {
  const chips = [];
  if (player.usedJiu) chips.push({ key: 'jiu' });
  if (player.status === 'dying') chips.push({ key: 'dying' });
  else if (player.hp <= 1 && player.status !== 'dead') chips.push({ key: 'low' });
  if (player.isTurnedOver) chips.push({ key: 'turned' });
  if (player.isLinked || player.isChained) chips.push({ key: 'chained' });
  const hasKongcheng = (player.skills || []).some(s => s.id === 'cls_kongcheng');
  if (hasKongcheng && player.handCardCount === 0) chips.push({ key: 'kongcheng' });
  return chips.map(({ key }) => ({ key, ...STATUS_INFO[key] }));
}
