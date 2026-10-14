/* 减肥姬 — 预加载脚本：把桌面端能力暴露给页面
 * 只暴露这几个明确的方法，页面拿不到 Node 的任何东西。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('slimpalNative', {
  platform: process.platform,

  /** 读数据文件（返回 JSON 字符串；没有文件时返回空串） */
  load: () => ipcRenderer.sendSync('data:load'),

  /** 写数据文件 */
  save: (json) => ipcRenderer.sendSync('data:save', json),

  /** 弹系统通知 */
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),

  /** 开机自启 */
  setAutostart: (enabled) => ipcRenderer.send('autostart:set', !!enabled),
  getAutostart: () => ipcRenderer.sendSync('autostart:get'),

  /** 把窗口收进托盘 */
  hideWindow: () => ipcRenderer.send('window:hide')
});
