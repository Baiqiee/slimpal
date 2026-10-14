/* 减肥姬 — 角色呈现层
 * 决定「现在该是什么表情」和「现在该说什么」，并把立绘渲染出来。
 * 它只读 store，不写数据。
 */
(function (JF) {
  'use strict';

  var U = JF.util;
  var S = JF.store;

  var lineCache = {};     // scene+日期 -> 选中的那句，保证同一天内稳定
  var exprOverride = null; // 用户手动点了表情时暂时覆盖

  function active() {
    var id = JF.defaultCharacterId;
    return (JF.characters && JF.characters[id]) || null;
  }

  function facePath(key) {
    var c = active();
    if (!c) return '';
    return c.assets.faces[key] || c.assets.faces.calm;
  }

  function hasLine(scene) {
    var c = active();
    return !!(c && c.lines && c.lines[scene] && c.lines[scene].length);
  }

  function fill(text, ctx) {
    return String(text).replace(/\{(\w+)\}/g, function (m, k) {
      return (ctx && ctx[k] !== undefined && ctx[k] !== null) ? ctx[k] : '';
    });
  }

  /**
   * 选一句台词，同时决定她摆哪个姿势。
   * 两者共用同一个随机序号：所以「换一句」时姿势也跟着换，
   * 看起来像她在根据说的话换姿态，而不是随机抖。
   */
  function pickLine(scene, ctx, force) {
    if (!hasLine(scene)) return { text: '', pose: 'portrait', index: 0 };
    var bank = active().lines[scene];
    var key = scene + '|' + U.todayKey();
    var idx;
    if (!force && lineCache[key] !== undefined && lineCache[key] < bank.length) {
      idx = lineCache[key];
    } else {
      idx = Math.floor(Math.random() * bank.length);
      lineCache[key] = idx;
    }
    var poses = (active().poses && active().poses[scene]) || ['portrait'];
    return {
      text: fill(bank[idx], ctx),
      pose: poses[idx % poses.length],
      index: idx
    };
  }

  /** 只要文本的旧接口 */
  function pick(scene, ctx, force) {
    return pickLine(scene, ctx, force).text;
  }

  // ---------- 上下文数值 ----------
  function context() {
    var p = S.profile() || {};
    var cur = S.currentWeightKg();
    var start = p.startWeightKg;
    var target = p.targetWeightKg;
    var limit = p.dailyLimit || 0;
    var kcal = S.kcalOn(U.todayKey());
    var lostKg = (start !== null && cur !== null) ? Math.max(0, start - cur) : 0;
    var toTargetKg = (target !== null && cur !== null) ? Math.max(0, cur - target) : 0;
    return {
      name: p.name || '你',
      jin: U.round1(U.kgToJin(lostKg)),
      target: target !== null ? U.round1(U.kgToJin(start - target)) : 0,
      toTarget: U.round1(U.kgToJin(toTargetKg)),
      kcal: kcal,
      limit: limit,
      remain: Math.max(0, limit - kcal),
      streak: S.streak()
    };
  }

  /**
   * 决定此刻的场景。优先级从高到低：
   * 生日 > 里程碑 > 超过 23 小时没记录 > 超上限 > 没称体重 > 时段问候
   */
  function currentScene() {
    var p = S.profile();
    if (!p) return { scene: 'intro', expr: 'cheer' };

    var ctx = context();
    var today = U.todayKey();

    if (U.isBirthdayToday(p.birthday) && !S.state().flags.birthdayWished.some(function (y) {
      return String(y) === String(new Date().getFullYear());
    })) {
      return { scene: 'birthday', expr: 'laugh', ctx: ctx, special: 'birthday' };
    }

    var step = JF.calc.newMilestone(p.startWeightKg, p.targetWeightKg, S.currentWeightKg(), S.state().milestones);
    if (step !== null) {
      var total = p.startWeightKg - p.targetWeightKg;
      var done = S.currentWeightKg() <= p.targetWeightKg;
      return {
        scene: done ? 'goalReached' : 'milestone',
        expr: 'laugh',
        ctx: Object.assign({}, ctx, { jin: JF.calc.milestoneJin(p.startWeightKg, p.targetWeightKg, step) }),
        special: 'milestone',
        step: step
      };
    }

    var last = S.state().flags.lastMealAt;
    if (last && (Date.now() - last) > 23 * 3600 * 1000) {
      return { scene: 'longAbsent', expr: 'angry', ctx: ctx };
    }

    if (ctx.limit && ctx.kcal > ctx.limit) return { scene: 'overLimit', expr: 'serious', ctx: ctx };
    if (ctx.limit && ctx.remain <= 200 && ctx.kcal > 0) return { scene: 'nearLimit', expr: 'serious', ctx: ctx };

    var h = new Date().getHours();
    var scene = h < 11 ? 'greetMorning' : (h < 14 ? 'greetNoon' : (h < 18 ? 'greetAfternoon' : (h < 23 ? 'greetEvening' : 'greetNight')));
    if (!S.todayMeals(today).length && ctx.streak === 0) scene = 'idle';
    return { scene: scene, expr: h < 5 || h >= 23 ? 'tired' : 'calm', ctx: ctx };
  }

  var EXPR_SCENE = {
    mealLogged: 'happy',
    mealLoggedBig: 'happy',
    weightDown: 'laugh',
    weightUp: 'tired',
    weightSame: 'calm',
    streak: 'cheer',
    diarySaved: 'shy',
    breakStreak: 'tired'
  };

  /** 主动说一句（记完饮食、称完体重等），返回 {text, expr} */
  function say(scene, extraCtx, force) {
    var ctx = Object.assign({}, context(), extraCtx || {});
    var expr = EXPR_SCENE[scene] || 'calm';
    return { text: pick(scene, ctx, force), expr: expr, ctx: ctx };
  }

  /** 首页该显示的那一句 */
  /** 首页那句：场景决定说什么、摆什么姿势 */
  function homeLine() {
    var info = currentScene();
    var picked = pickLine(info.scene, info.ctx);
    return {
      text: picked.text,
      pose: picked.pose,
      scene: info.scene,
      ctx: info.ctx
    };
  }

  // ---------- 通用场景：立绘 + 从她头顶弹出的气泡 ----------
  /**
   * 这是全 App 统一的"小克说话"的样子（引导页、首页、里程碑庆祝都用它）。
   * 立绘在下面，气泡浮在她头顶上方、尾巴朝下指着她，不用另外一个小头像+对话框。
   *
   * opts: { text, pose, showName, onMore, onTap, className, size }
   * 返回的节点带两个方法：setText(t) / setPose(key)
   */
  function renderScene(opts) {
    opts = opts || {};
    var c = active();

    var textEl = U.el('div', { class: 'scene-text', text: opts.text || '' });
    var bubble = U.el('div', { class: 'scene-bubble' }, [
      opts.showName === false ? null : U.el('div', { class: 'scene-name', text: c.name }),
      textEl,
      opts.onMore ? U.el('div', { class: 'scene-foot' }, [
        U.el('button', { class: 'scene-more', type: 'button', onclick: opts.onMore }, ['换一句'])
      ]) : null
    ].filter(Boolean));

    var portrait = U.el('img', { class: 'scene-portrait', src: poseSrc(opts.pose), alt: c.name });
    var stage = U.el('div', { class: 'scene-stage' }, [portrait]);

    var root = U.el('div', {
      class: 'scene'
        + (opts.className ? ' ' + opts.className : '')
        + (opts.size ? ' scene-' + opts.size : '')
    }, [bubble, stage]);

    if (opts.onTap) {
      root.classList.add('tappable');
      portrait.addEventListener('click', opts.onTap);
      portrait.title = '戳一下';
    }

    root.setText = function (t) { textEl.textContent = t; };
    root.setPose = function (k) { portrait.src = poseSrc(k); };
    return root;
  }

  function poseSrc(key) {
    var c = active();
    if (key === 'alt') return c.assets.portraitAlt;
    if (key === 'back') return c.assets.portraitBack;
    return c.assets.portrait;
  }

  JF.chloe = {
    active: active,
    facePath: facePath,
    pick: pick,
    pickLine: pickLine,
    renderScene: renderScene,
    poseSrc: poseSrc,
    fill: fill,
    say: say,
    homeLine: homeLine,
    context: context,
    currentScene: currentScene,
    hasLine: hasLine
  };
})(window.JF = window.JF || {});
