/**
 * 技能类型模型：主动 / 触发 / 锁定
 * 供 SkillComposer、SkillEditor、对局角色卡共用；纯函数可测。
 */

export const SKILL_TYPE_META = {
  active: {
    key: 'active',
    label: '主动',
    full: '主动技',
    behavior: '出牌阶段点按钮主动发动；不会自动触发。',
    title: '主动技：出牌阶段可发动，点击查看技能说明',
    activateHint: '出牌阶段可发动',
    passive: false,
    forced: false,
  },
  trigger: {
    key: 'trigger',
    label: '触发',
    full: '触发技',
    behavior: '满足触发时机时被动触发；未锁定会询问是否发动。',
    title: '触发技：满足时机时被动触发，点击查看技能说明',
    activateHint: '',
    passive: true,
    forced: false,
  },
  locked: {
    key: 'locked',
    label: '锁定',
    full: '锁定技',
    behavior: '满足条件自动生效，不询问、不可主动点击。',
    title: '锁定技：自动生效不询问，点击查看技能说明',
    activateHint: '',
    passive: true,
    forced: true,
  },
  limited: {
    key: 'limited',
    label: '限定',
    full: '限定技',
    behavior: '每局只能发动一次，需要玩家主动选择时机。',
    title: '限定技：每局一次，点击查看技能说明',
    activateHint: '每局一次',
    passive: false,
    forced: false,
  },
  awakening: {
    key: 'awakening',
    label: '觉醒',
    full: '觉醒技',
    behavior: '满足觉醒条件后自动生效并改变武将状态。',
    title: '觉醒技：满足条件后觉醒，点击查看技能说明',
    activateHint: '',
    passive: true,
    forced: false,
  },
  mission: {
    key: 'mission',
    label: '使命',
    full: '使命技',
    behavior: '围绕使命目标生效；完成或失败后可能转化。',
    title: '使命技：完成/失败使命，点击查看技能说明',
    activateHint: '',
    passive: true,
    forced: false,
  },
  transform: {
    key: 'transform',
    label: '转换',
    full: '转换技',
    behavior: '可在两种状态间转换，按当前状态生效。',
    title: '转换技：状态轮换生效，点击查看技能说明',
    activateHint: '',
    passive: true,
    forced: false,
  },
};

const FALLBACK_META = {
  key: 'other',
  label: '技能',
  full: '技能',
  behavior: '特殊类型技能。',
  title: '点击查看技能说明',
  activateHint: '',
  passive: true,
  forced: false,
};

export function skillTypeMeta(type) {
  return SKILL_TYPE_META[type] || FALLBACK_META;
}

/** 由 skill 对象（或序列化快照）推断展示信息 */
export function skillTypeInfo(skill) {
  const type = skill?.type || 'trigger';
  const meta = skillTypeMeta(type);
  return {
    key: meta.key,
    label: meta.label,
    full: meta.full,
    behavior: meta.behavior,
    title: meta.title,
    activateHint: meta.activateHint,
    passive: meta.passive,
    canActivate: type === 'active' && !skill?.triggerTiming,
    type,
  };
}

/** 触发时机 → 默认类型：出牌阶段开始是主动技，其它均为触发技 */
export function typeForTrigger(trigger) {
  return trigger === 'phaseUseBegin' ? 'active' : 'trigger';
}

/** 拼装器：选择触发时机时联动类型（手动选择的 locked 保持锁定） */
export function applyComposerTriggerChange(form, trigger) {
  const base = { ...(form || {}) };
  const next = applyComposerTypeChange(base, typeForTrigger(trigger));
  return {
    ...next,
    trigger,
    type: base.type === 'locked' ? 'locked' : next.type,
    forced: base.type === 'locked' ? true : next.forced,
  };
}

/** 拼装器：手动切换类型时补齐/清理字段 */
export function applyComposerTypeChange(form, nextType) {
  const b = { ...(form || {}) };
  const type = nextType || b.type;
  let trigger = b.trigger || 'phaseUseBegin';
  let forced = !!b.forced;
  if (type === 'active') {
    trigger = 'phaseUseBegin';
    forced = false;
  } else if (type === 'locked') {
    forced = true;
    if (!trigger || trigger === 'phaseUseBegin') trigger = 'damaged';
  } else if (type === 'trigger') {
    forced = false;
    if (!trigger || trigger === 'phaseUseBegin') trigger = 'damaged';
  }
  return { ...b, type, trigger, forced };
}

/**
 * 拼装器表单归一化（导出供测试/预览）：
 * - phaseUseBegin → active（locked 除外）
 * - 其它时机 → trigger（locked 保持 locked）
 * - active 强制 phaseUseBegin + forced=false
 * - locked forced=true
 */
export function normalizeComposerSkill(form) {
  const b = { ...(form || {}) };
  let type = b.type || typeForTrigger(b.trigger);
  let trigger = b.trigger || 'phaseUseBegin';
  let forced = !!b.forced;

  if (type === 'active') {
    trigger = 'phaseUseBegin';
    forced = false;
  } else if (type === 'locked') {
    forced = true;
  } else {
    // trigger 或未知类型：按触发时机修正
    if (trigger === 'phaseUseBegin') trigger = 'damaged';
    if (!b.type) type = typeForTrigger(trigger);
  }
  return { ...b, type, trigger, forced };
}

/** SkillEditor 表单：切换技能类型时清理/补齐字段（triggerTiming 字段名） */
export function normalizeEditorSkillType(form, nextType) {
  const f = { ...(form || {}) };
  const composer = applyComposerTypeChange({
    trigger: f.triggerTiming || 'phaseUseBegin',
    type: f.type,
    forced: f.forced,
  }, nextType);
  const type = composer.type;
  const forced = type === 'locked' ? true : (type === 'active' ? false : !!composer.forced);
  return {
    ...f,
    type,
    triggerTiming: type === 'active' ? '' : (composer.trigger || 'damaged'),
    forced,
  };
}
