/* 减肥姬 — 界面回归测试
 *
 * 和 verify-app.js 的分工：
 *   verify-app.js   跑"功能"：数据能不能存、算得对不对、流程能不能走通
 *   verify-ui.js    跑"界面"：结构对不对、文字对不对、位置对不对
 *
 * 每修一个界面问题，就往这里加一组断言，保证下次改别的地方不会把它改回去。
 * 运行：cd build && npx electron verify-ui.js
 *
 * 注意：这里**故意不关闭 CSS 动画**，因为要验证转场动画确实播了。
 * 所以量位置之前都要等动画跑完（见 settle()）。
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
function test(name, fn) { tests.push({ name, fn }); }

let failures = 0;

function assert(cond, msg) { if (!cond) throw new Error(msg || '断言失败'); }
function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error((label || '值') + ' 期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual));
  }
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));
/** 等 CSS 动画跑完再量，避免量到动画中途的位置 */
const settle = () => wait(1100);

// ---------------------------------------------------------------- 测试用例

test('#1 引导页内容上下居中', async () => {
  await resetToOnboarding();
  const v = JSON.parse(await js(`(function(){
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
  })()`));
  assert(!v.err, v.err);
  assert(v.innerH < v.hostH, '内容比容器还高，测不出居中（innerH=' + v.innerH + ' hostH=' + v.hostH + '）');
  const diff = Math.abs(v.above - v.below);
  assert(diff <= 24, '内容没有上下居中：上方 ' + v.above + 'px，下方 ' + v.below + 'px，差 ' + diff + 'px');
  return '上方 ' + v.above + 'px / 下方 ' + v.below + 'px';
});

test('#2 引导页不再出现离线说明小字', async () => {
  await resetToOnboarding();
  const text = await js(`document.querySelector('.onboard').textContent`);
  assert(text.indexOf('只装在你自己的设备上') === -1, '那串离线说明小字还在');
  assert(text.indexOf('数据不会离开这台机器') === -1, '那串离线说明小字还在');
  assert(text.indexOf('继续') !== -1 || text.indexOf('开始吧') !== -1, '第一屏没有继续按钮，删多了');
  return '开场白：' + text.replace(/\s+/g, ' ').trim().slice(0, 34);
});

test('#3 引导页用「立绘 + 贴着她弹出的气泡」', async () => {
  await resetToOnboarding();
  const v = JSON.parse(await js(`(function(){
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
      oldSay: document.querySelectorAll('.onboard-say').length,
      oldTop: document.querySelectorAll('.onboard-top').length,
      text: (scene.querySelector('.scene-text') || {}).textContent || ''
    });
  })()`));
  assert(!v.err, v.err);
  assert(/portrait(-alt|-back)?\.png$/.test(v.src), '用的不是小克立绘，而是 ' + v.src);
  assert(v.opacity === '1', '立绘被冲淡了，opacity=' + v.opacity);
  assert(v.bubbleBottom <= v.imgTop + 10,
    '气泡没贴在立绘上方（气泡底 ' + v.bubbleBottom + 'px，立绘顶 ' + v.imgTop + 'px）');
  assert(v.tailContent && v.tailContent !== 'none' && v.tailW !== '0px',
    '气泡没有朝下的小尾巴（content=' + v.tailContent + ' width=' + v.tailW + '）');
  assertEqual(v.oldSay, 0, '旧的「圆头像 + 下方对话框」还在');
  assertEqual(v.oldTop, 0, '还留着单独的顶部立绘');
  assert(v.text.length > 0, '气泡里没有文字');
  return '立绘 ' + v.src.split('/').pop() + '；气泡底 ' + v.bubbleBottom + 'px ≤ 立绘顶 ' + v.imgTop + 'px';
});

