import React, { useState } from 'react';
import useGameStore from '../../store/gameStore';
import { SKILL_TYPES, TRIGGER_TIMINGS } from '../../core/Skill';
import SkillComposer from './SkillComposer';
import SkillText, { SkillKeywordLegend } from '../ui/SkillText.jsx';
import Select from '../ui/Select';
import { skillTypeMeta, normalizeEditorSkillType } from '../ui/skillType';

const SKILL_TYPE_NAMES = {
  active: '主动技', trigger: '触发技', locked: '锁定技',
  limited: '限定技', awakening: '觉醒技', epic: '史诗技', master: '主公技',
};

const TIMING_NAMES = {
  roundStart: '回合开始', roundEnd: '回合结束',
  phaseBegin: '阶段开始', phaseEnd: '阶段结束',
  phaseJudgeBegin: '判定阶段开始', phaseJudgeEnd: '判定阶段结束',
  phaseDrawBegin2: '摸牌阶段', phaseDrawEnd: '摸牌阶段结束',
  phaseUseBegin: '出牌阶段开始', phaseUseEnd: '出牌阶段结束',
  phaseDiscardBegin: '弃牌阶段开始', phaseDiscardEnd: '弃牌阶段结束',
  useCard: '使用牌', respondCard: '响应牌', discardCard: '弃牌',
  loseCard: '失去牌', gainCard: '获得牌',
  damageBegin: '伤害开始', damageEnd: '伤害结束', damaged: '受伤后', recover: '回复体力',
  dying: '濒死时',
  die: '死亡时', dieAfter: '死亡后',
  equip: '装备时', unequip: '卸载装备', judge: '判定时',
};

