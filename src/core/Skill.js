/**
 * Skill - 技能系统
 * 定义技能的结构和注册机制
 * 技能三段式: filter → cost → content
 */

export const SKILL_TYPES = {
  ACTIVE: 'active',       // 主动技(出牌阶段发动)
  TRIGGER: 'trigger',     // 触发技(满足条件自动触发)
  LOCKED: 'locked',       // 锁定技(始终生效)
  LIMITED: 'limited',     // 限定技(每局一次)
  AWAKENING: 'awakening', // 觉醒技
  EPIC: 'epic',           // 史诗技
  MASTER: 'master',       // 主公技
};

export const TRIGGER_TIMINGS = {
  // 回合相关
  ROUND_START: 'roundStart',
  ROUND_END: 'roundEnd',
  PHASE_BEGIN: 'phaseBegin',
  PHASE_END: 'phaseEnd',
  PHASE_JUDGE_BEGIN: 'phaseJudgeBegin',
  PHASE_JUDGE_END: 'phaseJudgeEnd',
  PHASE_DRAW_BEGIN2: 'phaseDrawBegin2',
  PHASE_DRAW_END: 'phaseDrawEnd',
  PHASE_USE_BEGIN: 'phaseUseBegin',
  PHASE_USE_END: 'phaseUseEnd',
  PHASE_DISCARD_BEGIN: 'phaseDiscardBegin',
  PHASE_DISCARD_END: 'phaseDiscardEnd',
  // 卡牌相关
  USE_CARD: 'useCard',
  RESPOND_CARD: 'respondCard',
  DISCARD_CARD: 'discardCard',
  LOSE_CARD: 'loseCard',
  GAIN_CARD: 'gainCard',
  // 伤害相关
  DAMAGE_BEGIN: 'damageBegin',
  DAMAGE_END: 'damageEnd',
  DAMAGED: 'damaged',
  RECOVER: 'recover',
  // 濒死/死亡
  DYING: 'dying',
  // 死亡相关
  DIE: 'die',
  DIE_AFTER: 'dieAfter',
  // 其他
  EQUIP: 'equip',
  UNEQUIP: 'unequip',
  JUDGE: 'judge',
};

let _skillIdCounter = 0;

export default class Skill {
  /**
   * @param {object} config
   * @param {string} config.id - 内部ID
   * @param {string} config.name - 显示名
   * @param {string} config.type - 技能类型
   * @param {string} config.description - 描述
   * @param {string} config.triggerTiming - 触发时机(触发技必填)
   * @param {string} config.triggerSource - 触发源 'player'/'global'/'target'
   * @param {number} config.usable - 每回合可用次数(0=不限)
   * @param {boolean} config.forced - 是否锁定
   * @param {Function} config.filter - 能否发动 (event, player) => boolean
   * @param {Function} config.cost - 发动代价 async (event, trigger, player) => void
   * @param {Function} config.content - 技能效果 async (event, trigger, player) => void
   * @param {object} config.ai - AI提示
   */
  constructor(config) {
    this.id = config.id || `skill_${++_skillIdCounter}`;
    this.name = config.name || '未命名技能';
    this.type = config.type || SKILL_TYPES.TRIGGER;
    this.description = config.description || '';
    this.triggerTiming = config.triggerTiming || '';
    this.triggerSource = config.triggerSource || 'player';
    this.usable = config.usable ?? 1;
    this.forced = config.forced ?? false;
    this.filter = config.filter || (() => true);
    this.cost = config.cost || (async () => {});
    this.content = config.content || (async () => {});
    this.ai = config.ai || {
      order: 0,
      result: { player: 0, target: () => 0 },
      check: () => true,
    };
    // 编辑器代码文本(用于回填编辑，运行时不使用)
    this.filterCode = config.filterCode || '';
    this.costCode = config.costCode || '';
    this.contentCode = config.contentCode || '';
    this.aiCheckCode = config.aiCheckCode || '';
    // 运行时
    this.usedCount = 0;     // 本回合已用次数
    this.isDisabled = false; // 是否被禁用
  }

  /**
   * 判断技能是否可以在当前回合发动
   */
  canUse(event, player) {
    if (this.isDisabled) return false;
    if (this.usable > 0 && this.usedCount >= this.usable) return false;
    try {
      return this.filter(event, player);
    } catch {
      return false;
    }
  }

  /**
   * 重置回合使用次数
   */
  resetUsage() {
    this.usedCount = 0;
  }

  /**
   * 用编辑器保存的代码文本重新编译技能函数
   * 用于从 JSON 恢复技能时还原逻辑
   */
  applyCode() {
    const compile = (code, isAsync) => {
      if (!code) return null;
      try {
        return isAsync
          ? new Function('event', 'trigger', 'player', `return (async () => { ${code} })()`)
          : new Function('event', 'player', code);
      } catch {
        return null;
      }
    };
    const filter = compile(this.filterCode, false);
    if (filter) this.filter = filter;
    const cost = compile(this.costCode, true);
    if (cost) this.cost = cost;
    const content = compile(this.contentCode, true);
    if (content) this.content = content;
    const check = compile(this.aiCheckCode, false);
    if (check) this.ai = { ...this.ai, check };
  }

  /** 序列化(不含函数，但保留代码文本以便还原) */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      description: this.description,
      triggerTiming: this.triggerTiming,
      triggerSource: this.triggerSource,
      usable: this.usable,
      forced: this.forced,
      filterCode: this.filterCode,
      costCode: this.costCode,
      contentCode: this.contentCode,
      aiCheckCode: this.aiCheckCode,
    };
  }
}
