/* 减肥姬 — 桌面端核心：自定义协议 + 数据文件读写 + IPC 注册
 *
 * 抽出来是为了让开发时的自检脚本能跑「同一份代码」，
 * 而不是测一份复制品。
 */
const { app, ipcMain, protocol } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

/**
 * 页面文件的位置。
 * 开发时在仓库的 app/ 目录；打包后 electron-builder 会把它放进 resources/webapp/。
 */
const APP_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'webapp')
  : path.join(__dirname, '..', 'app');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

/** 数据文件路径（放在用户目录下，卸载重装前都在） */
function dataFile() {
  return path.join(app.getPath('userData'), 'data.json');
}

function readData() {
  try {
    const f = dataFile();
    if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  } catch (e) { console.error('[减肥姬] 读取数据失败', e); }
  return '';
}

function writeData(json) {
  try {
    const f = dataFile();
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const tmp = f + '.tmp';
    fs.writeFileSync(tmp, json, 'utf8');   // 先写临时文件再改名，避免写一半断电
    fs.renameSync(tmp, f);
    return true;
  } catch (e) {
    console.error('[减肥姬] 写入数据失败', e);
    return false;
  }
}

/** 把 app/ 目录当成一个网站提供，页面因此有正常来源，localStorage 才可靠 */
function registerProtocol() {
  protocol.handle('app', async (request) => {
    try {
      const url = new URL(request.url);
      let rel = decodeURIComponent(url.pathname);
      if (!rel || rel === '/') rel = '/index.html';
      const target = path.normalize(path.join(APP_ROOT, rel));
      if (!target.startsWith(APP_ROOT)) return new Response('forbidden', { status: 403 });
      const data = await fs.promises.readFile(target);
      return new Response(data, {
        status: 200,
        headers: { 'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream' }
      });
    } catch (e) {
      return new Response('not found', { status: 404 });
    }
  });
}

/**
 * 注册 IPC。hooks 由主进程提供，因为它需要 Notification / 开机自启 等能力：
 *   { notify(payload), setAutostart(bool), getAutostart() }
 */
function registerIpc(hooks) {
  hooks = hooks || {};
  ipcMain.on('data:load', (e) => { e.returnValue = readData(); });
  ipcMain.on('data:save', (e, json) => { e.returnValue = writeData(json); });
  ipcMain.on('notify', (e, payload) => {
    try { if (hooks.notify) hooks.notify(payload || {}); }
    catch (err) { console.error('[减肥姬] 通知失败', err); }
  });
  ipcMain.on('autostart:set', (e, enabled) => {
    try { if (hooks.setAutostart) hooks.setAutostart(!!enabled); }
    catch (err) { console.error('[减肥姬] 设置自启失败', err); }
  });
  ipcMain.on('autostart:get', (e) => {
    try { e.returnValue = hooks.getAutostart ? !!hooks.getAutostart() : false; }
    catch (err) { e.returnValue = false; }
  });
  ipcMain.on('window:hide', () => { if (hooks.hide) hooks.hide(); });
}

module.exports = {
  APP_ROOT, MIME,
  dataFile, readData, writeData,
  registerProtocol, registerIpc
};
