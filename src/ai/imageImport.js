/**
 * 本地图片导入：校验类型/大小，压缩到最大 768×1024 JPEG dataURL。
 * 浏览器 API 仅在用户选择文件后调用；SSR 下安全返回错误。
 */
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export const MAX_IMPORT_WIDTH = 768;
export const MAX_IMPORT_HEIGHT = 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function validateImageFile(file) {
  if (!file) return { ok: false, error: '请选择本地图片文件' };
  const type = String(file.type || '').toLowerCase();
  if (!IMAGE_TYPES.includes(type)) {
    return { ok: false, error: '仅支持 PNG / JPEG / WebP / GIF 图片' };
  }
  const size = Number(file.size) || 0;
  if (size <= 0) return { ok: false, error: '图片文件为空' };
  if (size > MAX_IMPORT_BYTES) {
    return { ok: false, error: '图片超过 8MB，请先压缩后再导入' };
  }
  return { ok: true };
}

export function fitImageSize(width, height, maxWidth = MAX_IMPORT_WIDTH, maxHeight = MAX_IMPORT_HEIGHT) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { width: maxWidth, height: maxHeight };
  }
  const scale = Math.min(1, maxWidth / w, maxHeight / h);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

/** 读取并压缩为 JPEG dataURL（最多 768×1024，质量 0.85，过大时自动降质） */
export async function imageFileToDataUrl(file, options = {}) {
  const check = validateImageFile(file);
  if (!check.ok) return check;
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return { ok: false, error: '当前环境不支持图片处理' };
  }
  const maxWidth = options.maxWidth || MAX_IMPORT_WIDTH;
  const maxHeight = options.maxHeight || MAX_IMPORT_HEIGHT;
  const baseQuality = options.quality || 0.85;
  const targetBytes = options.targetBytes || 400 * 1024;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('图片解码失败'));
      el.src = url;
    });
    const size = fitImageSize(img.naturalWidth || img.width, img.naturalHeight || img.height, maxWidth, maxHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, error: '无法创建图片画布' };
    ctx.drawImage(img, 0, 0, size.width, size.height);
    let quality = baseQuality;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > targetBytes * 1.4 && quality > 0.5) {
      quality = Math.round((quality - 0.1) * 100) / 100;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    return { ok: true, dataUrl, width: size.width, height: size.height };
  } catch (e) {
    return { ok: false, error: `图片处理失败：${e?.message || '未知错误'}` };
  } finally {
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
  }
}
