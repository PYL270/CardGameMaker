# CardGameMaker 项目设定集（交接版）

> 生成时间：2026-10-23
> 项目位置：`D:\CardGameMaker`
> 桌面入口：`C:\Users\99263\Desktop\CardGameMaker.lnk` → `D:\CardGameMaker\start.bat`
> 当前服务：网页 `http://localhost:3000`、联机中继 `ws://localhost:8787`（本地局域网可用）
> 技术栈：React 18 + Vite 5 + Zustand 4 + ws + qrcode

---

## 0. 一句话目标

做一个「类三国杀」的卡牌游戏框架：初始没有武将/技能，由用户自行添加，编辑器可生成代码；带完整对局引擎、AI、联机、手机端适配、三国杀式牌桌与持续优化的视觉/动画。

**新窗口接续建议**：先完整阅读本文件与 `README.md`，再运行测试确认真实状态；不要凭旧对话记忆改代码。

---

## 1. 需求演进（按用户提出顺序）

1. **初始需求**：做一个类似三国杀的游戏；**原本没有任何武将牌和技能牌**，由用户自行添加；添加后后台 AI 在代码区生成对应代码；在 D 盘创建文件夹。
   - 用户选择：React + Vite；模板生成 + LLM 生成都要；完整三国杀机制并留空白扩展区；文件夹名 `CardGameMaker`。
2. **UI/体验**：iPhone 玻璃拟态、微透明；战败后可重开、不停在战败界面；打击感（震动、屏幕震动、红色受击、伤害飘字、合成音效）。
3. **联机 + 桌面**：联机功能；软件放到桌面可点击游玩。
4. **测试与修复**：实际运行测试；遇到设计问题要重新设计修复。
5. **牌桌布局**：模仿三国杀；手牌在下方、个人角色在牌旁边；牌可自己换位置或一键整理。
6. **基础角色与牌面说明**：设计基础角色技能；牌底加小字简注；另设按钮查看详细说明。
7. **战斗性与策略**：不要直接省略别人的出牌阶段；要有策略；搜索《名将杀》借鉴；经典英雄技能不能只有名字，要有完整设置；参考三国杀经典英雄。
8. **安卓适配**：安卓手机与电脑联机。
9. **视觉去塑料感**：优化质感。
10. **信息与动态**：可看到对方牌数（不公开牌面）；增加运动感。
11. **减操作与牌堆**：推荐出牌/自动出牌；不同种子生成不同牌堆；左上角显示牌堆总数与剩余数。
12. **图标动画**：不要只做简单漂浮，要让图标动画有动态感。
13. **音乐与音效**：加入背景音乐与音效，并提供玩家自定义音乐/音效的窗口；BGM 要宏伟壮大的古风、不压抑，且必须首尾完美无缝衔接，循环不能有卡顿/空档。
14. **整体 UI 再优化**：继续加强页面/按钮/卡牌动效与整体质感。
15. **出牌阶段规则修复**：不能主动出【闪】等仅响应牌；全面检查出牌可用性（桃/酒目标/距离）。
16. **状态氛围与牌面/飞牌**：喝酒后要有红色氛围等状态表现；卡牌字体不能杂糅；飞牌在空中丝滑停滞再渐缓消失；背景要动态且支持用户上传。

---

## 2. 核心玩法设定

### 2.1 对局流程

回合顺序：
`回合开始 → 准备 → 判定 → 摸牌 → 出牌 → 弃牌 → 结束 → 回合结束`

- 判定阶段处理判定区延时锦囊（后进先出）。
- 摸牌阶段默认摸 2 张；技能可通过 `phaseDrawBegin2` 修改 `event.data.num`。
- 弃牌阶段弃至体力值。
- 伤害统一走 `game.dealDamage()`：`damageBegin` 技能修正 → 扣血 → `damaged` 技能 → 濒死处理。
- 死亡处理：`die` / `dieAfter` 时机；求桃简化（自救/他人自动出桃）。

### 2.2 初始内容策略（重要）

- 用户最早要求「没有武将/技能」，后来要求「设计经典英雄」。
- 现状：**内置 10 名经典武将 + 基础角色**，但仍支持在武将/技能编辑器里完全自定义；经典武将不写入用户的 localStorage 自定义列表，而是在 `Game.init()` 时注册进注册表。
- 未选择武将时使用**基础角色**：4 体力，技能【勤学】【稳守】。

### 2.3 基础角色

| 项目 | 设定 |
|------|------|
| ID | `base_character` |
| 体力 | 4 |
| 技能 | `base_qinxue` 勤学、`base_wenshou` 稳守 |
| 勤学 | 锁定技，摸牌阶段额外摸 1 张 |
| 稳守 | 锁定技，每回合第一次受到伤害时防止其中 1 点 |

相关文件：`src/data/basicCharacter.js`

### 2.4 经典武将（内置 10 名）

技能 ID 前缀统一 `cls_`，每个技能都有完整 `triggerTiming / triggerSource / usable / forced / filter / cost / content / description`。

