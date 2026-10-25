/**
 * Turn - 回合/阶段管理
 * 三国杀回合流程:
 * 准备阶段 → 判定阶段 → 摸牌阶段 → 出牌阶段 → 弃牌阶段 → 结束阶段
 */
import { TRIGGER_TIMINGS } from './Skill';

export const PHASES = {
  PREPARE: 'prepare',     // 准备阶段
  JUDGE: 'judge',         // 判定阶段
  DRAW: 'draw',           // 摸牌阶段
  PLAY: 'play',           // 出牌阶段
  DISCARD: 'discard',     // 弃牌阶段
  FINISH: 'finish',       // 结束阶段
};

export const PHASE_ORDER = [
  PHASES.PREPARE,
  PHASES.JUDGE,
  PHASES.DRAW,
  PHASES.PLAY,
  PHASES.DISCARD,
  PHASES.FINISH,
];

export const PHASE_NAMES = {
  prepare: '准备阶段',
  judge: '判定阶段',
  draw: '摸牌阶段',
  play: '出牌阶段',
  discard: '弃牌阶段',
  finish: '结束阶段',
};

export default class Turn {
  constructor(game) {
    this.game = game;
    this.currentPlayer = null;
    this.currentPhase = null;
    this.roundNumber = 0;
    this.phaseStep = 0;
    this.isPaused = false;
    this.onPhaseChange = null; // 回调: (phase, player) => void
  }

  /**
   * 开始一个回合
   */
  async startTurn(player) {
    this.currentPlayer = player;
    this.roundNumber++;
    player.resetTurn();
    this.game.notifyStateChange();

    // 触发 roundStart
    await this.game.emit('roundStart', { player, round: this.roundNumber });
    await this.game.fireTiming('roundStart', { player, round: this.roundNumber });

    for (const phase of PHASE_ORDER) {
      if (!player.isAlive) break;
      this.currentPhase = phase;
      this.phaseStep = 0;
      this.game.notifyStateChange();

      if (this.onPhaseChange) {
        this.onPhaseChange(phase, player);
      }

      // 触发 phaseBegin
      await this.game.emit('phaseBegin', { phase, player });
      await this.game.fireTiming('phaseBegin', { phase, player });

      // 执行阶段逻辑
      await this.executePhase(phase, player);

      // 触发 phaseEnd
      await this.game.emit('phaseEnd', { phase, player });
      await this.game.fireTiming('phaseEnd', { phase, player });
    }

    // 触发 roundEnd
    await this.game.emit('roundEnd', { player, round: this.roundNumber });
    await this.game.fireTiming('roundEnd', { player, round: this.roundNumber });
    this.currentPhase = null;
  }

  /**
   * 执行具体阶段
   */
  async executePhase(phase, player) {
    switch (phase) {
      case PHASES.PREPARE:
        await this.phasePrepare(player);
        break;
      case PHASES.JUDGE:
        await this.phaseJudge(player);
        break;
      case PHASES.DRAW:
        await this.phaseDraw(player);
        break;
      case PHASES.PLAY:
        await this.phasePlay(player);
        break;
      case PHASES.DISCARD:
        await this.phaseDiscard(player);
        break;
      case PHASES.FINISH:
        await this.phaseFinish(player);
        break;
    }
  }

  /**
   * 准备阶段
   */
  async phasePrepare(player) {
    // 触发技能时机
    await this.game.emit('phaseJudgeBegin', { player });
  }

  /**
   * 判定阶段 - 处理判定区延时锦囊
   */
  async phaseJudge(player) {
    if (player.judgeCards.length > 0) {
      await this.game.judgment.processJudgeArea(player, async (record) => {
        this.game.addLog(
          `${player.name} 判定${record.delayCard.name}：${record.judgeCard?.suitSymbol}${record.judgeCard?.numberDisplay}，${record.result ? '判定生效' : '判定不中'}`
        );
        if (record.result) {
          // 判定生效：执行延时锦囊效果
          await this.handleDelayTrickEffect(player, record.delayCard, true);
        } else if (record.delayCard.name === '闪电') {
          // 闪电判定不中也要移动到下家判定区
          await this.handleDelayTrickEffect(player, record.delayCard, false);
        }
      });
    }
  }

