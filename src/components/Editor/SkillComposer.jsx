import React, { useState } from 'react';
import {
  SKILL_TYPE_META,
  normalizeComposerSkill,
  applyComposerTriggerChange,
  applyComposerTypeChange,
} from '../ui/skillType';
import SkillText, { SkillKeywordLegend } from '../ui/SkillText.jsx';
import Select from '../ui/Select';

/**
 * SkillComposer - 模块化 DIY 技能拼装器
 * 将「触发时机 / 发动条件 / 发动代价 / 执行效果 / 频率限制」拼成
 * 现有 Skill 系统可用的 filterCode / costCode / contentCode。
 */

const TRIGGERS = [
  { id: 'phaseUseBegin', label: '出牌阶段开始时', type: 'active' },
  { id: 'damaged', label: '受到伤害后', type: 'trigger' },
  { id: 'useCard', label: '使用牌时', type: 'trigger' },
  { id: 'phaseDrawBegin2', label: '摸牌阶段', type: 'trigger' },
  { id: 'phaseEnd', label: '回合结束时', type: 'trigger' },
  { id: 'dying', label: '进入濒死状态时', type: 'trigger' },
  { id: 'die', label: '死亡时', type: 'trigger' },
  { id: 'recover', label: '回复体力时', type: 'trigger' },
];

const GROUPS = [
  { id: 'wei', label: '魏' },
  { id: 'shu', label: '蜀' },
  { id: 'wu', label: '吴' },
  { id: 'qun', label: '群' },
];

const CONDITION_TYPES = [
  { id: 'handGtHp', label: '你的手牌数大于体力值' },
  { id: 'handLtHp', label: '你的手牌数小于体力值' },
  { id: 'wounded', label: '你已受伤' },
  { id: 'hpAtMost', label: '你的体力值不大于 X', value: 2 },
  { id: 'group', label: '你的势力为 X', value: 'wei', select: 'group' },
  { id: 'judgeRed', label: '进行判定，若为红色' },
];

const COST_TYPES = [
  { id: 'none', label: '无代价' },
  { id: 'discardRed', label: '弃置一张红色手牌' },
  { id: 'discardAny', label: '弃置一张手牌' },
  { id: 'discardEquip', label: '弃置一张装备牌' },
  { id: 'loseHp', label: '失去 1 点体力' },
];

const EFFECT_TYPES = [
  { id: 'draw', label: '摸 X 张牌', value: 1 },
  { id: 'recover', label: '回复 X 点体力', value: 1 },
  { id: 'damage', label: '对攻击范围内一名角色造成 X 点伤害', value: 1, target: true },
  { id: 'discardTarget', label: '弃置一名角色的一张牌', value: 1, target: true },
  { id: 'steal', label: '获得一名角色的一张牌', value: 1, target: true },
  { id: 'forceChoice', label: '令一名角色交给你一张牌，否则失去 1 点体力', value: 1, target: true },
  { id: 'discardSelf', label: '弃置自己 X 张手牌', value: 1 },
];

const FREQUENCIES = [
  { id: 'turn', label: '每回合限一次' },
  { id: 'phase', label: '每阶段限一次' },
  { id: 'unlimited', label: '不限次数' },
  { id: 'game', label: '每局限一次' },
];

export const EXAMPLES = [
  {
    name: '烈火',
    type: 'active',
    trigger: 'phaseUseBegin',
    source: 'player',
    conditions: [{ type: 'handGtHp' }],
    cost: 'discardRed',
    effects: [{ type: 'damage', value: 1 }],
    frequency: 'turn',
    forced: false,
    note: '手牌溢出时，弃红牌打 1 点伤害',
  },
  {
    name: '青囊',
    type: 'active',
    trigger: 'phaseUseBegin',
    source: 'player',
    conditions: [],
    cost: 'discardAny',
    effects: [{ type: 'recover', value: 1 }],
    frequency: 'turn',
    forced: false,
    note: '弃一张手牌回复 1 点体力',
  },
  {
    name: '铁壁',
    type: 'trigger',
    trigger: 'damaged',
    source: 'player',
    conditions: [],
    cost: 'none',
    effects: [{ type: 'draw', value: 1 }],
    frequency: 'turn',
    forced: false,
    note: '受伤后摸一张牌',
  },
];

const EMPTY = {
  name: '', type: 'active', trigger: 'phaseUseBegin', source: 'player',
  conditions: [], cost: 'none', effects: [{ type: 'draw', value: 1 }],
  frequency: 'turn', forced: false,
};

