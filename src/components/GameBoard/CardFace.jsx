import React from 'react';
import { SUIT_SYMBOLS } from '../../core/Card';
import { getCardText } from '../../data/cardText';

const TYPE_LABEL = {
  basic: '基',
  trick: '锦',
  delay_trick: '延',
  equip: '装',
};

/**
 * 统一牌面：左上角点数/花色、中央水印、牌名、简注、类型钤印。
 * 质感：哑光纸基 + 纤维噪点（card-grain）+ 双层墨线/金线框（card-frame）。
 * 手牌区 / 操作面板 / 飞牌动画共用同一套视觉。
 * onInfo 提供时，右上角类型印可点击，弹出牌的说明面板。
 */
export default function CardFace({ card, info, showBrief = true, onInfo }) {
  if (!card) return null;
  const text = info || getCardText(card.name) || {};
  const typeLabel = TYPE_LABEL[card.type] || '牌';
  return (
    <>
      <span className="card-breath" aria-hidden="true" />
      <span className="card-grain" aria-hidden="true" />
      <span className="card-frame" aria-hidden="true" />
      <span className="card-corner">
        <span className="corner-number">{card.numberDisplay}</span>
        <span className="corner-suit">{SUIT_SYMBOLS[card.suit]}</span>
      </span>
      <span className="card-watermark" aria-hidden="true">{SUIT_SYMBOLS[card.suit]}</span>
      <span className="card-name">{card.name}</span>
      {showBrief && text.brief && (
        <span className="card-brief" title={text.detail}>{text.brief}</span>
      )}
      <span
        className={`card-seal seal-${card.type || 'basic'} ${onInfo ? 'clickable' : ''}`} data-info-trigger="1"
        title={onInfo ? '点击查看这张牌的说明' : undefined}
        onClick={onInfo
          ? (e) => {
            e.stopPropagation();
            onInfo({
              title: `${card.name} · ${typeLabel}`,
              desc: text.detail || text.brief || '暂无说明',
            }, e);
          }
          : undefined}
      >
        {typeLabel}
      </span>
    </>
  );
}