export default function SkillEditor({ navigate, context }) {
  const skills = useGameStore(s => s.skills);
  const addSkill = useGameStore(s => s.addSkill);
  const updateSkill = useGameStore(s => s.updateSkill);
  const removeSkill = useGameStore(s => s.removeSkill);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', id: '', type: SKILL_TYPES.TRIGGER,
    description: '', triggerTiming: '', triggerSource: 'player',
    usable: 1, forced: false,
    filterCode: '// 返回true表示可以发动\nreturn true;',
    costCode: '// 发动代价(如弃牌/选牌等)\n// event.result.bool = true 才执行content',
    contentCode: '// 技能效果\n// 可用变量: event, trigger, player, game',
    aiOrder: 0, aiCheckCode: 'return true;',
  });

  const resetForm = () => {
    setForm({ name: '', id: '', type: SKILL_TYPES.TRIGGER, description: '', triggerTiming: '', triggerSource: 'player', usable: 1, forced: false, filterCode: 'return true;', costCode: '// event.result.bool = true', contentCode: '// 技能效果', aiOrder: 0, aiCheckCode: 'return true;' });
    setEditing(null);
  };

  const applyComposer = (payload) => {
    setForm(prev => ({ ...prev, ...payload, id: prev.id }));
    setEditing(null);
    setTimeout(() => {
      document.querySelector('.editor-form > h3')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const startEdit = (skill) => {
    setForm({
      name: skill.name, id: skill.id, type: skill.type,
      description: skill.description, triggerTiming: skill.triggerTiming,
      triggerSource: skill.triggerSource, usable: skill.usable, forced: skill.forced,
      filterCode: skill.filterCode || 'return true;',
      costCode: skill.costCode || '// event.result.bool = true',
      contentCode: skill.contentCode || '// 技能效果',
      aiOrder: skill.ai?.order || 0,
      aiCheckCode: skill.aiCheckCode || 'return true;',
    });
    setEditing(skill.id);
  };

  const handleSave = () => {
    if (!form.name.trim()) { alert('请输入技能名'); return; }
    const config = {
      ...form,
      id: form.id || `skill_${form.name.replace(/\s/g, '_')}_${Date.now()}`,
      // 将代码字符串转为函数
      filter: createFunction(['event', 'player'], form.filterCode),
      cost: createAsyncFunction(['event', 'trigger', 'player'], form.costCode),
      content: createAsyncFunction(['event', 'trigger', 'player'], form.contentCode),
      ai: {
        order: form.aiOrder || 0,
        result: { player: 1, target: () => 0 },
        check: createFunction(['event', 'player'], form.aiCheckCode),
      },
    };
    if (editing) {
      updateSkill(editing, config);
    } else {
      addSkill(config);
    }
    resetForm();
  };

  return (
    <div className="skill-editor">
      <div className="page-header">
        <button className="btn btn-small" onClick={() => navigate('menu')}>← 返回</button>
        <h2>技能编辑器</h2>
        <button className="btn btn-small" onClick={() => navigate('editor')}>→ 武将编辑器</button>
      </div>

      <div className="editor-layout">
        {/* 左侧：技能列表 */}
        <div className="editor-list panel">
          <h3>已有技能 ({skills.length})</h3>
          {skills.length === 0 && <p className="empty-tip">暂无技能，请在右侧创建</p>}
          {skills.map(s => (
            <div key={s.id} className={`list-item ${editing === s.id ? 'active' : ''}`}>
              <div className="item-info">
                <span className="item-name">{s.name}</span>
                <span className="item-meta">{SKILL_TYPE_NAMES[s.type] || s.type} · {s.triggerTiming ? TIMING_NAMES[s.triggerTiming] : ''}</span>
              </div>
              <div className="item-actions">
                <button className="btn btn-small" onClick={() => startEdit(s)}>编辑</button>
                <button className="btn btn-small btn-danger" onClick={() => removeSkill(s.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>

        {/* 右侧：编辑表单 */}
        <div className="editor-form panel">
          <SkillComposer onApply={applyComposer} />
          <h3>{editing ? '编辑技能' : '创建新技能'}</h3>

          <div className="form-row">
            <div className="form-group">
              <label>技能名称 *</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="如：奸雄" />
            </div>
            <div className="form-group">
              <label>技能类型</label>
              <Select value={form.type}
                onChange={e => setForm(prev => normalizeEditorSkillType(prev, e.target.value))}>
                {Object.entries(SKILL_TYPE_NAMES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
              <small className="skill-type-hint">{skillTypeMeta(form.type).behavior}</small>
            </div>
          </div>

          <div className="form-group">
            <label>描述</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              placeholder="如：当你受到伤害后，你可以获得造成伤害的牌" rows={2} />
          </div>

          <div className="form-group skill-desc-preview">
            <label>描述预览 <small className="skill-preview-hint">颜色仅辅助阅读</small></label>
            <div className="skill-desc-preview-box">
              {form.description
                ? <SkillText text={form.description} />
                : <span className="skill-preview-empty">输入描述后在此预览关键词着色</span>}
            </div>
            <SkillKeywordLegend />
          </div>

          {(form.type === 'trigger' || form.type === 'locked') && (
            <div className="form-row">
              <div className="form-group">
                <label>触发时机</label>
                <Select value={form.triggerTiming} onChange={e => setForm({...form, triggerTiming: e.target.value})}>
                  <option value="">请选择</option>
                  {Object.entries(TIMING_NAMES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="form-group">
                <label>触发源</label>
                <Select value={form.triggerSource} onChange={e => setForm({...form, triggerSource: e.target.value})}>
                  <option value="player">自己</option>
                  <option value="global">全局</option>
                  <option value="target">成为目标时</option>
                </Select>
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>每回合可用次数</label>
              <input type="number" min={0} max={99} value={form.usable}
                onChange={e => setForm({...form, usable: Number(e.target.value)})} />
              <small>0=不限</small>
            </div>
            <div className="form-group">
              <label>锁定技</label>
              <Select value={form.forced ? 'true' : 'false'}
                disabled={form.type === 'active' || form.type === 'locked'}
                onChange={e => setForm({...form, forced: e.target.value === 'true'})}>
                <option value="false">否</option>
                <option value="true">是</option>
              </Select>
              <small>
                {form.type === 'locked' ? '锁定技固定为“是”'
                  : form.type === 'active' ? '主动技固定为“否”'
                    : '可选触发技：选“是”则不询问直接生效'}
              </small>
            </div>
          </div>

          {/* 代码编辑区 */}
          <div className="code-section">
            <h4>代码定义</h4>

            <div className="form-group">
              <label>filter - 判断能否发动</label>
              <textarea className="code-input" value={form.filterCode}
                onChange={e => setForm({...form, filterCode: e.target.value})} rows={3} />
            </div>

            <div className="form-group">
              <label>cost - 发动代价</label>
              <textarea className="code-input" value={form.costCode}
                onChange={e => setForm({...form, costCode: e.target.value})} rows={3} />
            </div>

            <div className="form-group">
              <label>content - 技能效果</label>
              <textarea className="code-input" value={form.contentCode}
                onChange={e => setForm({...form, contentCode: e.target.value})} rows={5} />
            </div>

            <div className="form-group">
              <label>AI优先级</label>
              <input type="number" value={form.aiOrder}
                onChange={e => setForm({...form, aiOrder: Number(e.target.value)})} />
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleSave}>
              {editing ? '保存修改' : '创建技能'}
            </button>
            {editing && <button className="btn" onClick={resetForm}>取消编辑</button>}
            <button className="btn" onClick={() => navigate('code_preview', { skillForm: form })}>
              AI生成代码
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .skill-editor { padding: 20px; overflow-y: auto; height: 100%; }
        .page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
        .page-header h2 { color: var(--accent-gold); flex: 1; }
        .editor-layout { display: flex; gap: 20px; }
        .editor-list { width: 260px; flex-shrink: 0; max-height: calc(100vh - 120px); overflow-y: auto; }
        .editor-list h3 { color: var(--accent-gold); margin-bottom: 12px; }
        .empty-tip { font-size: 12px; color: var(--text-secondary); opacity: 0.6; }
        .list-item { display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--border-color); }
        .list-item.active { background: rgba(230,180,34,0.1); }
        .item-info { display: flex; flex-direction: column; }
        .item-name { font-weight: bold; }
        .item-meta { font-size: 11px; color: var(--text-secondary); }
        .item-actions { display: flex; gap: 4px; }
        .editor-form { flex: 1; max-height: calc(100vh - 120px); overflow-y: auto; }
        .editor-form h3 { color: var(--accent-gold); margin-bottom: 16px; }
        .form-row { display: flex; gap: 12px; }
        .form-row .form-group { flex: 1; }
        .code-section { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color); }
        .code-section h4 { color: var(--accent-gold); margin-bottom: 8px; }
        .code-input { font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.4; background: #0d1117 !important; color: #c9d1d9 !important; }
        .form-actions { display: flex; gap: 10px; margin-top: 20px; }
        small { color: var(--text-secondary); font-size: 11px; }
      `}</style>
    </div>
  );
}

/**
 * 安全地从代码字符串创建函数
 */
function createFunction(args, code) {
  try {
    return new Function(...args, code);
  } catch (e) {
    console.warn('函数创建失败:', e.message);
    return () => true;
  }
}

function createAsyncFunction(args, code) {
  try {
    return new Function(...args, `return (async () => { ${code} })()`);
  } catch (e) {
    console.warn('异步函数创建失败:', e.message);
    return async () => {};
  }
}