function cloneExample(ex) {
  return {
    ...EMPTY,
    ...ex,
    conditions: (ex.conditions || []).map(c => ({ ...c })),
    effects: (ex.effects || []).map(e => ({ ...e })),
  };
}

function conditionText(c) {
  const def = CONDITION_TYPES.find(x => x.id === c.type);
  if (!def) return '';
  if (c.type === 'hpAtMost') return `你的体力值不大于 ${c.value || 2}`;
  if (c.type === 'group') {
    const g = GROUPS.find(x => x.id === c.value);
    return `你的势力为${g?.label || c.value}`;
  }
  return def.label;
}

function effectText(e) {
  const def = EFFECT_TYPES.find(x => x.id === e.type);
  if (!def) return '';
  return def.label.replace('X', String(e.value || 1));
}

function buildDescription(b) {
  const trigger = TRIGGERS.find(t => t.id === b.trigger);
  const cost = COST_TYPES.find(c => c.id === b.cost);
  const freq = FREQUENCIES.find(f => f.id === b.frequency);
  return [
    `技能名：【${b.name || '未命名'}】`,
    `【触发时机】：${trigger?.label || '出牌阶段'}`,
    `【发动条件】：${b.conditions.length ? b.conditions.map(conditionText).join('，且') : '无'}`,
    `【发动代价】：${cost?.label || '无代价'}`,
    `【执行效果】：${b.effects.length ? b.effects.map(effectText).join('；') : '无'}`,
    `【频率限制】：${freq?.label || '每回合限一次'}`,
  ].join('\n');
}

