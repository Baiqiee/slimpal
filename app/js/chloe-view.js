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

  function pick(scene, ctx, force) {
    if (!hasLine(scene)) return '';
    var bank = active().lines[scene];
    var key = scene + '|' + U.todayKey();
    var idx;
    if (!force && lineCache[key] !== undefined && lineCache[key] < bank.length) {
      idx = lineCache[key];
    } else {
      idx = Math.floor(Math.random() * bank.length);
      lineCache[key] = idx;
    }
    return fill(bank[idx], ctx);
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
    if (!p) return { scene: 'firstMeet', expr: 'cheer' };

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
  function homeLine() {
    var info = currentScene();
    return {
      text: pick(info.scene, info.ctx),
      expr: exprOverride || info.expr,
      scene: info.scene,
      ctx: info.ctx
    };
  }

  function setExpression(key) {
    exprOverride = key;
    setTimeout(function () { exprOverride = null; }, 6000);
  }

  // ---------- 渲染 ----------
  function faceImg(key, cls) {
    return U.el('img', { class: cls || 'hero-face', src: facePath(key), alt: '' });
  }

  /**
   * 首页主角区。
   * opts: { pose: 'portrait'|'alt'|'back', showBubble: bool }
   */
  function renderHero(opts) {
    opts = opts || {};
    var c = active();
    var line = homeLine();
    var pose = opts.pose || 'portrait';
    var src = pose === 'alt' ? c.assets.portraitAlt : (pose === 'back' ? c.assets.portraitBack : c.assets.portrait);

    var portrait = U.el('img', { class: 'hero-portrait', src: src, alt: c.name });

    var speechText = U.el('div', { class: 'speech-text', text: line.text });
    var bubble = U.el('div', { class: 'speech' }, [
      U.el('div', { class: 'speech-name' }, [c.name]),
      speechText,
      U.el('div', { class: 'speech-foot' }, [
        U.el('button', {
          class: 'speech-more', type: 'button', title: '换一句',
          onclick: function (e) {
            e.stopPropagation();
            speechText.textContent = pick(line.scene, line.ctx, true);
          }
        }, ['换一句'])
      ])
    ]);

    var avatar = U.el('div', { class: 'hero-avatar' }, [
      faceImg(line.expr, 'hero-face'),
      U.el('div', {
        class: 'hero-tap', title: '戳一下',
        onclick: function () {
          setExpression(['happy', 'shy', 'bashful', 'cheer'][Math.floor(Math.random() * 4)]);
          var t = pick('idle', line.ctx, true);
          document.querySelector('.hero-root .speech-text').textContent = t;
        }
      })
    ]);

    return U.el('div', { class: 'hero-root' }, [
      U.el('div', { class: 'hero-stage' }, [portrait]),
      U.el('div', { class: 'hero-row' }, [avatar, bubble])
    ]);
  }

  JF.chloe = {
    active: active,
    facePath: facePath,
    pick: pick,
    fill: fill,
    say: say,
    homeLine: homeLine,
    context: context,
    currentScene: currentScene,
    renderHero: renderHero,
    setExpression: setExpression,
    hasLine: hasLine
  };
})(window.JF = window.JF || {});