| 武将 | ID | 势力/体力 | 技能 | 类型 | 效果 |
|------|----|-----------|------|------|------|
| 曹操 | cls_caocao | 魏/4 | 奸雄 cls_jianxiong | 触发（受伤后，每回合1次） | 获得造成伤害的牌 |
| 刘备 | cls_liubei | 蜀/4 | 仁德 cls_rende | 主动（出牌阶段1次） | 交给其他角色1张手牌，回复1体力 |
| 孙权 | cls_sunquan | 吴/4 | 制衡 cls_zhiheng | 主动（出牌阶段1次） | 弃任意张手牌，摸等量牌 |
| 关羽 | cls_guanyu | 蜀/4 | 武圣 cls_wusheng | 主动（受出杀次数限制） | 红色手牌当【杀】使用 |
| 张飞 | cls_zhangfei | 蜀/4 | 咆哮 cls_paoxiao | 锁定 | 出【杀】无次数限制 |
| 诸葛亮 | cls_zhugeliang | 蜀/3 | 空城 cls_kongcheng | 锁定 | 无手牌时不能成为【杀】【决斗】目标 |
| 司马懿 | cls_simayi | 魏/3 | 反馈 cls_fankui | 触发（受伤后，每回合1次） | 获得伤害来源一张手牌 |
| 周瑜 | cls_zhouyu | 吴/3 | 英姿 cls_yingzi | 锁定 | 摸牌阶段额外摸1张 |
| 黄月英 | cls_huangyueying | 蜀/3 | 集智 cls_jizhi | 触发 | 使用非延时锦囊时摸1张 |
| 貂蝉 | cls_diaochan | 群/3 | 闭月 cls_biyue | 触发（结束阶段） | 摸1张 |

相关文件：`src/data/classicCharacters.js`（含 `CLASSIC_SKILLS`、`CLASSIC_CHARACTERS`、`getClassicSkill`）

### 2.5 主动技能系统

- 出牌阶段 `Game.getActiveSkills(player)` 列出可用主动技。
- 玩家通过 ActionPanel 的技能按钮选择；`Turn.phasePlay` 收到 `{type:'useSkill', skill}` 后调用 `game.useActiveSkill()`。
- 技能内可用 `game.chooseCards()` / `game.chooseTarget()` 请求选牌/选目标；人类走 UI 回调，无 UI 或 AI 操作时由 `aiPickSkillCards()` / `aiPickSkillTarget()` 按提示与局势选择。
- AI 已会主动发动**制衡、仁德、武圣**：制衡在低价值牌≥2 时弃2摸3；仁德只在有存活队友且己方受伤时送牌；武圣在断杀且有红色低价值牌时发动。
- 当前限制：**联机客户端不能发动自定义主动技能**（房主本地可用）。

### 2.6 推荐出牌 / 自动出牌

- ActionPanel 出牌阶段有「推荐出牌」按钮：调用 `computeRecommended()`，本地/房主直接用 `game.aiAutoPlay()` 结果出牌或结束出牌；联机客户端按提示数据选第一张可用牌与目标。
- 顶部「自动」按钮：开启后 700ms 自动处理 pendingAction：
  - play → 推荐动作
  - discard → 按价值弃牌
  - respond → 选第一张可用响应牌
  - selectCards → 选前 min 张
  - chooseTarget → 第一个目标
  - confirm → 同意
- 状态持久化：`localStorage["cgm_auto_play"]`。
- 自动模式不会主动使用主动技能（避免误操作）。

### 2.7 种子牌堆

- 选将页可输入种子或「换一个」。
- `Deck.init(cardDefs, seed)` 使用 `mulberry32(seed)`：
  - 相同种子 → 相同牌序
  - 不同种子 → 不同牌序
  - 牌堆耗尽重洗使用同一随机源，保证可复现
- 种子展示：中央 chip「种子 123456」；顶部左上角「牌堆 剩余/总数」。
- 联机每局由房主生成新种子，客户端通过 `deckInfo` 同步显示。

### 2.8 卡牌与说明

- 牌堆补充为 **六花色**：黑桃/红桃/梅花/方块 + **日曜☀ / 月华☾**；日曜按红色判定（八卦阵可用），月华按黑色判定；乐不思蜀/兵粮/闪电仍只认传统对应花色。牌堆总数 138 张，杀/闪/桃/酒、锦囊、延时锦囊、装备齐全。
- 每张手牌底部显示**小字简注**（来自 `src/data/cardText.js` 的 `brief`），悬停显示 `detail`。
- 顶部「说明」按钮打开 `CardGuide`：按基本牌/锦囊/延时锦囊/装备/基础角色技能/经典武将技能分类展示。
- 已实现效果以代码为准；无懈可击、常见武器/防具特效、丈八蛇矛/方天画戟入口已实现，说明里同步注明。

### 2.9 手牌与信息展示

- 自己的手牌：底部手牌区，选中的牌高亮；可单张拖动摆放、双击复位、一键整理（按类型/点数排序并清空手动偏移）。
- 对手手牌：**牌背堆叠 + 「手牌 N」**，只显示数量，不公开牌面。
- 牌堆信息：左上角「牌堆 剩余/总数」；中央「弃牌数 / 种子」。

### 2.10 音频系统与自定义音乐

