# Piper 离线中文 TTS（voice_service）

安全、免费、开源的本地中文语音合成。**纯 CPU 可跑、不依赖外网/显卡**，供 CardGameMaker 的 AI 配音调用。
本目录不修改游戏源码；前端接入（如 Vite 代理 `/voice-api`）由 UI 侧负责。

- 服务地址：`http://127.0.0.1:9881`（只监听本机）
- 模型：`zh_CN-huayan-medium`（Huayan 女声 / 中文 / 22050 Hz / medium）
- 启动：双击项目根目录 `start-piper.bat`，或命令行 `node voice_service/piper-server.mjs`
- 关闭：关闭启动窗口即停止服务（不会常驻）

---

## 1. 目录与文件

| 路径 | 说明 | 大小 |
| --- | --- | --- |
| `voice_service\piper-server.mjs` | 零依赖 Node HTTP 服务（本文件） | ≈11 KB |
| `voice_service\piper\piper.exe` | Piper 1.2.0 Windows 版 | 509,952 B |
| `voice_service\piper\*.dll` | onnxruntime / espeak-ng / phonemize 等运行库 | ≈19.7 MB |
| `voice_service\piper\espeak-ng-data\` | espeak-ng 音素化数据 | ≈18 MB |
| `voice_service\piper\voices\zh_CN-huayan-medium.onnx` | 中文模型（Huayan medium） | 63,201,294 B |
| `voice_service\piper\voices\zh_CN-huayan-medium.onnx.json` | 模型配置（采样率/音素映射等） | 4,822 B |
| `voice_service\piper\piper-LICENSE.md` | Piper MIT 许可证 | 1,071 B |
| `voice_service\piper\voices\MODEL_CARD.md` | 模型卡（语言/说话人/数据集来源） | 276 B |
| `voice_service\sample-zh.wav` | 本次验证的服务合成样例（“今日之战，胜负已分。”） | 92,832 B |
| `voice_service\_tmp*`、`_hf_model_api.json` | 验证临时文件，已清理 | — |

`voice_service\piper` 目录合计约 **102 MB**（其中模型 ≈60 MB，解压后运行库/数据 ≈40 MB）。

---

## 2. 许可证（重要）

| 组件 | 许可证 | 来源 |
| --- | --- | --- |
| Piper 可执行文件 / 源码 | **MIT**（Copyright (c) 2022 Michael Hansen） | `https://github.com/rhasspy/piper`（`piper-LICENSE.md` 已保留） |
| 中文音色模型 `zh_CN-huayan-medium` | 模型仓库 **MIT**（HuggingFace `rhasspy/piper-voices` 元数据 `license: mit`） | `https://hf-mirror.com/rhasspy/piper-voices/tree/main/zh/zh_CN/huayan/medium` |
| 模型训练数据集 `HuaYan_TTS` | ⚠️ 模型卡标注 **License: Unknown** | `https://github.com/PlayVoice/HuaYan_TTS` |

> 结论：Piper 与模型仓库均为 MIT，可安全免费使用；数据集授权标注为 Unknown（非明确“非商用/非免费”），
> 因此本次继续接入。**若未来用于商业发行，建议先复核 HuaYan_TTS 数据集授权**（详见 `piper\voices\MODEL_CARD.md`）。

---

## 3. 下载来源（已落地，离线可用）

- Piper Windows 包（≈22 MB）：`https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip`
- 中文模型（≈63 MB）：`https://hf-mirror.com/rhasspy/piper-voices/resolve/main/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx`
- 模型配置：同路径 `zh_CN-huayan-medium.onnx.json`
- 模型卡：同路径 `MODEL_CARD.md`

