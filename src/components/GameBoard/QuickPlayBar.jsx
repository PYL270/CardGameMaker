import React from 'react';

/**
 * 选中出牌条：选中手牌后固定悬浮在手牌上方，避免向下滚动确认。
 * 未选中/非出牌阶段返回 null，不占布局。
 */
export function QuickPlayBar({
  card = null,
  targetName = '',
  canConfirm = true,
  onConfirm,
  onCancel,
}) {
  if (!card) return null;
  return (
    <div className="quick-play-bar" data-quick-play="1" role="status" aria-live="polite">
      <span className="quick-play-label">已选</span>
      <strong className="quick-play-card">{card.name}</strong>
      {targetName ? <span className="quick-play-target">{`→ ${targetName}`}</span> : null}
      <span className="quick-play-spacer" />
      <button
        type="button"
        className="btn btn-small btn-primary quick-play-confirm"
        onClick={onConfirm}
        disabled={!canConfirm}>
        确认出牌
      </button>
      <button type="button" className="btn btn-small quick-play-cancel" onClick={onCancel}>
        取消
      </button>
    </div>
  );
}

/**
 * AI 思考徽标：当前行动者是 AI 时显示三点脉冲；不阻塞交互。
 */
export function AiThinkingBadge({ visible = false, name = '' }) {
  if (!visible) return null;
  return (
    <span className="ai-thinking-badge" role="status" aria-live="polite">
      <span className="ai-thinking-dots" aria-hidden="true"><i /><i /><i /></span>
      <span>{name ? `${name} 思考中…` : 'AI 思考中…'}</span>
    </span>
  );
}

export default QuickPlayBar;