- 内置 **5 首** BGM：**《山河》**（主菜单/编辑页）、**《战鼓》**（对局）为项目自制；**《沈阳》《涟漪》《古筝城》** 为 Kevin MacLeod（incompetech.com）作品，CC BY 4.0，需保留署名。位于 `public/audio/`，授权见 `public/audio/MUSIC_CREDITS.md`。
- **编曲已简化**：每两小节一个和弦、长音旋律、少量大鼓/大锣，避免层叠过乱；低通软化高频。
- **无缝循环**：BGM 解码为 `AudioBuffer` 后用 `AudioBufferSourceNode.loop` 播放；WAV 首尾用 60ms 尾音交叉淡化；新 MP3 解码后自动裁掉首尾静音并做 8ms 淡入淡出，降低循环接缝。禁止回退到 `<audio loop>`。
- 音效：**20 个 CC0 采样**，四类：界面交互（click/select/error）、卡牌操作（card/draw/shuffle/equip/trick/discard/tao）、战斗打击（sha/shan/damage/kill/dying）、战局状态（turn/judge/heal/win/lose）。Kenney CC0 音效包 + 项目原创合成（win/lose/dying）；`public/audio/sfx/<category>/`，授权见 `public/audio/SFX_CREDITS.md`；解码缓存、随机音高、失败回退合成音，可逐槽替换自定义音频。
- 自定义音频窗口：主菜单 →「音频设置」；上传 mp3/wav/ogg/m4a，BGM/音效按槽替换；文件存浏览器 IndexedDB，不上传服务器、不写入项目目录；总开关 + 主/BGM/音效音量。
- BGM 是本地播放，不做联机同步；首次用户交互后解锁播放。切场景时两首曲子交叉淡入淡出；同一场景切换页面不重播。
- 代码：`src/audio/audioManager.js`、`src/components/Menu/AudioSettings.jsx`；诊断句柄 `window.__cgmAudio`。

### 2.11 动态背景、状态氛围与牌面

- **动态背景**：内置墨玉流云 / 山河云海 / 战火余烬 / 星夜流光；CSS 极光、云海、漂浮粒子、暗角与颗粒；主菜单 →「背景设置」可上传自定义图片（jpg/png/webp ≤20MB，IndexedDB）、调暗化/模糊/动效；设置应用到主菜单与对战。
- **状态氛围**：喝酒后全场红色酒气 + 上浮余烬 + 角色红边 + “酒”徽章；濒死/低体力红色危殆光晕；翻面/横置/空城徽章；状态通过 `Player.toJSON()` 与 `serializePlayerPublic` 同步到联机客户端。
- **牌面**：左上角点数/花色、中央大水印、宋体牌名、底部简注、右上角类型钤印；不可用牌置灰；`CardFace` 统一手牌/选择面板/飞牌。
- **点击即看说明**：状态徽章（`infoTexts.js`）、技能/装备/判定标签、牌面类型印点击后弹出 `InfoPanel` 小浮层；点 × 或 Esc 关闭，不挡视野。
- **飞牌**：飞向左侧展示位，从操作面板/玩家区/日志等文字层后方经过（z-index 低于文字面板），不会遮挡文字；保留短暂停留、金环扩散、渐缓模糊消失；【杀】附全屏斩击。

### 2.12 装备与锦囊特效

- **诸葛连弩**：出【杀】无次数限制；**青釭剑**：使用【杀】无视目标防具（八卦阵失效）。
- **雌雄双股剑**：对异性目标出杀时，目标弃一张手牌，否则你摸一张；**寒冰剑**：造成伤害时可改为弃目标两张牌并免伤。
- **青龙偃月刀**：杀被闪避后追加一张杀（最多一次）；**贯石斧**：杀被闪避后可弃两张手牌强制造成伤害。
- **麒麟弓**：杀造成伤害后弃置目标坐骑；**八卦阵**：需要出闪时判定，红色视为闪。
- **无懈可击**：在有害锦囊生效前响应，抵消整张锦囊；AI 自动响应，人类通过响应面板选择。
- **丈八蛇矛**：出牌面板出现「丈八蛇矛」按钮，选两张手牌当【杀】；**方天画戟**：最后一张手牌为【杀】时可点「多目标」额外指定至多两个目标。
- **卡牌特效**：出牌/装备/酒/桃/闪电/无懈/武器/防具触发时显示对应光效与播报（治疗绿、酒气红、雷鸣紫、护盾蓝、装备金等）。

### 2.13 字体、图标与防遮挡布局

- **字体设置**：设置 →「字体设置」可切换墨韵（Ma Shan Zheng）/宋雅/楷雅/隶韵/清黑 5 套方案；`fontManager.js` 写入 `cgm_font_config`，启动时 `applySavedFont()` 恢复；切换只改变 `--font-calligraphy / --font-serif / --font-cn`。
- **标题字体**：本地 `public/fonts/MaShanZheng-Regular.ttf`（Google Fonts，SIL OFL 免费商用），用于主菜单标题、页面 h1/h2、回合横幅；正文仍用宋体/系统无衬线。
- **防遮挡**：回合横幅移到左上、战斗播报在其下方、日志面板下移；手机端隐藏横幅/播报，避免盖住玩家区。
- **文字安全**：牌面简注限制 2 行、状态/技能/装备标签不换行、顶栏阶段文字省略号、说明浮层自动收进屏幕。
- **大气感**：页面细金边框、面板内衬线、金色渐变标题与更大标题字距；主菜单改为 6 列网格组合（开始/联机全宽、编辑器双列、设置三列），避免按钮超出卡片。
- **图标与动效**：主菜单全部改为 SVG 线性图标；剑徽为左右镜像双剑 + 双向旋转环 + 四向呼吸星点；按钮交错入场（左右对称偏移）；不再使用 emoji 作为主图标。
- **菜单适配**：手机端缩小标题/Logo/按钮间距，所有 8 个入口一屏显示，不再出现底部按钮被裁切。

