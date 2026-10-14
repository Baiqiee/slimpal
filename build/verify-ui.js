/* 减肥姬 — 界面回归测试
 *
 * 和 verify-app.js 的分工：
 *   verify-app.js   跑"功能"：数据能不能存、算得对不对、流程能不能走通
 *   verify-ui.js    跑"界面"：结构对不对、文字对不对、位置对不对
 *
 * 每修一个界面问题，就往这里加一条断言，保证下次改别的地方不会把它改回去。
 * 运行：cd build && npx electron verify-ui.js
 */
const { app, BrowserWindow, protocol } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const PROFILE = path.join(__dirname, '..', 'tools', '.ui-profile');
fs.rmSync(PROFILE, { recursive: true, force: true });
app.setPath('userData', PROFILE);

const core = require('./desktop-core');
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

// ---------------------------------------------------------------- 测试框架
const tests = [];
/** 注册一条测试。fn 抛异常或返回 false 即算失败 */
function test(name, fn) { tests.push({ name, fn }); }

let failures = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(msg || '断言失败');
}
function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error((label || '值') + ' 期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual));
  }
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- 测试用例

test('#1 引导页内容上下居中', async () => {
  await resetToOnboarding();
  const m = await js(`(function(){
    var inner = document.querySelector('.onboard-inner');
    if (!inner) return JSON.stringify({err:'没有 .onboard-inner 包裹层'});
    var host = document.querySelector('.onboard');
    var r = inner.getBoundingClientRect();
    var h = host.getBoundingClientRect();
    return JSON.stringify({
      above: Math.round(r.top - h.top),
      below: Math.round(h.bottom - r.bottom),
      innerH: Math.round(r.height),
      hostH: Math.round(h.height)
    });
  })()`);
  const v = JSON.parse(m);
  assert(!v.err, v.err);
  assert(v.innerH < v.hostH, '内容比容器还高，测不出居中（innerH=' + v.innerH + ' hostH=' + v.hostH + '）');
  const diff = Math.abs(v.above - v.below);
  assert(diff <= 24, '内容没有上下居中：上方 ' + v.above + 'px，下方 ' + v.below + 'px，差 ' + diff + 'px');
  return '上方 ' + v.above + 'px / 下方 ' + v.below + 'px';
});

test('#2 引导页第一屏不再出现离线说明小字', async () => {
  await resetToOnboarding();
  const text = await js(`document.querySelector('.onboard').textContent`);
  assert(text.indexOf('只装在你自己的设备上') === -1, '那串离线说明小字还在');
  assert(text.indexOf('数据不会离开这台机器') === -1, '那串离线说明小字还在');
  // 第一屏本身要还在，别把整屏删空了
  assert(text.indexOf('开始') !== -1, '第一屏的「开始」按钮没了，删多了');
  return '第一屏剩余文案：' + text.replace(/\s+/g, ' ').trim().slice(0, 40);
});

test('#3 引导页第一屏改成「立绘 + 贴着她弹出的气泡」', async () => {
  await resetToOnboarding();
  const m = await js(`(function(){
    var scene = document.querySelector('.onboard .scene');
    if (!scene) return JSON.stringify({err:'没有 .scene 组件'});
    var bubble = scene.querySelector(':scope > .scene-bubble');
    var img    = scene.querySelector('.scene-portrait');
    if (!bubble) return JSON.stringify({err:'气泡不在 .scene 里'});
    if (!img)    return JSON.stringify({err:'没有立绘 .scene-portrait'});
    var after = getComputedStyle(bubble, '::after');
    var br = bubble.getBoundingClientRect(), ir = img.getBoundingClientRect();
    return JSON.stringify({
      src: img.getAttribute('src'),
      opacity: getComputedStyle(img).opacity,
      bubbleBottom: Math.round(br.bottom),
      imgTop: Math.round(ir.top),
      tailContent: after.content,
      tailW: after.width,
      tailBg: after.backgroundColor,
      oldSay: document.querySelectorAll('.onboard-say').length,
      oldTop: document.querySelectorAll('.onboard-top').length,
      text: (scene.querySelector('.scene-text') || {}).textContent || ''
    });
  })()`);
  const v = JSON.parse(m);
  assert(!v.err, v.err);
  assert(/portrait\.png$/.test(v.src), '第一屏用的不是全身立绘，而是 ' + v.src);
  assert(v.opacity === '1', '立绘被冲淡了，opacity=' + v.opacity);
  assert(v.bubbleBottom <= v.imgTop + 10,
    '气泡没贴在立绘上方（气泡底 ' + v.bubbleBottom + 'px，立绘顶 ' + v.imgTop + 'px）');
  assert(v.tailContent && v.tailContent !== 'none' && v.tailW !== '0px',
    '气泡没有朝下的小尾巴（content=' + v.tailContent + ' width=' + v.tailW + '）');
  assertEqual(v.oldSay, 0, '旧的「圆头像 + 下方对话框」还在');
  assertEqual(v.oldTop, 0, '第一屏还留着单独的顶部立绘');
  assert(v.text.length > 0, '气泡里没有文字');
  return '立绘 ' + v.src.split('/').pop() + '；气泡底 ' + v.bubbleBottom + 'px ≤ 立绘顶 ' + v.imgTop + 'px';
});

