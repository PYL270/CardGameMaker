/**
 * safeCode - 技能代码安全校验与编译入口
 *
 * 背景：技能编辑器的 filter/cost/content/ai.check 以及代码生成区都会把
 * 用户输入 / LLM 生成的文本用 new Function 变成可执行函数，这等价于任意
 * 代码执行（XSS 之上再加 RCE 级别的风险：读 localStorage 里的 API Key、
 * 发网络请求、操作页面 DOM 等）。
 *
 * 本模块做两件事（最小可用补丁，不是沙箱）：
 *   1) validateSkillCode：静态黑名单 + 长度上限，命中即抛中文错误；
 *   2) compileSkillCode / precheckSkillCode：唯一的 new Function 出口，
 *      先校验再编译，保证调用方不再各自裸调 new Function。
 *
 * 注意：静态黑名单可以被变形/编码绕过，这是"提高攻击成本"的加固，
 * 不是强安全边界。真正的隔离需要 Worker + CSP 或可中断的解释器。
 */

/** 技能代码长度上限（字符数），防止超长代码拖慢校验/编译 */
export const MAX_SKILL_CODE_LENGTH = 20000;

/**
 * 黑名单表：[命中词（用于报错）, 正则]
 * 全部使用 \b 单词边界，避免把 function 关键字误判为 Function。
 * 覆盖范围：DOM/BOM 全局、网络请求、存储、跨窗口通信、动态代码执行、
 * 原型链污染、Node/打包器注入的全局对象。
 */
const BLOCKED_PATTERNS = [
  // --- DOM / BOM 全局 ---
  ['window', /\bwindow\b/g],
  ['document', /\bdocument\b/g],
  ['globalThis', /\bglobalThis\b/g],
  ['self', /\bself\b/g],
  ['frames', /\bframes\b/g],
  ['parent', /\bparent\b/g],
  ['top', /\btop\b/g],
  ['opener', /\bopener\b/g],
  ['postMessage', /\bpostMessage\b/g],
  ['navigator', /\bnavigator\b/g],
  ['sendBeacon', /\bsendBeacon\b/g],
  ['location', /\blocation\b/g],
  ['cookie', /\bcookie\b/g],
  // --- 网络请求 ---
  ['fetch', /\bfetch\b/g],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/g],
  ['WebSocket', /\bWebSocket\b/g],
  ['EventSource', /\bEventSource\b/g],
  ['Worker', /\b(?:SharedWorker|Worker)\b/g],
  ['import', /\bimport\b/g],
  // --- 存储 ---
  ['localStorage', /\blocalStorage\b/g],
  ['sessionStorage', /\bsessionStorage\b/g],
  ['indexedDB', /\bindexedDB\b/g],
  // --- 动态代码执行 ---
  ['eval', /\beval\b/g],
  ['Function', /\bFunction\b/g],
  ['constructor', /\bconstructor\b/g],
  // --- 原型链污染 ---
  ['__proto__', /__proto__/g],
  ['prototype', /\bprototype\b/g],
  ['Object.assign/setPrototypeOf/defineProperty', /\bObject\s*\.\s*(?:assign|setPrototypeOf|defineProperty|getPrototypeOf)\b/g],
  // --- Node / 打包器注入的全局对象（浏览器里通常不存在，防御性拦截）---
  ['require', /\brequire\b/g],
  ['process', /\bprocess\b/g],
  ['module/exports', /\b(?:module|exports)\b/g],
  ['global', /\bglobal\b/g],
];

/**
 * 把字符下标换算成 行/列（1-based），用于报错定位。
 */
function toLineColumn(code, index) {
  const before = code.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

/**
 * 静态校验技能代码。
 * @param {string} code - 技能函数体/代码片段
 * @returns {string} 原样返回代码（便于链式使用）
 * @throws {Error} 超长或命中黑名单时抛出中文错误（含命中词与行/列位置）
 */
export function validateSkillCode(code) {
  const src = typeof code === 'string' ? code : String(code ?? '');

  if (src.length > MAX_SKILL_CODE_LENGTH) {
    throw new Error(
      `技能代码过长（${src.length} 字符，上限 ${MAX_SKILL_CODE_LENGTH} 字符），请精简后再保存`
    );
  }

  for (const [label, pattern] of BLOCKED_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(src);
    if (match) {
      const { line, column } = toLineColumn(src, match.index);
      throw new Error(
        `技能代码含被禁止的内容「${label}」（命中：${match[0]}，第 ${line} 行第 ${column} 列）。` +
        '技能代码只允许使用游戏内对象（event/trigger/player/game 等），不能访问浏览器、网络或存储能力'
      );
    }
  }

  return src;
}

/**
 * 编译技能函数（唯一的 new Function 出口）。
 * 与原有调用方式兼容：
 *   - 同步：new Function('event', 'player', code)
 *   - 异步：new Function('event', 'trigger', 'player', `return (async () => { ${code} })()`)
 *
 * @param {string[]} argNames - 形参名列表
 * @param {string} body - 函数体代码
 * @param {{async?: boolean}} [options] - async=true 时保持原有"异步 IIFE"语义
 * @returns {Function}
 * @throws {Error} 校验失败或语法错误时抛出（由调用方 try/catch 处理）
 */
export function compileSkillCode(argNames, body, { async = false } = {}) {
  const src = validateSkillCode(body);
  const params = Array.isArray(argNames) ? argNames : [];
  const fnBody = async ? `return (async () => { ${src} })()` : src;

  try {
    // eslint-disable-next-line no-new-func
    return new Function(...params, fnBody);
  } catch (err) {
    const reason = err && err.message ? err.message : String(err);
    throw new Error(`技能代码编译失败：${reason}`);
  }
}

/**
 * 代码预检（CodePreview 用）：只校验 + 编译，不执行。
 * new Function 本身只编译不执行函数体，因此这里不会产生副作用。
 *
 * @param {string} code - 完整代码片段
 * @returns {true} 通过校验与语法解析时返回 true
 * @throws {Error} 命中黑名单或存在语法错误
 */
export function precheckSkillCode(code) {
  const src = validateSkillCode(code);
  try {
    // eslint-disable-next-line no-new-func
    new Function(src);
  } catch (err) {
    const reason = err && err.message ? err.message : String(err);
    throw new Error(`语法错误：${reason}`);
  }
  return true;
}