export function buildPayload(b) {
  const form = normalizeComposerSkill(b);
  const conditions = [];
  let needJudge = false;
  for (const c of form.conditions || []) {
    if (c.type === 'handGtHp') conditions.push('player.handCards.length > player.hp');
    if (c.type === 'handLtHp') conditions.push('player.handCards.length < player.hp');
    if (c.type === 'wounded') conditions.push('player.hp < player.maxHp');
    if (c.type === 'hpAtMost') conditions.push(`player.hp <= ${Number(c.value) || 2}`);
    if (c.type === 'group') conditions.push(`player.character?.group === '${c.value || 'wei'}'`);
    if (c.type === 'judgeRed') needJudge = true;
  }
  const filterCode = conditions.length
    ? `// 模块化条件\nreturn ${conditions.map(x => `(${x})`).join(' && ')};`
    : '// 无额外条件\nreturn true;';

  let costCode = '// 无代价\n';
  if (form.cost === 'discardRed' || form.cost === 'discardAny') {
    const filter = form.cost === 'discardRed' ? 'c => c.isRed' : '() => true';
    costCode = `const game = event.game;
const cards = await game.chooseCards(player, { min: 1, max: 1, filter: ${filter}, hint: '${form.cost === 'discardRed' ? '弃置一张红色手牌' : '弃置一张手牌'}' });
if (!cards || cards.length === 0) { event.result.bool = false; return; }
for (const c of cards) { player.discardCard(c); game.deck.discardOne(c); }`;
  } else if (form.cost === 'discardEquip') {
    costCode = `const game = event.game;
const slot = Object.keys(player.equips || {}).find(s => player.equips[s]);
if (!slot) { event.result.bool = false; return; }
const equip = player.equips[slot];
player.equips[slot] = null;
game.deck.discardOne(equip);
game.addLog(\`\${player.name} 弃置装备\${equip.name}\`);`;
  } else if (form.cost === 'loseHp') {
    costCode = `const game = event.game;
await game.dealDamage({ source: null, target: player, num: 1 });
if (!player.isAlive) { event.result.bool = false; return; }`;
  }

  const effectLines = [];
  if (needJudge) {
    effectLines.push(`const judgeCard = game.deck.draw(1)[0];
if (!judgeCard) return;
game.deck.discardOne(judgeCard);
game.addLog(\`判定：\${judgeCard.suitSymbol}\${judgeCard.numberDisplay}（\${judgeCard.isRed ? '红色' : '黑色'}）\`);
if (!judgeCard.isRed) return;`);
  }
  for (let ei = 0; ei < form.effects.length; ei++) {
    const e = form.effects[ei];
    const n = Math.max(1, Number(e.value) || 1);
    if (e.type === 'draw') {
      effectLines.push(`player.drawCards(game.deck.draw(${n}));
game.addLog(\`\${player.name} 摸${n}张牌\`);`);
    } else if (e.type === 'recover') {
      effectLines.push(`player.recover(${n});
game.addLog(\`\${player.name} 回复${n}点体力\`);`);
    } else if (e.type === 'damage') {
      effectLines.push(`const enemies${ei} = game.getValidTargets(player, '杀');
const target${ei} = await game.chooseTarget(player, enemies${ei}, '选择造成伤害的目标');
if (target${ei}) {
  await game.dealDamage({ source: player, target: target${ei}, num: ${n}, nature: 'fire' });
  game.addLog(\`\${player.name} 对 \${target${ei}.name} 造成${n}点火焰伤害\`);
}`);
    } else if (e.type === 'discardTarget') {
      effectLines.push(`const candidates${ei} = game.distance.getOtherAlivePlayers(player);
const target${ei} = await game.chooseTarget(player, candidates${ei}, '选择弃牌目标');
if (target${ei}) {
  const card${ei} = game.takeAnyCard(target${ei});
  if (card${ei}) game.deck.discardOne(card${ei});
  game.addLog(\`\${player.name} 弃置了 \${target${ei}.name} 一张牌\`);
}`);
    } else if (e.type === 'steal') {
      effectLines.push(`const candidates${ei} = game.distance.getOtherAlivePlayers(player);
const target${ei} = await game.chooseTarget(player, candidates${ei}, '选择获得牌的目标');
if (target${ei}) {
  const card${ei} = game.takeAnyCard(target${ei});
  if (card${ei}) player.drawCards([card${ei}]);
  game.addLog(\`\${player.name} 获得 \${target${ei}.name} 一张牌\`);
}`);
    } else if (e.type === 'forceChoice') {
      effectLines.push(`const candidates${ei} = game.distance.getOtherAlivePlayers(player);
const target${ei} = await game.chooseTarget(player, candidates${ei}, '选择目标');
if (target${ei}) {
  const card${ei} = game.takeAnyCard(target${ei});
  if (card${ei}) { player.drawCards([card${ei}]); game.addLog(\`\${target${ei}.name} 交给 \${player.name} 一张牌\`); }
  else { await game.dealDamage({ source: player, target: target${ei}, num: 1 }); game.addLog(\`\${target${ei}.name} 失去1点体力\`); }
}`);
    } else if (e.type === 'discardSelf') {
      effectLines.push(`const cards${ei} = await game.chooseCards(player, { min: ${n}, max: ${n}, hint: '选择${n}张手牌弃置' });
if (cards${ei} && cards${ei}.length) for (const c of cards${ei}) { player.discardCard(c); game.deck.discardOne(c); }`);
    }
  }
  const contentCode = `const game = event.game;\n${effectLines.join('\n') || '// 暂无效果\n'}`;

  const frequency = FREQUENCIES.find(f => f.id === form.frequency) || FREQUENCIES[0];
  const usable = frequency.id === 'unlimited' ? 0 : 1;
  // 主动技：enable phaseUse 且不带 triggerTiming；触发/锁定：带 triggerTiming 且不带 enable
  const outputType = form.type === 'active'
    ? 'active'
    : (form.frequency === 'game' ? 'limited' : form.type);

  const payload = {
    name: (form.name || '').trim(),
    type: outputType,
    triggerSource: form.source,
    usable,
    forced: form.type === 'active' ? false : (form.type === 'locked' ? true : !!form.forced),
    description: buildDescription(form),
    filterCode,
    costCode,
    contentCode,
  };
  if (form.type === 'active') {
    payload.enable = 'phaseUse';
  } else {
    payload.triggerTiming = form.trigger;
  }
  return payload;
}

