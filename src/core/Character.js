/**
 * Character - 武将定义
 * 武将包含属性、技能列表等
 */

export const GROUPS = {
  WEI: 'wei',    // 魏
  SHU: 'shu',    // 蜀
  WU: 'wu',      // 吴
  QUN: 'qun',    // 群
  JIN: 'jin',    // 晋
  SHEN: 'shen',  // 神
  CUSTOM: 'custom', // 自定义
};

export const GROUP_NAMES = {
  wei: '魏', shu: '蜀', wu: '吴', qun: '群', jin: '晋', shen: '神', custom: '自定义',
};

export const GROUP_COLORS = {
  wei: '#58708c', shu: '#5f7a58', wu: '#8c5a4e', qun: '#6f6a5e',
  jin: '#7a6586', shen: '#a8864a', custom: '#8a7350',
};

export const SEX = { MALE: 'male', FEMALE: 'female', OTHER: 'other' };

let _charIdCounter = 0;

export default class Character {
  /**
   * @param {object} config
   * @param {string} config.id - 内部ID
   * @param {string} config.name - 显示名
   * @param {string} config.sex - 性别
   * @param {string} config.group - 势力
   * @param {number} config.hp - 体力值
   * @param {number} config.maxHp - 最大体力值
   * @param {string[]} config.skillIds - 技能ID列表
   * @param {string} config.description - 描述
   * @param {string} config.imageUrl - 立绘图片路径
   */
  constructor(config) {
    this.id = config.id || `char_${++_charIdCounter}`;
    this.name = config.name || '未命名武将';
    this.sex = config.sex || SEX.MALE;
    this.group = config.group || GROUPS.CUSTOM;
    this.hp = config.hp ?? 3;
    this.maxHp = config.maxHp ?? config.hp ?? 3;
    this.skillIds = config.skillIds || [];
    this.description = config.description || '';
    this.imageUrl = config.imageUrl || '';
    // 装备栏数量：默认 3，范围 1~6（旧存档/旧自定义武将无该字段时回退 3）
    this.equipSlots = Character.normalizeEquipSlots(config.equipSlots);
    // 扩展字段(用户自定义)
    this.tags = config.tags || [];
    this.customData = config.customData || {};
  }

  /** 把 equipSlots 规范化为 1~6 的整数，非法/缺省回退 3 */
  static normalizeEquipSlots(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 3;
    return Math.min(6, Math.max(1, Math.floor(n)));
  }

  get groupName() { return GROUP_NAMES[this.group] || this.group; }
  get groupColor() { return GROUP_COLORS[this.group] || '#999'; }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      sex: this.sex,
      group: this.group,
      hp: this.hp,
      maxHp: this.maxHp,
      skillIds: this.skillIds,
      description: this.description,
      imageUrl: this.imageUrl,
      equipSlots: this.equipSlots,
      tags: this.tags,
      customData: this.customData,
    };
  }
}
