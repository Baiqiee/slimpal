/* 减肥姬 — Electron 主进程
 *
 * 职责：
 *  1. 用自定义协议 app:// 提供页面（协议与数据读写见 desktop-core.js）
 *  2. 数据写进用户目录里的真实文件 userData/data.json
 *  3. 常驻系统托盘：关窗口不退出，右键托盘才能真正退出
 *  4. 开机自启（App 设置里可关）
 *  5. 弹系统通知
 */
const path = require('node:path');
const fs = require('node:fs');

/**
 * 最早期日志：只用 Node 的 fs 写文件，**不碰任何 Electron API**。
 * 万一 Electron 自己起不来（例如 require('electron') 就抛了），
 * 普通 diag() 会因为拿不到 userData 路径而什么都写不出来，
 * 结果就是"程序一闪而过、一点线索都没有"。这一段就是为了那种情况留的。
 * 路径与 Electron 的 userData 保持一致：%APPDATA%\减肥姬\
 */
const APP_NAME_DIR = '减肥姬';
function earlyLog(msg) {
  try {
    const dir = path.join(process.env.APPDATA || process.env.HOME || '.', APP_NAME_DIR);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'startup.log'),
      new Date().toISOString() + '  [early] ' + msg + '\r\n');
  } catch (e) { /* 记不上就算了 */ }
}

earlyLog('--- main.js 开始执行 --- node=' + process.versions.node);

let electron = null;
let core = null;
try {
  electron = require('electron');
} catch (e) {
  earlyLog('require("electron") 失败: ' + (e && e.stack));
  throw e;
}
try {
  core = require('./desktop-core');
} catch (e) {
  earlyLog('require("./desktop-core") 失败: ' + (e && e.stack));
  throw e;
}

const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, shell, protocol } = electron;

earlyLog('Electron 模块就绪; isPackaged=' + app.isPackaged
  + ' resourcesPath=' + process.resourcesPath
  + ' APP_ROOT=' + core.APP_ROOT);

const ICON = path.join(core.APP_ROOT, 'assets', 'icon.png');
const TRAY_ICON = path.join(core.APP_ROOT, 'assets', 'tray.png');

let win = null;
let tray = null;
let quitting = false;

/** 启动日志：出问题时能知道卡在哪一步（放在用户数据目录里） */
function diag(msg) {
  earlyLog(msg);
}

diag('--- 启动 --- electron=' + process.versions.electron + ' packaged=' + app.isPackaged);
diag('APP_ROOT=' + core.APP_ROOT);

// 自定义协议必须在 ready 之前登记为特权协议
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

// 只允许开一个：第二次启动就把已有窗口叫出来
const gotLock = app.requestSingleInstanceLock();
diag('单实例锁 = ' + gotLock);
if (!gotLock) {
  diag('已有实例在运行，本次退出');
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
}

function createWindow() {
  win = new BrowserWindow({
    width: 430,
    height: 900,
    minWidth: 380,
    minHeight: 620,
    backgroundColor: '#FCE7EC',
    title: '减肥姬',
    icon: ICON,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadURL('app://chloe/index.html');
  diag('窗口已创建，开始加载页面');

  win.webContents.on('did-finish-load', () => diag('页面加载完成'));
  win.webContents.on('did-fail-load', (e, code, desc, url) =>
    diag('页面加载失败 ' + code + ' ' + desc + ' ' + url));
  win.webContents.on('render-process-gone', (e, details) =>
    diag('渲染进程结束 ' + JSON.stringify(details)));

  // 关窗口 = 收进托盘，继续在后台帮你计时
  win.on('close', (e) => {
    diag('窗口 close 事件 quitting=' + quitting);
    if (!quitting) { e.preventDefault(); win.hide(); }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createTray() {
  let img = nativeImage.createFromPath(TRAY_ICON);
  if (img.isEmpty()) img = nativeImage.createFromPath(ICON);
  if (!img.isEmpty()) img = img.resize({ width: 16, height: 16 });
  try {
    tray = new Tray(img);
  } catch (e) {
    console.error('[减肥姬] 托盘创建失败', e);
    return;
  }
  tray.setToolTip('减肥姬');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开减肥姬', click: () => { if (win) { win.show(); win.focus(); } } },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('double-click', () => { if (win) { win.show(); win.focus(); } });
}

function showNotification(payload) {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title: payload.title || '减肥姬',
    body: payload.body || '',
    icon: ICON
  });
  n.on('click', () => { if (win) { win.show(); win.focus(); } });
  n.show();
}

app.whenReady().then(() => {
  diag('app ready');
  core.registerProtocol();
  core.registerIpc({
    notify: showNotification,
    setAutostart: (enabled) => app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: [] }),
    getAutostart: () => app.getLoginItemSettings().openAtLogin,
    hide: () => { if (win) win.hide(); }
  });

  createWindow();
  createTray();
  diag('窗口与托盘就绪');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (win) win.show();
  });
}).catch((e) => diag('ready 阶段异常 ' + (e && e.stack)));

app.on('before-quit', () => { diag('before-quit'); quitting = true; });

// 所有窗口关掉也不退出：这是常驻托盘的陪伴类应用
app.on('window-all-closed', () => { diag('window-all-closed（保持运行）'); });

process.on('uncaughtException', (e) => diag('未捕获异常 ' + (e && e.stack)));
process.on('unhandledRejection', (e) => diag('未处理的 Promise 拒绝 ' + e));