export default function SkillComposer({ onApply }) {
  const [b, setB] = useState({ ...EMPTY });
  const [status, setStatus] = useState('');

  const update = (patch) => setB(prev => ({ ...prev, ...patch }));
  // 时机与类型联动：phaseUseBegin ↔ active；其它时机 ↔ trigger；locked 保持
  const updateTrigger = (trigger) => setB(prev => applyComposerTriggerChange(prev, trigger));
  const updateType = (type) => setB(prev => applyComposerTypeChange(prev, type));
  const typeMeta = SKILL_TYPE_META[b.type] || SKILL_TYPE_META.trigger;
  const forcedLocked = b.type === 'active' || b.type === 'locked';
  const setCondition = (i, patch) => update({
    conditions: b.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c),
  });
  const addCondition = () => update({
    conditions: [...b.conditions, { type: 'handGtHp' }],
  });
  const removeCondition = (i) => update({
    conditions: b.conditions.filter((_, idx) => idx !== i),
  });
  const setEffect = (i, patch) => update({
    effects: b.effects.map((e, idx) => idx === i ? { ...e, ...patch } : e),
  });
  const addEffect = () => update({ effects: [...b.effects, { type: 'draw', value: 1 }] });
  const removeEffect = (i) => update({ effects: b.effects.filter((_, idx) => idx !== i) });

  const apply = () => {
    const payload = buildPayload(b);
    if (!payload.name) { setStatus('请先填写技能名'); return; }
    onApply(payload);
    setStatus('已填入下方技能表单，可继续微调后保存');
  };

  const loadExample = (ex) => {
    const next = cloneExample(ex);
    setB(next);
    setStatus(`已载入示例「${ex.name}」：${ex.note}`);
    onApply(buildPayload(next));
  };

  const preview = buildDescription(b);

  return (
    <div className="skill-composer panel">
      <div className="composer-head">
        <div>
          <h3>模块化技能拼装</h3>
          <p>像搭积木一样选「时机 + 条件 + 代价 + 效果 + 限制」，自动生成技能代码。</p>
        </div>
        <span className="composer-badge">DIY</span>
      </div>

      <div className="composer-examples">
        <span className="composer-label">新手示例</span>
        {EXAMPLES.map(ex => (
          <button key={ex.name} className="btn btn-small" onClick={() => loadExample(ex)}>
            {ex.name}<em>{ex.note}</em>
          </button>
        ))}
      </div>

      <div className="composer-grid">
        <div className="composer-block">
          <span className="block-icon">1</span>
          <label>触发时机</label>
          <Select value={b.trigger} disabled={b.type === 'active'}
            onChange={e => updateTrigger(e.target.value)}>
            {TRIGGERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
          <Select value={b.type} onChange={e => updateType(e.target.value)}>
            <option value="active">主动技（出牌阶段点按钮，不会自动触发）</option>
            <option value="trigger">触发技（满足条件时被动触发，可询问）</option>
            <option value="locked">锁定技（自动生效不询问）</option>
          </Select>
          <p className="composer-type-hint">{typeMeta.behavior}</p>
          <Select value={b.source} onChange={e => update({ source: e.target.value })}>
            <option value="player">触发源：自己</option>
            <option value="global">触发源：全局</option>
            <option value="target">触发源：成为目标者</option>
          </Select>
        </div>

        <div className="composer-block">
          <span className="block-icon">2</span>
          <label>发动条件</label>
          {b.conditions.length === 0 && <div className="block-empty">无条件</div>}
          {b.conditions.map((c, i) => (
            <div className="block-row" key={i}>
              <Select value={c.type} onChange={e => setCondition(i, { type: e.target.value })}>
                {CONDITION_TYPES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
              </Select>
              {c.type === 'group' && (
                <Select value={c.value || 'wei'} onChange={e => setCondition(i, { value: e.target.value })}>
                  {GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                </Select>
              )}
              {c.type === 'hpAtMost' && (
                <input type="number" min={1} max={8} value={c.value || 2}
                  onChange={e => setCondition(i, { value: Number(e.target.value) })} />
              )}
              <button className="block-remove" onClick={() => removeCondition(i)}>×</button>
            </div>
          ))}
          <button className="btn btn-small" onClick={addCondition}>+ 条件</button>
        </div>

        <div className="composer-block">
          <span className="block-icon">3</span>
          <label>发动代价</label>
          <Select value={b.cost} onChange={e => update({ cost: e.target.value })}>
            {COST_TYPES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </div>

        <div className="composer-block">
          <span className="block-icon">4</span>
          <label>执行效果</label>
          {b.effects.map((e, i) => (
            <div className="block-row" key={i}>
              <Select value={e.type} onChange={ev => setEffect(i, { type: ev.target.value })}>
                {EFFECT_TYPES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
              </Select>
              <input type="number" min={1} max={9} value={e.value || 1}
                onChange={ev => setEffect(i, { value: Number(ev.target.value) })} />
              <button className="block-remove" onClick={() => removeEffect(i)}>×</button>
            </div>
          ))}
          <button className="btn btn-small" onClick={addEffect}>+ 效果</button>
        </div>

        <div className="composer-block">
          <span className="block-icon">5</span>
          <label>频率限制</label>
          <Select value={b.frequency} onChange={e => update({ frequency: e.target.value })}>
            {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </Select>
          <label className={`composer-check ${forcedLocked ? 'disabled' : ''}`}
            title={b.type === 'locked' ? '锁定技固定自动生效' : b.type === 'active' ? '主动技不会自动触发' : '可选触发技：未勾选时真人会弹确认'}>
            <input type="checkbox"
              checked={b.type === 'locked' ? true : (b.type === 'active' ? false : !!b.forced)}
              disabled={forcedLocked}
              onChange={e => update({ forced: e.target.checked })} />
            锁定技（不询问直接生效）
          </label>
        </div>
      </div>

      <div className="composer-name-row">
        <label>技能名</label>
        <input type="text" value={b.name} placeholder="如：烈火"
          onChange={e => update({ name: e.target.value })} />
        <button className="btn btn-primary" onClick={apply}>填入技能表单</button>
      </div>

      {status && <p className="composer-status">{status}</p>}

      <div className="composer-preview">
        <div className="composer-label">实时描述预览</div>
        <pre><SkillText text={preview} /></pre>
        <SkillKeywordLegend compact />
      </div>

      <style>{`
        .skill-composer { margin-bottom: 18px; padding: 16px 18px; }
        .composer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .composer-head h3 { margin: 0 0 4px; color: var(--accent-gold); }
        .composer-head p { margin: 0; font-size: 12px; color: var(--text-secondary); line-height: 1.5; }
        .composer-badge {
          font-size: 10px; letter-spacing: 2px; color: var(--gold-deep);
          border: 1px solid rgba(214, 185, 110, 0.35); border-radius: 999px; padding: 3px 8px;
        }
        .composer-examples { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 12px 0; }
        .composer-label { font-size: 11px; letter-spacing: 1px; color: var(--text-secondary); }
        .composer-examples .btn { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; padding: 6px 10px; }
        .composer-examples em { font-style: normal; font-size: 10px; opacity: .6; }
        .composer-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .composer-block {
          position: relative; display: flex; flex-direction: column; gap: 8px;
          padding: 12px 12px 10px; border-radius: 12px;
          background: rgba(8, 11, 17, 0.55); border: 1px solid rgba(214, 185, 110, 0.18);
        }
        .composer-block > label { font-size: 12px; color: var(--gold-bright); }
        .skill-composer select,
        .skill-composer input[type="text"],
        .skill-composer input[type="number"] {
          background: rgba(8, 12, 18, 0.92);
          color: var(--text-primary);
          border: 1px solid rgba(214, 185, 110, 0.24);
          border-radius: 8px;
          padding: 7px 9px;
          font-size: 12px;
          outline: none;
        }
        .skill-composer select:focus,
        .skill-composer input:focus { border-color: rgba(214, 185, 110, 0.65); }
        .skill-composer option { background: #0b1018; color: var(--text-primary); }
        .block-icon {
          position: absolute; right: 10px; top: 8px; width: 20px; height: 20px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(214, 185, 110, 0.35); color: var(--gold); font-size: 10px;
        }
        .block-row { display: flex; gap: 6px; align-items: center; }
        .block-row select, .block-row .ui-select { flex: 1; min-width: 0; }
        .block-row input[type="number"] { width: 56px; flex: 0 0 auto; }
        .block-remove {
          flex: 0 0 auto; width: 24px; height: 24px; border-radius: 6px;
          border: 1px solid rgba(214, 185, 110, 0.22); background: transparent;
          color: var(--text-secondary); cursor: pointer;
        }
        .block-empty { font-size: 11.5px; color: var(--text-secondary); opacity: .7; }
        .composer-check { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary); }
        .composer-name-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
        .composer-name-row label { flex: 0 0 auto; font-size: 12px; color: var(--text-secondary); }
        .composer-name-row input { flex: 1; }
        .composer-status { margin: 8px 0 0; font-size: 11.5px; color: var(--gold-bright); }
        .composer-preview { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: rgba(0,0,0,.22); border: 1px solid rgba(214,185,110,.12); }
        .composer-preview pre {
          margin: 6px 0 0; white-space: pre-wrap; font-size: 12px; line-height: 1.7;
          color: var(--text-secondary); font-family: var(--font-serif);
        }
        @media (max-width: 720px) {
          .composer-grid { grid-template-columns: 1fr; }
          .composer-name-row { flex-wrap: wrap; }
          .composer-name-row input { flex-basis: 100%; }
        }
      `}</style>
    </div>
  );
}
