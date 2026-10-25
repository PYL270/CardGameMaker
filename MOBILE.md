# CardGameMaker 手机版（Android APK）

用 **原生 WebView + 本地静态 HTTP 服务** 把现有网页游戏打包成 Android APK（无需 Gradle/Capacitor/Cordova）。
前端仍然跑在手机的 WebView 里，但页面由 App 内置的 `127.0.0.1:8765` 本地服务提供（从 APK 的 `assets/www` 读取），
因此 `/assets/...`、`/audio/...` 等绝对路径、`fetch`、`decodeAudioData`、`localStorage` 都能正常工作，避免 `file://` 的各种限制。

---

## 手机版支持 / 不支持

| 能力 | 手机版 | 说明 |
| --- | --- | --- |
| 单机对战 / AI / 选将 / 卡牌编辑 / 设置 | ✅ 支持 | 与网页版一致（Vite `dist` 原样打包进 APK） |
| 音效 / BGM（`decodeAudioData`） | ✅ 支持 | 本地 HTTP 提供 `audio/`，MIME 正确 |
| 离线使用 | ✅ 支持 | 所有前端资源都在 APK 内，无需网络 |
| 横屏全屏 / 屏幕常亮 / 返回键接管 | ✅ 支持 | 返回键优先网页 `history.back` |
| 局域网联机（WebSocket 中继） | ⚠️ 需手动配置 | APK 内不启动中继服务；需在 PC 启动 `npm run relay` 并在手机端填中继地址 |
| Piper / GPT-SoVITS 本地配音 | ❌ 不支持 | 手机端不启动这两个本地服务，配音功能自动降级（无 PC 专属能力） |
| 本地 Stable Diffusion / AI 生图 | ❌ 不支持 | 同上 |
| 文件系统直接读写 / 本地模型目录 | ❌ 不支持 | WebView 沙箱内运行 |
| 后台常驻/通知 | ❌ 不支持 | 关闭 App 即停止本地服务 |

> 说明：手机端只是“把现有网页装进 WebView”。凡依赖 PC 本地端口（9880/9881/3000/8787）的能力，手机上都不可用，
> 相应按钮会失败或降级，不影响单机玩法。

---

## 一、一次性安装工具链（本机无 Java/SDK 时）

工具链装在 **项目之外**（默认 `%LOCALAPPDATA%\CGM-Android`），不会进 git：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-android.ps1
```

脚本会：
1. 下载 Adoptium **Temurin JDK 17** 并解压到 `%LOCALAPPDATA%\CGM-Android\jdk`；
2. 下载 Android **commandline-tools** 到 `%LOCALAPPDATA%\CGM-Android\sdk\cmdline-tools\latest`；
3. 自动接受 license 并安装 `platforms;android-34`、`build-tools;34.0.0`、`platform-tools`；
4. 校验 `aapt2 / zipalign / d8.jar / apksigner.jar / android.jar` 并打印路径。

安装完成后：`JAVA_HOME=%LOCALAPPDATA%\CGM-Android\jdk\<jdk 目录>`，
`ANDROID_SDK_ROOT=%LOCALAPPDATA%\CGM-Android\sdk`（`scripts/build-apk.mjs` 会自动定位，无需手动设置环境变量）。

本项目实测路径（本机）：
- JDK：`C:\Users\99263\AppData\Local\CGM-Android\jdk\jdk-17.0.20.1+1`
- SDK：`C:\Users\99263\AppData\Local\CGM-Android\sdk`
- 下载缓存：`C:\Users\99263\AppData\Local\CGM-Android\downloads`

> 也可把工具链放到 `mobile/tools/`（`jdk/`、`android-sdk/`），构建脚本同样能识别；该目录已在 `.gitignore` 中排除。

---

## 二、生成 APK

### 方式 A：命令行（推荐，最直接）

```bat
npm run apk
rem 等价：node scripts/build-apk.mjs
rem 或双击项目根目录的 start-piper.bat？不——APK 用上面这条
```

构建流程（全部由 `scripts/build-apk.mjs` 完成，零第三方依赖）：

1. `vite build` → `dist/`；
2. 复制 `dist/` → `mobile/android/assets/www/`（含 `assets/`、`audio/` 等）；
3. 用 `public/icons/icon-192.png` 生成 5 个 mipmap 密度图标；
4. `aapt2 compile` + `aapt2 link`（含 assets、AndroidManifest、minSdk 24 / targetSdk 34）；
5. `javac` 编译 `MainActivity.java` + `LocalHttpServer.java` + `R.java`；
6. `d8` 生成 `classes.dex`，用 `jar uf` 塞入 APK；
7. `zipalign -p 4`；
8. `apksigner` 用 `mobile/android/debug.keystore`（首次自动生成）签名；
9. `aapt2 dump badging` + `apksigner verify` 验收；
10. 输出唯一包 `public/apk/CardGameMaker-<version>-b<yyyymmddhhmmss>.apk`、稳定别名 `CardGameMaker-latest.apk` 与 `public/apk/latest.json`。

产物：
- `public/apk/CardGameMaker-<version>-b<时间戳>.apk`（每次唯一，不覆盖）
- `public/apk/CardGameMaker-latest.apk`（始终最新，固定分享链接）
- `public/apk/latest.json`（`version/file/size/url/stableUrl/sha256/versionCode/versionName/builtAt/package/label/minSdk/badging/signatureVerified/history`）
- 构建中进度：`mobile/android/build/progress.json`

### 方式 B：设置页「一键打包」

`npm run dev` 启动开发服务器后，设置 →「手机 APK」→「一键打包」：自动重新构建当前代码和资源，无需修改 APK 相关配置；Vite 插件（`scripts/mobile-build-plugin.mjs`）提供仅本机可用的接口：

| 接口 | 说明 |
| --- | --- |
| `GET /api/mobile/status` | `{available, missing, building, progress, log, apk, error}`；`apk` 持久读取 `latest.json`（重启后仍显示上次产物） |
| `POST /api/mobile/build` | 触发后台构建，立即返回 `202`；已在构建中返回 `409`；非本机 `403`；工具链缺失 `503` |

- 前端设置页调用这两个接口即可显示“生成中/进度/日志/下载链接”（UI 侧接入，本任务不改 UI 组件）。
- **生产静态托管（`vite build` 后的 dist）没有该中间件，不可触发构建**，只能使用已生成的 APK/latest.json。
- 触发构建仅允许 `127.0.0.1 / ::1`。

### 分享/安装

- 手机与 PC 同一局域网：启动 `npm run dev`（或任一静态服务器托管项目根目录）后，手机浏览器访问
  `http://<PC 局域网 IP>:3000/apk/CardGameMaker-latest.apk` 下载安装（需允许“安装未知来源应用”）；稳定链接始终指向最新包。