test('#3 台词与立绘姿势一一对应，且真的会换姿势', async () => {
  const v = JSON.parse(await js(`(function(){
    var c = JF.chloe.active();
    var poses = c.poses || {};
    var scenes = Object.keys(c.lines);
    var missing = scenes.filter(function(k){ return !poses[k] || !poses[k].length; });
    var bad = [], used = {};
    scenes.forEach(function(s){
      (poses[s] || []).forEach(function(p){
        used[p] = 1;
        if (['portrait','alt','back'].indexOf(p) === -1) bad.push(s + ':' + p);
      });
    });
    var varies = false;
    for (var i = 0; i < 40; i++) {
      if (JF.chloe.pickLine('idle', {}, true).pose !== JF.chloe.pickLine('idle', {}, true).pose) { varies = true; break; }
    }
    var intro = c.lines.intro || [];
    var introPoses = (poses.intro || []);
    return JSON.stringify({
      missing: missing, bad: bad, kinds: Object.keys(used), varies: varies,
      scenes: scenes.length, introLines: intro.length, introPoses: introPoses.length
    });
  })()`));
  assertEqual(v.missing.length, 0, '这些场景没配立绘姿势：' + v.missing.join('、'));
  assertEqual(v.bad.length, 0, '有非法姿势名：' + v.bad.join('、'));
  assert(v.kinds.length >= 2, '全部场景只用一种姿势，等于没换：' + v.kinds.join('、'));
  assert(v.varies, '多姿势场景反复抽取始终是同一个姿势');
  assertEqual(v.introPoses, v.introLines, '开场介绍的句数和姿势数对不上（会错位）');
  return v.scenes + ' 个场景，姿势：' + v.kinds.join(' / ') + '；开场 ' + v.introLines + ' 句';
});

test('#4 引导页全程用立绘，不出现 Q 版', async () => {
  await resetToOnboarding();
  const seen = [];
  // 开场介绍阶段
  for (let i = 0; i < 8; i++) {
    if (!(await isIntroPhase())) break;
    seen.push(await snapshotOnboard('开场' + (i + 1)));
    await clickOnboardNext();
  }
  // 问答阶段 7 步
  for (let s = 2; s <= 8; s++) {
    const snap = await snapshotOnboard('第' + s + '步');
    seen.push(snap);
    if (snap.no !== s) throw new Error('期望走到第 ' + s + ' 步，实际第 ' + snap.no + ' 步');
    if (s < 8) { await fillOnboardFields(); await clickOnboardNext(); }
  }
  assertEqual(seen.filter(s => s.chibi > 0).length, 0,
    '有 ' + seen.filter(s => s.chibi > 0).length + ' 屏还在用 Q 版立绘');
  assertEqual(seen.filter(s => s.portrait === 0).length, 0, '有页面没有显示立绘');
  assertEqual(seen.filter(s => s.scenes === 0).length, 0, '有页面没有用「立绘+气泡」组件');
  return seen.length + ' 屏（' + seen.map(s => s.where).join('/') + '）全部 portrait 立绘、无 chibi';
});

test('#4b 走引导的测试工具本身是可靠的', async () => {
  await resetToOnboarding();
  const r = await walkOnboarding(8);
  assert(r.ok, '走不到第 8 步：' + (r.why || '') + '，经过 ' + r.steps.join('→'));
  assertEqual(r.steps.join(','), '1,2,3,4,5,6,7,8', '步号不连续：' + r.steps.join(','));
  return '步号连续 ' + r.steps.join('→');
});

test('#5 第 8 步的收尾文案已替换', async () => {
  await resetToOnboarding();
  const r = await walkOnboarding(8);
  assert(r.ok, '走不到第 8 步：' + (r.why || ''));
  const text = await js(`document.querySelector('.onboard').textContent`);
  assert(text.indexOf('正式开始你的减肥计划吧，不要半途而弃哦~') !== -1, '新的收尾文案没有出现');
  assert(text.indexOf('每减掉目标的十分之一') === -1, '旧的里程碑说明文案还在');
  return '第 8 步文案已更新';
});