### 2.14 模块化 DIY 技能拼装（SkillComposer）

- 入口：技能编辑器顶部「模块化技能拼装」；不写代码即可拼技能。
- **四类模块**：
  1. 触发时机：出牌阶段开始 / 受到伤害后 / 使用牌时 / 摸牌阶段 / 回合结束 / **进入濒死（新增 `dying` 时机）** / 死亡 / 回复体力；
  2. 发动条件：手牌>体力、手牌<体力、已受伤、体力≤X、势力为魏/蜀/吴/群、判定为红色；
  3. 发动代价：无、弃红牌、弃任意手牌、弃装备、失去 1 点体力；
  4. 执行效果：摸 X、回复 X、对攻击范围内角色造成 X 点伤害、弃目标牌、获得目标牌、令目标交牌否则失去体力、弃自己手牌；
  5. 频率限制：每回合/每阶段/不限/每局一次；锁定技开关。
- **自动产出**：五段式描述（【触发时机】【发动条件】【发动代价】【执行效果】【频率限制】）+ `filterCode`/`costCode`/`contentCode` + `usable/type/timing`。
- **示例**：烈火（手牌>体力弃红牌打 1 伤害）、青囊（弃牌回血）、铁壁（受伤后摸牌）。
- **限定技**：`Player.resetTurn` 不再重置 `type==='limited'` 的技能次数，支持每局限一次。
- 代码生成依赖 `event.game` 的 `chooseCards/chooseTarget/dealDamage/takeAnyCard` 等现有 API，生成后仍可在下方代码区手改。

---

## 3. 视觉与交互规范（当前已定稿方向）

风格关键词：**墨玉暗底、鎏金细边、宣纸牌面、克制动效**。避免亮白塑料玻璃与大圆角高饱和。

### 3.1 设计 Token（`src/App.css`）

- 底色：`#05070b` / `#0a0d13` / `#11151d`
- 金色：`--gold #d6b96e`、`--gold-bright #f0d894`、`--gold-deep #9c7c35`
- 文本：`--text-primary #e8e2d2`、`--text-secondary #a09a8b`
- 牌面：`--paper #f3ead6` / `#e6d9be`，牌面墨字 `#2b2317`，红桃/方块 `#8d2f2f`，黑桃/梅花 `#232d3a`
- 面板：暗色渐变 + 渐变边框 + 内阴影；圆角 14~16（小屏 14）
- 标题字体：`--font-calligraphy`（Ma Shan Zheng，本地 OFL 字体）；正文系统无衬线、牌名宋体
- 背景：多层径向环境光 + `body::after` 颗粒纹理（SVG feTurbulence）+ 缓慢漂移
- 按钮：金属渐变、1px 鎏金描边、内高光；primary 为哑光金
- 卡牌：宣纸渐变 + 内层细框 + 纸张暗角；selected 金边发光
- 已去除大部分装饰性 emoji，保留牌面花色符号、剑徽等少量元素

### 3.2 牌桌布局

- 顶部：退出 / 牌堆剩余总数 / 联机标记 / 回合信息 / 自动 / 说明 / 日志 / 布局 / 重开
- 上方：其他玩家（含武将卡、体力、装备、判定、技能、牌背+手牌数）
- 中央：弃牌数、种子、操作面板；无操作显示当前回合提示
- 底部：手牌区（左/主体）+ 自己的武将角色卡（右；小屏时角色卡在手牌上方）
- 右上角悬浮日志（手机默认隐藏，可切换）
- 操作面板/手牌区可拖动；「布局」复位所有面板与手牌偏移

### 3.3 动效清单（避免退回“简单漂浮”）

- 主菜单剑徽：周期性挥砍 + 环形光轨旋转 + 火花迸发
- 结算徽章：旋转弹入 + 冲击波圆环 + 呼吸光
- 出牌：完整牌面飞向中心，短暂丝滑停滞 + 金环扩散，再渐缓模糊消失；【杀】全屏金色斩击
- 摸牌：`+N` 浮字 + 对手牌背增长
- 手牌：悬停 3D 倾斜 + 高光扫过；新牌淡入
- 当前玩家头像呼吸光环；技能按钮呼吸光；自动按钮脉冲
- 酒：全场红色酒气 + 上浮余烬；濒死/低血红色危殆光晕
- 动态背景：极光漂移、云海移动、粒子上浮；自定义图片缓慢推移
- 回合横幅、出牌播报（左侧浮动）、伤害震动/红光/飘字
- 页面切换淡入位移、按钮点击水波纹、选中卡牌弹起
- 遵守 `prefers-reduced-motion`

### 3.4 可拖动规则（重要实现细节）

