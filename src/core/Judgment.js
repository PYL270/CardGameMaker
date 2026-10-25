/**
 * Judgment - 判定系统
 * 处理判定区的延时锦囊判定
 */
import Card, { SUIT_COLORS } from './Card';

/** 延时锦囊中文名 → 判定类型 */
const JUDGE_TYPES = {
  '乐不思蜀': 'leshousishu',
  '兵粮寸断': 'bingliangcunduan',
  '闪电': 'shandian',
};

export default class Judgment {
  /**
   * @param {Deck} deck
   * @param {Game|null} game - 可选，用于发出 judge 演出事件（emitUiEffect）
   */
  constructor(deck, game = null) {
    this.deck = deck;
    this.game = game;
  }

  /**
   * 执行判定：从牌堆顶摸一张牌作为判定牌
   * @returns {Card} 判定牌
   */
  judge() {
    const cards = this.deck.draw(1);
    return cards[0] || null;
  }

  /**
   * 判定结果判断
   * @param {Card} judgeCard - 判定牌
   * @param {string} type - 判定类型
   * @returns {boolean}
   */
  getResult(judgeCard, type) {
    if (!judgeCard) return false;
    switch (type) {
      case 'leshousishu':    // 乐不思蜀: 红桃♥ = 不中
        return judgeCard.suit !== 'heart';
      case 'bingliangcunduan': // 兵粮寸断: 梅花♣ = 不中
        return judgeCard.suit !== 'club';
      case 'shandian':       // 闪电: 黑桃♠2~9 = 中
        return judgeCard.suit === 'spade' && judgeCard.number >= 2 && judgeCard.number <= 9;
      case 'bagua':          // 八卦阵: 红色 = 视为闪
        return judgeCard.isRed;
      default:
        return false;
    }
  }

  /**
   * 处理玩家判定区的所有延时锦囊
   * @param {Player} player
   * @param {Function} onJudgeResult - async (judgeCard, delayCard, result) => void
   * @returns {Promise<object[]>} 判定结果列表
   */
  async processJudgeArea(player, onJudgeResult) {
    const results = [];
    // 从判定区最后放入的开始判定(后进先出)
    const cards = [...player.judgeCards].reverse();
    for (const delayCard of cards) {
      // 牌可能已被前一张判定效果移除
      if (!player.judgeCards.includes(delayCard)) continue;
      const judgeCard = this.judge();
      const result = this.getResult(judgeCard, JUDGE_TYPES[delayCard.name] || delayCard.name);
      // 判定牌进弃牌堆
      if (judgeCard) this.deck.discardOne(judgeCard);
      // 判定不中时：普通延时锦囊进弃牌堆；【闪电】保留，交 Game 层移动到下家
      if (!result && delayCard.name !== '闪电') {
        const idx = player.judgeCards.indexOf(delayCard);
        if (idx !== -1) player.judgeCards.splice(idx, 1);
        this.deck.discardOne(delayCard);
      }
      const record = { judgeCard, delayCard, result };
      results.push(record);
      // 判定揭示演出事件：每次判定完成时发出（judge 先于判定效果结算）
      if (this.game && typeof this.game.emitJudgeEffect === 'function') {
        this.game.emitJudgeEffect(player, judgeCard, delayCard, result);
      }
      if (onJudgeResult) await onJudgeResult(record);
    }
    return results;
  }
}
