import React, { useState, useEffect } from 'react';
import useGameStore from '../../store/gameStore';
import { generateTemplateCode } from '../CodeGen/TemplateGenerator';
import { generateLLMCode } from '../CodeGen/LLMGenerator';
import Icon from '../ui/Icon';
import Select from '../ui/Select';
import { alertDialog } from '../../utils/dialogService';

export default function CodePreview({ navigate, context }) {
  const characters = useGameStore(s => s.characters);
  const skills = useGameStore(s => s.skills);
  const initialForm = context?.skillForm || null;
  const [mode, setMode] = useState(initialForm ? 'llm' : 'template'); // template | llm
  const [selectedChar, setSelectedChar] = useState(initialForm?.id || '');
  const [selectedSkills, setSelectedSkills] = useState(initialForm?.id ? [initialForm.id] : []);
  const [llmPrompt, setLlmPrompt] = useState(
    initialForm
      ? `技能名：${initialForm.name || '未命名'}\n描述：${initialForm.description || '（请补充技能效果描述）'}`
      : ''
  );
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [llmStatus, setLlmStatus] = useState('');

  // 模板生成
  const handleTemplateGen = async () => {
    const char = characters.find(c => c.id === selectedChar);
    const charSkills = skills.filter(s => selectedSkills.includes(s.id));
    if (!char && charSkills.length === 0) {
      await alertDialog({ title: '尚未选择', message: '请选择武将或技能' });
      return;
    }
    const code = generateTemplateCode(char, charSkills);
    setGeneratedCode(code);
  };

  // LLM生成
  const handleLLMGen = async () => {
    if (!llmPrompt.trim()) {
      await alertDialog({ title: '缺少技能描述', message: '请输入技能描述' });
      return;
    }
    setIsGenerating(true);
    setLlmStatus('正在调用AI生成代码...');
    try {
      const code = await generateLLMCode(llmPrompt);
      setGeneratedCode(code);
      setLlmStatus('生成完成！');
    } catch (e) {
      setLlmStatus(`生成失败: ${e.message}`);
    }
    setIsGenerating(false);
  };

  // 复制代码
  const handleCopy = async () => {
    let message = '已复制！';
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(generatedCode);
      message = '已复制到剪贴板！';
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = generatedCode;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(ta);
      }
    }
    await alertDialog({ title: '复制成功', message, kicker: 'COPIED' });
  };

  // 应用/校验代码
  const handleApply = async () => {
    if (!generatedCode) return;
    try {
      // 只编译不执行，避免副作用，用于语法检查
      // eslint-disable-next-line no-new-func
      new Function(generatedCode);
      await alertDialog({
        title: '语法检查通过',
        message: '代码语法检查通过。请复制到游戏代码区或保存为扩展文件使用。',
        kicker: 'CHECK PASSED',
      });
    } catch (e) {
      await alertDialog({
        title: '语法检查未通过',
        message: `代码语法错误: ${e.message}\n请检查后重试。`,
        danger: true,
        kicker: 'CHECK FAILED',
      });
    }
  };

  return (
    <div className="code-preview-page">
      <div className="page-header">
        <button className="btn btn-small" onClick={() => navigate('menu')}>← 返回</button>
        <h2>代码生成区</h2>
      </div>

      <div className="codegen-layout">
        {/* 左侧：配置面板 */}
        <div className="codegen-config panel">
          <h3>生成方式</h3>
          <div className="mode-tabs">
            <button className={`btn btn-small ${mode === 'template' ? 'btn-primary' : ''}`}
              onClick={() => setMode('template')}>模板生成</button>
            <button className={`btn btn-small ${mode === 'llm' ? 'btn-primary' : ''}`}
              onClick={() => setMode('llm')}>AI生成</button>
          </div>

          {mode === 'template' && (
            <div className="template-config">
              <div className="form-group">
                <label>选择武将</label>
                <Select value={selectedChar} onChange={e => setSelectedChar(e.target.value)}>
                  <option value="">-- 请选择 --</option>
                  {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>

              <div className="form-group">
                <label>选择技能</label>
                <div className="skill-checkboxes">
                  {skills.map(s => (
                    <label key={s.id} className={`skill-check ${selectedSkills.includes(s.id) ? 'checked' : ''}`}>
                      <input type="checkbox" checked={selectedSkills.includes(s.id)}
                        onChange={() => setSelectedSkills(prev =>
                          prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id]
                        )} />
                      <span>{s.name}</span>
                    </label>
                  ))}
                  {skills.length === 0 && <p className="empty-tip">暂无技能</p>}
                </div>
              </div>

              <button className="btn btn-primary" onClick={handleTemplateGen}>
                生成代码
              </button>
            </div>
          )}

          {mode === 'llm' && (
            <div className="llm-config">
              <div className="form-group">
                <label>技能描述(自然语言)</label>
                <textarea value={llmPrompt} onChange={e => setLlmPrompt(e.target.value)}
                  placeholder="例如：创建一个触发技'英姿'，在你的摸牌阶段，你可以额外摸一张牌"
                  rows={6} />
              </div>

              <div className="form-group">
                <label>参考：当前已有的武将/技能</label>
                <div className="ref-list">
                  {characters.map(c => <span key={c.id} className="ref-tag">{c.name}</span>)}
                  {skills.map(s => <span key={s.id} className="ref-tag">{s.name}</span>)}
                  {characters.length === 0 && skills.length === 0 && <span className="empty-tip">暂无</span>}
                </div>
              </div>

              <button className="btn btn-primary" onClick={handleLLMGen} disabled={isGenerating}>
                {isGenerating
                  ? <><Icon name="sparkle" size={15} /><span>生成中...</span></>
                  : <><Icon name="sparkle" size={15} /><span>AI生成代码</span></>}
              </button>
              {llmStatus && <p className="status-msg">{llmStatus}</p>}
            </div>
          )}
        </div>

        {/* 右侧：代码展示 */}
        <div className="codegen-result panel">
          <h3>生成结果</h3>
          {generatedCode ? (
            <>
              <div className="code-toolbar">
                <button className="btn btn-small" onClick={handleCopy}>复制</button>
                <button className="btn btn-small" onClick={handleApply}>应用</button>
                <button className="btn btn-small btn-danger" onClick={() => setGeneratedCode('')}>清空</button>
              </div>
              <pre className="code-display"><code>{generatedCode}</code></pre>
            </>
          ) : (
            <div className="codegen-empty">
              <span className="codegen-empty-icon" aria-hidden="true">
                <Icon name="code" size={34} />
              </span>
              <p className="codegen-empty-title">等待生成代码</p>
              <p className="empty-tip">选择生成方式并点击生成按钮</p>
              <p className="codegen-empty-sub">模板生成无需联网；AI 生成会调用设置中的模型接口</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .code-preview-page {
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 20px;
          overflow-y: auto;
        }
        .page-header {
          flex: 0 0 auto;
          display: flex; align-items: center; gap: 16px;
          margin-bottom: 0;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(214, 185, 110, 0.13);
        }
        .page-header h2 { color: var(--accent-gold); }
        .codegen-layout {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          gap: 20px;
          align-items: stretch;
        }
        .codegen-config {
          width: 340px;
          flex: 0 0 340px;
          overflow-y: auto;
        }
        .codegen-config h3 { color: var(--accent-gold); margin-bottom: 12px; }
        .mode-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
        .template-config, .llm-config { display: flex; flex-direction: column; gap: 12px; }
        .skill-checkboxes { display: flex; flex-wrap: wrap; gap: 6px; }
        .skill-check { display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--bg-dark); border-radius: 4px; cursor: pointer; font-size: 13px; }
        .skill-check.checked { background: rgba(230,180,34,0.2); border: 1px solid var(--accent-gold); }
        .empty-tip { font-size: 12px; color: var(--text-secondary); opacity: 0.6; }
        .ref-list { display: flex; flex-wrap: wrap; gap: 4px; }
        .ref-tag { font-size: 11px; padding: 2px 6px; background: var(--bg-dark); border-radius: 3px; }
        .status-msg { font-size: 13px; color: var(--accent-blue); margin-top: 8px; }
        .codegen-result {
          flex: 1 1 auto;
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .codegen-result h3 { flex: 0 0 auto; color: var(--accent-gold); margin-bottom: 12px; }
        .code-toolbar { flex: 0 0 auto; display: flex; gap: 8px; margin-bottom: 12px; }
        .code-display {
          flex: 1 1 auto;
          min-height: 0;
          max-height: none;
          background: #0d1117; color: #c9d1d9; padding: 16px;
          border-radius: 8px; overflow: auto; font-size: 13px;
          line-height: 1.55; font-family: 'Consolas', 'Courier New', monospace;
          border: 1px solid rgba(214, 185, 110, 0.1);
          white-space: pre-wrap;
        }
        .codegen-empty {
          flex: 1 1 auto;
          min-height: 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 24px;
          text-align: center;
          border: 1px dashed rgba(214, 185, 110, 0.16);
          border-radius: 10px;
          background: radial-gradient(70% 70% at 50% 42%, rgba(214, 185, 110, 0.05), transparent 70%);
        }
        .codegen-empty-icon {
          display: grid;
          place-items: center;
          width: 62px;
          height: 62px;
          margin-bottom: 2px;
          border-radius: 50%;
          border: 1px solid rgba(214, 185, 110, 0.22);
          background: rgba(214, 185, 110, 0.06);
          color: rgba(214, 185, 110, 0.62);
          box-shadow: inset 0 0 18px rgba(214, 185, 110, 0.06);
        }
        .codegen-empty-title {
          font-family: var(--font-serif);
          font-size: 16px;
          letter-spacing: 1.5px;
          color: rgba(242, 232, 206, 0.88);
        }
        .codegen-empty .empty-tip { font-size: 13px; opacity: 0.78; }
        .codegen-empty-sub { font-size: 11px; color: var(--text-secondary); opacity: 0.5; }
        @media (max-width: 900px) {
          .codegen-layout { flex: 0 0 auto; flex-direction: column; }
          .codegen-config { width: 100%; flex: 0 0 auto; overflow-y: visible; }
          .codegen-result { flex: 0 0 auto; min-height: clamp(320px, 58vh, 520px); }
          .code-display { min-height: 240px; }
          .codegen-empty { min-height: 240px; }
        }
      `}</style>
    </div>
  );
}
