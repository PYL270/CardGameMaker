/**
 * Card - 卡牌类
 * 每张牌有花色、点数、类型、名称等属性
 */
export const SUITS = ['spade', 'heart', 'club', 'diamond', 'sun', 'moon'];
export const SUIT_SYMBOLS = {
  spade: '♠', heart: '♥', club: '♣', diamond: '♦',
  sun: '☀', moon: '☾',
};
export const SUIT_COLORS = {
  spade: 'black', heart: 'red', club: 'black', diamond: 'red',
  sun: 'red', moon: 'black',
};
export const SUIT_NAMES = {
  spade: '黑桃', heart: '红桃', club: '梅花', diamond: '方块',
  sun: '日曜', moon: '月华',
};

export const CARD_TYPES = {
  BASIC: 'basic',       // 基本牌：杀、闪、桃
  TRICK: 'trick',       // 锦囊牌：决斗、南蛮、万箭等
  DELAY_TRICK: 'delay_trick', // 延时锦囊：乐不思蜀、兵粮寸断、闪电
  EQUIP: 'equip',       // 装备牌
};

export const EQUIP_SLOTS = {
  WEAPON: 'weapon',     // 武器
  ARMOR: 'armor',       // 防具
  HORSE_DEF: 'horse_def', // 防御马(+1)
  HORSE_ATK: 'horse_atk', // 进攻马(-1)
};

// 数字显示映射
const NUMBER_DISPLAY = {
  1: 'A', 11: 'J', 12: 'Q', 13: 'K',
};

let _cardIdCounter = 0;

export default class Card {
  /**
   * @param {object} config
   * @param {string} config.name - 牌名
   * @param {string} config.suit - 花色
   * @param {number} config.number - 点数(1-13)
   * @param {string} config.type - 类型(basic/trick/delay_trick/equip)
   * @param {string} config.subtype - 子类型(如 equip 的 slot)
   * @param {number} config.range - 武器攻击范围(仅武器)
   * @param {string} config.description - 描述
   * @param {Function} config.effect - 效果函数 async (game, source, targets) => {}
   * @param {object} config.ai - AI提示 { order, resultTarget }
   */
  constructor(config) {
    this.id = `card_${++_cardIdCounter}`;
    this.name = config.name || '未命名';
    this.suit = config.suit || 'spade';
    this.number = config.number || 1;
    this.type = config.type || CARD_TYPES.BASIC;
    this.subtype = config.subtype || '';
    this.range = config.range || 1;
    this.description = config.description || '';
    this.effect = config.effect || (async () => {});
    this.ai = config.ai || { order: 0, resultTarget: () => 0 };
    // 运行时状态
    this.owner = null;      // 当前持有者(Player)
    this.position = 'deck'; // deck / hand / equip / judge / discard
    this.isVirtual = false;  // 虚拟牌(技能产生的)
    this.glowColor = null;   // 高亮颜色
  }

  get suitSymbol() {
    return SUIT_SYMBOLS[this.suit] || '';
  }

  get suitColor() {
    return SUIT_COLORS[this.suit] || 'black';
  }

  get numberDisplay() {
    return NUMBER_DISPLAY[this.number] || String(this.number);
  }

  get isRed() {
    return this.suitColor === 'red';
  }

  get isBlack() {
    return this.suitColor === 'black';
  }

  get isBasic() { return this.type === CARD_TYPES.BASIC; }
  get isTrick() { return this.type === CARD_TYPES.TRICK; }
  get isDelayTrick() { return this.type === CARD_TYPES.DELAY_TRICK; }
  get isEquip() { return this.type === CARD_TYPES.EQUIP; }

  /**
   * 克隆这张牌(用于牌堆初始化)
   */
  clone() {
    return new Card({
      name: this.name,
      suit: this.suit,
      number: this.number,
      type: this.type,
      subtype: this.subtype,
      range: this.range,
      description: this.description,
      effect: this.effect,
      ai: this.ai,
    });
  }

  /**
   * 序列化为JSON(不含函数)
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      suit: this.suit,
      number: this.number,
      type: this.type,
      subtype: this.subtype,
      range: this.range,
      description: this.description,
      position: this.position,
    };
  }
}
