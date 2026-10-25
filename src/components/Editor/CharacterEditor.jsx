import React, { useEffect, useRef, useState } from 'react';
import useGameStore from '../../store/gameStore';
import { GROUP_NAMES, SEX } from '../../core/Character';
import ArtStudio from './ArtStudio';
import VoiceStudio from './VoiceStudio';
import CharacterCardPreview from './CharacterCardPreview';
import Icon from '../ui/Icon';
import Select from '../ui/Select';
import {
  CHARACTER_DRAFT_KEY,
  WORKSHOP_ACCENTS,
  WORKSHOP_FRAMES,
  GROUP_OPTIONS,
  blankCharacterForm,
  normalizeCharacterForm,
  normalizeAppearance,
  buildWorkshopInitialState,
  buildCharacterSavePayload,
  buildCharacterExport,
  extractCharacterImport,
  saveCharacterDraft,
} from './characterWorkshopModel';
import { skillTypeInfo } from '../ui/skillType';
import SkillText from '../ui/SkillText.jsx';

function WorkshopSection({ id, no, title, sub, open, onToggle, children }) {
  return (
    <section className={`workshop-section ${open ? 'open' : ''}`} data-section={id} id={`workshop-section-${id}`}>
      <button
        type="button"
        className="workshop-section-head"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => onToggle(id)}>
        <span className="workshop-section-no">{no}</span>
        <span className="workshop-section-title">
          <b>{title}</b>
          <small>{sub}</small>
        </span>
        <svg className="workshop-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className="workshop-section-body">
        <div className="workshop-section-rule" />
        <div className="workshop-section-content">{children}</div>
      </div>
    </section>
  );
}

/**
 * 武将 · 卡牌工坊：
 * 左侧手风琴表单（基础 / 技能 / 立绘 / 已有武将 / 外观）+ 右侧 360×520 实时卡牌预览。
 * 保留 store：characters / skills / addCharacter / updateCharacter / removeCharacter。
 */
