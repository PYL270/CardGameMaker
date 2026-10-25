import React from 'react';
import { CARD_GUIDE, getCardText } from '../../data/cardText';
import { BASE_SKILLS } from '../../data/basicCharacter';
import { CLASSIC_CHARACTERS, CLASSIC_SKILLS } from '../../data/classicCharacters';
import { GROUP_NAMES } from '../../core/Character';
import SkillText from '../ui/SkillText.jsx';

/**
 * 按说明文本分组：detail 完全相同的卡牌合并为一条（如仍存在同名/同效果副本），
 * 说明不同的卡牌各自独立展示。
 * 抽成纯函数便于测试（可用 mock lookup 验证合并/不合并）。
 */
export function mergeGuideEntries(names, lookup = getCardText) {
  const merged = [];
  const byDetail = new Map();
  for (const name of names || []) {
    const info = lookup(name) || { detail: name };
    const key = info.detail || name;
    if (byDetail.has(key)) {
      byDetail.get(key).names.push(name);
    } else {
      const entry = { names: [name], info };
      byDetail.set(key, entry);
      merged.push(entry);
    }
  }
  return merged;
}

/**
 * CardGuide - 卡牌与技能详细说明面板（点击按钮打开）
 */
export default function CardGuide({ onClose }) {
  return (
    <div className="overlay card-guide-overlay" onClick={onClose}>
      <div className="panel card-guide" onClick={(e) => e.stopPropagation()}>
        <div className="guide-head">
          <h2>卡牌与技能说明</h2>
          <button className="btn btn-small" onClick={onClose}>关闭</button>
        </div>

        <div className="guide-body">
          {CARD_GUIDE.map(group => {
            // 合并描述完全相同的卡牌；坐骑说明差异化后会自动各自独立展示
            const merged = mergeGuideEntries(group.items);
            return (
              <section key={group.title} className="guide-section">
                <h3>{group.title}</h3>
                <div className="guide-grid">
                  {merged.map(entry => {
                    const info = entry.info;
                    return (
                      <div key={entry.names.join('/')} className="guide-item">
                        <div className="guide-item-name">
                          {entry.names.join(' / ')}
                          {info.brief && <span className="guide-item-brief">{info.brief}</span>}
                        </div>
                        <p>{info.detail}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <section className="guide-section">
            <h3>基础角色技能</h3>
            <div className="guide-grid">
              {BASE_SKILLS.map(skill => (
                <div key={skill.id} className="guide-item">
                  <div className="guide-item-name">
                    {skill.name}
                    <span className="guide-item-brief">锁定技</span>
                  </div>
                  <p><SkillText text={skill.description} /></p>
                </div>
              ))}
            </div>
          </section>

          <section className="guide-section">
            <h3>经典武将技能</h3>
            <div className="guide-grid">
              {CLASSIC_CHARACTERS.map(hero => (
                <div key={hero.id} className="guide-item">
                  <div className="guide-item-name">
                    {hero.name}
                    <span className="guide-item-brief">
                      {GROUP_NAMES[hero.group] || hero.group} · {hero.hp}体力
                    </span>
                  </div>
                  {hero.skillIds.map(id => {
                    const skill = CLASSIC_SKILLS.find(s => s.id === id);
                    if (!skill) return null;
                    return (
                      <p key={id} style={{ marginTop: 6 }}>
                        <b style={{ color: 'var(--accent-gold)' }}>【{skill.name}】</b>
                        <SkillText text={skill.description} />
                      </p>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <style>{`
        .card-guide-overlay { z-index: 1500; }
        .card-guide {
          width: min(900px, 92vw);
          max-height: 86vh;
          display: flex;
          flex-direction: column;
          padding: 20px 22px;
          border-radius: 26px;
        }
        .guide-head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin-bottom: 14px; flex-shrink: 0;
        }
        .guide-head h2 { color: var(--accent-gold); font-size: 22px; }
        .guide-body { overflow-y: auto; padding-right: 6px; }
        .guide-section { margin-bottom: 20px; }
        .guide-section h3 {
          color: var(--accent-gold);
          font-size: 15px;
          font-family: var(--font-serif);
          letter-spacing: 1px;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid rgba(214, 185, 110, 0.22);
        }
        .guide-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 8px;
        }
        .guide-item {
          background: linear-gradient(160deg, rgba(30, 33, 40, 0.9), rgba(10, 12, 17, 0.92));
          border: 1px solid rgba(214, 185, 110, 0.18);
          border-radius: 10px;
          padding: 8px 10px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 6px 16px rgba(0, 0, 0, 0.3);
        }
        .guide-item-name {
          display: flex; align-items: baseline; gap: 8px;
          font-weight: 700; font-size: 13.5px;
          color: var(--text-primary);
        }
        .guide-item-brief {
          font-size: 10.5px;
          color: var(--text-secondary);
          font-weight: 400;
        }
        .guide-item p {
          margin-top: 4px;
          font-size: 11.5px;
          line-height: 1.55;
          color: var(--text-secondary);
        }
        @media (max-height: 700px) {
          .card-guide { max-height: 92vh; }
        }
      `}</style>
    </div>
  );
}
