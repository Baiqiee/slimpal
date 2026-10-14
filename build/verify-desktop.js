/* 桌面端自检：验证「页面 → preload → 主进程 → 数据文件」这条链路真的通。
 * 用的是 main.js 同一份 desktop-core 和同一份 preload.js。
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const PROFILE = path.join(__dirname, '..', 'tools', '.verify-profile');
fs.rmSync(PROFILE, { recursive: true, force: true });
app.setPath('userData', PROFILE);

const core = require('./desktop-core');
const { protocol } = require('electron');
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

const notifications = [];
let autostartValue = false;
let failures = 0;

function check(name, ok, detail) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '   ' + detail : ''));
  if (!ok) failures++;
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

app.whenReady().then(async () => {
  core.registerProtocol();
  core.registerIpc({
    notify: (p) => notifications.push(p),
    setAutostart: (v) => { autostartValue = v; },
    getAutostart: () => autostartValue,
    hide: () => {}
  });

  const win = new BrowserWindow({
    width: 430, height: 900, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  await win.loadURL('app://chloe/index.html');
  await wait(900);

  // 1) preload 是否暴露了接口
  const hasBridge = await win.webContents.executeJavaScript('!!window.jianfeijiNative');
  check('preload 暴露 jianfeijiNative', hasBridge === true);

  // 2) 页面脚本是否全部加载
  const mods = await win.webContents.executeJavaScript(
    'JSON.stringify(["util","calc","ui","charts","store","chloe","actions","notify","app"].map(function(k){return k+":"+(!!JF[k]);}))'
  );
  const modsOk = JSON.parse(mods).every(s => s.endsWith('true'));
  check('页面模块全部就绪', modsOk, mods);

  // 3) 写数据 → 文件真的出现在磁盘上
  const wrote = await win.webContents.executeJavaScript(`
    (function(){
      JF.store.setProfile({ name:'自检', birthday:'2000-01-01', gender:'female',
        heightCm:165, activity:'light', startWeightKg:70, targetWeightKg:60, speed:'normal' });
      JF.store.addWeight(70);
      JF.store.addMeal({ name:'测试餐', kcal:300 });
      return true;
    })()
  `);
  await wait(400);
  check('页面发起保存', wrote === true);
  check('数据文件已生成', fs.existsSync(core.dataFile()), core.dataFile());

  const onDisk = fs.existsSync(core.dataFile()) ? JSON.parse(fs.readFileSync(core.dataFile(), 'utf8')) : null;
  check('文件里有资料', !!(onDisk && onDisk.profile && onDisk.profile.name === '自检'));
  check('文件里有体重记录', !!(onDisk && onDisk.weights && onDisk.weights.length === 1));
  check('文件里有饮食记录', !!(onDisk && onDisk.meals && onDisk.meals.length === 1));

  // 4) 重启模拟：重新加载页面，数据应该从文件读回来
  await win.webContents.reload();
  await wait(1100);
  const after = await win.webContents.executeJavaScript(`
    JSON.stringify({
      name: (JF.store.profile()||{}).name,
      meals: JF.store.todayMeals().length,
      kcal: JF.store.kcalOn(JF.util.todayKey()),
      onboarded: !!JF.store.profile()
    })
  `);
  const a = JSON.parse(after);
  check('重开后读回资料', a.name === '自检', after);
  check('重开后读回饮食', a.meals === 1 && a.kcal === 300, after);
  check('重开后不进引导页', a.onboarded === true);

  // 5) 通知链路
  await win.webContents.executeJavaScript(`window.jianfeijiNative.notify('测试标题','测试内容'); 1`);
  await wait(300);
  check('通知送达主进程', notifications.length === 1 && notifications[0].title === '测试标题',
    JSON.stringify(notifications));

  // 6) 开机自启读写
  const auto = await win.webContents.executeJavaScript(`
    window.jianfeijiNative.setAutostart(true);
    String(window.jianfeijiNative.getAutostart());
  `);
  await wait(250);
  check('开机自启可设置', autostartValue === true && auto === 'true', 'returned=' + auto);

  // 7) 资源是否都能取到（图片 404 会让页面缺图）
  const asset = await win.webContents.executeJavaScript(`
    new Promise(function(res){
      var i = new Image();
      i.onload = function(){ res('ok:' + i.naturalWidth + 'x' + i.naturalHeight); };
      i.onerror = function(){ res('error'); };
      i.src = 'assets/chloe/portrait.png';
    })
  `);
  check('角色素材可加载', String(asset).startsWith('ok:'), String(asset));

  console.log('\n' + (failures ? failures + ' 项未通过' : '全部通过'));
  app.exit(failures ? 1 : 0);
}).catch((e) => {
  console.error('自检脚本异常', e);
  app.exit(2);
});
