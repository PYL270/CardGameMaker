import React from 'react';
import { GROUP_NAMES, GROUP_COLORS } from '../../core/Character';
import { skillTypeInfo } from '../ui/skillType';
import SkillText from '../ui/SkillText.jsx';
import {
  normalizeCharacterForm,
  normalizeAppearance,
  SEX_LABEL,
} from './characterWorkshopModel';

/**
 * 武将卡牌实时预览（工坊右侧）：360×520 黑金实体卡质感。
 * 纯展示组件，SSR 可用；不依赖 store。
 */
export default function CharacterCardPreview({ form, skills = [], appearance, meta = {} }) {
  const f = normalizeCharacterForm(form || {});
  const app = normalizeAppearance(appearance);
  const groupLabel = GROUP_NAMES[f.group] || '自定义';
  const groupColor = GROUP_COLORS[f.group] || 'rgba(214,185,110,.6)';
  const selectedSkills = (f.skillIds || [])
    .map(id => (skills || []).find(s => s.id === id))
    .filter(Boolean);
  const number = meta.number || f.id || 'CUSTOM';

  return (
    <article
      className="workshop-card"
      data-frame={app.frame}
      style={{ '--workshop-accent': app.accent, '--workshop-group': groupColor }}
      aria-label="武将卡牌实时预览">
      <div className="workshop-card-grain" aria-hidden="true" />
      <span className="workshop-corner ws-tl" aria-hidden="true"><i /></span>
      <span className="workshop-corner ws-tr" aria-hidden="true"><i /></span>
      <span className="workshop-corner ws-bl" aria-hidden="true"><i /></span>
      <span className="workshop-corner ws-br" aria-hidden="true"><i /></span>

      <div className={`workshop-card-art ${f.imageUrl ? 'has-art' : 'no-art'}`}>
        {f.imageUrl
          ? <img src={f.imageUrl} alt={f.name ? `${f.name}立绘` : '武将立绘'} loading="lazy" />
          : <span className="workshop-art-ink" aria-hidden="true">墨</span>}
      </div>

      <div className="workshop-card-top">
        <div className="workshop-group-badge" title={`势力：${groupLabel}`}>{groupLabel}</div>
        <h2 className="workshop-card-name">{f.name || '无名武将'}</h2>
        <div className="workshop-hp-badge" title={`体力 ${f.hp} / ${f.maxHp}`}>
          <span className="workshop-hp-value">{f.hp}</span>
          <span className="workshop-hp-label">体力</span>
        </div>
      </div>

      <div className="workshop-card-meta">
        <span className="workshop-chip faction">{groupLabel}</span>
        <span className="workshop-chip">{SEX_LABEL[f.sex] || '男'}</span>
        <span className="workshop-chip number">{number}</span>
      </div>

      <div className="workshop-equip-slots" aria-label={`装备栏 ${f.equipSlots} 格`}>
        <span className="workshop-equip-label">{`装备栏 ${f.equipSlots}`}</span>
        <div className="workshop-equip-boxes">
          {Array.from({ length: f.equipSlots }, (_, index) => (
            <span className="workshop-equip-slot" key={index} aria-hidden="true">＋</span>
          ))}
        </div>
      </div>

      <div className="workshop-card-skills-wrap">
        <div className="workshop-card-skills">
          {selectedSkills.length === 0 && (
            <div className="workshop-skills-empty">
              暂无技能
              <small>去左侧「技能」选择</small>
            </div>
          )}
          {selectedSkills.map(skill => {
            const info = skillTypeInfo(skill);
            return (
              <div key={skill.id} className="workshop-skill-block" data-seal="技">
                <div className="workshop-skill-head">
                  <span className="workshop-skill-name">{skill.name}</span>
                  <span className={`workshop-skill-tag ${info.key}`}>{info.label}</span>
                </div>
                {skill.description && (
                  <p className="workshop-skill-desc"><SkillText text={skill.description} /></p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="workshop-card-bottom">
        <p className="workshop-card-desc">{f.description || '暂无背景描述'}</p>
        <div className="workshop-card-foot">
          <span>{meta.artist || '佚名'}</span>
          <span className="number">{number}</span>
        </div>
      </div>
    </article>
  );
}
