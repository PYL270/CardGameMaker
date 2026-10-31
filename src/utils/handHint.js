/** 手牌区提示文案（抽成纯函数便于 UI 测试；confirm 也用于濒死求桃等，不再写死“技能发动”） */
export function handHintFor(pendingAction) {
  if (!pendingAction) return '点击选牌 / 拖动摆放 / 双击复位；点右上角印或右键看说明';
  if (pendingAction.type === 'play') return '选择一张手牌确认出牌；点牌右上角印可看说明';
  if (pendingAction.type === 'discard') return `选择 ${pendingAction.count} 张牌弃置`;
  if (pendingAction.type === 'respond') return '选择可用的响应牌，或点「不使用」';
  if (pendingAction.type === 'confirm') return '请在上方确认（技能发动 / 使用桃等）';
  return '请在上方完成选择';
}
