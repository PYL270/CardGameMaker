/**
 * secureStore - LLM 配置加密存储
 *
 * 背景：原实现把 cgm_llm_config（含 apiKey）明文写入 localStorage，
 * 任何同源脚本（包括被注入的第三方代码）都能顺手读取。本模块改为：
 *   - 用 WebCrypto AES-GCM(256) 加密配置后写入 localStorage；
 *   - 设备密钥在 IndexedDB 中生成并保存为不可导出的 CryptoKey，不落明文；
 *   - 读取时兼容旧版明文格式：读到明文 → 加密回写 → 后续只留密文；
 *   - WebCrypto / IndexedDB / localStorage 任一不可用（如 file://、隐私模式、
 *     老浏览器）时优雅降级回"明文读写"的原有行为并 console.warn，绝不抛未捕获异常。
 *
 * 兼容性：对外 API 是异步的（loadLLMConfig / saveLLMConfig 返回 Promise），
 * 调用方需要 await。旧数据不会丢：迁移失败时保留明文继续可用。
 *
 * 安全边界（诚实说明）：本方案只能防"顺手读取 localStorage"和简单脚本扫描，
 * 不能防同源脚本（能执行就能调用本模块解密或直接读内存里的 apiKey）。
 */

const STORAGE_KEY = 'cgm_llm_config';
const DB_NAME = 'cgm_secure_store';
const DB_VERSION = 1;
const KEY_STORE = 'device_keys';
const DEVICE_KEY_ID = 'llm-config-device-key';
/** 密文载荷标记：{ __cgm_enc: 1, iv, data } */
const ENC_MARK = '__cgm_enc';
const ENC_VERSION = 1;

function warn(message, error) {
  try {
    console.warn('[secureStore]', message, error || '');
  } catch {
    /* console 不可用时忽略 */
  }
}

function info(message) {
  try {
    console.info('[secureStore]', message);
  } catch {
    /* ignore */
  }
}

function safeLocalStorage() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch {
    /* 某些隐私模式下访问 localStorage 本身就会抛异常 */
  }
  return null;
}

function getCrypto() {
  try {
    if (typeof crypto !== 'undefined' && crypto && crypto.subtle) return crypto;
  } catch {
    /* ignore */
  }
  return null;
}

function getIndexedDB() {
  try {
    if (typeof indexedDB !== 'undefined' && indexedDB) return indexedDB;
  } catch {
    /* ignore */
  }
  return null;
}

/** WebCrypto + IndexedDB 都可用才做加密，否则降级 */
function canEncrypt() {
  return !!(getCrypto() && getIndexedDB());
}

/* ------------------------------------------------------------------ */
/* Base64（不依赖 Buffer，浏览器/Node 通用）                           */
/* ------------------------------------------------------------------ */

function bytesToBase64(bytes) {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ------------------------------------------------------------------ */
/* IndexedDB 设备密钥                                                  */
/* ------------------------------------------------------------------ */

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let request;
    try {
      request = getIndexedDB().open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB 打开失败'));
    request.onblocked = () => reject(new Error('IndexedDB 被其他标签页阻塞'));
  }).catch((err) => {
    dbPromise = null; // 失败后允许下次重试
    throw err;
  });
  return dbPromise;
}

let deviceKeyPromise = null;

/** 获取（或首次生成）设备 AES-GCM 密钥；CryptoKey 不可导出，只存在 IndexedDB */
function getDeviceKey() {
  if (deviceKeyPromise) return deviceKeyPromise;
  deviceKeyPromise = (async () => {
    const db = await openDb();
    const existing = await new Promise((resolve, reject) => {
      const tx = db.transaction(KEY_STORE, 'readonly');
      const request = tx.objectStore(KEY_STORE).get(DEVICE_KEY_ID);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('读取设备密钥失败'));
    });
    if (existing) return existing;

    const key = await getCrypto().subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // 不可导出：脚本无法把密钥原文带走
      ['encrypt', 'decrypt']
    );
    await new Promise((resolve, reject) => {
      const tx = db.transaction(KEY_STORE, 'readwrite');
      tx.objectStore(KEY_STORE).put(key, DEVICE_KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('保存设备密钥失败'));
      tx.onabort = () => reject(tx.error || new Error('保存设备密钥被中止'));
    });
    return key;
  })().catch((err) => {
    deviceKeyPromise = null; // 失败后允许下次重试
    throw err;
  });
  return deviceKeyPromise;
}

/* ------------------------------------------------------------------ */
/* 加解密                                                              */
/* ------------------------------------------------------------------ */

function isEncryptedPayload(value) {
  return !!(
    value &&
    typeof value === 'object' &&
    value[ENC_MARK] === ENC_VERSION &&
    typeof value.iv === 'string' &&
    typeof value.data === 'string'
  );
}