export default function CharacterEditor({ navigate, context, initialForm = null }) {
  const characters = useGameStore(s => s.characters);
  const skills = useGameStore(s => s.skills);
  const addCharacter = useGameStore(s => s.addCharacter);
  const updateCharacter = useGameStore(s => s.updateCharacter);
  const removeCharacter = useGameStore(s => s.removeCharacter);

  const [boot] = useState(() => buildWorkshopInitialState(initialForm));
  const [form, setForm] = useState(boot.form);
  const [appearance, setAppearance] = useState(boot.appearance);
  const [cardMeta, setCardMeta] = useState(boot.meta || {});
  const [editing, setEditing] = useState(boot.editingId);
  const [open, setOpen] = useState(() => {
    const focus = context && context.focus;
    return {
      basic: true,
      skills: true,
      art: focus === 'art',
      list: false,
      appearance: false,
      voice: focus === 'voice',
    };
  });
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);
  const toastTimer = useRef(null);
  const draftTimer = useRef(null);

  // 草稿实时保存（v2，仅本地；外观/编号等预览字段不写入 Character）
  useEffect(() => {
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      saveCharacterDraft({ form, appearance, meta: cardMeta, editingId: editing });
    }, 280);
    return () => clearTimeout(draftTimer.current);
  }, [form, appearance, cardMeta, editing]);

  useEffect(() => {
    clearTimeout(toastTimer.current);
    if (!toast) return undefined;
    toastTimer.current = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  const showToast = (msg, kind = 'ok') => setToast({ msg, kind, id: Date.now() });
  const go = (page) => { if (navigate) navigate(page); };
  const updateForm = (patch) => setForm(prev => ({ ...prev, ...patch }));
  const toggleSection = (id) => setOpen(prev => ({ ...prev, [id]: !prev[id] }));

  const focusSection = (id) => {
    setOpen(prev => ({ ...prev, [id]: true }));
    if (typeof document === 'undefined') return;
    setTimeout(() => {
      const el = document.getElementById(`workshop-section-${id}`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  };

  // 主菜单/快捷入口可带 context.focus='art'|'voice' 直接展开对应分区
  useEffect(() => {
    const focus = context && context.focus;
    if (focus !== 'art' && focus !== 'voice') return undefined;
    setOpen(prev => ({ ...prev, [focus]: true }));
    if (typeof document === 'undefined') return undefined;
    const timer = setTimeout(() => {
      const el = document.getElementById(`workshop-section-${focus}`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [context]);

  const selectedSkillNames = form.skillIds
    .map(id => (skills || []).find(s => s.id === id))
    .filter(Boolean)
    .map(s => s.name);

  const toggleSkill = (skillId) => {
    setForm(prev => ({
      ...prev,
      skillIds: prev.skillIds.includes(skillId)
        ? prev.skillIds.filter(id => id !== skillId)
        : [...prev.skillIds, skillId],
    }));
  };

  const resetAll = () => {
    setForm(blankCharacterForm());
    setAppearance(normalizeAppearance({}));
    setCardMeta({});
    setEditing(null);
    setOpen({ basic: true, skills: true, art: false, list: false, appearance: false, voice: false });
    showToast('已新建空白武将', 'ok');
  };

  const loadCharacter = (char) => {
    if (!char) return;
    const data = typeof char.toJSON === 'function' ? char.toJSON() : char;
    setForm(normalizeCharacterForm(data));
    setEditing(char.id);
    setOpen(prev => ({ ...prev, basic: true, list: true }));
    showToast(`已载入「${char.name}」`, 'ok');
  };

  const handleSave = () => {
    const result = buildCharacterSavePayload(form, {
      editingId: editing,
      existingIds: characters.map(c => c.id),
    });
    if (!result.ok) {
      showToast(result.error, 'err');
      return;
    }
    if (editing) {
      updateCharacter(editing, result.config);
      setForm(normalizeCharacterForm(result.config));
      showToast('已保存修改', 'ok');
    } else {
      const created = addCharacter(result.config);
      setEditing(created.id);
      setForm(prev => ({ ...prev, id: created.id }));
      showToast(result.idCollision ? 'ID 重复，已自动生成新 ID 并保存为可玩武将' : '已保存为可玩武将', 'ok');
    }
    setOpen(prev => ({ ...prev, list: true }));
  };

  const handleDelete = (char) => {
    if (!char) return;
    if (typeof window !== 'undefined' && !window.confirm(`确定删除武将「${char.name}」？`)) return;
    removeCharacter(char.id);
    if (editing === char.id) setEditing(null);
    showToast(`已删除「${char.name}」`, 'ok');
  };

  const handleImportFile = (file) => {
    if (!file) return;
    if (file.size > 1024 * 1024) { showToast('JSON 文件过大（>1MB），请检查文件', 'err'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(String(reader.result || '{}'));
      } catch (e) {
        showToast(`JSON 解析失败：${e?.message || '格式错误'}`, 'err');
        return;
      }
      const result = extractCharacterImport(parsed, skills);
      if (!result.ok) { showToast(result.error, 'err'); return; }
      setForm(result.form);
      setEditing(null);
      if (result.appearance) setAppearance(result.appearance);
      if (result.meta) setCardMeta(result.meta);
      setOpen(prev => ({ ...prev, basic: true }));
      const unmatched = result.unmatched || [];
      if (unmatched.length) {
        showToast(`已导入「${result.form.name}」，${unmatched.length} 个技能未匹配：${unmatched.slice(0, 3).join('、')}${unmatched.length > 3 ? '…' : ''}`, 'err');
      } else {
        showToast(`已导入「${result.form.name}」`, 'ok');
      }
    };
    reader.onerror = () => showToast('读取文件失败', 'err');
    reader.readAsText(file, 'utf-8');
  };

  const handleExport = () => {
    if (!form.name.trim()) { showToast('请先填写武将名称再导出', 'err'); return; }
    const data = buildCharacterExport(form);
    const text = JSON.stringify(data, null, 2);
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(data.name || 'character').replace(/[\\/:*?"<>|\s]+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast('已导出游戏武将 JSON', 'ok');
  };

  const selectedSkillCount = form.skillIds.length;

  return (
    <div className="character-workshop">
      <header className="workshop-header">
        <button className="btn btn-small" onClick={() => go('menu')}>← 返回</button>
        <div className="workshop-heading">
          <h2>武将 · 卡牌工坊</h2>
          <p>武将编辑器 · 可玩武将档案 / 卡牌级实时预览</p>
        </div>
        <div className="workshop-actions">
          <button className="btn btn-small" onClick={resetAll}><Icon name="plus" size={14} />新建</button>
          <button className="btn btn-small" onClick={() => fileRef.current && fileRef.current.click()}><Icon name="upload" size={14} />导入 JSON</button>
          <button className="btn btn-small" onClick={handleExport}><Icon name="download" size={14} />导出 JSON</button>
          <button className="btn btn-small btn-primary" onClick={handleSave}>
            <Icon name="check" size={14} />{editing ? '保存修改' : '保存武将'}
          </button>
          <button className="btn btn-small btn-ai" onClick={() => focusSection('art')} title="免费 AI 立绘（Stable Horde）">
            <Icon name="palette" size={14} />AI 立绘
          </button>
          <button className="btn btn-small btn-ai" onClick={() => focusSection('voice')} title="AI 配音（浏览器 / 本地 GPT-SoVITS）">
            <Icon name="mic" size={14} />AI 配音
          </button>
          <button className="btn btn-small" onClick={() => go('skill_editor')}>技能编辑器 →</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              handleImportFile(e.target.files && e.target.files[0]);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <div className="workshop-layout">
        <div className="workshop-form-column">
          <WorkshopSection id="basic" no="壹" title="基础信息" sub="名称、ID、性别、势力与体力"
            open={open.basic} onToggle={toggleSection}>
            <div className="workshop-field-grid">
              <div className="workshop-field wide">
                <label htmlFor="ws-name">武将名称 <em>必填</em></label>
                <input id="ws-name" type="text" maxLength={20} value={form.name}
                  placeholder="如：关羽"
                  onChange={e => updateForm({ name: e.target.value })} />
              </div>
              <div className="workshop-field">
                <label htmlFor="ws-id">ID <em>可留空自动生成</em></label>
                <input id="ws-id" type="text" maxLength={60} value={form.id}
                  placeholder="如：custom_guanyu"
                  onChange={e => updateForm({ id: e.target.value })} />
              </div>
              <div className="workshop-field">
                <label htmlFor="ws-sex">性别</label>
                <Select id="ws-sex" value={form.sex}
                  onChange={e => updateForm({ sex: e.target.value })}>
                  <option value={SEX.MALE}>男</option>
                  <option value={SEX.FEMALE}>女</option>
                  <option value={SEX.OTHER}>其他</option>
                </Select>
              </div>
              <div className="workshop-field">
                <label htmlFor="ws-group">势力</label>
                <Select id="ws-group" value={form.group}
                  onChange={e => updateForm({ group: e.target.value })}>
                  {GROUP_OPTIONS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                </Select>
              </div>
              <div className="workshop-field">
                <label htmlFor="ws-hp">体力</label>
                <input id="ws-hp" type="number" min={1} max={9} value={form.hp}
                  onChange={e => updateForm({ hp: Math.max(1, Math.min(9, Number(e.target.value) || 1)) })} />
              </div>
              <div className="workshop-field">
                <label htmlFor="ws-maxhp">最大体力</label>
                <input id="ws-maxhp" type="number" min={form.hp} max={9} value={form.maxHp}
                  onChange={e => updateForm({ maxHp: Math.max(form.hp, Math.min(9, Number(e.target.value) || form.hp)) })} />
              </div>
              <div className="workshop-field">
                <label htmlFor="ws-equip">装备栏数量</label>
                <input id="ws-equip" type="number" min={1} max={6} step={1} value={form.equipSlots || 3}
                  onChange={e => updateForm({ equipSlots: Math.max(1, Math.min(6, Math.round(Number(e.target.value) || 3))) })} />
                <small className="workshop-field-hint">装备栏默认 3 个；满后替换需选择弃置。</small>
              </div>
              <div className="workshop-field wide">
                <label htmlFor="ws-desc">背景描述 <em>显示在卡面底部</em></label>
                <textarea id="ws-desc" rows={3} maxLength={400} value={form.description}
                  placeholder="武将背景与性格…"
                  onChange={e => updateForm({ description: e.target.value })} />
              </div>
            </div>
          </WorkshopSection>

          <WorkshopSection id="skills" no="贰" title="技能" sub={`从技能编辑器已建技能中选择 · 已选 ${selectedSkillCount}/${skills.length}`}
            open={open.skills} onToggle={toggleSection}>
            {skills.length === 0 ? (
              <div className="workshop-empty">
                暂无可用技能，请先到技能编辑器创建。
                <button className="btn btn-small" onClick={() => go('skill_editor')}>去技能编辑器</button>
              </div>
            ) : (
              <div className="workshop-skill-options">
                {skills.map(skill => {
                  const info = skillTypeInfo(skill);
                  const checked = form.skillIds.includes(skill.id);
                  return (
                    <label key={skill.id} className={`workshop-skill-option ${checked ? 'checked' : ''} skill-type-${info.key}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleSkill(skill.id)} />
                      <span className="workshop-skill-option-main">
                        <span className="workshop-skill-option-head">
                          <b>{skill.name}</b>
                          <span className={`workshop-skill-tag ${info.key}`}>{info.label}</span>
                        </span>
                        <span className="workshop-skill-option-desc"><SkillText text={skill.description || '暂无说明'} /></span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </WorkshopSection>

          <WorkshopSection id="art" no="叁" title="立绘" sub="AI 生成 / 导入本地图片 / 图片 URL"
            open={open.art} onToggle={toggleSection}>
            <div className="workshop-art-embed">
              <ArtStudio
                name={form.name}
                group={form.group}
                description={form.description}
                imageUrl={form.imageUrl}
                onApply={(url) => updateForm({ imageUrl: url })}
              />
            </div>
          </WorkshopSection>

          <WorkshopSection id="list" no="肆" title="已有武将" sub={`${characters.length} 位 · 载入编辑或删除`}
            open={open.list} onToggle={toggleSection}>
            {characters.length === 0 ? (
              <div className="workshop-empty">暂无武将，填写表单后点击「保存武将」创建第一位。</div>
            ) : (
              <div className="workshop-char-list">
                {characters.map(char => (
                  <div key={char.id} className={`workshop-char-row ${editing === char.id ? 'active' : ''}`}>
                    <span className="workshop-char-name">{char.name}</span>
                    <span className="workshop-char-meta">
                      {GROUP_NAMES[char.group] || char.group} · {char.hp}血 · {(char.skillIds || []).length} 技能
                    </span>
                    <span className="workshop-char-actions">
                      <button className="btn btn-small" onClick={() => loadCharacter(char)}>载入</button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(char)}>删除</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </WorkshopSection>

          <WorkshopSection id="appearance" no="伍" title="卡面外观" sub="仅影响预览，不写入武将数据"
            open={open.appearance} onToggle={toggleSection}>
            <div className="workshop-field-grid">
              <div className="workshop-field wide">
                <label>边框材质</label>
                <div className="workshop-frame-options">
                  {WORKSHOP_FRAMES.map(frame => (
                    <label key={frame.id} className={`workshop-frame-opt ${appearance.frame === frame.id ? 'active' : ''}`}>
                      <input type="radio" name="workshop-frame" value={frame.id}
                        checked={appearance.frame === frame.id}
                        onChange={() => setAppearance(prev => ({ ...prev, frame: frame.id }))} />
                      <span className={`workshop-frame-dot ${frame.id}`} />
                      {frame.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="workshop-field wide">
                <label>卡面主色 <em>仅预览点缀</em></label>
                <div className="workshop-swatches">
                  {WORKSHOP_ACCENTS.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className={`workshop-swatch ${appearance.accent === item.color ? 'active' : ''}`}
                      style={{ background: `linear-gradient(140deg, ${item.color}, rgba(7,9,12,.9))` }}
                      title={item.label}
                      onClick={() => setAppearance(prev => ({ ...prev, accent: item.color }))}
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="workshop-hint">外观与编号等只保存在本地草稿（{CHARACTER_DRAFT_KEY}），不会写入 Character 数据。</p>
          </WorkshopSection>

          <WorkshopSection id="voice" no="陆" title="AI 配音" sub="浏览器语音免费 / 本地 GPT-SoVITS 定制音色"
            open={open.voice} onToggle={toggleSection}>
            <VoiceStudio name={form.name} skillNames={selectedSkillNames} />
          </WorkshopSection>
        </div>

        <aside className="workshop-preview-column">
          <div className="workshop-preview-caption">
            <span>实时预览</span>
            <span>360 × 520 · 实体卡牌</span>
          </div>
          <CharacterCardPreview
            form={form}
            skills={skills}
            appearance={appearance}
            meta={{ ...cardMeta, number: cardMeta.number || form.id }}
          />
          <p className="workshop-preview-hint">
            保存后可在对局选将中使用；草稿自动保存到本机。
          </p>
          <div className="workshop-preview-stats">
            <span>装备栏 <b>{form.equipSlots || 3}</b></span>
            <span>技能 <b>{form.skillIds.length}</b></span>
            <span>体力 <b>{form.hp}/{form.maxHp}</b></span>
          </div>
        </aside>
      </div>

      {toast && (
        <div className={`workshop-toast ${toast.kind || 'ok'}`} role="status" aria-live="polite">
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export { CHARACTER_DRAFT_KEY };
