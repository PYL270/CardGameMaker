/**
 * effects - 打击感辅助：合成音效 + 设备震动
 * 全部做能力检测与异常保护，任何环境缺失都静默降级。
 */

let audioCtx = null;

/**
 * 读取打击反馈开关（设置页可关闭）
 * @param {'sound'|'vibrate'} kind
 */
function effectsEnabled(kind) {
  try {
    if (typeof localStorage === 'undefined') return true;
    const cfg = JSON.parse(localStorage.getItem('cgm_effects') || '{}');
    return cfg[kind] !== false;
  } catch {
    return true;
  }
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AC();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * 播放打击音效（低沉撞击 + 高频碎点，无需音频文件）
 * @param {number} intensity - 强度 0.5~1.5
 */
export function playImpact(intensity = 1) {
  if (!effectsEnabled('sound')) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const level = Math.min(1.5, Math.max(0.3, intensity));

    // 低频撞击
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(150 * level, t);
    thump.frequency.exponentialRampToValueAtTime(48, t + 0.2);
    thumpGain.gain.setValueAtTime(0.0001, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.28 * level, t + 0.012);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    thump.connect(thumpGain).connect(ctx.destination);
    thump.start(t);
    thump.stop(t + 0.26);

    // 高频碎点（增加“脆”的打击感）
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(1100, t);
    click.frequency.exponentialRampToValueAtTime(320, t + 0.07);
    clickGain.gain.setValueAtTime(0.0001, t);
    clickGain.gain.exponentialRampToValueAtTime(0.09 * level, t + 0.005);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    click.connect(clickGain).connect(ctx.destination);
    click.start(t);
    click.stop(t + 0.1);
  } catch {
    // 忽略音频异常
  }
}

/**
 * 设备震动（移动端；桌面端静默失败）
 * @param {number[]|number} pattern
 */
export function vibrate(pattern = [28, 34, 54]) {
  if (!effectsEnabled('vibrate')) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // 忽略
  }
}

/**
 * 点击/出牌轻反馈
 */
export function playTap() {
  if (!effectsEnabled('sound')) {
    vibrate(10);
    return;
  }
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(720, t);
    osc.frequency.exponentialRampToValueAtTime(480, t + 0.05);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  } catch {
    // 忽略
  }
  vibrate(10);
}