test('#6 开场：小克居中淡入、逐句介绍、每句换姿势', async () => {
  await resetToOnboarding();

  const first = JSON.parse(await js(`(function(){
    var scene = document.querySelector('.onboard .scene');
    var inner = document.querySelector('.onboard-inner');
    var field = document.querySelector('.onboard .field');
    if (!scene) return JSON.stringify({err:'开场没有 .scene'});
    var sr = scene.getBoundingClientRect(), ir = inner.getBoundingClientRect();
    return JSON.stringify({
      isIntro: !!document.querySelector('.onboard .scene-intro'),
      hasForm: !!field,
      animName: getComputedStyle(scene).animationName,
      offsetPx: Math.round((sr.left + sr.width / 2) - (ir.left + ir.width / 2)),
      text: (scene.querySelector('.scene-text') || {}).textContent || ''
    });
  })()`));
  assert(!first.err, first.err);
  assert(first.isIntro, '开局不是「开场介绍」阶段');
  assert(!first.hasForm, '开局就把注册表单显示出来了，应该等介绍完再顶上来');
  assert(/introFadeIn/.test(first.animName), '开场没有淡入动画（animationName=' + first.animName + '）');
  assert(Math.abs(first.offsetPx) <= 6, '开场小克没有水平居中，偏移 ' + first.offsetPx + 'px');

  // 逐句点「继续」，记录每句的文字和姿势
  const lines = [first.text];
  const poses = [];
  for (let i = 0; i < 8; i++) {
    if (!(await isIntroPhase())) break;
    poses.push(await js(`(document.querySelector('.onboard .scene-portrait')||{}).getAttribute('src')`));
    await clickOnboardNext();
    if (await isIntroPhase()) {
      lines.push(await js(`(document.querySelector('.onboard .scene-text')||{}).textContent || ''`));
    }
  }

  assert(lines.length >= 2, '开场只有 1 句就进问答了，没有"逐句介绍"');
  assertEqual(new Set(lines).size, lines.length, '开场出现了重复的句子');
  assert(new Set(poses).size >= 2, '开场各句用的立绘姿势完全一样，等于没换：' + poses.join('、'));
  return lines.length + ' 句介绍，用了 ' + new Set(poses).size + ' 种姿势';
});

test('#6 介绍结束：注册表单从下方顶上来，把她推上去', async () => {
  await resetToOnboarding();
  // 点到最后一句，再点「开始吧」
  for (let i = 0; i < 10; i++) {
    if (!(await isIntroPhase())) break;
    await clickOnboardNext();
  }
  const v = JSON.parse(await js(`(function(){
    var field = document.querySelector('.onboard .field');
    var scene = document.querySelector('.onboard .scene');
    var inner = document.querySelector('.onboard-inner');
    return JSON.stringify({
      isIntro: !!document.querySelector('.onboard .scene-intro'),
      hasForm: !!field,
      fieldAnim: field ? getComputedStyle(field).animationName : 'n/a',
      sceneAnim: scene ? getComputedStyle(scene).animationName : 'n/a',
      innerAnim: inner.classList.contains('anim-form'),
      step: (document.querySelector('.onboard-step')||{}).textContent || '',
      firstFieldLabel: field ? (field.querySelector('.field-label')||{}).textContent || '(无标题)' : ''
    });
  })()`));
  assert(!v.isIntro, '介绍结束后还停在开场阶段');
  assert(v.hasForm, '介绍结束后没有出现注册表单');
  assert(/formSlideUp/.test(v.fieldAnim), '表单没有"从下方顶上来"的动画（animationName=' + v.fieldAnim + '）');
  assert(/scenePushedUp/.test(v.sceneAnim), '立绘没有被"顶上去"的动画（animationName=' + v.sceneAnim + '）');
  assert(/第 2 \/ 8 步/.test(v.step), '介绍完不是进第 2 步，而是：' + v.step);

  // 再翻一步：动画不应重复播
  await fillOnboardFields();
  await clickOnboardNext();
  const again = await js(`(function(){
    var f = document.querySelector('.onboard .field');
    return getComputedStyle(f).animationName;
  })()`);
  assertEqual(again, 'none', '翻页时又播了一遍"表单顶上来"动画，应该只在介绍结束时播一次');
  return '转场动画只播一次；第一步字段：' + v.firstFieldLabel;
});

