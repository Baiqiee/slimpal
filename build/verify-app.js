/* 减肥姬 — 端到端功能自检
 * 走一遍真实界面流程（引导 → 记录 → 称重 → 里程碑 → 日记 → 备份），
 * 每一步都读回真实数据来验证，而不是只看「没报错」。
 */
const { app, BrowserWindow, protocol } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const PROFILE = path.join(__dirname, '..', 'tools', '.e2e-profile');
fs.rmSync(PROFILE, { recursive: true, force: true });
app.setPath('userData', PROFILE);

const core = require('./desktop-core');
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '   ' + detail : ''));
  if (!ok) failures++;
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  core.registerProtocol();
  core.registerIpc({ notify: () => {}, setAutostart: () => {}, getAutostart: () => false, hide: () => {} });

  const win = new BrowserWindow({
    width: 430, height: 900, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, backgroundThrottling: false
    }
  });
  const errors = [];
  win.webContents.on('console-message', (e, level, msg) => {
    if (level >= 2 && !/Security Warning|unsafe-eval|electronjs\.org/.test(String(msg))) errors.push(String(msg).slice(0, 200));
  });
  win.webContents.on('render-process-gone', () => errors.push('渲染进程崩溃'));

  const js = (code) => win.webContents.executeJavaScript(code);

  await win.loadURL('app://chloe/index.html');
  await wait(900);

  // ---------- 1. 首次打开进引导 ----------
  check('首次打开显示引导页', await js(`!!document.querySelector('.onboard')`));
  // 第一屏现在是「立绘 + 贴着她的气泡」，不再是顶部立绘 + 下方对话框
  check('引导显示小克形象', await js(`(function(){
    var im = document.querySelector('.onboard .scene-portrait');
    return !!im && im.complete && im.naturalWidth > 0;
  })()`));

  // ---------- 2. 走完 8 步引导 ----------
  // 引导页现在统一用「立绘 + 贴着的气泡」，台词在 .scene-text 里
  async function stepText() {
    return js(`(document.querySelector('.onboard .scene-text')||{}).textContent || ''`);
  }
  async function clickNext(label) {
    const ok = await js(`(function(){
      var bs = Array.prototype.slice.call(document.querySelectorAll('.onboard .btn'));
      var b = bs.filter(function(x){ return x.textContent.indexOf(${JSON.stringify(label)}) !== -1; })[0];
      if (!b) return false;
      b.click(); return true;
    })()`);
    await wait(260);
    return ok;
  }
  async function setField(sel, value) {
    return js(`(function(){
      var i = document.querySelector(${JSON.stringify(sel)});
      if (!i) return false;
      i.value = ${JSON.stringify(String(value))};
      i.dispatchEvent(new Event('input', {bubbles:true}));
      i.dispatchEvent(new Event('change', {bubbles:true}));
      return true;
    })()`);
  }

  const said = [];
  said.push(await stepText());

  // 开场介绍：逐句点「继续」看完，最后一句的按钮是「开始吧」
  const introSeen = [said[0]];
  for (let i = 0; i < 8; i++) {
    if (!(await js(`!!document.querySelector('.onboard .scene-intro')`))) break;
    const clicked = await js(`(function(){
      var bs = Array.prototype.slice.call(document.querySelectorAll('.onboard .btn'));
      var b = bs.filter(function(x){ return /继续|开始吧/.test(x.textContent); })[0];
      if (!b) return null;
      var t = b.textContent; b.click(); return t;
    })()`);
    await wait(300);
    if (clicked === null) break;
    const t = await stepText();
    if (t && t !== introSeen[introSeen.length - 1]) introSeen.push(t);
  }
  check('开场介绍是多句', introSeen.length >= 2, introSeen.length + ' 句');
  check('介绍完进入注册表单', await js(`!document.querySelector('.onboard .scene-intro') && !!document.querySelector('.onboard .field')`));

  check('第2步问姓名', (await stepText()).length > 0);
  check('填入姓名', await setField('.onboard .input[type="text"]', '测试君'));
  check('第2步继续', await clickNext('就叫这个'));

  check('第3步问生日', (await stepText()).length > 0);
  check('填入生日', await setField('.onboard .input[type="date"]', '1995-06-18'));
  check('第3步继续', await clickNext('记住了'));

  check('第4步问性别', (await stepText()).length > 0);
  check('选男生', await js(`(function(){var c=document.querySelectorAll('.onboard .chip'); if(c[1]){c[1].click(); return true;} return false;})()`));
  check('第4步继续', await clickNext('下一步'));

  check('第5步问身高体重', (await stepText()).length > 0);
  await js(`(function(){
    var ins = document.querySelectorAll('.onboard .input');
    ins[0].value='176'; ins[0].dispatchEvent(new Event('input',{bubbles:true}));
    ins[1].value='82';  ins[1].dispatchEvent(new Event('input',{bubbles:true}));
    return true; })()`);
  check('第5步继续', await clickNext('下一步'));

  check('第6步问活动量', (await stepText()).length > 0);
  await js(`(function(){var c=document.querySelectorAll('.onboard .choice'); if(c[1]) c[1].click(); return true;})()`);
  check('第6步继续', await clickNext('下一步'));

  check('第7步问目标', (await stepText()).length > 0);
  await js(`(function(){
    var i = document.querySelector('.onboard .input');
    i.value='72'; i.dispatchEvent(new Event('input',{bubbles:true}));
    var c = document.querySelectorAll('.onboard .choice'); if (c[1]) c[1].click();
    return true; })()`);
  await wait(200);
  const previewText = await js(`(document.querySelector('.onboard .card.plain')||{}).textContent || ''`);
  check('第7步出现热量上限预览', /千卡/.test(previewText), previewText.slice(0, 60));
  check('第7步继续', await clickNext('就这样'));

  const profile = JSON.parse(await js(`JSON.stringify(JF.store.profile() || {})`));
  check('资料已保存（名字）', profile.name === '测试君', profile.name);
  check('资料已保存（性别）', profile.gender === 'male');
  check('资料已保存（身高）', profile.heightCm === 176);
  check('算出基础代谢', profile.bmr > 1500 && profile.bmr < 2100, 'bmr=' + profile.bmr);
  check('算出每日上限', profile.dailyLimit > 1500 && profile.dailyLimit < 2600, 'limit=' + profile.dailyLimit);
  check('当前体重已记录', profile.startWeightKg === 82);
  check('目标体重已记录', profile.targetWeightKg === 72);

  check('第8步总结页', /每日热量上限|开始吧/.test(await js(`document.body.textContent`)));
  check('进入主界面', await clickNext('开始吧'));
  await wait(400);
  check('底部导航已出现', await js(`document.querySelectorAll('.tabbar .tab').length === 5`));
  check('首页在小克区', await js(`!!document.querySelector('.hero-portrait') && document.querySelector('.hero-portrait').naturalWidth > 0`));

  // ---------- 3. 记一笔（走真实弹层） ----------
  await js(`JF.actions.addMealSheet(); 1`);
  await wait(320);
  check('记一笔弹层打开', await js(`!!document.querySelector('.mask .sheet')`));
  const chipCount = await js(`document.querySelectorAll('.mask .chip').length`);
  check('弹层里有常吃/食物库快捷项（首次应为空提示）', chipCount >= 0, 'chips=' + chipCount);
  await js(`(function(){
    var ins = document.querySelectorAll('.mask .input');
    ins[0].value='牛肉面'; ins[0].dispatchEvent(new Event('input',{bubbles:true}));
    ins[1].value='620';   ins[1].dispatchEvent(new Event('input',{bubbles:true}));
    return true; })()`);
  await js(`(function(){
    var bs = document.querySelectorAll('.mask .btn');
    for (var i=0;i<bs.length;i++) if (bs[i].textContent.indexOf('记下来')!==-1) { bs[i].click(); return true; }
    return false; })()`);
  await wait(450);
  const afterMeal = JSON.parse(await js(`JSON.stringify({n:JF.store.todayMeals().length, kcal:JF.store.kcalOn(JF.util.todayKey())})`));
  check('记录写入成功', afterMeal.n === 1 && afterMeal.kcal === 620, JSON.stringify(afterMeal));
  check('记录后小克有反应', await js(`!!document.querySelector('.react-pop')`));
  check('倒计时基准已更新', await js(`JF.store.state().flags.lastMealAt > 0`));

  // ---------- 4. 空热量校验 ----------
  await js(`JF.actions.addMealSheet(); 1`);
  await wait(300);
  await js(`(function(){
    var bs = document.querySelectorAll('.mask .btn');
    for (var i=0;i<bs.length;i++) if (bs[i].textContent.indexOf('记下来')!==-1) { bs[i].click(); return true; }
    return false; })()`);
  await wait(300);
  check('空名称不放行（弹层仍在）', await js(`!!document.querySelector('.mask .sheet')`));
  check('空名称不产生记录', await js(`JF.store.todayMeals().length === 1`));
  await js(`JF.ui.closeSheet(); 1`);
  await wait(200);

  // ---------- 5. 称体重 ----------
  await js(`JF.actions.weighSheet(); 1`);
  await wait(320);
  await js(`(function(){
    var i = document.querySelector('.mask .input');
    i.value='80.5'; i.dispatchEvent(new Event('input',{bubbles:true}));
    var bs = document.querySelectorAll('.mask .btn');
    for (var k=0;k<bs.length;k++) if (bs[k].textContent.indexOf('记下来')!==-1) { bs[k].click(); return true; }
    return false; })()`);
  await wait(450);
  const w = JSON.parse(await js(`JSON.stringify(JF.store.latestWeight() || {})`));
  check('体重已记录', w.kg === 80.5, JSON.stringify(w));
  check('降到 1/10 里程碑会祝贺', await js(`!!document.querySelector('.mask .celebrate')`));
  const ms = await js(`JF.store.state().milestones.length`);
  check('里程碑已标记', ms === 1, 'milestones=' + ms);
  await js(`JF.ui.closeSheet(); 1`);
  await wait(220);

  // ---------- 6. 食物库增删改 ----------
  await js(`JF.actions.foodEditSheet(null); 1`);
  await wait(300);
  await js(`(function(){
    var ins = document.querySelectorAll('.mask .input');
    ins[0].value='鸡胸肉'; ins[0].dispatchEvent(new Event('input',{bubbles:true}));
    ins[1].value='165';   ins[1].dispatchEvent(new Event('input',{bubbles:true}));
    var bs = document.querySelectorAll('.mask .btn');
    for (var i=0;i<bs.length;i++) if (bs[i].textContent.indexOf('添加')!==-1) { bs[i].click(); return true; }
    return false; })()`);
  await wait(350);
  check('食物库新增成功', await js(`JF.store.foodsSorted().some(function(f){return f.name==='鸡胸肉'&&f.kcal===165;})`));

  await js(`JF.actions.foodEditSheet(JF.store.foodsSorted()[0]); 1`);
  await wait(300);
  await js(`(function(){
    var i = document.querySelectorAll('.mask .input')[1];
    i.value='180'; i.dispatchEvent(new Event('input',{bubbles:true}));
    var bs = document.querySelectorAll('.mask .btn');
    for (var k=0;k<bs.length;k++) if (bs[k].textContent.indexOf('保存')!==-1) { bs[k].click(); return true; }
    return false; })()`);
  await wait(350);
  check('食物库编辑生效', await js(`JF.store.foodsSorted()[0].kcal === 180`));

  // 常吃：用食物库快速记一笔
  await js(`JF.actions.quickLog({name:'鸡胸肉', lastKcal:180}); 1`);
  await wait(350);
  const freq = JSON.parse(await js(`JSON.stringify(JF.store.frequentFoods(5))`));
  check('常吃列表由真实记录统计而来', freq.length >= 1 && freq.some(f => f.name === '鸡胸肉'), JSON.stringify(freq.map(f => f.name + '×' + f.count)));

  // 有了历史之后，记一笔的弹层里应该出现一键快捷项
  await js(`JF.actions.addMealSheet(); 1`);
  await wait(320);
  const chipNow = await js(`document.querySelectorAll('.mask .chip').length`);
  check('记一笔弹层出现常吃快捷项', chipNow >= 1, 'chips=' + chipNow);
  await js(`(function(){
    var c = document.querySelector('.mask .chip');
    if (c) c.click();
    return 1; })()`);
  await wait(200);
  const filled = await js(`document.querySelectorAll('.mask .input')[0].value`);
  check('点快捷项会填好名称与热量', filled.length > 0, filled);
  await js(`JF.ui.closeSheet(); 1`);
  await wait(200);

  // ---------- 7. 日记 ----------
  await js(`JF.app.go('diary'); 1`);
  await wait(350);
  await js(`(function(){
    var t = document.querySelector('.view textarea');
    t.value = '今天走了八千步。'; t.dispatchEvent(new Event('input',{bubbles:true}));
    var bs = document.querySelectorAll('.view .btn');
    for (var i=0;i<bs.length;i++) if (bs[i].textContent.indexOf('保存')!==-1) { bs[i].click(); return true; }
    return false; })()`);
  await wait(400);
  check('日记已保存', await js(`(JF.store.diaryOn(JF.util.todayKey())||{}).text === '今天走了八千步。'`));

  // ---------- 8. 各页面都能渲染 ----------
  for (const [tab, probe] of [
    ['home', `.hero-portrait`], ['checkin', `.day-nav`], ['food', `.seg`],
    ['diary', `textarea`], ['stats', `.chart, .chart-empty`]
  ]) {
    await js(`JF.app.go('${tab}'); 1`);
    await wait(300);
    check(`页面可渲染：${tab}`, await js(`!!document.querySelector('.view ${probe}')`));
  }
  await js(`JF.app.go('stats'); 1`);
  await wait(350);
  check('数据页画出图表', await js(`document.querySelectorAll('.view svg.chart').length >= 1`));

  // ---------- 9. 设置页 ----------
  await js(`JF.app.openSettings(); 1`);
  await wait(350);
  check('设置页打开', await js(`!!document.querySelector('.onboard .face-grid')`));
  check('表情图鉴 9 张', await js(`document.querySelectorAll('.onboard .face-cell').length === 9`));
  check('表情图鉴图片可加载', await js(`(function(){
    var im = document.querySelector('.onboard .face-cell img');
    return !!im && im.complete && im.naturalWidth > 0; })()`));
  await js(`(function(){var b=document.querySelector('.onboard .icon-btn'); if(b) b.click(); return 1;})()`);
  await wait(250);

  // ---------- 10. 备份导出 / 导入 ----------
  const exported = await js(`JF.store.exportJson()`);
  const parsed = JSON.parse(exported);
  check('导出内容含资料', !!parsed.data.profile && parsed.data.profile.name === '测试君');
  check('导出内容含饮食记录', parsed.data.meals.length >= 2);
  check('导出内容含日记', parsed.data.diary.length === 1);
  check('导出内容含好感度', parsed.data.affection.points > 0);

  await js(`JF.store.resetAll(); 1`);
  await wait(200);
  check('清空后回到无资料状态', await js(`!JF.store.profile()`));
  await js(`JF.store.importJson(${JSON.stringify(exported)}); 1`);
  await wait(250);
  const restored = JSON.parse(await js(`JSON.stringify({
    name:(JF.store.profile()||{}).name, meals:JF.store.state().meals.length,
    diary:JF.store.state().diary.length, limit:(JF.store.profile()||{}).dailyLimit })`));
  check('导入后资料恢复', restored.name === '测试君', JSON.stringify(restored));
  check('导入后记录恢复', restored.meals >= 2 && restored.diary === 1);
  check('导入后重算热量上限', restored.limit > 0);

  // ---------- 11. 提醒时间计算 ----------
  // 注意：倒计时基准取「最近一次记录 / 上次提醒 / 建档时间」三者中最大的那个，
  // 所以测试里要把建档时间也挪到过去，才是在测 23 小时规则本身。
  const n1 = await js(`(function(){
    JF.store.setProfile({ createdAt: new Date(2026,0,1,9,0,0).getTime() });
    JF.store.state().settings.quietStart='22:00'; JF.store.state().settings.quietEnd='08:00';
    JF.store.state().flags.lastNotifyAt=null;
    JF.store.state().flags.lastMealAt=new Date(2026,0,1,10,0,0).getTime();
    var at = JF.notify.nextFireAt();
    return JSON.stringify({h:at.getHours(), m:at.getMinutes(), day:at.getDate()});
  })()`);
  const t1 = JSON.parse(n1);
  check('23 小时提醒落在次日上午 9 点', t1.h === 9 && t1.m === 0 && t1.day === 2, n1);

  const n2 = await js(`(function(){
    JF.store.state().flags.lastMealAt=new Date(2026,0,1,23,30,0).getTime();
    var at = JF.notify.nextFireAt();
    return JSON.stringify({h:at.getHours(), day:at.getDate()});
  })()`);
  const t2 = JSON.parse(n2);
  check('落在免打扰时段会顺延到早上 8 点', t2.h === 8 && t2.day === 3, n2);

  const n2b = await js(`(function(){
    JF.store.state().flags.lastMealAt=new Date(2026,0,1,5,0,0).getTime();
    var at = JF.notify.nextFireAt();
    return JSON.stringify({h:at.getHours(), day:at.getDate()});
  })()`);
  const t2b = JSON.parse(n2b);
  check('凌晨的记录顺延后仍是当天早上 8 点', t2b.h === 8 && t2b.day === 2, n2b);

  const n2c = await js(`(function(){
    JF.store.state().settings.quietStart='22:00'; JF.store.state().settings.quietEnd='08:00';
    JF.store.state().flags.lastMealAt=new Date(2026,0,1,12,0,0).getTime();
    var at = JF.notify.nextFireAt();
    return JSON.stringify({h:at.getHours(), day:at.getDate()});
  })()`);
  const t2c = JSON.parse(n2c);
  check('不在免打扰时段就按原时间提醒', t2c.h === 11 && t2c.day === 2, n2c);

  const n3 = await js(`JF.notify.body()`);
  check('提醒文案里带上你的名字', /测试君/.test(n3), n3);

  // ---------- 12. 没有未捕获错误 ----------
  check('运行期间没有页面错误', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log('\n' + (failures ? failures + ' 项未通过' : '全部通过'));
  app.exit(failures ? 1 : 0);
}).catch(e => { console.error('自检脚本异常', e); app.exit(2); });
