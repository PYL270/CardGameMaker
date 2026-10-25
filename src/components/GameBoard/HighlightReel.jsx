import React, { useEffect, useMemo, useRef } from 'react';
import { alertDialog } from '../../utils/dialogService';

export const HIGHLIGHT_LIMIT = 40;

const TYPE_LABELS = {
  damage: '伤害',
  heal: '回复',
  kill: '击杀',
  judge: '判定',
  bond: '羁绊',
  turn: '回合',
};

const TYPE_TONES = {
  damage: 'damage',
  heal: 'recover',
  kill: 'kill',
  judge: 'judge',
  bond: 'bond',
  turn: 'calm',
};

const nameOf = (entity, fallback = '') => {
  if (!entity) return fallback;
  if (typeof entity === 'string') return entity;
  return entity.name || entity.character?.name || fallback;
};

const typeLabelOf = (type) => TYPE_LABELS[type] || '战局';

export function normalizeHighlight(entry = {}) {
  const type = TYPE_LABELS[entry.type] ? entry.type : 'turn';
  return {
    id: entry.id || `hl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    round: Math.max(0, Number(entry.round) || 0),
    type,
    text: String(entry.text || ''),
    tone: entry.tone || TYPE_TONES[type],
    time: Number(entry.time) || Date.now(),
    amount: Number.isFinite(Number(entry.amount)) ? Number(entry.amount) : null,
    major: entry.major === true,
  };
}

/**
 * 引擎 effect → 高光条目（纯函数，不改状态）。
 * @param {object} effect - Game.ui.onEffect 事件
 * @param {object} options - { round, now, wasDying }
 * @returns {null|{type,text,tone,amount,major}}
 */
export function highlightFromEffect(effect, { round = 0, now = Date.now(), wasDying = false } = {}) {
  if (!effect || typeof effect !== 'object') return null;
  const targetName = nameOf(effect.target, effect.targetName || '目标');
  const sourceName = nameOf(effect.source || effect.player, effect.sourceName || effect.playerName || '');
  const playerName = nameOf(effect.player || effect.target, effect.playerName || effect.targetName || '玩家');

  if (effect.type === 'bondCombo') {
    const members = Array.isArray(effect.members)
      ? effect.members.map(m => nameOf(m)).filter(Boolean)
      : [];
    const bondName = effect.bondName || effect.name || '武将羁绊';
    return {
      type: 'bond',
      text: `${bondName}·合击：${members.length ? members.join('、') : sourceName || '羁绊成员'} 协力，${sourceName || '成员'} 对 ${targetName} 追加 1 点伤害`,
      tone: 'bond',
      amount: 1,
      major: true,
    };
  }

  if (effect.type === 'death') {
    return {
      type: 'kill',
      text: `${sourceName ? `${sourceName} 击败了 ` : ''}${playerName}，战局少一人`,
      tone: 'kill',
      amount: null,
      major: true,
    };
  }

  if (effect.type === 'judge') {
    const delayName = effect.delayCard?.name || effect.delayCardName || '';
    const judgeName = effect.card?.name || effect.cardName || '';
    const lightning = delayName === '闪电' || judgeName === '闪电'
      || /闪电|雷击/.test(String(effect.name || ''));
    if (!lightning) return null;
    const suit = effect.card?.suitSymbol || effect.card?.suit || '';
    const number = effect.card?.numberDisplay ?? effect.card?.number ?? '';
    return {
      type: 'judge',
      text: `${playerName} 判定【闪电】：${suit}${number}，${effect.success ? '雷击命中' : '判定未中'}`,
      tone: 'judge',
      amount: effect.success ? 2 : 0,
      major: true,
    };
  }

  if (effect.type === 'damage' && Number(effect.num) >= 2) {
    const thunder = effect.nature === 'thunder'
      || effect.damageType === 'thunder'
      || effect.card?.name === '闪电'
      || effect.cardName === '闪电';
    return {
      type: 'damage',
      text: `${sourceName || '局势'} 对 ${targetName} 造成 ${Math.max(0, Number(effect.num) || 0)} 点${thunder ? '雷电' : ''}伤害`,
      tone: thunder ? 'judge' : 'damage',
      amount: Number(effect.num) || 0,
      major: (Number(effect.num) || 0) >= 3 || thunder,
    };
  }

  if (effect.type === 'heal') {
    const num = Math.max(1, Number(effect.num) || 1);
    if (!wasDying && num < 2) return null;
    return {
      type: 'heal',
      text: wasDying
        ? `${playerName} 在濒死边缘被救回，回复 ${num} 点体力`
        : `${playerName} 回复 ${num} 点体力，稳住阵脚`,
      tone: 'recover',
      amount: num,
      major: wasDying,
    };
  }

  return null;
}

export function formatHighlightsForCopy(highlights = []) {
  const list = Array.isArray(highlights) ? highlights : [];
  if (!list.length) return '牌桌导演 · 高光战报\n本局还没有高光时刻。';
  const lines = ['牌桌导演 · 高光战报', ''];
  for (const item of list) {
    const safe = normalizeHighlight(item);
    const time = new Date(safe.time);
    const clock = Number.isNaN(time.getTime())
      ? ''
      : ` ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
    lines.push(`第${safe.round}回合 · ${typeLabelOf(safe.type)}${clock}`);
    lines.push(`  ${safe.text}`);
  }
  return lines.join('\n');
}