- 面板拖动由 `src/hooks/usePanelDrag.js` 提供：移动超过 8px 才算拖拽，双击空白复位，位置存 localStorage。
- 手牌单张拖动在 `HandZone` 内部：外层 `.hand-card-wrap` 用 inline transform 存偏移；内层 `.game-card` 负责悬停 3D/高光，避免 transform 冲突。
- 自己的整块「手牌+角色卡」通过拖动角色卡移动（`.self-zone` transform）。
- 「布局」按钮触发 `window` 事件 `cgm:reset-layout`，各面板/手牌监听复位。

### 3.5 手机适配

- 断点：≤720px 手机；≤900px 编辑器/代码生成单列；≤1000px 或高度≤760px 紧凑化。
- 对局：手牌 56×84；角色卡全宽置上；日志默认隐藏；操作面板 `min-width:0` + `94vw`；按钮加高；安全区 `env(safe-area-inset-*)`。
- 编辑器/设置/联机大厅响应式；输入字号 16px 防 iOS 聚焦放大。
- PWA：`public/manifest.webmanifest` + `public/icons/icon-192/512.png`，可「添加到主屏幕」；无 Service Worker，离线不可用。
- 监听媒体查询 `hover:none` 取消悬停位移。

---

## 4. 联机设计

### 4.1 架构：房主权威

- 房主浏览器运行完整引擎；客户端只发送操作意图、接收视图状态。
- 中继服务器 `server/relay.mjs` 只做房间与消息转发，不跑游戏逻辑。
- 客户端不需要安装任何东西，手机浏览器即可。

### 4.2 协议

客户端→服务器：`create` / `join` / `leave` / `relay` / `ping` / `lanip`
服务器→客户端：`room`（含个人 seat/isHost）、`relay`（含 from）、`error`、`closed`、`notice`、`lanip`

游戏消息（relay 的 kind）：
- 房主→客户端：`start`、`state`、`effect`、`prompt`（requestId + prompt）
- 客户端→房主：`action`（requestId + payload：play/endPlay/useSkill/discard/respond/confirm）

关键点：
- 房主固定 seat 0；加入者 1~7。
- state 按座位序列化：自己的手牌有明细，其他人只有数量。
- 房主等待客户端操作 60s 超时。
- 房主离开解散房间。
- 客户端主动技能目前不开放（promptPlay 默认不含 activeSkills）。

### 4.3 房间/二维码/局域网

- 大厅简化为 **一键创建 / 房间号加入**：
  - 中继地址默认自动取 `window.location.hostname:8787`，不再要求玩家手填；
  - 只有换中继服务器时才展开「高级设置 · 中继服务器」；
  - 创建后显示房间号、二维码和「复制邀请链接」；
  - 手机扫码地址 `http://<LAN-IP>:3000/?room=<房间号>`，带 `?room=` 时**自动加入**，不再需要再点一次加入。
- `lanip` 消息返回本机 IPv4，按 192.168 / 10 / 172.16-31 优先排序。
- 首次联机如手机打不开，再运行 `allow-lan.bat`（管理员，放行 TCP 3000/8787）；日常启动 `start.bat` 即可。
- 端口：网页 3000、中继 8787；Vite `host: true`，relay 绑定 0.0.0.0。
- 仅局域网；外网需端口转发/内网穿透（未内置）。

### 4.4 简化后的联机流程

1. 电脑双击 `start.bat`（自动启动网页 + 中继 + 打开浏览器）；
2. 电脑进入「联机对战」→「创建房间」；
3. 手机扫二维码，或朋友输入 5 位房间号；
4. 房主选人数 →「开始对局」，不足座位 AI 补齐。

不再需要：手动填写中继地址、扫码后再点加入、记局域网 IP。

---

## 5. 技术架构与文件地图

```
D:\CardGameMaker
├── start.bat / test.bat / allow-lan.bat
├── launcher.log / app.ico / package.json / vite.config.js / index.html
├── public/ (manifest.webmanifest, icons/, audio/bgm-shanhe.wav, audio/bgm-zhangu.wav, audio/bgm-shenyang.mp3, audio/bgm-ripples.mp3, audio/bgm-guzheng.mp3, audio/MUSIC_CREDITS.md)
├── server/relay.mjs              # 房间 + 消息转发 + lanip
├── scripts/
│   ├── launch.mjs                # 启动网页+中继（单实例、打开浏览器、日志）
│   ├── gen_bgm.py                # numpy 生成内置古风 BGM（可复现）
│   ├── audio-check.mjs           # BGM 时长/首尾连续性/非静音检查
│   ├── run-smoke.mjs / smoke-test.mjs
│   ├── run-ui-smoke.mjs / ui-smoke.mjs
│   ├── net-smoke.mjs
│   ├── run-online-host-smoke.mjs / online-host-smoke.mjs
│   ├── headless-live-check.mjs
│   ├── headless-online-2p.mjs
│   └── headless-mobile-check.mjs
├── src/
│   ├── audio/audioManager.js      # 无缝 BGM / 音效 / 自定义音频 / IndexedDB
│   ├── appearance/backgroundManager.js # 动态背景 / 自定义图片 / IndexedDB
│   ├── core/
│   │   ├── Game.js               # 注册表/事件时机/技能/伤害/主动技/目标限制/游戏循环
│   │   ├── Turn.js               # 六阶段、phasePlay、phaseDraw、判定
│   │   ├── Player.js             # 体力/手牌/装备/判定/技能/标记/canSha
│   │   ├── Card.js / Skill.js / Character.js
│   │   ├── Deck.js               # 种子洗牌/摸牌/重洗
│   │   ├── Distance.js / Judgment.js / EventEmitter.js / ExtensionSystem.js
│   ├── data/
│   │   ├── basicCards.js         # 标准牌堆
│   │   ├── basicCharacter.js     # 基础角色
│   │   ├── classicCharacters.js  # 10 经典武将 + 技能设置
│   │   └── cardText.js           # 卡牌简注/详情 + 分类
│   ├── net/netClient.js / serialize.js
│   ├── hooks/usePanelDrag.js
│   ├── store/gameStore.js        # 状态、对局启动/重开、联机、AI节奏、UI回调
│   ├── components/
│   │   ├── Menu/MainMenu.jsx / Settings.jsx / OnlineLobby.jsx / AudioSettings.jsx / AppearanceSettings.jsx
│   │   ├── GameBoard/GameBoard.jsx / HandZone.jsx / SelfCharacterCard.jsx / CardFace.jsx / SceneBackground.jsx / InfoPanel.jsx / infoTexts.js
│   │   │                 / ActionPanel.jsx / PlayerArea.jsx / ResultOverlay.jsx / CardGuide.jsx
│   │   ├── Editor/CharacterEditor.jsx / SkillEditor.jsx / CodePreview.jsx
│   │   └── CodeGen/TemplateGenerator.js / LLMGenerator.js
│   ├── extensions/ (空白扩展区 + DemoExtension 未加载)
│   └── utils/effects.js          # 合成音效/震动
```