- 或直接把 `public/apk/CardGameMaker-<version>-b<时间戳>.apk` 拷贝到手机安装。
- `latest.json` 可用于 App 内检查版本：`/apk/latest.json`（含 `stableUrl` 与最近 5 个 `history`）。

---

## 二点五、本机实测验收（2026-10-24）

| 项目 | 结果 |
| --- | --- |
| JDK | Microsoft OpenJDK **17.0.20.1+1 LTS**（`C:\Users\99263\AppData\Local\CGM-Android\jdk\jdk-17.0.20.1+1`） |
| Android SDK | `C:\Users\99263\AppData\Local\CGM-Android\sdk`（build-tools **34.0.0**、platforms **android-34**、platform-tools） |
| 工具链安装耗时 | JDK 下载/解压约 7 分钟（网络波动）；commandline-tools + SDK 组件约 3 分钟 |
| 单次构建耗时 | **约 8 秒**（vite build ~1s + aapt2/javac/d8/zipalign/apksigner） |
| APK | `public/apk/CardGameMaker-1.0.0.apk`，**23.43 MB**（24,568,154 bytes） |
| APK 内容 | 57 个条目；`assets/www` **46 个文件**（含 `assets/www/audio` **28 个**、`assets/www/assets/*.js|css`、`index.html`、图标、字体），`classes.dex`、`AndroidManifest.xml`、5 个密度 mipmap |
| badging | `package=com.cardgamemaker.app`、`label=卡牌游戏制作器`、`versionCode=1792850629`（时间戳，逐次递增）、`versionName=1.0.0+b202610242203`、`minSdk=24`、`targetSdk=34`、`uses-permission INTERNET` |
| sha256 | `dc1668be78af8b4fd0ea6491b1e4e85c196696177ae9eac41a6c201346c42896`（以 latest.json 为准，每次构建变化） |
| 签名 | **apksigner verify 通过**（APK Signature Scheme v2 + v3，debug 证书 `CN=CardGameMaker Debug`，RSA 2048） |
| 接口实测 | `GET /api/mobile/status` 返回 available/apk 持久信息；`POST /api/mobile/build` 返回 202；构建中重复 POST 返回 **409**；完成后 latest.json 更新，构建约 4~8 秒 |
| 真机安装 | **未做**：本机无 Android 设备/模拟器，`adb install` 跳过；真机安装与交互需用户验证 |

> 说明：aapt2 在 Windows 上用 `-A` 添加 assets 会把 zip 条目写成反斜杠（`assets\www\...`），Android 无法读取；
> 构建脚本已改为 `aapt2 link` 后由 JDK `jar uf ... -C mobile/android assets/www` 添加，保证条目为正斜杠
> `assets/www/index.html`（已用 `jar tf` 验证 0 个反斜杠条目）。

---

## 三、手机端行为细节

- **本地静态服务**：`LocalHttpServer`（Java `ServerSocket`）仅绑定 `127.0.0.1:8765`，服务 APK `assets/www`；
  支持 GET/HEAD、常见 MIME（html/js/css/ogg/wav/png/webp/json…）、简单 Range（音频拖进度）、无扩展名路径回退 `index.html`。