test('#7 首页也用「立绘 + 气泡」，点击小克有互动反馈', async () => {
  await resetToOnboarding();
  await seedAndEnter();

  const v = JSON.parse(await js(`(function(){
    var scene = document.querySelector('.view .scene.home-scene');
    if (!scene) return JSON.stringify({err:'首页没有 .scene.home-scene'});
    var bubble = scene.querySelector(':scope > .scene-bubble');
    var img    = scene.querySelector('.scene-portrait');
    var br = bubble.getBoundingClientRect(), ir = img.getBoundingClientRect();
    var after = getComputedStyle(bubble, '::after');
    return JSON.stringify({
      bubbleBottom: Math.round(br.bottom),
      imgTop: Math.round(ir.top),
      tail: after.content,
      old: document.querySelectorAll('.hero-root, .hero-avatar, .hero-stage, .speech').length,
      text: (scene.querySelector('.scene-text') || {}).textContent || '',
      hasPoke: !!JF.chloe.active().lines.poke,
      pokeCount: (JF.chloe.active().lines.poke || []).length
    });
  })()`));
  assert(!v.err, v.err);
  assert(v.bubbleBottom <= v.imgTop + 10,
    '首页气泡没贴在立绘上方（气泡底 ' + v.bubbleBottom + '，立绘顶 ' + v.imgTop + '）');
  assert(v.tail && v.tail !== 'none', '首页气泡没有朝下的小尾巴');
  assertEqual(v.old, 0, '首页还留着旧的「小圆头像 + 下方对话框」结构');
  assert(v.text.length > 0, '首页气泡没有文字');
  assert(v.hasPoke && v.pokeCount >= 3, '角色包没有配「被戳」的台词');

  // 点她本人：台词必须来自 poke 那一组，并触发弹跳
  const pokeBank = JSON.parse(await js(`JSON.stringify(JF.chloe.active().lines.poke)`));
  const seenText = new Set();
  const seenPose = new Set();
  let sawPokedClass = false;
  for (let i = 0; i < 8; i++) {
    await js(`document.querySelector('.view .home-scene .scene-portrait').click(); 1`);
    await wait(180);
    const r = JSON.parse(await js(`(function(){
      var scene = document.querySelector('.view .home-scene');
      return JSON.stringify({
        text: (scene.querySelector('.scene-text') || {}).textContent || '',
        pose: (scene.querySelector('.scene-portrait') || {}).getAttribute('src') || '',
        poked: scene.classList.contains('poked')
      });
    })()`));
    seenText.add(r.text);
    seenPose.add(r.pose);
    if (r.poked) sawPokedClass = true;
  }
  const bad = [...seenText].filter(t => pokeBank.indexOf(t) === -1);
  assertEqual(bad.length, 0, '点了她之后说的不是「被戳」台词：' + bad.join(' | '));
  assert(sawPokedClass, '点她之后没有触发弹跳反馈（缺 .poked）');
  assert(seenText.size >= 2, '连点 8 次台词一直没变，互动感是假的');
  assert(seenPose.size >= 2, '连点 8 次姿势一直没变');

  // 「换一句」换成当前场景的台词，而不是被戳台词
  const before = await js(`document.querySelector('.view .home-scene .scene-text').textContent`);
  await js(`document.querySelector('.view .home-scene .scene-more').click(); 1`);
  await wait(200);
  const after = await js(`document.querySelector('.view .home-scene .scene-text').textContent`);
  assert(after.length > 0, '「换一句」之后气泡空了');
  return '点击 8 次得到 ' + seenText.size + ' 种回应 / ' + seenPose.size + ' 种姿势；换一句：'
    + before.slice(0, 10) + '… → ' + after.slice(0, 10) + '…';
});