### 5.1 关键函数/行为

- `Game.fireTiming(timing, data)`：触发技能时机；`event.game` 可用；非全局技能只对 `data.player || data.target` 生效；`triggerSource:'global'` 对所有存活玩家。
- `Game.useActiveSkill(player, skill)`：主动技入口；`chooseCards/chooseTarget` 供技能选牌/选目标。
- `Game.getValidTargets(player, cardName)`：统一目标过滤（含【空城】）；AI/ActionPanel/联机 prompt 都使用它。
- `Game.resolveShaUse(player, card, target)`：普通杀与武圣转化杀共用。
- `Game.dealDamage({target, source, num, card})`：统一伤害与濒死。
- `Game.executeCardAction`：**非装备、非延时锦囊先入弃牌堆**再结算（为了【奸雄】能取回伤害牌；延时锦囊不提前入弃牌堆；装备只装备不弃）。
- `Player.canSha`：检查 `cls_paoxiao`；否则每回合 1 张。
- `Game.isTargetAllowed`：空城（`cls_kongcheng`）无手牌时排除杀/决斗目标。
- `store.startGame(configs, seed)`：设置 `game.config.seed`，绑定 UI 回调（含 askForCards/askForTarget），后台跑 `game.run(0)`，用 `runToken` 丢弃旧对局回调。
- `store.hostStartOnline(playerCount)`：构建房主权威局，绑定本地/远程提示，广播 state/effect。
- AI 节奏：浏览器端默认 900ms（设置页可调 700~1800ms）、弃牌/响应 340ms 停顿；Node 测试环境不延迟。
- `Game.canPlayCard(player, card)`：出牌阶段可用性总入口（闪/无懈禁止、桃需受伤、酒每回合一次、杀需目标/次数、顺/拆/兵粮目标限制）；`Turn.phasePlay` 兜底校验，AI 同步使用。
- `Game.getValidTargets(player, cardName)`：按牌种过滤目标（杀距离、顺手距离1且有牌、过河有牌、兵粮距离1、空城过滤）。
- `CardFace`：手牌/选择面板/飞牌共用牌面；`.card-name`/`.card-brief` 绝对定位，飞牌 `.fly-card` 必须 `display:flex`。
- `SceneBackground` / `backgroundManager`：动态预设与自定义背景；`PlayerArea`/`SelfCharacterCard` 显示酒/低血/濒死/翻面/横置/空城徽章。
- 重开：`runToken`、`disposeGame`、解绑 UI、放行挂起操作；桌面/联机均支持。

---

## 6. 关键踩坑与硬约束（新窗口务必注意）

