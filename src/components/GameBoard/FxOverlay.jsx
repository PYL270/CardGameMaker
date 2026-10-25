import React, { useEffect, useRef } from 'react';
import { fxDuration } from './effectFx';

/**
 * 演出特效层（不阻塞输入：容器 pointer-events:none）
 * - ExecutionOverlay 处决
 * - DyingPulse 濒死脉搏
 * - JudgeReveal 判定揭示
 * - HealPop 回复
 * - ThunderFlash 雷击
 * FxLayer 负责按队列顺序播放并自动出队。
 */

function VictimCard({ victim, image, hp, group }) {
  return (
    <div className={`fx-victim-card ${image ? 'has-image' : 'no-image'}`} data-group={group || ''}>
      {image
        ? <img className="fx-victim-image" src={image} alt="" loading="lazy" />
        : <span className="fx-victim-initial" aria-hidden="true">{String(victim || '?').slice(0, 1)}</span>}
      <span className="fx-victim-shade" aria-hidden="true" />
      <span className="fx-victim-name">{victim}</span>
      {hp !== null && hp !== undefined ? <span className="fx-victim-hp">{hp}</span> : null}
    </div>
  );
}

export function ExecutionOverlay({ fx = {} }) {
  const victim = fx.victim || '未知角色';
  const source = fx.source || '';
  const text = fx.text || (source ? '斩' : '阵亡');
  const image = fx.victimImage || '';
  const hp = Number.isFinite(Number(fx.victimHp)) ? Number(fx.victimHp) : null;
  const group = fx.victimGroup || '';
  return (
    <div className="fx-execution" data-fx="execution" data-victim-image={image ? '1' : '0'}>
      <div className="fx-execution-vignette" aria-hidden="true" />
      <span className="fx-blade fx-blade-a" aria-hidden="true" />
      <span className="fx-blade fx-blade-b" aria-hidden="true" />
      <div className="fx-execution-victim" aria-hidden="true">
        <div className="fx-victim-half fx-victim-top">
          <VictimCard victim={victim} image={image} hp={hp} group={group} />
        </div>
        <div className="fx-victim-half fx-victim-bottom">
          <VictimCard victim={victim} image={image} hp={hp} group={group} />
        </div>
        <span className="fx-exec-slash" />
        <span className="fx-exec-ink fx-exec-ink-a" />
        <span className="fx-exec-ink fx-exec-ink-b" />
      </div>
      <div className="fx-execution-core">
        <div className="fx-execution-brush" aria-hidden="true">{text}</div>
        <div className="fx-execution-names">
          <b>{victim}</b>
          {source ? <span className="fx-execution-source">{` · 来自 ${source}`}</span> : null}
        </div>
      </div>
      <span className="fx-ember fx-ember-0" aria-hidden="true" />
      <span className="fx-ember fx-ember-1" aria-hidden="true" />
      <span className="fx-ember fx-ember-2" aria-hidden="true" />
      <span className="fx-ember fx-ember-3" aria-hidden="true" />
    </div>
  );
}

export function DyingPulse({ fx = {} }) {
  const player = fx.player || '未知角色';
  return (
    <div className="fx-dying" data-fx="dying" role="status">
      <span className="fx-dying-ring fx-dying-ring-a" aria-hidden="true" />
      <span className="fx-dying-ring fx-dying-ring-b" aria-hidden="true" />
      <span className="fx-dying-text">{`${player} 濒死`}</span>
    </div>
  );
}

const TRIGRAMS = ['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷'];

export function JudgeReveal({ fx = {} }) {
  const card = fx.card || { name: '判定牌', suitSymbol: '♠', numberDisplay: '?', isRed: false };
  const success = fx.success !== false;
  const text = fx.text || (success ? '判定生效' : '判定不中');
  return (
    <div className="fx-divination" aria-live="polite">
      <span className="fx-divination-veil" aria-hidden="true" />
      <span className="fx-divination-cast" aria-hidden="true">卜卦</span>
      <span className="fx-divination-rings" aria-hidden="true">
        <i className="fx-divination-ring ring-a" />
        <i className="fx-divination-ring ring-b" />
        <i className="fx-divination-ring ring-c" />
        {TRIGRAMS.map((trigram, index) => (
          <b
            className="fx-divination-trigram"
            key={trigram}
            style={{ '--i': index }}>
            {trigram}
          </b>
        ))}
      </span>
      <span className="fx-divination-orbit" aria-hidden="true">
        {[0, 1, 2].map(index => (
          <i className="fx-divination-card-back" key={index} style={{ '--i': index }}>
            <b>卦</b>
          </i>
        ))}
      </span>
      <div className={`fx-judge ${success ? 'success' : 'fail'}`} data-fx="judge">
        <div className="fx-judge-title">{fx.delayCard ? `【${fx.delayCard}】判定` : '判定'}</div>
        <div className={`fx-judge-card ${card.isRed ? 'red' : ''}`}>
          <span className="fx-judge-suit" aria-hidden="true">{card.suitSymbol}</span>
          <span className="fx-judge-name">{card.name}</span>
          <span className="fx-judge-num">{card.numberDisplay}</span>
        </div>
        <div className="fx-judge-result">{text}</div>
        {fx.player ? <div className="fx-judge-player">{fx.player}</div> : null}
      </div>
      <span className="fx-divination-ink" aria-hidden="true" />
    </div>
  );
}

export function HealPop({ fx = {} }) {
  const num = Number(fx.num) > 0 ? Number(fx.num) : 1;
  const player = fx.player || '未知角色';
  return (
    <div className="fx-heal" data-fx="heal" role="status">
      <span className="fx-heal-label">回复</span>
      <span className="fx-heal-num">{`+${num}`}</span>
      <span className="fx-heal-target">{player}</span>
      <span className="fx-heal-spark fx-heal-spark-a" aria-hidden="true" />
      <span className="fx-heal-spark fx-heal-spark-b" aria-hidden="true" />
      <span className="fx-heal-spark fx-heal-spark-c" aria-hidden="true" />
    </div>
  );
}

export function ThunderFlash({ fx = {} }) {
  return (
    <div className="fx-thunder" data-fx="thunder" aria-hidden="true">
      <span className="fx-thunder-flash" />
      <svg className="fx-lightning" viewBox="0 0 120 120">
        <polyline points="68,6 44,54 63,54 38,114 86,46 64,46 84,6" />
      </svg>
      <span className="fx-thunder-text">雷击</span>
    </div>
  );
}

const RENDERERS = {
  execution: ExecutionOverlay,
  dying: DyingPulse,
  judge: JudgeReveal,
  heal: HealPop,
  thunder: ThunderFlash,
};

/**
 * 特效队列播放器：按顺序播放 queue 顶部，播放完调用 onShift；不阻塞输入。
 */
export default function FxLayer({ queue = [], onShift }) {
  const front = queue[0] || null;
  const shiftRef = useRef(onShift);
  shiftRef.current = onShift;

  useEffect(() => {
    if (!front) return undefined;
    const timer = setTimeout(() => {
      if (shiftRef.current) shiftRef.current();
    }, fxDuration(front));
    return () => clearTimeout(timer);
    // 只随当前特效变化，避免父组件重渲染重启计时器
  }, [front?.id, front?.kind]);

  if (!front) return null;
  const Renderer = RENDERERS[front.kind];
  if (!Renderer) return null;

  return (
    <div
      className={`fx-layer ${front.kind === 'execution' ? 'fx-layer-shake' : ''}`}
      data-fx-layer={front.kind}
      aria-live="polite"
    >
      <Renderer key={front.id || front.kind} fx={front} />
    </div>
  );
}
