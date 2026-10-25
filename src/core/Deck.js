/**
 * Deck - 牌堆系统
 * 管理洗牌、摸牌、弃牌堆等
 */
import Card from './Card';

/** 可复现的伪随机数生成器（种子牌堆） */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default class Deck {
  constructor() {
    this.cardPile = [];      // 牌堆(未摸)
    this.discardPile = [];   // 弃牌堆
    this.initialCards = [];  // 初始牌定义(用于重置)
    this.seed = null;        // 牌堆种子
    this._rng = Math.random; // 当前随机源
  }

  /**
   * 初始化牌堆
   * @param {Card[]} cardDefs - 牌定义列表(会被克隆)
   * @param {number|null} seed - 牌堆种子；相同种子得到相同牌序
   */
  init(cardDefs, seed = null) {
    this.initialCards = cardDefs;
    this.seed = Number.isFinite(Number(seed)) && seed !== null && seed !== ''
      ? Number(seed)
      : Math.floor(Math.random() * 900000) + 100000;
    this._rng = mulberry32(this.seed);
    this.cardPile = cardDefs.map(c => c.clone());
    this.discardPile = [];
    this.shuffle();
  }

  /**
   * 洗牌(Fisher-Yates)，使用种子随机源
   */
  shuffle() {
    for (let i = this.cardPile.length - 1; i > 0; i--) {
      const j = Math.floor(this._rng() * (i + 1));
      [this.cardPile[i], this.cardPile[j]] = [this.cardPile[j], this.cardPile[i]];
    }
  }

  /**
   * 摸牌
   * @param {number} count - 摸牌数
   * @returns {Card[]}
   */
  draw(count = 1) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (this.cardPile.length === 0) {
        this.reshuffle();
        if (this.cardPile.length === 0) break; // 无牌可摸
      }
      const card = this.cardPile.pop();
      drawn.push(card);
    }
    return drawn;
  }

  /**
   * 弃牌堆洗入牌堆(牌堆耗尽时)
   */
  reshuffle() {
    if (this.discardPile.length === 0) return;
    this.cardPile = [...this.discardPile];
    this.discardPile = [];
    this.shuffle();
  }

  /**
   * 弃牌
   */
  discard(cards) {
    cards.forEach(c => { c.position = 'discard'; c.owner = null; });
    this.discardPile.push(...cards);
  }

  /**
   * 将特定牌放入弃牌堆
   */
  discardOne(card) {
    card.position = 'discard';
    card.owner = null;
    this.discardPile.push(card);
  }

  /**
   * 获取牌堆剩余数
   */
  get remaining() {
    return this.cardPile.length;
  }

  /**
   * 获取弃牌堆数
   */
  get discarded() {
    return this.discardPile.length;
  }

  /**
   * 获取牌堆信息
   */
  getInfo() {
    return {
      remaining: this.remaining,
      discarded: this.discarded,
      total: this.initialCards.length,
      seed: this.seed,
    };
  }
}