1. **不要改回“无武将 0 体力”**：`Game.init` 必须为基础角色兜底 4 体力，否则弃牌/濒死异常。
2. **技能时机匹配**：`fireTiming` 的事件相关玩家是 `data.player || data.target`；写触发技时注意 `triggerSource` 与 `filter`。
3. **无懈可击**：支持受影响方与来源方交替抵消链（最多 8 层，偶数次无懈=锦囊被抵消）；AOE 整张取消，不逐个目标抵消；不要退回纯占位/单向。
4. **装备牌不要先入弃牌堆**；延时锦囊也不要提前入弃牌堆；普通基本/锦囊先入弃牌堆（奸雄依赖）。
5. **主动技能只有本地/房主可用**；远程客户端 prompt 默认不带 activeSkills。
6. **AI 已会主动用技能**：`aiChooseActiveSkill` / `aiPickSkillCards` / `aiPickSkillTarget` 会处理制衡、仁德、武圣；扩展时保持 `aiAutoPlay` 的纯决策性质（返回动作，不直接改状态）。
7. **手牌拖动结构**：外层 wrapper 存偏移，内层 card 做 hover 3D/高光；不要把 inline transform 放回内层，否则悬停动画失效。
8. **Vite watcher 的 EBUSY**：`vite.config.js` 已忽略 `scripts/**`、`*.tmpdir`、`dist` 等；不要移除，否则 Windows 下开发服务器可能崩溃。
9. **启动器**：`cmd /c start` 在 Windows 会挂起；`launch.mjs` 已改为 PowerShell `Start-Process` 优先 + cmd/explorer 回退，并且等浏览器打开后才退出；不要改回旧的即时退出。
10. **单实例**：launch.mjs 检测 3000 已运行则只开浏览器；重复点击不应再起第二个服务。
11. **中文文件编辑**：不要用 PowerShell 的 Get-Content/Set-Content 直接改含中文的文件（曾出现乱码）；用 `write/edit` 工具或 Node 以 UTF-8 读写。
12. **测试环境**：
    - Node 用 DSH 自带：`C:\Users\99263\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`
    - pnpm：同目录 `pnpm\bin\pnpm.mjs`
    - 浏览器实时测试需要 Edge/Chrome 以 `--remote-debugging-port=9333` 启动。
13. **联机身份**：服务器广播房间信息必须带每个成员自己的 seat/isHost，否则房主会丢掉 seat 0 身份（已修复，勿回退）。
14. **种子随机**：不要改回 `Math.random` 洗牌，否则种子功能失效。
15. **UI 风格**：避免重新引入亮白玻璃、高饱和渐变、大量 emoji；保持墨玉鎏金 + 宣纸牌面。
16. **测试计数变化后**：同步更新 `README.md` 与本文件的测试结果。
17. **经典武将 ID**：统一 `cls_*`；基础角色 `base_*`；自定义用户 ID 不要与之冲突。
18. **扩展区**：`DemoExtension` 默认不加载，保持初始自定义内容为空；若加载会新增周瑜示例，注意别误启用。
19. **出牌规则集中校验**：`Game.canPlayCard()` + `getValidTargets()` 是唯一入口；UI 手牌置灰、ActionPanel、AI、联机 prompt 都用它；`Turn.phasePlay` 还有兜底校验。不要单独放开【闪】【无懈】主动出牌。
20. **牌面布局**：`.card-name`/`.card-brief` 是绝对定位；`.fly-card` 必须保持 `display:flex`（曾误设 `display:block` 导致牌名字体挤在一起、被角落点数覆盖）。
21. **BGM 无缝**：必须用 `AudioBufferSourceNode.loop`；禁止改回 `<audio loop>`（浏览器循环处有空档）。内置曲由 `scripts/gen_bgm.py` 生成；编曲要“少层、长音、稀疏鼓点”，避免杂乱。
22. **动态背景**：`SceneBackground` 固定层 z-index 0、`.page-view` z-index 1；自定义图片存 IndexedDB；不要把背景放到面板之上。
23. **状态同步**：新增状态（酒/低血/濒死等）必须同时加进 `Player.toJSON()` 和 `serializePlayerPublic()`，否则联机客户端看不到。
24. **推荐出牌**：`aiAutoPlay` 是 async，必须 await；`useRef` 等 Hook 必须放在所有 early return 之前（曾因条件调用 useRef 导致开局黑屏）。
25. **点击说明**：状态/技能/牌面印点击统一走 `openInfo` → `InfoPanel`；牌面印点击必须 `stopPropagation`，否则会误选牌。

---

## 7. 测试与验收

### 7.1 常规测试

```bash
cd D:\CardGameMaker
test.bat          # 或 npm run test:all
```

| 套件 | 命令 | 当前结果 |
|------|------|----------|
| 引擎 | `node scripts/run-smoke.mjs` | 446/446 |
| UI 渲染 | `node scripts/run-ui-smoke.mjs` | 1684/1684 |
| 中继协议 | `node scripts/net-smoke.mjs` | 37/37 |
| 联机房主集成 | `node scripts/run-online-host-smoke.mjs` | 47/47 |
| 浏览器实时交互 | `node scripts/headless-live-check.mjs` | 53/53 |
| 双页面联机 | `node scripts/headless-online-2p.mjs` | 15/15 |
| 手机尺寸 | `node scripts/headless-mobile-check.mjs` | 16/16 |
| BGM 循环检查 | `node scripts/audio-check.mjs` | 15/15 |

> 实时/双页面/手机测试需先启动 Edge/Chrome：
> `"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --remote-debugging-port=9333 --user-data-dir=%TEMP%\cgm-edge http://localhost:3000`
> 且网页/中继已启动（桌面快捷方式或 `npm start`）。

### 7.2 构建

```bash
node node_modules/vite/bin/vite.js build
```

最近构建成功。

---

## 8. 运行与部署

### 8.1 启动

- 双击桌面 `CardGameMaker`：
  - 启动 Vite（3000）+ 中继（8787）
  - 自动打开浏览器（PowerShell Start-Process 优先）
  - 已在运行则只打开浏览器
  - 失败/浏览器打不开时保留窗口并显示网址
- 日志：`D:\CardGameMaker\launcher.log`
- 关闭启动窗口/Ctrl+C 停止服务。

### 8.2 安卓手机联机