  /**
   * 处理判定生效的延时锦囊效果
   * @param {Player} player 判定者
   * @param {Card} delayCard 延时锦囊
   * @param {boolean} triggered 判定是否生效
   */
  async handleDelayTrickEffect(player, delayCard, triggered = true) {
    const idx = player.judgeCards.indexOf(delayCard);
    switch (delayCard.name) {
      case '乐不思蜀':
        // 跳过出牌阶段(设标记)
        player.setStorage('skipPlay', true);
        this.game.addLog(`${player.name} 被乐不思蜀，跳过出牌阶段`);
        break;
      case '兵粮寸断':
        // 跳过摸牌阶段
        player.setStorage('skipDraw', true);
        this.game.addLog(`${player.name} 被兵粮寸断，跳过摸牌阶段`);
        break;
      case '闪电': {
        // 判定生效：受到2点雷电伤害；无论是否生效都要传递给下家
        if (triggered) {
          const dealt = await this.game.dealDamage({
            target: player, num: 2, card: delayCard, nature: 'thunder', reason: 'lightning',
          });
          this.game.addLog(dealt > 0
            ? `${player.name} 被闪电劈中，受到${dealt}点伤害`
            : `${player.name} 的闪电伤害被防止`);
        } else {
          this.game.addLog(`闪电判定未中`);
        }
        if (idx !== -1) player.judgeCards.splice(idx, 1);
        // 传递：跳过判定区已有【闪电】的角色（判定区不能有同名牌），
        // 若没有其他存活角色可接（例如仅剩1人），闪电进入弃牌堆，避免自己传给自己造成重复判定/死循环。
        const total = this.game.players.length;
        let next = this.game.getNextAlivePlayer(player);
        let hops = 0;
        while (next && next !== player && hops++ < total
          && (next.judgeCards || []).some(c => c.name === '闪电')) {
          next = this.game.getNextAlivePlayer(next);
        }
        if (next && next !== player && !(next.judgeCards || []).some(c => c.name === '闪电')) {
          next.addJudgeCard(delayCard);
          this.game.addLog(`闪电传递给 ${next.name}`);
        } else {
          this.game.deck.discardOne(delayCard);
          this.game.addLog('没有可传递【闪电】的角色，闪电进入弃牌堆');
        }
        return;
      }
      default:
        break;
    }
    if (delayCard.name !== '闪电' && idx !== -1) {
      player.judgeCards.splice(idx, 1);
      this.game.deck.discardOne(delayCard);
    }
  }

  /**
   * 摸牌阶段
   */
  async phaseDraw(player) {
    let drawNum = 2;
    // 检查是否被跳过
    if (player.getStorage('skipDraw')) {
      player.storage.delete('skipDraw');
      this.game.addLog(`${player.name} 跳过摸牌阶段`);
      return;
    }
    // 触发 phaseDrawBegin2 (技能可修改摸牌数)
    const drawEvent = { player, num: drawNum };
    const skillEvent = await this.game.fireTiming('phaseDrawBegin2', drawEvent);
    drawNum = Math.max(0, skillEvent.data.num);
    this.game.emit('phaseDrawBegin2', drawEvent);

    const cards = this.game.deck.draw(drawNum);
    player.drawCards(cards);
    this.game.emitUiEffect({ type: 'draw', player, num: drawNum });
    this.game.addLog(`${player.name} 摸了${drawNum}张牌`);
  }

  /**
   * 出牌阶段
   */
  async phasePlay(player) {
    if (player.getStorage('skipPlay')) {
      player.storage.delete('skipPlay');
      this.game.addLog(`${player.name} 跳过出牌阶段`);
      return;
    }

    // 循环等待出牌，直到玩家选择结束出牌或无法出牌
    while (player.isAlive && !this.isPaused) {
      const action = await this.game.askForPlay(player);
      if (!action || action.type === 'endPlay') break;
      if (action.type === 'useSkill') {
        const skill = action.skill || (player.skills || []).find(s => s.id === action.skillId);
        await this.game.useActiveSkill(player, skill);
        continue;
      }
      if (action.type === 'useWeapon') {
        await this.game.useWeaponAction(player, action.weapon);
        continue;
      }
      // 出牌阶段规则校验：闪/无懈不能主动使用、桃需受伤、酒每回合一次、目标合法
      if (!this.game.canPlayCard(player, action.card)) {
        this.game.addLog(`${player.name} 现在不能主动使用【${action.card?.name || '该牌'}】`);
        if (player.isAI) break;
        continue;
      }
      // 执行出牌动作
      await this.game.executeCardAction(player, action);
    }
  }

  /**
   * 弃牌阶段
   */
  async phaseDiscard(player) {
    // 手牌上限：默认=体力值；【英姿】+1（统一由 Player.handLimit 计算）
    const excess = player.handCardCount - player.handLimit;
    if (excess > 0) {
      const discarded = await this.game.askForDiscard(player, excess);
      for (const card of discarded) {
        player.discardCard(card);
        this.game.deck.discardOne(card);
      }
      // 弃牌演出事件：同一批弃牌合并为一个 discard 事件
      this.game.emitDiscard(player, discarded, 'phase');
      this.game.addLog(`${player.name} 弃了${discarded.length}张牌`);
    }
  }

  /**
   * 结束阶段
   */
  async phaseFinish(player) {
    // 清除回合临时标记
    player.storage.delete('skipPlay');
    player.storage.delete('skipDraw');

    // 爪黄飞电：结束阶段若你本回合未受到过伤害，摸1张牌
    if (this.game.hasEquip(player, '爪黄飞电') && !player.getStorage('damagedThisTurn')) {
      const cards = this.game.deck.draw(1);
      player.drawCards(cards);
      this.game.emitUiEffect({ type: 'weapon', player, name: '爪黄飞电' });
      this.game.addLog(`【爪黄飞电】${player.name} 本回合未受伤，摸1张牌`);
    }
  }

  /**
   * 暂停/恢复
   */
  pause() { this.isPaused = true; }
  resume() { this.isPaused = false; }
}