test('#8 左上角标题是角色名，不是 App 名', async () => {
  await resetToOnboarding();
  await seedAndEnter();
  const v = JSON.parse(await js(`(function(){
    var t = document.querySelector('.app > .topbar .topbar-title');
    var s = document.querySelector('.app > .topbar .topbar-sub');
    return JSON.stringify({
      title: t ? t.textContent : '(没有标题)',
      sub: s ? s.textContent : '',
      charName: JF.chloe.active().name,
      appNameInAbout: '减肥姬'
    });
  })()`));
  assertEqual(v.title, v.charName, '左上角标题');
  assert(v.title !== v.appNameInAbout, '左上角还是显示 App 名「减肥姬」');
  assert(v.sub.length > 0, '问候语没了');
  return '标题「' + v.title + '」/ 副标题「' + v.sub + '」';
});

test('#9 导航正中间是小克的脸部特写，不是 Q 版', async () => {
  await resetToOnboarding();
  await seedAndEnter();
  const v = JSON.parse(await js(`(function(){
    var glyph = document.querySelector('.tab.center .tab-glyph');
    var img = document.querySelector('.tab.center .tab-face');
    if (!glyph) return JSON.stringify({err:'导航中间没有 .tab-glyph'});
    if (!img) return JSON.stringify({err:'导航中间不是图片'});
    var gr = glyph.getBoundingClientRect(), ir = img.getBoundingClientRect();
    return JSON.stringify({
      src: img.getAttribute('src'),
      loaded: img.complete && img.naturalWidth > 0,
      natural: img.naturalWidth,
      fillW: Math.round(ir.width / gr.width * 100),
      fillH: Math.round(ir.height / gr.height * 100),
      round: getComputedStyle(glyph).borderRadius,
      clip: getComputedStyle(glyph).overflow,
      chibiInTab: document.querySelectorAll('.tabbar img[src*="chibi"]').length,
      chibiAnywhere: Array.prototype.slice.call(document.querySelectorAll('img[src*="chibi"]'))
        .map(function(x){ return x.className + '@' + (x.closest('.card') ? 'card' : (x.closest('.tabbar') ? 'tabbar' : 'other')); }),
      expected: JF.chloe.active().assets.navFace
    });
  })()`));
  assert(!v.err, v.err);
  assertEqual(v.src, v.expected, '导航头像的图源');
  assert(!/chibi/.test(v.src), '导航中间还是 Q 版：' + v.src);
  assert(v.loaded, '导航头像没加载出来');
  assert(v.fillW >= 80 && v.fillH >= 80, '头像没有占满圆钮（' + v.fillW + '% x ' + v.fillH + '%）');
  assertEqual(v.round, '50%', '圆钮不是圆形');
  assertEqual(v.clip, 'hidden', '圆钮没有裁剪，头像是方形的');
  assertEqual(v.chibiInTab, 0, '导航条里还混着 Q 版图标：' + v.chibiAnywhere.join('、'));
  return v.src.split('/').pop() + '，占满 ' + v.fillW + '% x ' + v.fillH + '%'
    + (v.chibiAnywhere.length ? '（页面别处仍有 Q 版空态图：' + v.chibiAnywhere.join('、') + '）' : '');
});

// ---------------------------------------------------------------- 运行环境

let win = null;
const errors = [];

function js(code) { return win.webContents.executeJavaScript(code); }

/** 清空数据回到引导页（localStorage 和桌面数据文件都要清，否则会读回旧资料直接进主界面） */
async function resetToOnboarding() {
  await js(`(function(){
    try { window.jianfeijiNative.save(''); } catch (e) {}
    localStorage.clear();
    return 1;
  })()`);
  await win.webContents.reload();
  await settle();
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
  await settle();
}

/** 是否处在开场介绍阶段 */
async function isIntroPhase() {
  return js(`!!document.querySelector('.onboard .scene-intro')`);
}

