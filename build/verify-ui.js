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
