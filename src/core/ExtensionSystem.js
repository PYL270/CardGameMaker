/**
 * ExtensionSystem - 扩展区架构
 * 提供插件式的扩展机制，用户可以通过扩展添加新的:
 * - 武将/技能/卡牌
 * - 游戏规则
 * - UI组件
 * - AI行为
 */

/**
 * 扩展基类
 */
export class GameExtension {
  /**
   * @param {string} name - 扩展名
   * @param {string} version - 版本
   * @param {string} description - 描述
   */
  constructor(name, version = '1.0', description = '') {
    this.name = name;
    this.version = version;
    this.description = description;
    this.enabled = true;
    this.dependencies = [];    // 依赖的其他扩展
    this.conflicts = [];       // 冲突的扩展
    this._hooks = new Map();   // 钩子函数
    this._config = {};         // 扩展配置
  }

  /**
   * 扩展注册时调用(添加武将/技能/规则)
   * @param {Game} game
   */
  onRegister(game) {}

  /**
   * 游戏初始化前调用
   * @param {Game} game
   */
  onBeforeInit(game) {}

  /**
   * 游戏初始化后调用
   * @param {Game} game
   */
  onAfterInit(game) {}

  /**
   * 回合开始前调用
   * @param {Game} game
   * @param {Player} player
   */
  onTurnStart(game, player) {}

  /**
   * 回合结束后调用
   * @param {Game} game
   * @param {Player} player
   */
  onTurnEnd(game, player) {}

  /**
   * 伤害计算修正
   * @param {Game} game
   * @param {object} damageEvent
   * @returns {number} 伤害修正值(可返回负值减少伤害)
   */
  onDamageCalc(game, damageEvent) { return 0; }

  /**
   * 距离修正
   * @param {Game} game
   * @param {Player} from
   * @param {Player} to
   * @returns {number} 距离修正值
   */
  onDistanceCalc(game, from, to) { return 0; }

  /**
   * 自定义UI渲染(返回React元素)
   * @returns {React.Element|null}
   */
  renderUI() { return null; }

  /**
   * 扩展卸载时调用
   * @param {Game} game
   */
  onRemove(game) {}

  /**
   * 注册钩子
   * @param {string} event
   * @param {Function} fn
   */
  addHook(event, fn) {
    if (!this._hooks.has(event)) this._hooks.set(event, []);
    this._hooks.get(event).push(fn);
  }

  /**
   * 触发钩子
   * @param {string} event
   * @param  {...any} args
   */
  async triggerHook(event, ...args) {
    const hooks = this._hooks.get(event) || [];
    for (const hook of hooks) {
      await hook(...args);
    }
  }

  /**
   * 获取配置
   */
  getConfig(key) { return this._config[key]; }

  /**
   * 设置配置
   */
  setConfig(key, value) { this._config[key] = value; }

  /**
   * 序列化
   */
  toJSON() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      enabled: this.enabled,
      config: this._config,
    };
  }
}

/**
 * 扩展管理器
 */
export class ExtensionManager {
  constructor() {
    this.extensions = new Map();
    this.order = []; // 加载顺序
  }

  /**
   * 注册扩展
   */
  register(ext) {
    if (this.extensions.has(ext.name)) {
      console.warn(`扩展 ${ext.name} 已存在，将被覆盖`);
    }
    this.extensions.set(ext.name, ext);
    this.order.push(ext.name);
  }

  /**
   * 卸载扩展
   */
  unregister(name, game) {
    const ext = this.extensions.get(name);
    if (ext) {
      ext.onRemove(game);
      this.extensions.delete(name);
      this.order = this.order.filter(n => n !== name);
    }
  }

  /**
   * 获取扩展
   */
  get(name) {
    return this.extensions.get(name);
  }

  /**
   * 启用/禁用扩展
   */
  setEnabled(name, enabled) {
    const ext = this.extensions.get(name);
    if (ext) ext.enabled = enabled;
  }

  /**
   * 获取所有扩展列表
   */
  listAll() {
    return this.order.map(name => {
      const ext = this.extensions.get(name);
      return ext ? ext.toJSON() : null;
    }).filter(Boolean);
  }

  /**
   * 调用所有扩展的某个方法
   */
  async invokeAll(method, ...args) {
    for (const name of this.order) {
      const ext = this.extensions.get(name);
      if (ext && ext.enabled && typeof ext[method] === 'function') {
        try {
          await ext[method](...args);
        } catch (e) {
          console.error(`扩展 ${name} 的 ${method} 出错:`, e);
        }
      }
    }
  }

  /**
   * 计算伤害修正(累加所有扩展)
   */
  calcDamageFix(game, damageEvent) {
    let fix = 0;
    for (const name of this.order) {
      const ext = this.extensions.get(name);
      if (ext && ext.enabled) {
        fix += ext.onDamageCalc(game, damageEvent);
      }
    }
    return fix;
  }

  /**
   * 计算距离修正
   */
  calcDistanceFix(game, from, to) {
    let fix = 0;
    for (const name of this.order) {
      const ext = this.extensions.get(name);
      if (ext && ext.enabled) {
        fix += ext.onDistanceCalc(game, from, to);
      }
    }
    return fix;
  }
}

/**
 * 创建空白扩展模板
 * @param {string} name
 * @returns {GameExtension}
 */
export function createEmptyExtension(name) {
  return new GameExtension(name, '1.0', `自定义扩展: ${name}`);
}
