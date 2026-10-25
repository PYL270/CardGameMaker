import Character from '../core/Character';
import Skill from '../core/Skill';

/**
 * 基础角色（未选择武将时使用）
 * 定位：4 体力、两个简单锁定技，保证默认对局有基本强度且不需要玩家确认。
 */
export const BASE_SKILLS = [
  {
    id: 'base_qinxue',
    name: '勤学',
    type: 'locked',
    description: '锁定技，摸牌阶段，若你的手牌数少于体力值，额外摸一张牌。',
    triggerTiming: 'phaseDrawBegin2',
    triggerSource: 'player',
    usable: 0,
    forced: true,
    filter: (event, player) => event.data?.player === player,
    cost: async () => {},
    content: async (event, trigger, player) => {
      // 与经典武将【英姿】区分：仅在手牌不足时补一张，而不是无条件多摸
      if (player && player.handCards.length < player.hp) {
        event.data.num = (event.data.num || 0) + 1;
      }
    },
    ai: { order: 10, check: () => true },
  },
  {
    id: 'base_wenshou',
    name: '稳守',
    type: 'locked',
    description: '锁定技，每回合你第一次受到伤害时，防止其中1点伤害。',
    triggerTiming: 'damageBegin',
    triggerSource: 'target',
    usable: 1,
    forced: true,
    filter: (event, player) => event.data?.target === player && (event.data.num || 0) > 0,
    cost: async () => {},
    content: async (event, trigger, player) => {
      event.data.num = Math.max(0, (event.data.num || 0) - 1);
      event.game?.addLog?.(`【稳守】${player?.name || '角色'} 防止1点伤害`);
    },
    ai: { order: 10, check: () => true },
  },
];

/**
 * 创建基础角色及独立的技能实例（每个玩家各一份，避免使用次数串号）
 * @returns {{ character: Character, skills: Skill[] }}
 */
export function createBaseCharacter() {
  const skills = BASE_SKILLS.map(def => new Skill(def));
  const character = new Character({
    id: 'base_character',
    name: '基础角色',
    sex: 'male',
    group: 'custom',
    hp: 4,
    maxHp: 4,
    skillIds: skills.map(s => s.id),
    description: '默认角色：勤学、稳守',
    // 装备栏数量（默认 3，可在自定义武将中调整 1~6）
    equipSlots: 3,
  });
  return { character, skills };
}
