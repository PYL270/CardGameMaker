import React, { useEffect, useState } from 'react';
import { attackRange } from './distanceInfo';
import {
  evaluatePosition,
  predictIntent,
  recommendAction,
  simulateCard,
  describeTargetLock,
} from '../../ai/tacticalAdvisor';

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

const initialAdvice = { kind: 'wait', label: '军师正在研判…', tone: 'calm', source: 'fallback' };
const TONE_ORDER = { muted: 0, calm: 1, observe: 2, plan: 3, recover: 4, attack: 5, alert: 6, danger: 7 };

export default function TacticalPulse(props) {
  const {
    selfPlayer = null,
    players = [],
    selectedTarget = null,
    currentPlayer = null,
    pendingAction = null,
    currentPhase = '',
    phaseLabel = '',
    spectator = false,
    selectedCards = [],
    game = null,
    teamMode = 'ffa',
  } = props;
  const { chips, hint, tone } = buildTacticalPulse(props);
  const [advice, setAdvice] = useState(initialAdvice);

  const assessment = evaluatePosition({
    self: selfPlayer,
    players,
    teamMode,
    currentPhase,
    currentPlayer,
  });
  const topThreat = assessment.threats[0] || null;
  const threatPlayer = topThreat
    ? (players || []).find(p => p?.id === topThreat.id) || null
    : null;
  const intent = threatPlayer ? predictIntent(threatPlayer, { currentPlayer, phase: currentPhase }) : null;
  const selectedCard = (selectedCards || [])[0] || null;
  const simulation = selectedCard && selfPlayer
    ? simulateCard({ card: selectedCard, self: selfPlayer, target: selectedTarget, players })
    : null;
  const targetLock = selectedTarget && selfPlayer
    ? describeTargetLock({ self: selfPlayer, target: selectedTarget, players, card: selectedCard })
    : null;

  useEffect(() => {
    let alive = true;
    if (!selfPlayer || spectator) {
      setAdvice(initialAdvice);
      return () => { alive = false; };
    }
    setAdvice(initialAdvice);
    recommendAction({ self: selfPlayer, players, pendingAction, game })
      .then(next => {
        if (alive && next) setAdvice(prev => (
          (TONE_ORDER[next.tone] ?? 0) >= (TONE_ORDER[prev.tone] ?? 0) || prev === initialAdvice
            ? next
            : prev
        ));
      })
      .catch(() => {
        if (alive) setAdvice({ kind: 'wait', label: '稳住阵脚，观察对手', tone: 'calm', source: 'fallback' });
      });
    return () => { alive = false; };
  }, [
    selfPlayer?.id,
    selfPlayer?.hp,
    (selfPlayer?.handCards || []).length,
    pendingAction?.type,
    pendingAction?.player?.id,
    currentPhase,
    game,
    spectator,
  ]);

  if (spectator) {
    return (
      <div className={`tactical-pulse pulse-advised tone-${tone}`} aria-label="军师战局研判">
        <div className="pulse-chips">
          <span className="pulse-title">军师 · 战局研判</span>
          <span className="pulse-eyebrow">战局脉搏</span>
          {chips.map(chip => (
            <span className="pulse-chip" key={chip.key}>{chip.label}</span>
          ))}
        </div>
        <div className="advisor-win-row">
          <span className="advisor-win-label">胜率</span>
          <div className="advisor-win-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={assessment.winRate}>
            <i className="advisor-win-fill" style={{ width: `${assessment.winRate}%` }} />
          </div>
          <span className="advisor-win-value">{assessment.winRate}%</span>
        </div>
        {topThreat && (
          <div className="advisor-threat">
            <span className="advisor-threat-eyebrow">威胁榜首</span>
            <b>{topThreat.name}</b>
            <span className="advisor-threat-label">{topThreat.label} · {topThreat.score}</span>
          </div>
        )}
        <div className="pulse-hint">
          <i className="pulse-dot" aria-hidden="true" />
          <span>{hint}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`tactical-pulse pulse-advised tone-${tone}`} aria-label="军师战局研判">
      <div className="pulse-chips">
        <span className="pulse-title">军师 · 战局研判</span>
        <span className="pulse-eyebrow">战局脉搏</span>
        {chips.map(chip => (
          <span className="pulse-chip" key={chip.key}>{chip.label}</span>
        ))}
      </div>

      <div className="advisor-win-row">
        <span className="advisor-win-label">胜率</span>
        <div
          className="advisor-win-track"
          role="progressbar"
          aria-label="胜率"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={assessment.winRate}>
          <i className="advisor-win-fill" style={{ width: `${assessment.winRate}%` }} />
          <span className="advisor-win-mark" style={{ left: `${assessment.winRate}%` }} aria-hidden="true" />
        </div>
        <span className="advisor-win-value">{assessment.winRate}%</span>
      </div>

      <div className="advisor-brief">
        {topThreat ? (
          <span className="advisor-threat">
            <span className="advisor-threat-eyebrow">威胁榜首</span>
            <b>{topThreat.name}</b>
            <span className="advisor-threat-label">
              {topThreat.label}{intent ? ` · ${intent.label}` : ''} · {topThreat.score}
            </span>
          </span>
        ) : (
          <span className="advisor-threat advisor-threat-empty">暂无明确威胁</span>
        )}
        <span className={`advisor-advice tone-${advice.tone || 'calm'}`}>
          <span className="advisor-advice-eyebrow">军师建议</span>
          <b>{advice.label}</b>
          {advice.source === 'ai' && <i className="advisor-source">AI 同源</i>}
        </span>
      </div>

      {simulation && (
        <div className="advisor-sim" title={simulation.detail}>
          <span className="advisor-sim-eyebrow">推演</span>
          <b>{simulation.label}</b>
          <span>期望 {simulation.expected}</span>
          <span className={`advisor-risk risk-${simulation.risk}`}>风险 {simulation.risk}</span>
        </div>
      )}

      {targetLock && <div className="advisor-lock">{targetLock}</div>}

      <div className="pulse-hint">
        <i className="pulse-dot" aria-hidden="true" />
        <span>{hint}</span>
      </div>
    </div>
  );
}