解压后 `piper.exe`、`espeak-ng-data`、DLL 位于 `voice_service\piper\`；模型位于 `voice_service\piper\voices\`。
运行 Piper 时需保持 `espeak-ng-data/` 与 `piper.exe` 同目录（CLI 与服务均已如此设置）。

---

## 4. 命令行验证结果（Piper CLI）

```bat
cd /d D:\CardGameMaker\voice_service\piper
piper.exe --model voices\zh_CN-huayan-medium.onnx --output_file out.wav
rem 然后经 stdin 输入中文文本（UTF-8）
```

实测（文本“吾乃常山赵子龙，谁敢与我一战。”）：

| 指标 | 结果 |
| --- | --- |
| 总耗时 | **0.70 s**（加载音色 0.255 s + 推理 0.194 s，RTF≈0.058） |
| 音频 | 3.544 s / **22050 Hz** / 单声道 / 16-bit PCM |
| 非静音 | RMS≈0.181、peak≈1.0（有声音，无报错） |

---

## 5. HTTP 服务接口

默认 `127.0.0.1:9881`，仅监听本机；CORS 全开（供本地游戏前端调用）。Node 零依赖（仅内置模块）。

### GET /health

```json
{
  "ok": true,
  "service": "piper-tts",
  "model": { "name": "zh_CN-huayan-medium.onnx", "sampleRate": 22050, "language": "zh_CN", "voice": "Huayan", "quality": "medium", "espeakVoice": "cmn" },
  "voice": "zh_CN-huayan-medium.onnx",
  "voices": ["zh_CN-huayan-medium.onnx"],
  "port": 9881,
  "maxTextChars": 500,
  "timeoutMs": 60000
}
```

### POST /tts

请求（`Content-Type: application/json`，UTF-8）：

```json
{ "text": "今日之战，胜负已分。", "voice": "zh_CN-huayan-medium.onnx" }
```

- `text`：必填，≤ **500 字**（按 Unicode 码点）；`voice`：可选，默认 `zh_CN-huayan-medium.onnx`，仅允许 `voices/` 下存在的 `.onnx` 文件名（禁止路径穿越）。
- 成功：`200` + `Content-Type: audio/wav`（22050 Hz / 单声道 / 16-bit PCM），响应头含 CORS；`X-Piper-Voice`、`X-Piper-Ms` 便于排查。
- 失败：`400`（参数/文本非法）、`500`（合成失败）、`502`（无有效音频），JSON 中文错误信息 `{ ok:false, error:"..." }`。
- `OPTIONS /tts`：`204` 预检通过。
- 限制：单次合成 **60 s 超时**；**串行处理**（同一时间只跑一个 piper，避免 CPU 打满）；临时 wav 用完立即删除。
- 实现安全点：`spawn(piper.exe, [参数数组])` 不经过 shell，避免命令注入；路径全部基于脚本目录（不依赖 cwd）。

### 实测耗时（本机 CPU）

| 项目 | 耗时 |
| --- | --- |
| Node 服务启动 → `/health` 可用 | ≈0.34~1.0 s |
| `start-piper.bat` 启动 → 端口可用 | ≈1.4~2.0 s |
| `POST /tts`（20 字中文） | **≈0.49 s**，输出 92,832 B / 2.10 s 音频（22050 Hz 单声道，RMS≈0.184） |
| 60s 超时保护 | 已实现（超时杀子进程并返回 500） |
| 并发 | 队列串行，无并发冲突 |

---

## 6. 启动方式

1) **双击** 项目根目录 `start-piper.bat`（UTF-8，自动找 PATH/ProgramFiles/项目内置 Node，窗口保留日志）。
2) 命令行：

```bat
cd /d D:\CardGameMaker
node voice_service\piper-server.mjs
```

可选环境变量：`PIPER_HOST`（默认 127.0.0.1）、`PIPER_PORT`（默认 9881）。
> 端口 9881 与 GPT-SoVITS(9880)、游戏 3000/8787 互不冲突；若被占用可设 `PIPER_PORT` 并同步前端代理。

---

## 7. 冒烟测试

```bat
cd /d D:\CardGameMaker
node scripts\piper-smoke.mjs
rem 或测试已在运行的服务：
set PIPER_BASE_URL=http://127.0.0.1:9881 && node scripts\piper-smoke.mjs
```

`scripts/piper-smoke.mjs` 零依赖，会自动拉起服务（默认用 19881 端口避免冲突）并校验：
`/health`、CORS、OPTIONS 预检、`/tts` 返回 WAV、RIFF/WAVE 头、采样率/单声道/时长/RMS、空文本与超长文本 400。实测 **16 通过 / 0 失败**，总耗时约 0.85 s。

---

## 8. 前端接入建议（UI 队友执行，本任务不改前端）

- Vite 开发代理：`/voice-api` → `http://127.0.0.1:9881`（保留路径，如 `/voice-api/tts` → `/tts`）。
- 直接调用：`fetch('http://127.0.0.1:9881/tts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text}) })` 取 `blob` 播放。
- 生产/离线：先启动 `start-piper.bat`，再进游戏；服务未启动时请做降级（跳过配音或提示用户启动）。
- 文本建议：单句 ≤500 字（可先按标点切句），过长会返回 400。

---

## 9. 风险与注意事项

1. **首次加载**：Piper 每个请求都会加载一次模型（CLI 模式），首次/冷启动约 0.7 s；Node 服务串行处理，短文本通常 <1 s。
2. **CPU/内存**：纯 CPU 推理，单进程峰值内存约数百 MB；并发已限制为 1，避免多请求同时占满 CPU。
3. **文本长度**：服务硬限制 500 字；超长请切句。中文标点、数字/英文混排由 espeak-ng 音素化，个别多音字/生僻字可能读音不准（可换更高质量模型或对文本做注音）。
4. **CORS**：服务端已全开 `Access-Control-Allow-Origin: *`，仅监听 127.0.0.1，不对外网暴露。
5. **编码**：`start-piper.bat` 为 UTF-8（无 BOM）+ `chcp 65001`；该文件已在本机实测可正常启动（cmd 对 UTF-8 批处理在部分字符组合下存在解析缺陷，如遇乱码/异常，可直接用 `node voice_service\piper-server.mjs` 启动）。
6. **模型/数据集许可证**：模型仓库 MIT，但训练数据集 HuaYan_TTS 标注 Unknown；商业使用前请复核（见第 2 节）。
7. **Windows 限定**：当前二进制为 Windows amd64；Linux/macOS 需替换对应 Piper 版本与模型路径。
8. **端口冲突**：9881 被占用时服务会打印中文错误并退出，请改 `PIPER_PORT` 或关闭占用进程。
9. 本任务仅新增基础设施，**未修改** `src/**`、`vite.config.js`、`start-voice.bat`、`package.json`。