1. 电脑启动游戏；
2. 首次运行 `allow-lan.bat`（管理员，放行 TCP 3000/8787）；
3. 电脑「联机对战」创建房间，显示二维码；
4. 手机同一 WiFi 扫码（或打开 `http://电脑IP:3000/?room=房间号`），点「加入」；
5. 房主开始对局。

限制：仅局域网；手机端不要把地址写成 127.0.0.1；路由器需关闭 AP 隔离。

### 8.3 数据持久化键

- `cgm_data`：自定义武将/技能
- `cgm_game_config`：游戏设置
- `cgm_llm_config`：LLM API 配置
- `cgm_effects`：音效/震动开关
- `cgm_auto_play`：自动出牌
- `cgm_panel_action` / `cgm_panel_hand` / `cgm_panel_selfzone`：面板位置
- `cgm_relay_url` / `cgm_name`：联机服务器/昵称

---

## 9. 已知限制（诚实清单）

1. 「无懈可击」已支持交替抵消链（最多 8 层）；AOE 被无懈时仍整张取消，不逐个目标结算。
2. AI 会主动发动制衡/仁德/武圣并使用乐/兵/闪电；但不会评估所有自定义主动技，联机客户端自定义主动技仍受限（房主可）。
3. 单机人类确认/是否出桃走游戏内面板（ActionPanel），不再依赖 `window.confirm`。
4. 丈八蛇矛/方天画戟已支持出牌面板入口；寒冰剑/青龙/贯石斧等仍自动发动，暂不移交选择权。
5. 联机不支持断线重连、旁观、公网房间列表；房主离开解散。
6. 未实现《名将杀》式身份局（16 身份）与埋伏牌。
7. 没有卡牌编辑器、离线 PWA（无 Service Worker）；自定义音频/背景仅存本机浏览器 IndexedDB。
8. 武将立绘需用户自行填写 `imageUrl`。
9. 音效为 WebAudio 合成，设备音色有差异；iOS Safari 不支持震动 API。
10. 手机建议横屏；竖屏已可用但空间较紧。
11. BGM 与自定义背景是本地播放，不做联机同步；MP3 已裁首尾静音并淡化，但非循环编曲仍可能有轻微接缝（内置 WAV 最完美）。
12. AI 已会主动使用延时锦囊（乐/兵/闪电）；其余装备特效仍未全部实现。

---

## 10. 后续路线（建议优先级）

1. 无懈可击相互抵消链已实现（2026-10）；继续补更多装备与锦囊交互。
2. AI 主动技能决策已覆盖制衡/仁德/武圣（2026-10）；下一步是通用自定义主动技评估，以及联机客户端主动技能。
3. 装备特效的可选发动弹窗、多目标手动选目标。
4. 借鉴《名将杀》：身份局 / 多身份、埋伏牌。
5. 断线重连、旁观、公网房间列表。
6. 卡牌编辑器、对局回放、皮肤主题、音频素材、移动端进一步优化。
7. 单机人类提示改为游戏内弹窗（已完成主要确认/出桃流程，边缘提示继续清理）。
8. 更多经典武将（每名 2 技能）与自动出牌策略难度分级。

---

## 11. 参考：《名将杀》调研结论

公开资料强调策略杀牌、多身份（“四种身份是聚会，十六种身份是战争”）及“埋伏牌”等机制：
- https://a.4399.cn/gl/51031926_337592.html
- http://www.nadianshi.com/2025/09/396647

已借鉴：回合信息可见、出牌节奏、策略性主动技能与经典武将技能设置；身份局/埋伏牌仍在路线图。

---

## 12. 新窗口接续提示词（可直接复制）

```
你在继续开发 D:\CardGameMaker 项目（类三国杀卡牌游戏，React+Vite）。
请先阅读 D:\CardGameMaker\PROJECT_BRIEF.md 和 README.md，然后运行：
- node scripts/run-smoke.mjs
- node scripts/run-ui-smoke.mjs
- node scripts/net-smoke.mjs
确认当前状态（期望 446/1684/37；实时测试 53/15、手机 16、BGM 15，另需 Edge CDP 9333）。
关键约束：
- 初始内置 10 名经典武将（cls_ 前缀）+ 基础角色；用户仍可自定义。
- 墨玉鎏金视觉 + 宣纸牌面；手牌在底部，角色卡在旁边；手牌可拖动/整理。
- 不恢复亮白塑料玻璃、不大量使用 emoji。
- 出牌阶段规则集中走 Game.canPlayCard/getValidTargets；闪/无懈不能主动出，桃需受伤，酒每回合一次。
- 牌面用 CardFace；.fly-card 必须 display:flex，名字/简注绝对定位，避免字体挤在一起。
- 牌堆种子用 mulberry32；顶部显示剩余/总数。
- 联机为房主权威、中继 ws://LAN-IP:8787；手机扫码加入。
- BGM 用 AudioBufferSourceNode.loop（禁止 <audio loop>）；内置曲由 scripts/gen_bgm.py 生成，编曲保持简洁。
- 音频/背景自定义存 IndexedDB；背景设置页可上传图片，音频设置页可上传 BGM/音效。
- 酒/低血/濒死等状态要同时同步到 Player.toJSON 与 serializePlayerPublic。
- 修改后更新 README/PROJECT_BRIEF 的测试计数，并跑全部测试。
```
