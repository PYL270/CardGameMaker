import React from 'react';
import { attackRange } from './distanceInfo';

const hasCard = (hand, name) => (hand || []).some(card => card?.name === name);

/**
 * 战局脉搏纯函数：chips + 按优先级第一条战术提示。
 * 观战/无 self 时不输出任何个人手牌/体力信息。
 */
export function buildTacticalPulse({
  selfPlayer = null,
  players = [],
  selectedTarget = null,
  currentPlayer = null,
  pendingAction = null,
  currentPhase = '',
  phaseLabel = '',
  spectator = false,
} = {}) {
  const alivePlayers = (players || []).filter(p => p && p.status !== 'dead');
  const aliveCount = alivePlayers.length;
  const totalCount = (players || []).length;

  if (spectator || !selfPlayer) {
    return {
      chips: [
        { key: 'spectate', label: '观战' },
        { key: 'alive', label: `存活 ${aliveCount}/${totalCount}` },
        { key: 'current', label: `当前 ${currentPlayer?.name || '-'}` },
        { key: 'phase', label: `阶段 ${phaseLabel || '-'}` },
      ],
      hint: '观战中：观察双方手牌数量',
      tone: 'observe',
    };
  }

  const hand = selfPlayer.handCards || [];
  const hp = Number(selfPlayer.hp) || 0;
  const maxHp = Number(selfPlayer.maxHp) || hp;
  const range = (() => {
    try { return attackRange(selfPlayer); } catch { return 1; }
  })();
  const hasSha = hasCard(hand, '杀');
  const hasTao = hasCard(hand, '桃');
  const selfId = selfPlayer.id;
  const enemies = alivePlayers.filter(p => p.id !== selfId);

  let hint = '局势平稳：按你的节奏出牌';
  let tone = 'calm';

  const selectedEnemy = selectedTarget && selectedTarget.id !== selfId ? selectedTarget : null;
  const oneHpEnemy = enemies.find(p => Number(p.hp) <= 1);

  if (selectedEnemy && Number(selectedEnemy.hp) <= 1 && hasSha) {
    hint = `斩杀窗口：${selectedEnemy.name || '目标'} 仅剩 1 血`;
    tone = 'kill';
  } else if (oneHpEnemy && hasSha) {
    hint = `斩杀机会：${oneHpEnemy.name || '敌方'} 仅剩 1 血`;
    tone = 'kill';
  } else if (hp < maxHp && hasTao) {
    hint = '回复窗口：手牌有桃';
    tone = 'recover';
  } else if (hand.length > maxHp) {
    hint = `手牌溢出：回合结束将弃 ${hand.length - maxHp} 张`;
    tone = 'warn';
  } else if ((currentPhase === 'play' || pendingAction?.type === 'play') && !hasSha) {
    hint = '无杀可用：可先蓄锦囊/装备';
    tone = 'warn';
  } else if (currentPlayer?.id && currentPlayer.id !== selfId) {
    hint = `观察中：${currentPlayer.name || '对手'} 行动`;
    tone = 'observe';
  }

  return {
    chips: [
      { key: 'hand', label: `手牌 ${hand.length}/${maxHp}` },
      { key: 'hp', label: `体力 ${hp}/${maxHp}` },
      { key: 'range', label: `攻击范围 ${range}` },
      { key: 'alive', label: `存活 ${aliveCount}/${totalCount}` },
    ],
    hint,
    tone,
  };
}

export default function TacticalPulse(props) {
  const { chips, hint, tone } = buildTacticalPulse(props);
  return (
    <div className={`tactical-pulse tone-${tone}`} aria-label="战局脉搏">
      <div className="pulse-chips">
        <span className="pulse-title">战局脉搏</span>
        {chips.map(chip => (
          <span className="pulse-chip" key={chip.key}>{chip.label}</span>
        ))}
      </div>
      <div className="pulse-hint">
        <i className="pulse-dot" aria-hidden="true" />
        <span>{hint}</span>
      </div>
    </div>
  );
}
