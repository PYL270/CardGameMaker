/**
 * 示例扩展: 添加一个自定义武将和技能
 * 演示如何使用扩展系统
 */
import { GameExtension } from '../core/ExtensionSystem';

class DemoExtension extends GameExtension {
  constructor() {
    super('demo_extension', '1.0', '示例扩展: 演示如何添加自定义武将和技能');
  }

  onRegister(game) {
    // ===== 注册技能 =====

    // 技能1: 英姿 - 摸牌阶段额外摸一张牌
    game.registerSkill({
      id: 'demo_yingzi',
      name: '英姿',
      type: 'trigger',
      description: '摸牌阶段，你可以额外摸一张牌',
      triggerTiming: 'phaseDrawBegin2',
      triggerSource: 'player',
      usable: 1,
      forced: true,
      filter: (event, player) => true,
      cost: async (event, trigger, player) => {
        event.result = { bool: true };
      },
      content: async (event, trigger, player) => {
        trigger.num = (trigger.num || 2) + 1;
        game.addLog(`${player.name} 发动【英姿】，额外摸一张牌`);
      },
      ai: { order: 10, result: { player: 2, target: () => 0 }, check: () => true },
    });

    // 技能2: 反馈 - 受到伤害后可以获得伤害来源一张牌
    game.registerSkill({
      id: 'demo_fankui',
      name: '反馈',
      type: 'trigger',
      description: '当你受到伤害后，你可以获得伤害来源的一张牌',
      triggerTiming: 'damaged',
      triggerSource: 'player',
      usable: 1,
      forced: false,
      filter: (event, player) => {
        return event.data?.source && event.data.source.handCardCount > 0;
      },
      cost: async (event, trigger, player) => {
        event.result = { bool: true };
      },
      content: async (event, trigger, player) => {
        const source = trigger.data?.source;
        if (source && source.handCardCount > 0) {
          const card = source.handCards[source.handCardCount - 1];
          source.discardCard(card);
          player.drawCards([card]);
          game.addLog(`${player.name} 发动【反馈】，获得了${source.name}的一张牌`);
        }
      },
      ai: { order: 8, result: { player: 1, target: () => -1 }, check: () => true },
    });

    // ===== 注册武将 =====
    game.registerCharacter({
      id: 'demo_zhouyu',
      name: '周瑜',
      sex: 'male',
      group: 'wu',
      hp: 3,
      maxHp: 3,
      skillIds: ['demo_yingzi', 'demo_fankui'],
      description: '东吴大都督，赤壁之战的指挥者',
    });
  }

  onDamageCalc(game, damageEvent) {
    // 示例: 可以在这里修改伤害计算
    return 0;
  }
}

export default new DemoExtension();