test('#3 台词与立绘姿势一一对应，且真的会换姿势', async () => {
  const m = await js(`(function(){
    var c = JF.chloe.active();
    var poses = c.poses || {};
    var scenes = Object.keys(c.lines);
    var missing = scenes.filter(function(k){ return !poses[k] || !poses[k].length; });
    var bad = [];
    var used = {};
    scenes.forEach(function(s){
      (poses[s] || []).forEach(function(p){
        used[p] = 1;
        if (['portrait','alt','back'].indexOf(p) === -1) bad.push(s + ':' + p);
      });
    });
    // 对多姿势场景连抽 40 次，看是不是真的会换
    var varies = false;
    for (var i = 0; i < 40; i++) {
      if (JF.chloe.pickLine('idle', {}, true).pose !== JF.chloe.pickLine('idle', {}, true).pose) { varies = true; break; }
    }
    return JSON.stringify({missing: missing, bad: bad, kinds: Object.keys(used), varies: varies, scenes: scenes.length});
  })()`);
  const v = JSON.parse(m);
  assertEqual(v.missing.length, 0, '这些场景没配立绘姿势：' + v.missing.join('、'));
  assertEqual(v.bad.length, 0, '有非法姿势名：' + v.bad.join('、'));
  assert(v.kinds.length >= 2, '全部场景只用一种姿势，等于没换：' + v.kinds.join('、'));
  assert(v.varies, '多姿势场景反复抽取始终是同一个姿势');
  return v.scenes + ' 个场景，用到的姿势：' + v.kinds.join(' / ');
});

// ---------------------------------------------------------------- 运行环境
let win = null;
const errors = [];

/** 在页面里执行表达式并取回结果 */
function js(code) { return win.webContents.executeJavaScript(code); }

/** 清空数据回到引导页 */
async function resetToOnboarding() {
  await js(`localStorage.clear(); 1`);
  await win.webContents.reload();
  await wait(900);
}

/** 造一份资料，直接进主界面 */
async function seedAndEnter() {
  await js(`
    (function(){
      var S = JF.store;
      S.resetAll();
      S.setProfile({ name:'测试君', birthday:'1995-06-18', gender:'male', heightCm:176,
        activity:'light', startWeightKg:82, targetWeightKg:72, speed:'normal', createdAt: Date.now() });
      S.addWeight(82);
      JF.app.afterOnboarding();
      return 1;
    })()
  `);
  await wait(700);
}

app.whenReady().then(async () => {
  core.registerProtocol();
  core.registerIpc({ notify: () => {}, setAutostart: () => {}, getAutostart: () => false, hide: () => {} });

  win = new BrowserWindow({
    width: 430, height: 900, show: false,
    backgroundColor: '#FCE7EC',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, backgroundThrottling: false
    }
  });
  win.webContents.on('console-message', (e, level, msg) => {
    const m = String(msg);
    if (level >= 2 && !/Security Warning|unsafe-eval|electronjs\.org/.test(m)) errors.push(m.slice(0, 200));
  });

  await win.loadURL('app://chloe/index.html');
  await wait(800);

  // 关掉动画，保证量到的位置是最终位置
  await js(`(function(){
    var s = document.createElement('style');
    s.textContent = '*{animation:none !important; transition:none !important;}';
    document.head.appendChild(s);
    return 1;
  })()`);

  for (const t of tests) {
    try {
      const detail = await t.fn();
      console.log('PASS  ' + t.name + (detail ? '   [' + detail + ']' : ''));
    } catch (e) {
      failures++;
      console.log('FAIL  ' + t.name + '\n        ' + (e && e.message ? e.message : e));
    }
  }

  if (errors.length) {
    failures++;
    console.log('FAIL  运行期间出现页面错误\n        ' + errors.slice(0, 3).join(' | '));
  }

  console.log('\n' + tests.length + ' 项界面检查，' + (failures ? failures + ' 项未通过' : '全部通过'));
  app.exit(failures ? 1 : 0);
}).catch(e => { console.error('测试脚本异常', e); app.exit(2); });
