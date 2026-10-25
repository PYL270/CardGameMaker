import React from 'react';
import { tokenizeSkillText, SKILL_KEYWORD_GROUPS } from './skillText';

/** 技能描述富文本：纯 React 节点渲染，不使用 innerHTML。 */
export default function SkillText({ text = '', className = '' }) {
  const tokens = tokenizeSkillText(text);
  if (tokens.length === 0) return null;
  return (
    <span className={`skill-text ${className}`.trim()}>
      {tokens.map((token, index) => (
        token.type === 'plain'
          ? token.text
          : (
            <span key={index} className={`skill-kw skill-kw--${token.type}`}>
              {token.text}
            </span>
          )
      ))}
    </span>
  );
}

/** 颜色图例：技能编辑器 / 拼装器共用 */
export function SkillKeywordLegend({ compact = false }) {
  return (
    <div className={`skill-kw-legend ${compact ? 'compact' : ''}`} aria-label="技能描述颜色图例">
      {SKILL_KEYWORD_GROUPS.map(group => (
        <span className="skill-kw-legend-item" key={group.type}>
          <span className={`skill-kw skill-kw--${group.type}`}>{group.sample}</span>
          <em>{group.label}</em>
        </span>
      ))}
    </div>
  );
}
