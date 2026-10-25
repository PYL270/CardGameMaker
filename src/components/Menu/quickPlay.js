/**
 * 速玩（扫码即玩）纯函数：启动参数解析 / 局域网地址策略 / 链接生成 / 二维码降级 / 手机布局选择。
 * 抽成纯函数便于 UI 冒烟测试；组件只负责 DOM 与副作用。
 */

/**
 * 解析启动参数：
 * - ?quick=1 → { quick:true, room:null, mode:'quick' }
 * - ?room=CODE → { quick:false, room:'CODE', mode:'room' }（房间优先）
 * - 空 / 非法 → { quick:false, room:null, mode:'menu' }
 */
export function parseLaunchParams(search) {
  const raw = typeof search === 'string' ? search : '';
  let params;
  try {
    params = new URLSearchParams(raw.replace(/^\?/, ''));
  } catch {
    return { quick: false, room: null, mode: 'menu' };
  }
  const roomRaw = (params.get('room') || '').trim().toUpperCase();
  const room = /^[A-Z0-9]{4,8}$/.test(roomRaw) ? roomRaw : null;
  const quickRaw = (params.get('quick') || '').toLowerCase();
  const quickWanted = quickRaw === '1' || quickRaw === 'true';
  const quick = quickWanted && !room;
  return { quick, room, mode: room ? 'room' : (quick ? 'quick' : 'menu') };
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'];

/**
 * 局域网地址策略：
 * 1) 手机端直接访问（hostname 不是 localhost）→ 用当前 origin
 * 2) 电脑端 localhost → 优先中继返回的 online.lanIps[0] + 当前端口
 * 3) 都没有 → 退回 origin 并给出 localhost 警告
 */
export function buildLanAddress({ origin = '', hostname = '', port = '', protocol = 'http:', lanIps = [] } = {}) {
  const normalizedHost = String(hostname || '').toLowerCase();
  const isLocalhost = !normalizedHost || LOCAL_HOSTS.includes(normalizedHost);
  const lanIp = Array.isArray(lanIps)
    ? lanIps.find(ip => typeof ip === 'string' && ip.trim()) || null
    : null;
  const effectivePort = String(port || (protocol === 'https:' ? '443' : '80'));
  let baseUrl = '';
  let mode = 'none';

  if (!isLocalhost && origin) {
    baseUrl = origin.replace(/\/+$/, '');
    mode = 'origin';
  } else if (lanIp) {
    const portPart = effectivePort && effectivePort !== '80' ? `:${effectivePort}` : '';
    baseUrl = `http://${lanIp}${portPart}`;
    mode = 'lan';
  } else if (origin) {
    baseUrl = origin.replace(/\/+$/, '');
    mode = 'localhost';
  }

  const warning = (mode === 'localhost' || mode === 'none')
    ? '当前是 localhost/127.0.0.1，手机无法直接访问。请用电脑的局域网 IP 打开本页（ipconfig 查看 IPv4），或确保中继已启动以自动获取 LAN 地址。'
    : null;

  return { baseUrl, mode, isLocalhost: mode === 'localhost' || mode === 'none', lanIp, warning };
}

/** 生成速玩链接：kind='quick' → /?quick=1；kind='room' → /?room=CODE */
export function buildQuickPlayUrl({ baseUrl = '', kind = 'quick', code = null } = {}) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  if (!base) return '';
  if (kind === 'room') {
    const normalized = String(code || '').trim().toUpperCase();
    return normalized ? `${base}/?room=${encodeURIComponent(normalized)}` : '';
  }
  return `${base}/?quick=1`;
}

/** 二维码状态：生成失败/地址不可用时降级为可复制链接，不白屏 */
export function resolveQuickPlayQr({ url = '', data = '', error = null } = {}) {
  const canShowQr = !!(url && data && !error);
  return {
    canShowQr,
    link: url || '',
    fallback: !canShowQr,
    fallbackText: canShowQr ? '' : '二维码生成失败或地址不可用，请复制下方链接在手机浏览器打开。',
  };
}

/**
 * 手机速玩自动布局：仅当窄屏且本地没有 cgm_layout 时才自动选择，绝不覆盖用户已存设置。
 * 返回 preset id（compact/mingsha）或 null（不修改）。
 */
export function pickQuickPlayLayout({ width = 0, hasStoredLayout = false } = {}) {
  if (hasStoredLayout) return null;
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) return null;
  return w <= 720 ? 'compact' : 'mingsha';
}

/** 速玩单机默认配置：你（人类）+ AI1，2 人自由混战 */
export function buildQuickPlayConfigs() {
  return [
    { name: '你', isAI: false, team: null },
    { name: 'AI1', isAI: true, team: null },
  ];
}

export const QUICK_PLAY_TEAM_MODE = 'ffa';
