/**
 * 字体方案：只修改 CSS 变量，正文/标题/牌名可整体切换。
 * 全部为系统字体或本地开源字体，不依赖联网。
 */
export const FONT_KEY = 'cgm_font_config';

const SYSTEM_SANS = "'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif";
const SONG = "'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Source Han Serif SC', 'SimSun', serif";
const KAI = "'KaiTi', 'STKaiti', 'Kaiti SC', 'Songti SC', serif";
const LI = "'LiSu', 'STLiti', 'Songti SC', serif";
const MA = "'Ma Shan Zheng', 'Songti SC', 'STSong', 'SimSun', serif";

export const FONT_PRESETS = [
  {
    id: 'mashan',
    name: '墨韵',
    sample: '千秋墨韵',
    desc: '毛笔标题 + 宋体正文，默认风格',
    titleFont: MA,
    serifFont: SONG,
    sansFont: SYSTEM_SANS,
  },
  {
    id: 'songti',
    name: '宋雅',
    sample: '山河入梦',
    desc: '宋体标题与正文，端正雅致',
    titleFont: SONG,
    serifFont: SONG,
    sansFont: SYSTEM_SANS,
  },
  {
    id: 'kaiti',
    name: '楷雅',
    sample: '青史长歌',
    desc: '楷体标题，书卷气更浓',
    titleFont: KAI,
    serifFont: KAI,
    sansFont: SYSTEM_SANS,
  },
  {
    id: 'lishu',
    name: '隶韵',
    sample: '汉风古韵',
    desc: '隶书标题，厚重古朴',
    titleFont: LI,
    serifFont: SONG,
    sansFont: SYSTEM_SANS,
  },
  {
    id: 'sans',
    name: '清黑',
    sample: '极简现代',
    desc: '无衬线标题与正文，清爽利落',
    titleFont: SYSTEM_SANS,
    serifFont: SYSTEM_SANS,
    sansFont: SYSTEM_SANS,
  },
];

export function getFontPreset(id) {
  return FONT_PRESETS.find(p => p.id === id) || FONT_PRESETS[0];
}

export function loadFontConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(FONT_KEY) || '{}');
    return { preset: getFontPreset(saved.preset).id };
  } catch {
    return { preset: FONT_PRESETS[0].id };
  }
}

export function applyFontConfig(config) {
  if (typeof document === 'undefined') return;
  const preset = getFontPreset(config?.preset);
  const root = document.documentElement;
  root.style.setProperty('--font-calligraphy', preset.titleFont);
  root.style.setProperty('--font-serif', preset.serifFont);
  root.style.setProperty('--font-cn', preset.sansFont);
  root.dataset.fontPreset = preset.id;
}

export function saveFontConfig(config) {
  applyFontConfig(config);
  try {
    localStorage.setItem(FONT_KEY, JSON.stringify(config));
  } catch { /* ignore quota / privacy mode */ }
}

export function applySavedFont() {
  applyFontConfig(loadFontConfig());
}
