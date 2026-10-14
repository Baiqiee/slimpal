/* 开发用：把 App 跑起来并逐页截图，用来肉眼检查界面。
 * 每次运行都用一个干净的数据目录，保证截图可复现。
 */
const { app, BrowserWindow, protocol } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const APP_ROOT = path.join(__dirname, '..', 'app');
const OUT = path.join(__dirname, '..', 'tools', 'shots');
const PROFILE = path.join(__dirname, '..', 'tools', '.shot-profile');

fs.rmSync(PROFILE, { recursive: true, force: true });
app.setPath('userData', PROFILE);

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

const FREEZE = `(function(){
  var s = document.createElement('style');
  s.textContent = '*{animation:none !important; transition:none !important;}';
  document.head.appendChild(s);
  return 1;
})()`;

const SEED = `
(function(){
  var S = JF.store, U = JF.util;
  S.setProfile({
    name: '阿哲', birthday: '1998-03-14', gender: 'male', heightCm: 175,
    activity: 'light', startWeightKg: 78.5, targetWeightKg: 68, speed: 'normal',
    createdAt: Date.now() - 30*86400000
  });
  var today = new Date();
  for (var i = 24; i >= 0; i--) {
    var d = U.dateKey(U.addDays(today, -i));
    var kg = 78.5 - (24 - i) * 0.16 + (Math.sin(i*1.7) * 0.25);
    S.addWeight(Math.round(kg*10)/10, d);
  }
  [['鸡胸肉',165,'1 份（100 克）'],['全麦面包',120,'2 片'],['美式咖啡',5,'1 杯'],
   ['水煮蛋',78,'1 个'],['牛肉面',620,'1 碗'],['苹果',95,'1 个']]
   .forEach(function(f){ S.addFood({name:f[0], kcal:f[1], portion:f[2]}); });
  S.toggleStar('鸡胸肉'); S.toggleStar('美式咖啡');

  var menu = [['燕麦牛奶',260],['鸡胸肉沙拉',320],['美式咖啡',5],['牛肉面',620],
              ['水煮蛋',78],['苹果',95],['全麦面包',120],['清蒸鱼',240]];
  for (var j = 20; j >= 1; j--) {
    var dk = U.dateKey(U.addDays(today, -j));
    var n = 2 + ((j * 7) % 3);
    for (var m = 0; m < n; m++) {
      var pick = menu[(j + m * 3) % menu.length];
      S.addMeal({ date: dk, time: ['08:20','12:30','19:10'][m % 3], name: pick[0], kcal: pick[1] });
    }
  }
  S.addMeal({ name: '燕麦牛奶', kcal: 260, time: '08:20' });
  S.addMeal({ name: '鸡胸肉沙拉', kcal: 320, time: '12:35' });
  S.addMeal({ name: '美式咖啡', kcal: 5, time: '15:02' });
  S.addMeal({ name: '水煮蛋', kcal: 78, time: '19:40' });

  S.saveDiary(U.todayKey(), 'proud', '今天忍住没喝奶茶，晚上去走了四十分钟。\\n有点累，但心情不错。');
  S.saveDiary(U.dateKey(U.addDays(today,-1)), 'good', '普通的一天，午饭吃得有点多。');
  S.saveDiary(U.dateKey(U.addDays(today,-2)), 'tired', '加班到很晚，没管住嘴。');

  // 让里程碑提示不要在截图时弹出来
  S.state().milestones = [1,2,3];
  S.addAffection(260, 'seed');
  S.persist();
  return { kcal: S.kcalOn(U.todayKey()), meals: S.todayMeals().length, limit: S.profile().dailyLimit };
})()`;

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  protocol.handle('app', async (request) => {
    try {
      const url = new URL(request.url);
      let rel = decodeURIComponent(url.pathname);
      if (!rel || rel === '/') rel = '/index.html';
      const target = path.normalize(path.join(APP_ROOT, rel));
      if (!target.startsWith(APP_ROOT)) return new Response('forbidden', { status: 403 });
      const data = await fs.promises.readFile(target);
      return new Response(data, {
        headers: { 'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream' }
      });
    } catch (e) {
      return new Response('not found', { status: 404 });
    }
  });

  const win = new BrowserWindow({
    width: 430, height: 900, show: false,
    backgroundColor: '#FCE7EC',
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  win.webContents.on('console-message', (e, level, msg) => {
    if (level >= 2) console.log('[page]', String(msg).slice(0, 300));
  });

  await win.loadURL('app://chloe/index.html');
  await wait(700);
  await win.webContents.executeJavaScript(FREEZE);

  await shot(win, '00-onboarding', '引导');

  const seeded = await win.webContents.executeJavaScript(SEED);
  console.log('seeded:', JSON.stringify(seeded));
  await win.webContents.executeJavaScript('JF.app.afterOnboarding(); 1');
  await wait(800);
  await capture(win, '01-home', '首页');

  const tabs = [['checkin', '02-checkin', '打卡'], ['food', '03-food', '吃']];
  for (const [tab, file, label] of tabs) {
    await win.webContents.executeJavaScript(`JF.app.go('${tab}'); 1`);
    await wait(500);
    await capture(win, file, label);
  }

  await win.webContents.executeJavaScript(`document.querySelectorAll('.seg button')[1].click(); 1`);
  await wait(450);
  await capture(win, '03b-food-library', '食物库');

  await win.webContents.executeJavaScript(`JF.app.go('diary'); 1`);
  await wait(450);
  await capture(win, '04-diary', '日记');

  await win.webContents.executeJavaScript(`JF.app.go('stats'); 1`);
  await wait(550);
  await capture(win, '05-stats', '数据');

  await win.webContents.executeJavaScript(`JF.app.go('stats'); document.querySelectorAll('.seg button')[2].click(); 1`);
  await wait(500);
  await capture(win, '05b-stats-all', '数据-全部');

  await win.webContents.executeJavaScript(`
    JF.app.go('home');
    setTimeout(function(){ document.querySelector('.view').scrollTop = 99999; }, 20); 1
  `);
  await wait(650);
  await capture(win, '01b-home-bottom', '首页-底部');

  await win.webContents.executeJavaScript('JF.app.openSettings(); 1');
  await wait(550);
  await capture(win, '06-settings', '设置');

  console.log('done');
  app.quit();
});

async function capture(win, name, label) {
  const at = await win.webContents.executeJavaScript(
    "document.querySelector('.tab.on .tab-label') ? document.querySelector('.tab.on .tab-label').textContent : '?'");
  await shot(win, name, label + ' [当前标签:' + at + ']');
}

async function shot(win, name, note) {
  const img = await win.webContents.capturePage();
  const p = path.join(OUT, name + '.png');
  fs.writeFileSync(p, img.toPNG());
  console.log('shot', name.padEnd(18), (note || ''), Math.round(fs.statSync(p).size / 1024) + 'KB');
}