/** 当前引导到第几步（读"第 N / 8 步"）；开场介绍算第 1 步 */
async function onboardStepNo() {
  return js(`(function(){
    var m = /第\\s*(\\d+)\\s*\\/\\s*8\\s*步/.exec((document.querySelector('.onboard-step')||{}).textContent || '');
    return m ? Number(m[1]) : 0;
  })()`);
}

/** 当前屏的界面快照，用来批量断言"全程都用立绘"这类事情 */
async function snapshotOnboard(where) {
  const v = JSON.parse(await js(`(function(){
    var imgs = Array.prototype.slice.call(document.querySelectorAll('.onboard img'));
    var m = /第\\s*(\\d+)\\s*\\/\\s*8\\s*步/.exec((document.querySelector('.onboard-step')||{}).textContent || '');
    return JSON.stringify({
      chibi: imgs.filter(function(x){ return /chibi\\.png/.test(x.getAttribute('src')||''); }).length,
      portrait: imgs.filter(function(x){ return /portrait(-alt|-back)?\\.png/.test(x.getAttribute('src')||''); }).length,
      scenes: document.querySelectorAll('.onboard .scene').length,
      no: m ? Number(m[1]) : 0
    });
  })()`));
  v.where = where;
  return v;
}

/**
 * 按字段标题填值 —— 不能用"第几个输入框"来猜，
 * 因为每一步的输入框个数和含义都不一样（目标那步只有一个框，值是公斤数）。
 */
async function fillOnboardFields() {
  await js(`(function(){
    var fields = document.querySelectorAll('.onboard .field');
    for (var i = 0; i < fields.length; i++) {
      var lab = (fields[i].querySelector('.field-label') || {}).textContent || '';
      var inp = fields[i].querySelector('.input');
      if (!inp || inp.value) continue;
      if (inp.type === 'date')            inp.value = '1995-06-18';
      else if (/身高/.test(lab))          inp.value = '176';
      else if (/现在体重/.test(lab))       inp.value = '82';
      else if (/目标体重/.test(lab))       inp.value = '72';
      else if (/称呼|名字/.test(lab))      inp.value = '测试君';
      else if (inp.type === 'text')       inp.value = '测试君';
      else                                inp.value = '1';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var choices = document.querySelectorAll('.onboard .choice');
    if (choices.length && !document.querySelector('.onboard .choice.on')) choices[0].click();
    return 1;
  })()`);
}

/** 点当前屏的继续按钮；返回按钮文字（没得点返回 null） */
async function clickOnboardNext() {
  const label = await js(`(function(){
    var bs = [].slice.call(document.querySelectorAll('.onboard .btn'));
    var b = bs.filter(function(x){ return /继续|开始|下一步|就叫这个|记住了|就这样|开始吧/.test(x.textContent); })[0];
    if (!b) return null;
    var t = b.textContent;
    b.click();
    return t;
  })()`);
  await wait(260);
  return label;
}

/**
 * 一路走到指定步（默认第 8 步）。
 * 会先点完开场介绍的每一句，再走问答表单。
 * 返回 { ok, reached, steps }；steps 只记录问答阶段的步号，
 * 用来证明真的在前进、而不是卡在某一步空转。
 */
async function walkOnboarding(target) {
  target = target || 8;
  const steps = [];
  const first = await onboardStepNo();
  if (first) steps.push(first);          // 开场介绍那一步的号数
  for (let guard = 0; guard < 40; guard++) {
    if (!(await isIntroPhase())) {
      const n = await onboardStepNo();
      if (steps[steps.length - 1] !== n) steps.push(n);
      if (n >= target) return { ok: true, reached: n, steps: steps };
    }
    await fillOnboardFields();
    const label = await clickOnboardNext();
    if (label === null) {
      return { ok: false, reached: steps[steps.length - 1] || 0, steps: steps, why: '当前屏找不到继续按钮' };
    }
  }
  return { ok: false, reached: steps[steps.length - 1] || 0, steps: steps, why: '循环次数用完了还没走到' };
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
  await settle();

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
