import React, { useEffect } from 'react';
import { fxDuration } from './effectFx';

/**
 * 出牌桌面展示：牌桌中央偏上放大牌 + “X 使用 · 目标”。
 * 纯展示，pointer-events:none，不阻塞操作；无 card 数据时不渲染。
 */
export function TableCardStage({ fx = null }) {
  if (!fx || !fx.card) return null;
  const card = fx.card;
  const caption = `${fx.playerName || '玩家'} 使用${fx.targetName ? ` · 目标 ${fx.targetName}` : ''}`;
  return (
    <div className="table-card-stage" data-fx="table-card" aria-live="polite">
      <div className="table-card-aura" aria-hidden="true" />
      <div className={`table-card-face ${card.isRed ? 'red' : ''} card-type-${card.type || 'basic'}`}>
        <span className="card-breath" aria-hidden="true" />
        <span className="table-card-suit" aria-hidden="true">{card.suitSymbol || '🂠'}</span>
        <span className="table-card-number">{card.numberDisplay || ''}</span>
        <span className="table-card-name">{card.name}</span>
        <span className="table-card-brand" aria-hidden="true">CGM</span>
      </div>
      <div className="table-card-caption">{caption}</div>
    </div>
  );
}

/**
 * 弃牌飞散：少量牌背/牌面向中央弃牌堆旋转缩小，伴随墨尘/金屑。
 * 每个事件只播一次，队列按 front 播放；pointer-events:none。
 */
export function DiscardBurst({ fx = null, onShift = null }) {
  useEffect(() => {
    if (!fx) return undefined;
    const timer = setTimeout(() => {
      if (typeof onShift === 'function') onShift();
    }, fxDuration(fx));
    return () => clearTimeout(timer);
  }, [fx?.id]);

  if (!fx) return null;
  return (
    <div className="discard-burst" data-fx="discard" aria-live="polite">
      <div className="discard-caption">
        <b>{fx.playerName || '玩家'}</b>
        <span>{fx.reason ? `弃牌 · ${fx.reason}` : '弃牌'}</span>
      </div>
      <div className="discard-cards" aria-hidden="true">
        {(fx.cards || []).map((card, index) => (
          <span
            key={`${fx.id}-${index}`}
            className={`discard-card ${card.isRed ? 'red' : ''}`}
            style={{ '--i': index }}>
            <span className="card-breath" aria-hidden="true" />
            <span className="discard-suit">{card.suitSymbol || '🂠'}</span>
            <span className="discard-name">{card.name}</span>
          </span>
        ))}
      </div>
      <span className="discard-ink" aria-hidden="true" />
      <span className="discard-ember" aria-hidden="true" />
    </div>
  );
}

export default TableCardStage;
