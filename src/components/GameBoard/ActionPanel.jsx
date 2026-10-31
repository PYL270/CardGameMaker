import React, { useEffect, useState } from 'react';
import usePanelDrag from '../../hooks/usePanelDrag';
import CardFace from './CardFace';
import { distanceHint } from './distanceInfo';
import { isTeammateTarget } from './teamConfig';
import { equipChoiceEntries, equipTypeLabel } from './equipSlots';
import { getCardText } from '../../data/cardText';

/**
 * 方天画戟逐目标勾选：最多 3 名目标；再次点击已选目标取消选择。
 * 抽成纯函数便于 UI 冒烟测试直接验证选择规则。
 */
export function toggleFangtianTarget(list, target, max = 3) {
  const key = (t) => (t?.id ?? t?.name ?? '');
  const id = key(target);
  if (!id) return list;
  if (list.some(t => key(t) === id)) return list.filter(t => key(t) !== id);
  if (list.length >= max) return list;
  return [...list, target];
}

/**
 * 可拖动外壳：按住提示面板拖动可挪开，避免遮挡
 */
function DraggableShell({ drag, minWidth = 340, maxWidth = 520, children }) {
  return (
    <div
      className={`action-panel panel ${drag.dragging ? 'dragging-panel' : ''}`}
      onPointerDown={drag.onPointerDown}
      onDoubleClick={
        (e) => {
          if (!e.target.closest('button')) drag.reset();
        }
      }
      style={{
        transform: `translate(${drag.pos.x}px, ${drag.pos.y}px)`,
        zIndex: drag.dragging ? 1200 : 30,
        // 手机端允许纵向滚动面板内容（max-height 44vh 时可滚到按钮），拖拽时再禁用
        touchAction: drag.dragging ? 'none' : 'pan-y',
        userSelect: 'none',
        cursor: drag.dragging ? 'grabbing' : 'grab',
        '--ap-min': `${minWidth}px`,
        '--ap-max': `${maxWidth}px`,
      }}>
      {children}
      {/* 各分支只设置 --ap-min/--ap-max，尺寸规则在这里统一维护 */}
      <style>{`
        .action-panel {
          min-width: var(--ap-min, 340px);
          max-width: var(--ap-max, 520px);
        }
        @media (max-width: 720px) {
          .action-panel { touch-action: pan-y !important; }
        }
      `}</style>
    </div>
  );
}

/**
 * ActionPanel - 操作提示面板（三国杀式）
 * 手牌在下方手牌区选择；此面板只显示提示、目标与确认按钮
 */