async function copyText(text) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 权限/非安全上下文失败，走游戏内提示
  }
  await alertDialog({ title: '复制战报', message: text, kicker: 'HIGHLIGHT REEL' });
  return false;
}

/**
 * 导演镜头：不阻塞点击的 1.6s 上下黑边 + 标题/参战者。
 * 由 GameBoard 根据 layout.showFloats 与 reduced-motion 决定是否挂载。
 */
export function DirectorShot({ shot = null }) {
  if (!shot) return null;
  const members = Array.isArray(shot.members) ? shot.members.filter(Boolean) : [];
  return (
    <div className={`director-shot director-tone-${shot.tone || 'calm'}`} key={shot.id} aria-hidden="true">
      <div className="director-bar director-bar-top" />
      <div className="director-bar director-bar-bottom" />
      <div className="director-frame">
        <span className="director-kicker">
          导演镜头{shot.round ? ` · 第 ${shot.round} 回合` : ''}
        </span>
        <strong className="director-title">{shot.title || '高光时刻'}</strong>
        {shot.subtitle && <span className="director-subtitle">{shot.subtitle}</span>}
        {members.length > 0 && (
          <span className="director-members">{members.join(' · ')}</span>
        )}
      </div>
    </div>
  );
}

/**
 * 高光战报弹层：时间线、复制、Esc 关闭。
 */
export default function HighlightReel({ highlights = [], onClose = () => {} }) {
  const closeRef = useRef(null);
  const list = useMemo(
    () => (Array.isArray(highlights) ? highlights.slice(-HIGHLIGHT_LIMIT).map(normalizeHighlight) : []),
    [highlights],
  );
  const desc = list.length
    ? `本局共 ${list.length} 个高光瞬间，按发生顺序编排。`
    : '本局还没有高光时刻：重创、击杀、濒死救援、雷击判定或羁绊合击都会收录在这里。';

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (closeRef.current) closeRef.current.focus();
  }, []);

  const handleCopy = () => copyText(formatHighlightsForCopy(list));

  return (
    <div className="highlight-reel-overlay" onClick={onClose}>
      <div
        className="highlight-reel panel"
        role="dialog"
        aria-modal="true"
        aria-label="高光战报"
        onClick={(event) => event.stopPropagation()}>
        <div className="highlight-reel-head">
          <div className="highlight-reel-title">
            <span className="highlight-reel-kicker">牌桌导演 · DIRECTOR'S CUT</span>
            <h2>高光战报</h2>
            <p>{desc}</p>
          </div>
          <button
            className="btn btn-small highlight-close"
            ref={closeRef}
            onClick={onClose}
            aria-label="关闭高光战报">
            关闭
          </button>
        </div>

        {list.length === 0 ? (
          <div className="highlight-empty">
            <div className="highlight-empty-seal" aria-hidden="true">录</div>
            <strong>本局无高光</strong>
            <p>{desc}</p>
          </div>
        ) : (
          <ol className="highlight-timeline" aria-label="高光时间线">
            {list.map((item, index) => (
              <li key={item.id} className={`highlight-item tone-${item.tone} type-${item.type}`}>
                <div className="highlight-axis" aria-hidden="true">
                  <span className="highlight-dot" />
                  {index < list.length - 1 && <span className="highlight-line" />}
                </div>
                <div className="highlight-body">
                  <div className="highlight-meta">
                    <span className="highlight-round">第 {item.round} 回合</span>
                    <span className="highlight-type">{typeLabelOf(item.type)}</span>
                    {item.amount ? <span className="highlight-amount">{item.amount}</span> : null}
                    <time dateTime={new Date(item.time).toISOString()}>
                      {new Date(item.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </div>
                  <p className="highlight-text">{item.text}</p>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="highlight-reel-foot">
          <span className="highlight-foot-note">导演剪辑仅收录本局公开战况</span>
          <div className="highlight-reel-actions">
            <button className="btn btn-small" onClick={handleCopy} disabled={list.length === 0}>
              复制战报
            </button>
            <button className="btn btn-small btn-primary" onClick={onClose}>返回牌桌</button>
          </div>
        </div>
      </div>
    </div>
  );
}
