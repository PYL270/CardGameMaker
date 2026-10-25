# GPT-SoVITS 本地配音验证（voice_refs）

验证日期：2026-10-24（Windows，本机）
GPT-SoVITS 根目录（绝对路径）：
`D:\AI-shengyin\GPT\GPT-SoVITS-v2pro-20250604-nvidia50`

本目录只存放测试样本与说明，**不修改游戏源码**。游戏侧 UI 接入（Vite 代理 `/voice-api` 等）由 UI 队友负责。

---

## 1. 参考音频（Reference Audio）

| 文件 | 绝对路径 | 说明 |
| --- | --- | --- |
| 参考音频 | `D:\CardGameMaker\voice_refs\ref-zh.wav` | 16 kHz / 单声道 / 16-bit PCM，时长 **4.145 s**，RMS≈0.063（非静音） |
| 参考文本 | `D:\CardGameMaker\voice_refs\ref-zh.txt` | UTF-8，内容：`吾乃常山赵子龙，谁敢与我一战。` |

生成方式：Windows 系统自带中文 TTS（System.Speech）→ 已安装语音 `Microsoft Huihui Desktop`（zh-CN，Female）。未使用 GPT-SoVITS 自带测试音频（本机有中文语音）。
`prompt_text` 必须与参考音频逐字一致（即上面的文本），否则音色克隆效果会明显变差。

> 参考音频要求：2~5 秒、单声道、16k~32k 采样率。当前样本 4.145 s / 16 kHz / 单声道，满足要求。

---

## 2. API 启动命令（最终命令）

在 GPT-SoVITS 根目录执行（必须是该目录作为 working directory，配置内模型路径是相对路径）：

```bat
cd /d D:\AI-shengyin\GPT\GPT-SoVITS-v2pro-20250604-nvidia50
runtime\python.exe api_v2.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml
```

- 监听地址：`http://127.0.0.1:9880`，端口 **9880**
- 配置文件：`D:\AI-shengyin\GPT\GPT-SoVITS-v2pro-20250604-nvidia50\GPT_SoVITS\configs\tts_infer.yaml`
  （`custom` 段：`device: cuda`、`is_half: true`、`version: v2`，v2 预训练 GPT/SoVITS 模型）
- 服务启动后会一直驻留，**测试完成后必须停止**（Ctrl+C 或结束该 `python.exe` 进程；不要常驻占用显存）。

本机实测耗时（RTX 5060 Laptop 8GB / 已装 CUDA runtime / torch 2.7.0+cu128）：

| 阶段 | 耗时 | 备注 |
| --- | --- | --- |
| 启动（进程启动→端口可连接） | **≈39 s** | 加载 Text2Semantic、VITS、BERT、CNHuBERT 到 GPU |
| 首次 /tts（冷启动/预热） | **≈49 s** | 含模型预热与首个分段解码；客户端若超时请放大 timeout |
| 后续 /tts（热） | **≈1.2 s** | 文本 `今日之战，胜负已分。`（20 字，分 2 段） |
| 显存占用 | ≈**2.6 GB** | `nvidia-smi` 实测，8 GB 显存足够 |

---

## 3. /tts 调用与验证输出

请求（POST `http://127.0.0.1:9880/tts`，`Content-Type: application/json`，UTF-8）：

```json
{
  "text": "今日之战，胜负已分。",
  "text_lang": "zh",
  "ref_audio_path": "D:\\CardGameMaker\\voice_refs\\ref-zh.wav",
  "prompt_text": "吾乃常山赵子龙，谁敢与我一战。",
  "prompt_lang": "zh",
  "media_type": "wav",
  "speed_factor": 1.0
}
```

- `ref_audio_path` 必须是**本机绝对路径**（JSON 中反斜杠要转义；也可用 `D:/CardGameMaker/voice_refs/ref-zh.wav` 正斜杠）。
- `prompt_text` 必须与参考音频内容一致，`prompt_lang` 为 `zh`。
- 本机验证输出：`D:\CardGameMaker\voice_refs\test-output.wav`
  - HTTP 200，**32 kHz / 单声道 / 16-bit PCM**，时长 **2.56 s**
  - 文件大小 **163,884 bytes**，RMS≈**0.034**、peak≈0.45（非静音）
  - 生成耗时：热态 **1.223 s**（冷态约 49 s，见上表）
- 验收标准：时长 >0、采样率 32k、RMS>0 即视为链路可用。本次三项均满足。

---

## 4. 环境 / GPU / CPU 注意事项

- GPU：`NVIDIA GeForce RTX 5060 Laptop GPU`，8151 MiB；`torch.cuda.is_available() == True`，torch 2.7.0+cu128；当前 `custom` 配置为 `cuda` + `is_half: true`。
- 若启动报 CUDA/算力不兼容或显存不足（OOM），降级方式（在 GPT-SoVITS 根目录新建一个配置副本，不改原文件）：
  1. 复制 `GPT_SoVITS\configs\tts_infer.yaml` 为如 `GPT_SoVITS\configs\tts_infer_cpu.yaml`；
  2. 把 `custom:` 段改为 `device: cpu`、`is_half: false`（或直接删除 `custom:` 段，加载器会回退到 `v2` 段，该段默认为 CPU）；
  3. 启动命令改为 `-c GPT_SoVITS/configs/tts_infer_cpu.yaml`。
  CPU 模式可跑通但合成明显变慢（首段可能需要数十秒到数分钟），仅作降级。
- 首次启动/首次合成慢属正常（模型加载 + 预热）；建议 UI 侧启动后先做一次预热请求。
- 路径必须使用本机绝对路径；`cd` 到 GPT-SoVITS 根目录再启动，否则相对模型路径解析失败。
- 端口 9880 被占用时请换端口（如 `-p 9881`），并同步 UI 代理配置。
- CORS：由游戏侧 Vite 代理 `/voice-api` 处理（UI 队友负责），本服务默认只监听 127.0.0.1，不对外网开放。
- 本次测试环境说明：`Invoke-WebRequest` 在非交互 PowerShell 下会报“朗读和提示功能不可用”，改用 Python `urllib` 调用成功；遇到同类问题时建议用 Python/Node 脚本发请求。

---

## 5. 本次验证过程与结果摘要

1. 系统中文 TTS 检查：可用 `Microsoft Huihui Desktop`（zh-CN）；据此合成 `ref-zh.wav`（4.145 s，16 kHz 单声道）并写入 `ref-zh.txt`。
2. 按上述命令后台启动 API，端口 9880 在约 39 s 后就绪；`GET /tts` 使用上述 JSON 成功返回 wav（HTTP 200）。
3. 输出保存为 `test-output.wav`（32 kHz 单声道 2.56 s，RMS 0.034，非静音），验证通过。
4. 测试结束后已停止 API 进程（9880 端口已关闭），未常驻。
5. 临时测试脚本已删除；本目录仅保留 `ref-zh.wav`、`ref-zh.txt`、`test-output.wav`、`README.md`。
