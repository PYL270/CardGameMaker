# 音效来源与授权（SFX Credits）

本项目内置音效全部为 **Creative Commons Zero (CC0 1.0)** 或项目原创合成，
可免费用于个人/商业项目，无需署名（仍在此致谢）。

## Kenney（CC0 1.0）

- 来源站点：https://kenney.nl/assets
- 许可：CC0 1.0 Universal — https://creativecommons.org/publicdomain/zero/1.0/
- 使用包：
  - [Interface Sounds](https://kenney.nl/assets/interface-sounds) — click / select / error / bong / pluck / confirmation
  - [UI Audio](https://kenney.nl/assets/ui-audio) — UI 备用
  - [Impact Sounds](https://kenney.nl/assets/impact-sounds) — punch / metal impact
  - [RPG Audio](https://kenney.nl/assets/rpg-audio) — knife slice / cloth / metal latch
  - [Casino Audio](https://kenney.nl/assets/casino-audio) — card place / slide / shuffle / shove
- 原始文件由 Kenney 制作；本项目仅做文件筛选、重命名与分类，未改变许可。

完整许可文本见 `SFX-LICENSE-KENNEY.txt`。

## 项目原创合成（CC0）

以下音效由项目脚本 `scripts/make_sfx_custom.py` 用正弦/钟音/包络合成，
不包含任何第三方采样，按 CC0 1.0 释出：

| 文件 | 用途 |
| --- | --- |
| `sfx/state/win.wav` | 胜利五声音阶上行 + 尾奏和弦 |
| `sfx/state/lose.wav` | 失败低沉下行钟音 |
| `sfx/combat/dying.wav` | 濒死双次低沉心跳 |
| `sfx/card/shuffle.wav` | 0.42s 快速洗牌纸声（与整理手牌动画对齐） |
| `sfx/state/heal.wav` | 0.58s 温暖上行回复钟音 |

## 分类与文件

| 分类 | 文件 |
| --- | --- |
| `sfx/ui/` | click、select、error |
| `sfx/card/` | card、draw、shuffle、equip、trick、discard、tao |
| `sfx/combat/` | sha、shan、damage、kill、dying |
| `sfx/state/` | turn、judge、heal、win、lose |
