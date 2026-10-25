import React from 'react';
import { SUIT_SYMBOLS } from '../../core/Card';
import { GROUP_COLORS } from '../../core/Character';
import { getCardText } from '../../data/cardText';
import { statusChipList } from './infoTexts';
import { teamChipFor, teamClassFor } from './teamConfig';
import { distanceHint } from './distanceInfo';
import Icon from '../ui/Icon';
import Portrait from '../ui/Portrait';
import { skillTypeInfo } from '../ui/skillType';
import { buildEquipSlots, equipTypeLabel } from './equipSlots';
import { bondsByIds } from '../../data/bonds';

export default function PlayerArea({
  player, isSelf, isCurrent, selectable, onSelect,
  selectedCards = [], onCardSelect, hit = false, damage = null, hideHand = false,
  onInfo, teamMode = 'ffa', selfSeatNum = 0,
  showDistance = true, distanceMe = null, distancePlayers = null,
}) {
  if (!player) return null;

  const hpArray = Array.from({ length: player.maxHp }, (_, i) => i < player.hp);
  const statusChips = statusChipList(player);
  const teamChip = teamChipFor(player, selfSeatNum, teamMode);
  const teamClass = teamClassFor(teamChip);
  const dist = (!isSelf && showDistance && distanceMe && distancePlayers && player.status === 'alive')
    ? distanceHint(distanceMe, player, distancePlayers)
    : null;
  const equipment = buildEquipSlots(player);
  const bondDefs = bondsByIds(player.bondIds);

  return (
    <div
      className={`player-area ${isCurrent ? 'current' : ''} ${player.status === 'dead' ? 'dead' : ''} ${selectable ? 'selectable' : ''} ${hit ? 'hit' : ''} ${player.usedJiu ? 'jiu' : ''} ${player.status === 'dying' ? 'dying' : ''} ${player.hp <= 1 && player.status !== 'dead' ? 'low-hp' : ''} ${player.isTurnedOver ? 'turned' : ''} ${player.isLinked || player.isChained ? 'chained' : ''} ${teamClass}`}
      onClick={selectable ? onSelect : undefined}>

      {/* 伤害飘字 */}
      {damage && (
        <div className="damage-pop" key={damage.id}>-{damage.num}</div>
      )}

      {/* 武将信息 */}
      <div className="player-info">
        <div className="player-avatar" style={{
          borderColor: GROUP_COLORS[player.character?.group] || 'rgba(255,255,255,0.35)',
        }}>
          <Portrait
            src={player.character?.imageUrl}
            name={player.character?.name || player.name}
            alt={`${player.character?.name || player.name}头像`}
          />
        </div>
        <div className="player-details">
          <div className="player-name-row">
            <span className="player-name">{player.name}</span>
            {teamChip && (
              <span className={`team-chip ${teamChip === '我方' ? 'ally' : 'enemy'}`}>{teamChip}</span>
            )}
          </div>
          {player.character && <span className="char-name">{player.character.name}</span>}
          {/* 体力条 */}
          <div className="hp-bar" data-hp={Math.max(0, player.hp)} data-max-hp={player.maxHp}>
            {hpArray.map((filled, i) => (
              <span key={i} className={`hp-dot ${filled ? 'filled' : 'empty'}`} title={filled ? '体力' : '失去体力'}>
                <Icon name="heart" size={12} />
              </span>
            ))}
            {player.hujia > 0 && (
              <span className="hp-dot armor"><Icon name="shield" size={11} />{player.hujia}</span>
            )}
          </div>
          {dist && (
            <span
              className={`distance-chip ${dist.inRange ? 'in-range' : 'out-range'}`}
              title={dist.title}
              data-info-trigger="1">
              {dist.label}
            </span>
          )}
        </div>
      </div>

      {statusChips.length > 0 && (
        <div className="status-chips">
          {statusChips.map(s => (
            <span
              key={s.key}
              className={`status-chip status-${s.key} ${onInfo ? 'clickable' : ''}`} data-info-trigger="1"
              title={onInfo ? '点击查看说明' : s.desc}
              onClick={onInfo ? (e) => { e.stopPropagation(); onInfo(s, e); } : undefined}
            >
              {s.label}
            </span>
          ))}
        </div>
      )}

      {bondDefs.length > 0 && (
        <div className="bond-tags player-bond-tags">
          {bondDefs.map(bond => (
            <span
              key={bond.id}
              className={`bond-tag ${onInfo ? 'clickable' : ''}`}
              data-info-trigger="1"
              title={`${bond.name}：${bond.desc}`}
              onClick={onInfo
                ? (e) => { e.stopPropagation(); onInfo({ title: `羁绊 · ${bond.name}`, desc: `${bond.desc} 组合技：${bond.comboDesc}` }, e); }
                : undefined}
            >
              {bond.name}
            </span>
          ))}
        </div>
      )}

      {/* 装备区：固定 equipLimit 个框，空框显示淡金虚位 */}
      <div className="equip-area">
        <span className="equip-area-title">{equipment.title}</span>
        <div className="equip-slots">
          {equipment.slots.map(({ slotKey, card, index }) => (
            card ? (
              <span
                key={slotKey}
                className={`equip-slot filled ${onInfo ? 'clickable' : ''}`} data-info-trigger="1"
                title={onInfo ? '点击查看装备说明' : undefined}
                onClick={onInfo
                  ? (e) => { e.stopPropagation(); onInfo({ title: `${card.name} · 装备`, desc: getCardText(card.name).detail || '装备牌提供武器攻击范围、防具或 ±1 坐骑距离。' }, e); }
                  : undefined}
              >
                <span className="equip-slot-suit" aria-hidden="true">{card.suitSymbol || ''}</span>
                <span className="equip-tag equip-slot-name">{card.name}</span>
                <span className="equip-slot-type">{equipTypeLabel(card)}</span>
              </span>
            ) : (
              <span className="equip-slot empty" key={`empty-${index}`} aria-hidden="true">
                <span className="equip-slot-plus">＋</span>
                <span className="equip-slot-empty-label">装备</span>
              </span>
            )
          ))}
        </div>
      </div>

      {/* 判定区 */}
      {player.judgeCards?.length > 0 && (
        <div className="judge-area">
          {player.judgeCards.map((c, i) => (
            <span
              key={i}
              className={`judge-tag ${onInfo ? 'clickable' : ''}`} data-info-trigger="1"
              title={onInfo ? '点击查看判定牌说明' : undefined}
              onClick={onInfo
                ? (e) => { e.stopPropagation(); onInfo({ title: `${c.name} · 判定`, desc: '延时锦囊在判定阶段结算：乐不思蜀红桃跳过出牌，兵粮黑桃跳过摸牌，闪电黑桃2~9受2点雷电伤害。' }, e); }
                : undefined}
            >
              判·{c.name}
            </span>
          ))}
        </div>
      )}

      {/* 手牌(仅自己显示；操作面板打开时由面板集中展示，避免重复) */}
      {isSelf && !hideHand && (
        <div className="hand-cards">
          {player.handCards?.map((card, i) => (
            <div key={card.id || i}
              className={`game-card ${card.suit} ${selectedCards.includes(card) ? 'selected' : ''}`}
              onClick={(e) => { e.stopPropagation(); onCardSelect?.(card); }}>
              <span className="card-suit">{SUIT_SYMBOLS[card.suit]}</span>
              <span className="card-number">{card.numberDisplay}</span>
              <span className="card-name">{card.name}</span>
            </div>
          ))}
          {(!player.handCards || player.handCards.length === 0) && (
            <span className="empty-hand">无手牌</span>
          )}
        </div>
      )}

      {/* 非自己：只显示牌背与张数（不公开牌面） */}
      {!isSelf && (
        <div
          className="opponent-hand"
          key={`${player.id}_${player.handCardCount || 0}`}
          title={`手牌 ${player.handCardCount || 0} 张（不公开）`}>
          <div className="card-backs" aria-hidden="true">
            {Array.from({ length: Math.min(player.handCardCount || 0, 5) }).map((_, i) => (
              <span key={i} className="mini-back" style={{ animationDelay: `${i * 45}ms` }} />
            ))}
            {(player.handCardCount || 0) === 0 && <span className="no-card">无手牌</span>}
          </div>
          <span className="hand-count">手牌 {player.handCardCount || 0}</span>
        </div>
      )}

      {/* 技能标签 */}
      {player.skills?.length > 0 && (
        <div className="skill-tags">
          {player.skills.map(s => {
            const t = skillTypeInfo(s);
            return (
              <span
                key={s.id}
                className={`skill-tag skill-type-${t.key} ${t.key === 'active' ? 'skill-activable' : 'skill-passive'} ${onInfo ? 'clickable' : ''}`}
                data-info-trigger="1"
                title={`${t.title}${s.description ? ` · ${s.description}` : ''}`}
                onClick={onInfo
                  ? (e) => { e.stopPropagation(); onInfo({ title: s.name, desc: `${t.full}：${s.description || '暂无说明'}` }, e); }
                  : undefined}
              >
                {s.name}
                <i className={`skill-type-badge ${t.key}`}>{t.label}</i>
              </span>
            );
          })}
        </div>
      )}

      <style>{`
        .player-area {
          position: relative;
          background:
            linear-gradient(160deg, rgba(25, 28, 35, 0.94), rgba(9, 11, 16, 0.95)) padding-box,
            linear-gradient(150deg, rgba(214, 185, 110, 0.4), rgba(255, 255, 255, 0.03) 40%, rgba(214, 185, 110, 0.14)) border-box;
          border: 1px solid transparent;
          border-radius: 14px;
          padding: 12px;
          min-width: 150px;
          box-shadow: 0 14px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
          transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
        }
        .player-area.current {
          border-color: rgba(214, 185, 110, 0.75);
          box-shadow: 0 0 0 1px rgba(214, 185, 110, 0.3),
            0 0 26px rgba(214, 185, 110, 0.22),
            0 14px 32px rgba(0, 0, 0, 0.5);
        }
        .player-area.current .player-avatar {
          animation: avatarAura 2.4s ease-in-out infinite;
        }
        @keyframes avatarAura {
          0%, 100% {
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06),
              0 0 0 0 rgba(214, 185, 110, 0.28);
          }
          50% {
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1),
              0 0 0 6px rgba(214, 185, 110, 0),
              0 0 20px rgba(214, 185, 110, 0.38);
          }
        }
        .player-area.dead { opacity: 0.4; filter: grayscale(0.7); }
        .player-area.selectable { cursor: pointer; }
        .player-area.selectable:hover {
          transform: translateY(-3px);
          border-color: rgba(208, 87, 79, 0.85);
          box-shadow: 0 0 24px rgba(208, 87, 79, 0.25),
            0 14px 32px rgba(0, 0, 0, 0.5);
        }
        .player-info { display: flex; gap: 10px; margin-bottom: 8px; }
        .player-avatar {
          width: 44px; height: 44px;
          border-radius: 50%; border: 2px solid;
          display: flex; align-items: center; justify-content: center;
          font-size: 19px; font-weight: 700;
          background:
            radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.12), transparent 60%),
            linear-gradient(160deg, #1c2028, #0a0c11);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06), 0 4px 10px rgba(0, 0, 0, 0.5);
          flex-shrink: 0;
        }
        .player-details { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .player-name-row { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
        .player-name { font-size: 14px; font-weight: 700; }
        .char-name { font-size: 11px; color: var(--text-secondary); }
        .hp-bar { display: flex; gap: 2px; flex-wrap: wrap; }
        .hp-dot { font-size: 12px; line-height: 1.2; }
        .hp-dot.filled { color: #b8433c; text-shadow: 0 0 6px rgba(184, 67, 60, 0.45); }
        .hp-dot.empty { color: rgba(255, 255, 255, 0.16); }
        .hp-dot.armor { color: var(--accent-blue); }
        .equip-area, .judge-area { display: flex; flex-wrap: wrap; gap: 4px; margin: 5px 0; }
        .equip-tag {
          font-size: 10px; padding: 2px 7px; border-radius: 8px;
          color: #9ecbff; background: rgba(90, 169, 255, 0.14);
          border: 1px solid rgba(90, 169, 255, 0.25);
        }
        .judge-tag {
          font-size: 10px; padding: 2px 7px; border-radius: 8px;
          color: #d3b1ff; background: rgba(176, 107, 255, 0.14);
          border: 1px solid rgba(176, 107, 255, 0.25);
        }
        .hand-cards { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .empty-hand { font-size: 11px; color: var(--text-secondary); }
        .opponent-hand {
          display: flex; align-items: center; gap: 8px;
          margin-top: 6px;
        }
        .card-backs { display: flex; align-items: center; }
        .mini-back {
          position: relative;
          width: 15px; height: 22px;
          border-radius: 3px;
          border: 1px solid rgba(184, 147, 78, 0.4);
          overflow: hidden;
          background:
            repeating-linear-gradient(45deg, rgba(212, 185, 120, 0.09) 0 1px, transparent 1px 5px),
            repeating-linear-gradient(-45deg, rgba(212, 185, 120, 0.07) 0 1px, transparent 1px 6px),
            radial-gradient(ellipse at 50% 50%, transparent 0 34%, rgba(4, 8, 6, 0.35) 100%),
            linear-gradient(160deg, #1a2620, #0a110d);
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.4), 0 2px 5px rgba(0, 0, 0, 0.4);
          margin-left: -6px;
          animation: backIn 0.3s ease backwards;
        }
        /* 金色回纹/菱格：低对比、哑光，无塑料高光 */
        .mini-back::before {
          content: '';
          position: absolute;
          inset: 2px;
          border: 1px solid rgba(184, 147, 78, 0.26);
          border-radius: 2px;
          background-image:
            linear-gradient(45deg, rgba(184, 147, 78, 0.12) 25%, transparent 25% 75%, rgba(184, 147, 78, 0.12) 75%),
            linear-gradient(45deg, rgba(184, 147, 78, 0.12) 25%, transparent 25% 75%, rgba(184, 147, 78, 0.12) 75%);
          background-size: 6px 6px;
          background-position: 0 0, 3px 3px;
          opacity: 0.8;
        }
        .mini-back:first-child { margin-left: 0; }
        .mini-back:nth-child(odd) { transform: rotate(-4deg); }
        .mini-back:nth-child(even) { transform: rotate(3deg); }
        .hand-count { font-size: 11.5px; color: var(--text-secondary); }
        .no-card { font-size: 11px; color: var(--text-secondary); }
        @keyframes backIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .skill-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
        .skill-tag {
          font-size: 10px; padding: 2px 7px; border-radius: 8px;
          background: var(--accent-gold-soft);
          border: 1px solid rgba(247, 201, 72, 0.28);
          color: var(--accent-gold);
        }
      `}</style>
    </div>
  );
}
