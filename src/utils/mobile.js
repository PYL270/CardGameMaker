/**
 * 手机端能力检测与限制说明（纯函数优先，SSR 安全）。
 * Android App 会在 WebView UA 中带 CGMAndroid，并设置 window.__CGM_MOBILE__ = true。
 */
import { useEffect, useState } from 'react';

export const MOBILE_LIMITATIONS = [
  {
    id: 'local-ai',
    label: '本地 AI 服务',
    desc: '本地 Stable Diffusion、Piper、GPT-SoVITS 需要电脑端启动服务，手机版不可用。',
  },
  {
    id: 'code-ai',
    label: '代码生成 AI',
    desc: 'AI 代码生成需要电脑配置 LLM API；手机版仅可浏览已有代码。',
  },
  {
    id: 'online-host',
    label: '联机对战',
    desc: '联机需要电脑端开房/中继；手机版可加入，但房主仍需电脑。',
  },
  {
    id: 'desktop-files',
    label: '桌面布局与文件',
    desc: '部分桌面布局、字体导入、本地音频替换等仅电脑端可用。',
  },
  {
    id: 'artifact-build',
    label: '生成手机 APK',
    desc: 'APK 构建需在电脑开发环境运行 npm run apk，手机版只负责安装运行。',
  },
];

function readScope(scope) {
  if (scope && typeof scope === 'object') return scope;
  return typeof globalThis !== 'undefined' ? globalThis : {};
}

/** Android App（WebView）检测：UA 含 CGMAndroid 或 window.__CGM_MOBILE__ === true */
export function isMobileApp(scope = globalThis) {
  const root = readScope(scope);
  try {
    if (root.__CGM_MOBILE__ === true) return true;
    const ua = String(root.navigator?.userAgent || '');
    return /CGMAndroid/i.test(ua);
  } catch {
    return false;
  }
}

/** 手机/平板检测：App 优先；否则 UA 或触屏小屏 */
export function isMobileDevice(scope = globalThis) {
  const root = readScope(scope);
  try {
    if (isMobileApp(root)) return true;
    const ua = String(root.navigator?.userAgent || '');
    if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone|HarmonyOS/i.test(ua)) return true;
    const touchPoints = Number(root.navigator?.maxTouchPoints || 0);
    const width = Number(root.innerWidth || 0);
    return touchPoints > 0 && width > 0 && width <= 900;
  } catch {
    return false;
  }
}

/** 设备类型标签（设置/主菜单展示用） */
export function mobileDeviceLabel(scope = globalThis) {
  if (isMobileApp(scope)) return '手机 App';
  if (isMobileDevice(scope)) return '手机浏览器';
  return '电脑';
}

/** 是否触控输入：粗指针 / 触屏点数 / App */
export function isTouchInput(scope = globalThis) {
  const root = readScope(scope);
  try {
    if (isMobileApp(root)) return true;
    const points = Number(root.navigator?.maxTouchPoints || 0);
    if (points > 0) return true;
    if (typeof root.matchMedia === 'function') {
      return !!root.matchMedia('(pointer: coarse)').matches;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * 平台判定：App/窄屏/触屏窄屏 → mobile；否则 desktop。
 * 844×390 横屏（宽 844）在触屏粗指针下仍判为 mobile。
 */
export function getPlatform(scope = globalThis) {
  const root = readScope(scope);
  if (isMobileApp(root)) return 'mobile';
  try {
    const width = Number(root.innerWidth || 0);
    const height = Number(root.innerHeight || 0);
    if (width > 0 && width <= 760) return 'mobile';
    // 手机横屏（如 844×390）：宽 >760 但高度明显偏矮
    if (width > 0 && height > 0 && width <= 900 && height <= 500) return 'mobile';
    if (width > 0 && width <= 900 && isTouchInput(root)) return 'mobile';
  } catch {
    // ignore
  }
  return 'desktop';
}

/** React hook：随窗口尺寸/指针类型变化更新平台 */
export function usePlatform() {
  const [platform, setPlatform] = useState(() => getPlatform());
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const update = () => setPlatform(getPlatform());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    let mql = null;
    try {
      mql = window.matchMedia('(pointer: coarse)');
      if (mql?.addEventListener) mql.addEventListener('change', update);
      else if (mql?.addListener) mql.addListener(update);
    } catch {
      // ignore
    }
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      try {
        if (mql?.removeEventListener) mql.removeEventListener('change', update);
        else if (mql?.removeListener) mql.removeListener(update);
      } catch {
        // ignore
      }
    };
  }, []);
  return platform;
}