- **WebView 设置**：JS、DOM Storage、`setMediaPlaybackRequiresUserGesture(false)`（自动播放）、
  `MIXED_CONTENT_ALWAYS_ALLOW`、`usesCleartextTraffic="true"`（本地 http）。
- **UA**：在系统 UA 后追加 ` CGMAndroid/<versionName>`，前端可用它识别手机壳。
- **返回键**：优先 `history.back()`，没有历史时退出 App。
- **横屏**：`screenOrientation="sensorLandscape"`；`FLAG_KEEP_SCREEN_ON` 常亮。
- **端口**：App 内固定 8765（只在本机回环）；与 PC 的 3000/8787/9880/9881 无冲突。

---

## 四、改版本 / 改图标

- **版本**：改 `package.json` 的 `version`（如 `1.0.1`）。构建时自动生成：
  - `versionName = <version>+b<yyyymmddhhmm>`（构建时间，便于人工识别）
  - `versionCode = 构建时间的秒级时间戳`（Android 要求单调递增；2038 年前 < int 上限，满足长期使用）
  - APK 文件名使用 `<version>`：`public/apk/CardGameMaker-<version>.apk`。
- **图标**：替换 `public/icons/icon-192.png` 后重新构建（会自动复制到 mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi）。
- **应用名**：`mobile/android/AndroidManifest.xml` 的 `android:label`（默认“卡牌游戏制作器”）。
- **包名**：`com.cardgamemaker.app`（Manifest `package` 与 Java 包名，改动需同步目录）。
- **minSdk/targetSdk**：`mobile/android/AndroidManifest.xml` + `scripts/build-apk.mjs` 顶部常量（默认 24/34）。

---

## 五、签名说明（debug）

- 首次构建会自动生成 `mobile/android/debug.keystore`（`keytool`，别名 `androiddebugkey`，口令 `android`），
  该文件已加入 `.gitignore`，**不要提交**；丢失后重新生成即可（已安装的旧 APK 无法覆盖升级，需先卸载）。
- 当前为 **debug 签名**，仅用于内部分发/自测；正式发布请替换为自有 release keystore，
  并在 `scripts/build-apk.mjs` 的 `apksigner` 参数中改用对应别名/口令。
- 验收命令（构建脚本自动执行）：
  ```bat
  aapt2 dump badging public\apk\CardGameMaker-1.0.0.apk
  apksigner verify --verbose --print-certs public\apk\CardGameMaker-1.0.0.apk
  ```

---

## 六、目录结构

```
mobile/android/
  AndroidManifest.xml          # 清单模板（@VERSION_CODE@ / @VERSION_NAME@ 由构建脚本替换）
  java/com/cardgamemaker/app/
    MainActivity.java          # WebView + 返回键 + UA + 全屏常亮
    LocalHttpServer.java       # 127.0.0.1:8765 极简静态 HTTP 服务（assets/www）
  assets/www/                  # 构建时从 dist 复制（gitignore）
  res/                         # 构建时生成图标（gitignore）
  build/                       # 中间产物（gitignore）
  debug.keystore               # 首次构建生成（gitignore）
scripts/
  setup-android.ps1            # 一键安装 JDK17 + Android SDK
  build-apk.mjs                # APK 构建（vite build → aapt2 → javac → d8 → zipalign → apksigner）
  mobile-build-plugin.mjs      # Vite dev/preview 的 /api/mobile/* 接口
public/apk/
  CardGameMaker-<version>.apk  # 构建产物（gitignore）
  latest.json                  # 最新 APK 元信息
```

---

## 七、常见问题与风险

1. **首次构建慢**：需要 `vite build` + 安装 SDK 组件；工具链安装 5~10 分钟（取决于网速），之后单次构建通常 30~90 秒。
2. **端口 8765**：App 内固定本地端口；若同一手机已有其他 App 占用会启动失败（页面无法打开），可修改
   `MainActivity.LOCAL_PORT` 与 `LocalHttpServer` 使用值。
3. **debug 签名**：不同电脑构建的 APK 签名不同，不能互相覆盖升级，需要先卸载旧版。
4. **WebView 版本差异**：极旧 Android System WebView 可能不支持部分新 CSS/JS；建议 Android 7.0+（minSdk 24）。
5. **联网/联机**：APK 不内置中继服务器；联机需 PC 启动 `npm run relay` 并在手机设置里填地址。
6. **权限**：Manifest 声明了 `android.permission.INTERNET`（本机回环 ServerSocket/WebView 访问需要），
   该权限是 Android 上建立任何 socket 的前提；App 自身只监听 `127.0.0.1`，不会主动外联。
   如需访问 PC 端 WebSocket 中继，同一权限已足够，无需额外声明。
7. **未做真机验收**：本机无 Android 设备/模拟器，验收到 `aapt2 badging + apksigner verify + unzip 资产检查`；
   真机安装/交互需用户侧验证。
8. **不修改游戏 UI 组件**：本链路只做打包与本地服务；设置页按钮/进度 UI 由 UI 侧接入。