async function encryptConfig(config) {
  const webcrypto = getCrypto();
  const key = await getDeviceKey();
  const iv = webcrypto.getRandomValues(new Uint8Array(12)); // GCM 推荐 96-bit IV
  const plaintext = new TextEncoder().encode(JSON.stringify(config ?? {}));
  const cipher = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return JSON.stringify({
    [ENC_MARK]: ENC_VERSION,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(cipher)),
  });
}

async function decryptConfig(payload) {
  const webcrypto = getCrypto();
  const key = await getDeviceKey();
  const iv = base64ToBytes(payload.iv);
  const data = base64ToBytes(payload.data);
  const plaintext = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

/* ------------------------------------------------------------------ */
/* localStorage 读写                                                   */
/* ------------------------------------------------------------------ */

function readRaw(storage) {
  try {
    return storage.getItem(STORAGE_KEY);
  } catch (err) {
    warn('读取本地 LLM 配置失败', err);
    return null;
  }
}

function writeRaw(storage, text) {
  try {
    storage.setItem(STORAGE_KEY, text);
    return true;
  } catch (err) {
    warn('写入本地 LLM 配置失败', err);
    return false;
  }
}

function normalizeConfig(config) {
  try {
    return JSON.parse(JSON.stringify(config && typeof config === 'object' ? config : {}));
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* 对外 API                                                            */
/* ------------------------------------------------------------------ */

/**
 * 读取 LLM 配置（自动识别密文 / 旧明文并迁移）。
 * @returns {Promise<object>} 配置对象；任何异常都返回 {}，不抛出
 */
export async function loadLLMConfig() {
  try {
    const storage = safeLocalStorage();
    if (!storage) {
      warn('localStorage 不可用，LLM 配置按空配置处理');
      return {};
    }

    const raw = readRaw(storage);
    if (!raw) return {};

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      warn('本地 LLM 配置不是合法 JSON，按空配置处理', err);
      return {};
    }
    if (!parsed || typeof parsed !== 'object') return {};

    // 旧版明文格式 → 尽量加密迁移，失败也先返回明文不丢配置
    if (!isEncryptedPayload(parsed)) {
      if (canEncrypt()) {
        try {
          const cipherText = await encryptConfig(parsed);
          if (writeRaw(storage, cipherText)) {
            info('检测到旧版明文 LLM 配置，已加密迁移到 localStorage');
          }
        } catch (err) {
          warn('旧版明文 LLM 配置加密迁移失败，暂时保留明文（不影响使用）', err);
        }
      } else {
        warn('WebCrypto/IndexedDB 不可用，旧版明文 LLM 配置保持原样（未加密）');
      }
      return parsed;
    }

    // 密文格式
    if (!canEncrypt()) {
      warn(
        'WebCrypto 或 IndexedDB 不可用（例如 file:// 非安全上下文/隐私模式），无法解密已加密的 LLM 配置；' +
        '请通过 http://localhost 或 https 打开本应用后重新填写 API Key'
      );
      return {};
    }
    try {
      return await decryptConfig(parsed);
    } catch (err) {
      warn('LLM 配置解密失败（设备密钥可能已变），按空配置处理，请重新填写', err);
      return {};
    }
  } catch (err) {
    warn('读取 LLM 配置出现未预期错误，按空配置处理', err);
    return {};
  }
}

/** 保存串行队列：Settings 每次输入都保存，避免异步加密写乱序覆盖 */
let writeChain = Promise.resolve();

/**
 * 保存 LLM 配置（加密；不可加密时降级为原明文行为）。
 * @param {object} config - 完整配置对象
 * @returns {Promise<boolean>} 是否写入成功
 */
export function saveLLMConfig(config) {
  const snapshot = normalizeConfig(config);
  writeChain = writeChain
    .then(() => persistConfig(snapshot))
    .catch((err) => {
      warn('LLM 配置保存出现未预期错误', err);
      return false;
    });
  return writeChain;
}

async function persistConfig(config) {
  const storage = safeLocalStorage();
  if (!storage) {
    warn('localStorage 不可用，LLM 配置未保存');
    return false;
  }

  if (canEncrypt()) {
    try {
      const cipherText = await encryptConfig(config);
      return writeRaw(storage, cipherText);
    } catch (err) {
      warn('LLM 配置加密失败，降级为明文保存（不安全，建议用 https/localhost 打开）', err);
    }
  } else {
    warn('WebCrypto/IndexedDB 不可用，LLM 配置降级为明文保存（不安全）');
  }

  // 降级：保持原行为（明文 JSON）
  return writeRaw(storage, JSON.stringify(config));
}

/** 供 UI 显示提示用：当前环境是否具备加密能力 */
export function isSecureStoreAvailable() {
  return canEncrypt();
}