export default function ActionPanel({ action, onResolve, selectedCards, setSelectedCards,
  selectedTarget, setSelectedTarget, game, onRecommend, recommendHint, onInfo,
  distancePlayers = null, showDistance = true,
  teamMode = 'ffa', friendlyFire = false, initialEquipChoice = null }) {

  const drag = usePanelDrag('action');
  const [fangtianTargets, setFangtianTargets] = useState([]);
  const [equipChoice, setEquipChoice] = useState(initialEquipChoice);

  // 目标距离：只在有公开玩家数据时计算；联机用 gameState 快照同样可用
  const distFor = (target) => (
    showDistance && distancePlayers && action
      ? distanceHint(action.player, target, distancePlayers)
      : null
  );

  // 误伤开启时，目标里的同队玩家加「队友」标记（用公开 team 数据，不依赖本地 game）
  const isAllyTarget = (target) => (
    friendlyFire && action
      ? isTeammateTarget(action.player, target, teamMode)
      : false
  );

  // 目标按钮文案：名称 + 距离 + 队友标签
  const targetButtonLabel = (target) => {
    const dist = distFor(target);
    const ally = isAllyTarget(target);
    return `${target?.name || ''}${dist ? ` · 距离${dist.distance}` : ''}${ally ? ' · 队友' : ''}`;
  };

  const targetButtonTitle = (target) => {
    const dist = distFor(target);
    const ally = isAllyTarget(target);
    if (ally) return `${dist ? `${dist.title} · ` : ''}将攻击队友`;
    return dist ? dist.title : undefined;
  };

  // 每次新的操作请求（新的 action 对象）出现时清空方天画戟多目标选择，
  // 避免无懈链/连续响应等多次询问之间串选牌状态
  useEffect(() => {
    setFangtianTargets([]);
    setEquipChoice(initialEquipChoice ?? null);
  }, [action]);

  if (!action) return null;

  const { type, count } = action;
  const clearSelection = () => {
    setSelectedCards([]);
    setSelectedTarget(null);
    setFangtianTargets([]);
  };

  // 装备栏已满：必须选择弃置一张旧装备，不允许取消
  if (type === 'equipReplace') {
    const newCard = action.newCard || {};
    const choices = equipChoiceEntries(action.cards);
    const newInfo = getCardText(newCard.name) || {};
    return (
      <DraggableShell drag={drag}>
        <h3>装备替换</h3>
        <p className="equip-replace-warning">装备栏已满，必须弃置一张装备</p>
        <p className="equip-replace-hint">旧装备进入弃牌堆，新装备放入该槽。</p>
        <div className="equip-replace-new">
          <span className="equip-replace-label">新装备</span>
          <span className={`equip-replace-card ${newCard.isRed ? 'red' : ''}`}>
            <span className="equip-replace-suit">{newCard.suitSymbol || ''}</span>
            <b>{newCard.name || '装备牌'}</b>
            <em>{equipTypeLabel(newCard)}</em>
          </span>
        </div>
        <div className="equip-replace-current-label">{`当前装备（${choices.length}/${action.limit || choices.length}）`}</div>
        {choices.length === 0 && <p className="equip-replace-empty">当前没有可替换的装备</p>}
        <div className="equip-replace-list">
          {choices.map(({ slotKey, card }, index) => {
            const selected = equipChoice === slotKey;
            return (
              <button
                type="button"
                key={slotKey}
                className={`equip-replace-option ${selected ? 'selected' : ''}`}
                onClick={() => setEquipChoice(slotKey)}>
                <span className="equip-replace-slot">{`槽位 ${index + 1}`}</span>
                <span className="equip-replace-name">{card.name}</span>
                <span className="equip-replace-type">{equipTypeLabel(card)}</span>
                <span className="equip-replace-check" aria-hidden="true">{selected ? '✓' : ''}</span>
              </button>
            );
          })}
        </div>
        <div className="action-buttons">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!equipChoice}
            onClick={() => { if (equipChoice) onResolve(equipChoice); }}>
            替换并弃置
          </button>
          {onInfo && (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => onInfo({
                title: `${newCard.name || '装备牌'} · ${equipTypeLabel(newCard)}`,
                desc: newInfo.detail || newInfo.brief || '新装备放入所选槽位，旧装备进入弃牌堆。',
              })}>
              查看说明
            </button>
          )}
        </div>
      </DraggableShell>
    );
  }

  // 出牌阶段
  if (type === 'play') {
    const shaTargets = action.shaTargets
      || (game?.getValidTargets?.(action.player, '杀'))
      || [];
    const juedouTargets = action.juedouTargets
      || (game?.getValidTargets?.(action.player, '决斗'))
      || [];
    const otherPlayers = action.otherPlayers
      || (game?.distance?.getOtherAlivePlayers(action.player) || []);

    const card = selectedCards[0];
    const targetsFor = (name, fallback) => action.targetsByCard?.[name]
      || (game?.getValidTargets?.(action.player, name))
      || fallback;
    let needsTarget = false;
    let validTargets = [];
    if (card) {
      if (card.name === '杀') {
        needsTarget = true;
        validTargets = targetsFor('杀', shaTargets);
      } else if (card.name === '决斗') {
        needsTarget = true;
        validTargets = targetsFor('决斗', juedouTargets);
      } else if (['顺手牵羊', '过河拆桥', '乐不思蜀', '兵粮寸断'].includes(card.name)) {
        needsTarget = true;
        validTargets = targetsFor(card.name, otherPlayers);
      }
    }

    const cardPlayable = card
      ? (Array.isArray(action.playableIds)
        ? action.playableIds.includes(card.id)
        : !!game?.canPlayCard?.(action.player, card))
      : false;
    const sameTarget = (a, b) => !!a && !!b && (
      (a.id && b.id) ? a.id === b.id : a.name === b.name
    );
    // 方天画戟：最后一张手牌当【杀】时可逐目标勾选至多 3 名目标
    // 联机客户端没有本地引擎，用房主下发的 fangtianReady / equips 判定
    const fangtianReady = !!card && card.name === '杀' && (
      !!action.fangtianReady
      || ((action.player?.handCards?.length === 1 || action.player?.handCardCount === 1)
        && (game
          ? !!game.hasEquip?.(action.player, '方天画戟')
          : Object.values(action.player?.equips || {}).some(eq => eq?.name === '方天画戟')))
    );
    const multiMode = fangtianReady && validTargets.length > 0;
    const chosenTargets = multiMode && fangtianTargets.length
      ? fangtianTargets
      : (selectedTarget ? [selectedTarget] : []);
    const targetValid = !needsTarget || (multiMode
      ? chosenTargets.length > 0
        && chosenTargets.length <= 3
        && chosenTargets.every(t => validTargets.some(v => sameTarget(v, t)))
      : (selectedTarget && validTargets.some(t => sameTarget(t, selectedTarget))));
    const canConfirm = selectedCards.length === 1 && cardPlayable && targetValid;
    const canFangtian = multiMode && validTargets.length > 1;

    return (
      <DraggableShell drag={drag} minWidth={400}>
        <h3>出牌阶段</h3>
        <p className="action-hint">
          从下方手牌中选择一张牌
          {card && <span className="picked-card">已选：{card.name}</span>}
        </p>
        {recommendHint && (
          <p className={`recommend-hint ${recommendHint.startsWith('推荐：') ? 'ok' : ''}`}>
            {recommendHint}
          </p>
        )}

        {action.activeSkills && action.activeSkills.length > 0 && (
          <div className="skill-actions">
            <span className="skill-actions-label">主动技能</span>
            {action.activeSkills.map(sk => (
              <button key={sk.id} className="btn btn-small" title={sk.description || ''}
                onClick={() => {
                  onResolve({ type: 'useSkill', skillId: sk.id });
                  clearSelection();
                }}>
                {sk.name}
              </button>
            ))}
          </div>
        )}

        {action.weaponActions && action.weaponActions.length > 0 && (
          <div className="skill-actions weapon-actions">
            <span className="skill-actions-label">武器</span>
            {action.weaponActions.map(w => (
              <button key={w.id} className="btn btn-small" title={w.description || ''}
                onClick={() => {
                  onResolve({ type: 'useWeapon', weapon: w.id });
                  clearSelection();
                }}>
                {w.name}
              </button>
            ))}
          </div>
        )}

        {needsTarget && card && (
          <div className="target-selection">
            <p>
              选择目标:
              {multiMode && (
                <span className="fangtian-hint">
                  {' '}方天画戟：逐个点选至多 3 名目标（已选 {fangtianTargets.length}/3）
                </span>
              )}
            </p>
            <div className="target-list">
              {validTargets.map(t => {
                const picked = multiMode
                  ? fangtianTargets.some(x => sameTarget(x, t))
                  : selectedTarget?.id === t.id;
                const ally = isAllyTarget(t);
                return (
                  <button key={t.id}
                    className={`btn btn-small ${picked ? 'btn-primary' : ''} ${ally ? 'target-ally' : ''}`}
                    title={targetButtonTitle(t)}
                    onClick={() => {
                      if (multiMode) setFangtianTargets(prev => toggleFangtianTarget(prev, t, 3));
                      else setSelectedTarget(t);
                    }}>
                    {targetButtonLabel(t)}
                  </button>
                );
              })}
              {validTargets.length === 0 && <span className="empty-hand">暂无可用目标</span>}
            </div>
            {selectedTarget && (isAllyTarget(selectedTarget) || distFor(selectedTarget)) && (
              <p className={`target-distance-hint ${isAllyTarget(selectedTarget) ? 'friendly-warning' : ''}`}>
                {`已选目标：${selectedTarget.name}`
                  + `${isAllyTarget(selectedTarget) ? '（队友，将攻击队友）' : ''}`
                  + `${distFor(selectedTarget) ? ` · ${distFor(selectedTarget).label}` : ''}`}
              </p>
            )}
          </div>
        )}

        <div className="action-buttons">
          {canFangtian && (
            <button className="btn"
              title="方天画戟：以最后一张手牌为杀，逐个勾选至多 3 个目标"
              disabled={fangtianTargets.length < 1}
              onClick={() => {
                onResolve({ card, targets: fangtianTargets.slice(0, 3) });
                clearSelection();
              }}>
              方天画戟 · 出杀（{fangtianTargets.length} 目标）
            </button>
          )}
          {onRecommend && (
            <button className="btn" onClick={onRecommend} title="按 AI 建议直接出牌">
              推荐出牌
            </button>
          )}
          <button className="btn btn-primary" disabled={!canConfirm}
            onClick={() => {
              onResolve({ card: selectedCards[0], targets: chosenTargets.slice(0, 3) });
              clearSelection();
            }}>
            确认出牌
          </button>
          <button className="btn btn-danger" onClick={() => {
            onResolve({ type: 'endPlay' });
            clearSelection();
          }}>
            结束出牌
          </button>
        </div>

        <style>{`
          .action-panel h3 { color: var(--accent-gold); margin-bottom: 8px; }
          .action-hint { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
          .recommend-hint { font-size: 12.5px; color: var(--text-secondary); margin: -4px 0 10px; }
          .recommend-hint.ok { color: var(--gold-bright); }
          .picked-card { margin-left: 10px; color: var(--accent-gold); }
          .skill-actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 12px; }
          .skill-actions-label { font-size: 12px; color: var(--text-secondary); }
          .target-selection { margin-bottom: 12px; }
          .target-selection p { font-size: 13px; margin-bottom: 4px; }
          .target-list { display: flex; gap: 6px; flex-wrap: wrap; }
          .fangtian-hint { font-size: 12px; color: var(--gold-bright); }
          .action-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
        `}</style>
      </DraggableShell>
    );
  }

  // 弃牌阶段
  if (type === 'discard') {
    return (
      <DraggableShell drag={drag} minWidth={380}>
        <h3>弃牌阶段</h3>
        <p className="action-hint">
          从下方手牌选择 {count} 张弃置（已选 {selectedCards.length}/{count}）
        </p>
        <div className="action-buttons">
          <button className="btn btn-primary" disabled={selectedCards.length !== count}
            onClick={() => {
              onResolve(selectedCards);
              clearSelection();
            }}>
            确认弃牌
          </button>
        </div>

        <style>{`
          .action-panel h3 { color: var(--accent-gold); margin-bottom: 8px; }
          .action-hint { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
          .action-buttons { display: flex; gap: 10px; }
        `}</style>
      </DraggableShell>
    );
  }

  // 响应请求(闪/桃/杀等)
  if (type === 'respond') {
    // 无合法响应牌时给出明确提示：直接点「不使用」即可退出，不会卡住对局
    const legalCards = Array.isArray(action.cards)
      ? action.cards
      : (typeof action.filter === 'function' && Array.isArray(action.player?.handCards)
        ? action.player.handCards.filter(action.filter)
        : null);
    const noLegal = Array.isArray(legalCards) && legalCards.length === 0;
    return (
      <DraggableShell drag={drag} minWidth={380}>
        <h3>响应请求</h3>
        <p className="action-hint">
          {noLegal
            ? '没有可用于响应的手牌，点「不使用」继续对局'
            : `是否需要使用手牌响应？${selectedCards[0] ? `已选：${selectedCards[0].name}` : '请在下方手牌中选择'}`}
        </p>
        <div className="action-buttons">
          <button className="btn btn-primary" disabled={selectedCards.length !== 1}
            onClick={() => {
              onResolve(selectedCards[0]);
              clearSelection();
            }}>
            使用
          </button>
          <button className="btn btn-danger" onClick={() => {
            onResolve(null);
            clearSelection();
          }}>
            不使用
          </button>
        </div>

        <style>{`
          .action-panel h3 { color: var(--accent-gold); margin-bottom: 8px; }
          .action-hint { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
          .action-buttons { display: flex; gap: 10px; }
        `}</style>
      </DraggableShell>
    );
  }

  // 确认请求(技能发动等)
  if (type === 'confirm') {
    return (
      <DraggableShell drag={drag}>
        <h3>技能确认</h3>
        <p className="action-hint">{action.message || '是否发动技能？'}</p>
        <div className="action-buttons">
          <button className="btn btn-primary" onClick={() => onResolve(true)}>
            发动
          </button>
          <button className="btn btn-danger" onClick={() => onResolve(false)}>
            取消
          </button>
        </div>

        <style>{`
          .action-panel h3 { color: var(--accent-gold); margin-bottom: 8px; }
          .action-hint { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
          .action-buttons { display: flex; gap: 10px; }
        `}</style>
      </DraggableShell>
    );
  }

  // 主动技能：选择手牌（可多选）
  if (type === 'selectCards') {
    const cards = action.cards || [];
    const min = action.min || 1;
    const max = Math.min(action.max || cards.length, cards.length);
    const same = (a, b) => (a?.id ?? '') === (b?.id ?? '');
    const toggle = (card) => {
      if (selectedCards.some(c => same(c, card))) {
        setSelectedCards(selectedCards.filter(c => !same(c, card)));
      } else if (selectedCards.length < max) {
        setSelectedCards([...selectedCards, card]);
      }
    };
    const canConfirm = selectedCards.length >= min && selectedCards.length <= max;

    return (
      <DraggableShell drag={drag} minWidth={420} maxWidth={560}>
        <h3>选择手牌</h3>
        <p className="action-hint">
          {action.hint || `请选择 ${min}~${max} 张手牌`}（已选 {selectedCards.length}）
        </p>
        <div className="hand-selection">
          {cards.map(card => (
            <div key={card.id}
              className={`game-card ${card.suit} card-type-${card.type || 'basic'} ${selectedCards.some(c => same(c, card)) ? 'selected' : ''}`}
              onClick={() => {
                if (drag.consumeDrag()) return;
                toggle(card);
              }}>
              <CardFace card={card} showBrief={false} onInfo={onInfo} />
            </div>
          ))}
          {cards.length === 0 && <span className="empty-hand">没有可选的牌</span>}
        </div>
        <div className="action-buttons">
          <button className="btn btn-primary" disabled={!canConfirm}
            onClick={() => {
              onResolve(selectedCards);
              setSelectedCards([]);
            }}>
            确认
          </button>
          <button className="btn btn-danger" onClick={() => {
            onResolve(null);
            setSelectedCards([]);
          }}>
            取消
          </button>
        </div>

        <style>{`
          .action-panel h3 { color: var(--accent-gold); margin-bottom: 8px; }
          .action-hint { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
          .hand-selection { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
          .action-buttons { display: flex; gap: 10px; }
        `}</style>
      </DraggableShell>
    );
  }

  // 主动技能：选择目标
  if (type === 'chooseTarget') {
    const candidates = action.candidates || [];
    return (
      <DraggableShell drag={drag}>
        <h3>选择目标</h3>
        <p className="action-hint">{action.hint || '请选择一名角色'}</p>
        <div className="target-list">
          {candidates.map(t => {
            const ally = isAllyTarget(t);
            return (
              <button key={t.id} className={`btn btn-small ${ally ? 'target-ally' : ''}`}
                title={targetButtonTitle(t)}
                onClick={() => {
                  onResolve(t);
                  setSelectedCards([]);
                }}>
                {targetButtonLabel(t)}
              </button>
            );
          })}
          {candidates.length === 0 && <span className="empty-hand">没有可选目标</span>}
        </div>
        <div className="action-buttons" style={{ marginTop: 12 }}>
          <button className="btn btn-danger" onClick={() => {
            onResolve(null);
            setSelectedCards([]);
          }}>
            取消
          </button>
        </div>

        <style>{`
          .action-panel h3 { color: var(--accent-gold); margin-bottom: 8px; }
          .action-hint { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
          .target-list { display: flex; gap: 6px; flex-wrap: wrap; }
          .action-buttons { display: flex; gap: 10px; }
        `}</style>
      </DraggableShell>
    );
  }

  return null;
}
