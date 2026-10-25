/**
 * CC0 音效目录（纯数据，供 audioManager / AudioSettings / audio-check 共用）。
 * 采样文件位于 public/audio/sfx/<category>/，授权见 public/audio/SFX_CREDITS.md。
 */

export const SFX_CATEGORIES = [
  { id: 'ui', label: '界面交互', desc: '按钮 / 选牌 / 错误' },
  { id: 'card', label: '卡牌操作', desc: '出牌 / 摸牌 / 洗牌 / 装备 / 锦囊 / 弃牌 / 桃' },
  { id: 'combat', label: '战斗打击', desc: '杀 / 闪 / 伤害 / 处决 / 濒死' },
  { id: 'state', label: '战局状态', desc: '回合 / 判定 / 回复 / 胜负' },
];

export const SFX_SLOTS = [
  // 界面交互
  { key: 'sfx:click', label: '点击', category: 'ui', sample: '/audio/sfx/ui/click.ogg' },
  { key: 'sfx:select', label: '选牌 / 选目标', category: 'ui', sample: '/audio/sfx/ui/select.ogg' },
  { key: 'sfx:error', label: '无效操作', category: 'ui', sample: '/audio/sfx/ui/error.ogg' },
  // 卡牌操作
  { key: 'sfx:card', label: '出牌（通用）', category: 'card', sample: '/audio/sfx/card/card.ogg' },
  { key: 'sfx:draw', label: '摸牌', category: 'card', sample: '/audio/sfx/card/draw.ogg' },
  { key: 'sfx:shuffle', label: '整理手牌（洗牌）', category: 'card', sample: '/audio/sfx/card/shuffle.wav' },
  { key: 'sfx:equip', label: '装备', category: 'card', sample: '/audio/sfx/card/equip.ogg' },
  { key: 'sfx:trick', label: '使用锦囊', category: 'card', sample: '/audio/sfx/card/trick.ogg' },
  { key: 'sfx:discard', label: '弃牌', category: 'card', sample: '/audio/sfx/card/discard.ogg' },
  { key: 'sfx:tao', label: '使用【桃】', category: 'card', sample: '/audio/sfx/card/tao.ogg' },
  // 战斗打击
  { key: 'sfx:sha', label: '出【杀】', category: 'combat', sample: '/audio/sfx/combat/sha.ogg' },
  { key: 'sfx:shan', label: '出【闪】', category: 'combat', sample: '/audio/sfx/combat/shan.ogg' },
  { key: 'sfx:damage', label: '受到伤害', category: 'combat', sample: '/audio/sfx/combat/damage.ogg' },
  { key: 'sfx:kill', label: '处决 / 阵亡', category: 'combat', sample: '/audio/sfx/combat/kill.ogg' },
  { key: 'sfx:dying', label: '濒死心跳', category: 'combat', sample: '/audio/sfx/combat/dying.wav' },
  // 战局状态
  { key: 'sfx:turn', label: '回合开始', category: 'state', sample: '/audio/sfx/state/turn.ogg' },
  { key: 'sfx:judge', label: '判定揭示', category: 'state', sample: '/audio/sfx/state/judge.ogg' },
  { key: 'sfx:heal', label: '回复', category: 'state', sample: '/audio/sfx/state/heal.wav' },
  { key: 'sfx:win', label: '胜利', category: 'state', sample: '/audio/sfx/state/win.wav' },
  { key: 'sfx:lose', label: '失败', category: 'state', sample: '/audio/sfx/state/lose.wav' },
];

/** slotKey -> 内置 CC0 采样 URL */
export const BUILTIN_SFX = Object.fromEntries(
  SFX_SLOTS.filter(slot => slot.sample).map(slot => [slot.key, slot.sample]),
);

/**
 * 音效时长/响度校准：maxDuration 与对应动画/交互时长对齐，避免音效拖尾；
 * gain 用于把不同来源的采样响度拉平（相对音量，最终仍乘主/音效音量）。
 * 只对内置采样生效，自定义上传文件保持原样。
 */
export const SFX_TUNING = {
  'sfx:click': { maxDuration: 0.12, gain: 1.4 },
  'sfx:select': { maxDuration: 0.25, gain: 0.8 },
  'sfx:error': { maxDuration: 0.18, gain: 0.8 },
  'sfx:card': { maxDuration: 0.45, gain: 0.7 },
  'sfx:draw': { maxDuration: 0.35, gain: 0.85 },
  'sfx:shuffle': { maxDuration: 0.44, gain: 1.1 },
  'sfx:equip': { maxDuration: 0.22, gain: 0.65 },
  'sfx:trick': { maxDuration: 0.35, gain: 0.9 },
  'sfx:discard': { maxDuration: 0.45, gain: 1.1 },
  'sfx:tao': { maxDuration: 0.4, gain: 0.8 },
  'sfx:sha': { maxDuration: 0.4, gain: 0.8 },
  'sfx:shan': { maxDuration: 0.3, gain: 1.3 },
  'sfx:damage': { maxDuration: 0.35, gain: 0.65 },
  'sfx:kill': { maxDuration: 0.7, gain: 0.8 },
  'sfx:dying': { maxDuration: 1.5, gain: 0.75 },
  'sfx:turn': { maxDuration: 0.55, gain: 0.75 },
  'sfx:judge': { maxDuration: 0.55, gain: 1.1 },
  'sfx:heal': { maxDuration: 0.6, gain: 0.85 },
  'sfx:win': { maxDuration: 1.9, gain: 0.8 },
  'sfx:lose': { maxDuration: 2.0, gain: 0.8 },
};

export function getSfxTuning(slotKey) {
  return SFX_TUNING[slotKey] || { maxDuration: 0, gain: 1 };
}
