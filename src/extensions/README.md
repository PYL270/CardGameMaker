# 扩展区（Extension Zone）

这里用于放置**用户自定义扩展**，是框架的“空白区”：默认不加载任何武将和技能，全部由你添加。

## 扩展能做什么

- 注册新武将（Character）
- 注册新技能（Skill）
- 注册自定义卡牌（`game.registerCardType`，配合扩展自己的牌堆定义）
- 修改规则：伤害修正、距离修正
- 挂接自定义事件钩子

## 如何编写一个扩展

1. 在本目录新建文件，例如 `MyExtension.js`：

```js
import { GameExtension } from '../core/ExtensionSystem';

export default new GameExtension('my_extension', '1.0', '我的扩展');
```

2. 覆盖生命周期方法并按需注册内容：

```js
import { GameExtension } from '../core/ExtensionSystem';

class MyExtension extends GameExtension {
  constructor() {
    super('my_extension', '1.0', '我的扩展');
  }

  // 游戏注册阶段：添加武将/技能
  onRegister(game) {
    game.registerSkill({
      id: 'my_skill',
      name: '示例技',
      type: 'trigger',
      description: '摸牌阶段额外摸一张牌',
      triggerTiming: 'phaseDrawBegin2',
      triggerSource: 'player',
      usable: 1,
      forced: false,
      filter: () => true,
      cost: async (event) => { event.result = { bool: true }; },
      content: async (event) => { event.data.num += 1; },
      ai: { order: 10, check: () => true },
    });

    game.registerCharacter({
      id: 'my_hero',
      name: '示例武将',
      group: 'custom',
      hp: 4,
      skillIds: ['my_skill'],
    });
  }

  // 伤害修正（返回正数加伤、负数减伤）
  onDamageCalc(game, damageEvent) {
    return 0;
  }

  // 距离修正（返回正数增加距离）
  onDistanceCalc(game, from, to) {
    return 0;
  }
}

export default new MyExtension();
```

3. 在 `index.js` 中登记：

```js
import MyExtension from './MyExtension';

export const allExtensions = [
  MyExtension,
  // ...
];
```

4. 在需要启动扩展的地方调用 `registerAllExtensions(game)`（或单独
   `game.registerExtension('my_extension', MyExtension)`）。

> `DemoExtension.js` 是一个完整的示例（周瑜 + 英姿 + 反馈），默认**不加载**，
> 以保证游戏初始没有任何武将/技能。可以把它加入 `index.js` 观察效果，
> 或直接删除。

## 与「编辑器 + 代码生成」的关系

- 编辑器创建的武将/技能保存在浏览器 localStorage，是**无需写代码**的快速方式；
- 扩展区适合做**跨对局、可复用、可分享**的规则包；
- 「代码生成区」可以把编辑器里配置好的武将/技能一键导出为扩展代码，
  复制到本目录即可变成正式扩展。

## 注意

- 触发技的 `triggerTiming` 必须与引擎时机一致（见 `src/core/Skill.js` 的
  `TRIGGER_TIMINGS`）。
- `triggerSource` 为 `player` 时只在该玩家相关事件触发；`global` 时所有
  存活玩家都会检查。
- 扩展方法请保持无阻塞、少副作用；异常会被引擎捕获并写入对局日志。
