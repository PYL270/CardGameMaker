import React from 'react';
import { GROUP_COLORS } from '../../core/Character';
import { getCardText } from '../../data/cardText';
import { statusChipList } from './infoTexts';
import { isTeamMode } from './teamConfig';
import { attackRangeHint } from './distanceInfo';
import Icon from '../ui/Icon';
import Portrait from '../ui/Portrait';
import { skillTypeInfo } from '../ui/skillType';
import { buildEquipSlots, equipTypeLabel } from './equipSlots';

/**
 * SelfCharacterCard - 自己的武将角色卡（三国杀式：放在手牌旁边）
 */
export default function SelfCharacterCard({
  player, hit = false, damage = null, onPointerDown, onDoubleClick, onInfo, teamMode = 'ffa',
  showDistance = true,
}) {
  if (!player) return null;

  const character = player.character || null;
  const groupColor = GROUP_COLORS[character?.group] || 'rgba(255,255,255,0.35)';
  const hpArray = Array.from({ length: player.maxHp || 0 }, (_, i) => i < player.hp);
  const equipment = buildEquipSlots(player);
  const judges = player.judgeCards || [];
  const skills = player.skills || [];
  const statusChips = statusChipList(player);
  const teamModeOn = isTeamMode(teamMode);
  const rangeHint = attackRangeHint(player);

  const emitInfo = (info, e) => {
    if (!onInfo) return;
    e.stopPropagation();
    onInfo(info, e);
  };

  return (
    <div
      className={`self-character ${hit ? 'hit' : ''} ${player.usedJiu ? 'jiu' : ''} ${player.status === 'dying' ? 'dying' : ''} ${player.hp <= 1 && player.status !== 'dead' ? 'low-hp' : ''} ${teamModeOn ? 'team-ally' : ''}`}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      title={`按住角色卡可移动整个手牌区，双击复位 · ${rangeHint.title}`}>
      {damage && <div className="damage-pop" key={damage.id}>-{damage.num}</div>}

      {statusChips.length > 0 && (
        <div className="status-chips">
          {statusChips.map(s => (
            <span
              key={s.key}
              className={`status-chip status-${s.key} ${onInfo ? 'clickable' : ''}`} data-info-trigger="1"
              title={onInfo ? '点击查看说明' : s.desc}
              onClick={onInfo ? (e) => emitInfo(s, e) : undefined}
            >
              {s.label}
            </span>
          ))}
        </div>
      )}

      <div className="self-char-head">
        <div className="self-avatar" style={{ borderColor: groupColor }}>
          <Portrait
            src={character?.imageUrl}
            name={character?.name || player.name}
            alt={`${character?.name || player.name}头像`}
          />
        </div>
        <div className="self-char-info">
          <span className="self-name-row">
            <span className="self-name">{player.name}</span>
            {teamModeOn && <span className="team-chip ally">我方</span>}
          </span>
          <span className="self-char-name">{character?.name || '基础角色'}</span>
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
          {showDistance && (
            <span className="distance-chip range-chip" title={rangeHint.title} data-info-trigger="1">
              {rangeHint.label}
            </span>
          )}
        </div>
      </div>

      <div className="self-tags self-equip-section">
        <span className="self-tags-label">{equipment.title}</span>
        <div className="self-equip-slots">
          {equipment.slots.map(({ slotKey, card, index }) => (
            card ? (
              <span
                key={slotKey}
                className={`equip-slot filled self-equip-slot ${onInfo ? 'clickable' : ''}`} data-info-trigger="1"
                title={onInfo ? '点击查看装备说明' : undefined}
                onClick={onInfo
                  ? (e) => emitInfo({ title: `${card.name} · 装备`, desc: getCardText(card.name).detail || '装备牌提供武器攻击范围、防具或 ±1 坐骑距离。' }, e)
                  : undefined}
              >
                <span className="equip-slot-suit" aria-hidden="true">{card.suitSymbol || ''}</span>
                <span className="equip-tag equip-slot-name">{card.name}</span>
                <span className="equip-slot-type">{equipTypeLabel(card)}</span>
              </span>
            ) : (
              <span className="equip-slot empty self-equip-slot" key={`empty-${index}`} aria-hidden="true">
                <span className="equip-slot-plus">＋</span>
                <span className="equip-slot-empty-label">装备</span>
              </span>
            )
          ))}
        </div>
      </div>

      {judges.length > 0 && (
        <div className="self-tags">
          <span className="self-tags-label">判定</span>
          {judges.map((c, i) => (
            <span
              key={i}
              className={`judge-tag ${onInfo ? 'clickable' : ''}`} data-info-trigger="1"
              title={onInfo ? '点击查看判定牌说明' : undefined}
              onClick={onInfo
                ? (e) => emitInfo({ title: `${c.name} · 判定`, desc: '延时锦囊在判定阶段结算：乐不思蜀红桃跳过出牌，兵粮黑桃跳过摸牌，闪电黑桃2~9受2点雷电伤害。' }, e)
                : undefined}
            >
              判·{c.name}
            </span>
          ))}
        </div>
      )}

      {skills.length > 0 && (
        <div className="self-tags">
          <span className="self-tags-label">技能</span>
          {skills.map(s => {
            const t = skillTypeInfo(s);
            return (
              <span
                key={s.id}
                className={`skill-tag skill-type-${t.key} ${t.key === 'active' ? 'skill-activable' : 'skill-passive'} ${onInfo ? 'clickable' : ''}`}
                data-info-trigger="1"
                title={`${t.title}${s.description ? ` · ${s.description}` : ''}`}
                onClick={onInfo
                  ? (e) => emitInfo({ title: s.name, desc: `${t.full}：${s.description || '暂无说明'}` }, e)
                  : undefined}
              >
                {s.name}
                <i className={`skill-type-badge ${t.key}`}>{t.label}</i>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
