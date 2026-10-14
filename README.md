# 减肥姬

一个只给自己用的、**完全离线的减肥陪伴 App**。不登录、不联网、不上传，所有数据只存在本机。

里面住着一位叫 **小克（Chloe）** 的虚拟女孩：你记吃了什么、称体重、写日记，她看着你的真实数据换表情、说话、督促你。

| 文档 | 内容 |
|---|---|
| [PRD.md](PRD.md) | **产品需求文档**，后续所有开发以它为准 |
| [使用说明.md](使用说明.md) | 怎么安装、怎么用、数据怎么备份、常见问题 |

---

## 当前状态

v1.0 已完成并验证，产物在 `dist/`：

| 产物 | 说明 |
|---|---|
| `减肥姬-1.0.0-安装程序.exe` | Windows 安装包（NSIS，约 110 MB） |
| `减肥姬-1.0-android.apk` | 安卓安装包（自签名，约 8.5 MB） |
| `win-unpacked/JianfeiJi.exe` | Windows 免安装版 |

iPhone 版按需求方决定暂不做（原因见 PRD 第 9 节）。

---

## 目录结构

```
jianfeiji/
├─ app/                     ← 应用本体：纯 HTML/CSS/JS，无构建步骤，三端共用
│  ├─ index.html
│  ├─ css/app.css
│  ├─ js/
│  │  ├─ util.js  calc.js  store.js  ui.js  charts.js
│  │  ├─ chloe-view.js  actions.js  notify.js  onboarding.js  app.js
│  │  ├─ characters/chloe.js     ← 角色包（加新角色只动这里）
│  │  └─ pages/                  ← 首页 / 打卡 / 吃 / 日记 / 数据 / 设置
│  └─ assets/                    ← 图标 + 小克的立绘与表情
├─ build/                   ← Windows 壳（Electron）
│  ├─ main.js  preload.js  desktop-core.js
│  ├─ shot.js                    ← 开发用：逐页截图
│  ├─ verify-app.js              ← 功能端到端自检（69 项）
│  └─ verify-desktop.js          ← 数据链路自检（13 项）
├─ android/                 ← 安卓壳（Capacitor）
│  ├─ capacitor.config.json
│  └─ android/                   ← Capacitor 生成的 Gradle 工程
├─ tools/                   ← 素材处理与打包辅助脚本（Python / Node）
├─ source/                  ← 角色原始设定图（一切素材的源头）
├─ PRD.md  使用说明.md
└─ dist/                    ← 构建产物（已忽略，不进仓库）
```

---

## 怎么开发

### 跑起来看效果

**最简单**：直接用浏览器打开 `app/index.html`。

**带桌面壳**（有托盘、系统通知、数据落盘）：

```powershell
cd build
npm install
npx electron .
```

### 改完界面后

| 目标 | 命令 |
|---|---|
| 桌面版生效 | 无需额外步骤，重启 `electron .` 即可 |
| 安卓版生效 | `cd android` → `npx cap sync android` → 重新打包 |

### 自检（改完务必跑一遍）

```powershell
cd build
npx electron verify-app.js        # 66~69 项功能断言，走真实界面流程
npx electron verify-desktop.js    # 13 项数据链路断言，含"重开后读回"
```

两个脚本都要求输出 **0 项 FAIL**。

### 逐页截图（肉眼检查界面）

```powershell
cd build
npx electron shot.js              # 输出到 tools/shots/
```

---

## 怎么打包

### Windows

```powershell
cd build
npm install
npx electron-builder --win --x64            # 出安装包 + 免安装版
npx electron-builder --win --x64 --dir      # 只出免安装版（快，调试用）
```

> 国内网络下若卡在下载，先设镜像：
> `$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"`
> `$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"`

### 安卓

需要 JDK 17 + Android SDK（platform 34 / build-tools 34.0.0）。

```powershell
$env:JAVA_HOME="...\jdk-17.0.2"
$env:ANDROID_HOME="...\android-sdk"

cd android
npm install
npx cap sync android
cd android
.\gradlew.bat assembleRelease
```

产物：`android/android/app/build/outputs/apk/release/app-release.apk`

---

## 重新生成角色素材

素材是从 `source/` 里的三张原始设定图裁切 + 抠图来的。

```powershell
python -m pip install rembg onnxruntime    # 抠图模型，首次会下载约 176 MB
python tools/build_assets.py               # 生成 app/assets/chloe/ 全套
python tools/make_icons.py                 # 生成 App 图标与托盘图标
python tools/make_android_res.py           # 生成安卓图标与启动图
```

---

## 几个不能忘的坑

改代码时如果碰到这几处，**别按"常理"改回去**：

| 位置 | 为什么 |
|---|---|
| `build/package.json` 里的 `disableAsarIntegrity: true` | 去掉它，打包出的 exe 会在执行我们代码之前就静默崩溃（启动日志一条都不留） |
| `app/css` 用经典 `<script>`，不用 ES module | 否则 `file://` 直接打开会加载失败 |
| 安卓 `styles.xml` 必须是 `Theme.AppCompat.Light` + `forceDarkAllowed=false` | 否则系统深色模式会把整个配色搞花 |
| 安卓 `AndroidManifest.xml` 里的 `screenOrientation="portrait"` | 横屏布局没设计过 |
| 前端不引任何第三方 JS 库，图表手写 SVG | 保证完全离线、无供应链风险 |

更多约束见 [PRD.md](PRD.md) 第 8.2 节。

---

## 密钥提醒

安卓签名文件 `android/jianfeiji.keystore` 与 `android/android/keystore.properties`
**已被 .gitignore 排除**，请单独备份。丢了就不能对已装的 App 做覆盖升级。
