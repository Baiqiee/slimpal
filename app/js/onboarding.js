/* 减肥姬 — 开头引导：小克一步步问你，问完算出每日热量上限 */
(function (JF) {
  'use strict';

  var U = JF.util;
  var S = JF.store;
  var el = U.el;

  // 引导分两个阶段：
  //   intro —— 小克居中淡入，一句一句介绍自己（每句换姿势）
  //   form  —— 介绍完，注册表单从下方顶上来，把她推上去，之后就是原来的问答流程
  var STEPS = ['name', 'birthday', 'gender', 'body', 'activity', 'goal', 'done'];
  var TOTAL = STEPS.length + 1;          // 加上开场介绍那一步
  var phase = 'intro';
  var introIdx = 0;
  var idx = 0;
  var root = null;
  var formAnimPending = false;   // 只在"介绍→问答"那一次转场播动画
  var draft = {
    name: '', birthday: '', gender: 'female',
    heightCm: '', weightKg: '', activity: 'light',
    targetWeightKg: '', speed: 'normal'
  };

  // 有表单的步骤，立绘缩一档，给输入框留地方
  var FORM_STEPS = { name: 1, birthday: 1, gender: 1, body: 1, activity: 1, goal: 1 };

  function introLines() {
    var c = JF.chloe.active();
    return (c.lines && c.lines.intro) || ['你好呀，我是小克。'];
  }
  function introPoses() {
    var c = JF.chloe.active();
    return (c.poses && c.poses.intro) || ['portrait'];
  }

  /** 当前显示的是第几步（开场介绍算第 1 步） */
  function stepNo() { return phase === 'intro' ? 1 : idx + 2; }

  /** 小克说一句：立绘 + 贴着她弹出的气泡（全 App 统一的说话方式） */
  function say(host, scene, extra) {
    var line = JF.chloe.pickLine(scene, Object.assign({ name: draft.name || '你' }, extra || {}), true);
    host.appendChild(JF.chloe.renderScene({
      text: line.text,
      pose: line.pose,
      className: 'scene-onboard' + (FORM_STEPS[STEPS[idx]] ? ' scene-sm' : '')
    }));
  }

  function paint() {
    U.clear(root);
    // 只有从"介绍"切到"问答"的那一次才播"表单顶上来"的动画，之后翻页不再播
    root.classList.toggle('anim-form', formAnimPending);
    formAnimPending = false;
    if (phase === 'intro') renderIntro(root);
    else renderInto(root);
  }
  function next() { idx++; paint(); }
  function back() { if (idx > 0) { idx--; paint(); } }

  // ---------- 阶段一：居中淡入的开场介绍 ----------
  function renderIntro(host) {
    var lines = introLines();
    var poses = introPoses();
    var last = introIdx >= lines.length - 1;

    var scene = JF.chloe.renderScene({
      text: JF.chloe.fill(lines[introIdx], { name: draft.name || '你' }),
      pose: poses[introIdx % poses.length],
      className: 'scene-intro scene-lg'
    });
    // 点她本人也能继续
    scene.classList.add('tappable');
    scene.addEventListener('click', advanceIntro);
    host.appendChild(scene);

    host.appendChild(el('div', { class: 'sheet-actions' }, [
      el('button', {
        class: 'btn primary', type: 'button', style: 'flex:2',
        onclick: advanceIntro
      }, [last ? '开始吧' : '继续'])
    ]));

    host.appendChild(el('div', { class: 'onboard-step', text: '第 1 / ' + TOTAL + ' 步' }));
  }

  function advanceIntro() {
    if (introIdx < introLines().length - 1) {
      introIdx++;
      paint();
    } else {
      phase = 'form';
      idx = 0;
      formAnimPending = true;   // 让表单播一次"从下方顶上来"
      paint();
    }
  }

  function navButtons(host, opts) {
    opts = opts || {};
    host.appendChild(el('div', { class: 'sheet-actions' }, [
      idx > 0 ? el('button', { class: 'btn ghost', type: 'button', onclick: back }, ['上一步']) : null,
      el('button', {
        class: 'btn primary', type: 'button', style: 'flex:2',
        disabled: !!opts.disabled,
        onclick: opts.onNext
      }, [opts.label || '下一步'])
    ].filter(Boolean)));
  }

  function renderInto(host) {
    var step = STEPS[idx];

    if (step === 'name') {
      say(host, 'askName');
      var nameI = U.el('input', { class: 'input', type: 'text', placeholder: '我的名字 / 昵称', maxlength: 20, value: draft.name });
      host.appendChild(JF.ui.field('', nameI));
      navButtons(host, {
        label: '就叫这个',
        onNext: function () {
          var v = nameI.value.trim();
          if (!v) { U.toast('写个名字吧'); nameI.focus(); return; }
          draft.name = v; next();
        }
      });
      setTimeout(function () { nameI.focus(); }, 150);

    } else if (step === 'birthday') {
      say(host, 'askBirthday');
      var bI = U.el('input', { class: 'input', type: 'date', value: draft.birthday });
      host.appendChild(JF.ui.field('生日（用来算年龄，也用来记住那天）', bI));
      navButtons(host, {
        label: '记住了',
        onNext: function () {
          if (!bI.value) { U.toast('选个日期吧'); return; }
          draft.birthday = bI.value; next();
        }
      });

    } else if (step === 'gender') {
      say(host, 'askGender');
      var row = el('div', { class: 'chips' });
      [['female', '女生'], ['male', '男生']].forEach(function (g) {
        var b = el('button', {
          class: 'chip' + (draft.gender === g[0] ? ' on' : ''), type: 'button',
          onclick: function () {
            draft.gender = g[0];
            U.$$('.chip', row).forEach(function (x) { x.classList.remove('on'); });
            b.classList.add('on');
          }
        }, [g[1]]);
        row.appendChild(b);
      });
      host.appendChild(JF.ui.field('性别（基础代谢公式要用）', row));
      navButtons(host, { label: '下一步', onNext: next });

    } else if (step === 'body') {
      say(host, 'askBody');
      var hI = U.el('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: '例如 168', value: draft.heightCm });
      var wI = U.el('input', { class: 'input', type: 'number', inputmode: 'decimal', step: '0.1', placeholder: '例如 68.5', value: draft.weightKg });
      host.appendChild(el('div', { class: 'input-row' }, [
        JF.ui.field('身高', el('div', { class: 'input-suffix' }, [hI, el('span', { text: '厘米' })])),
        JF.ui.field('现在体重', el('div', { class: 'input-suffix' }, [wI, el('span', { text: '公斤' })])),
      ]));
      host.appendChild(el('div', { class: 'small', text: '体重会自动变成「斤」显示。不习惯公斤的话：1 公斤 = 2 斤。' }));
      navButtons(host, {
        label: '下一步',
        onNext: function () {
          var h = Number(hI.value), w = Number(wI.value);
          if (!(h > 80 && h < 250)) { U.toast('身高填个正常数字'); hI.focus(); return; }
          if (!(w > 20 && w < 300)) { U.toast('体重填个正常数字'); wI.focus(); return; }
          draft.heightCm = h; draft.weightKg = w; next();
        }
      });

    } else if (step === 'activity') {
      say(host, 'askActivity');
      var col = el('div', { class: 'list' });
      Object.keys(JF.calc.ACTIVITY).forEach(function (k) {
        var a = JF.calc.ACTIVITY[k];
        var on = draft.activity === k;
        col.appendChild(el('button', {
          class: 'choice' + (on ? ' on' : ''), type: 'button',
          onclick: function () {
            draft.activity = k;
            U.$$('.choice', col).forEach(function (x) { x.classList.remove('on'); });
            U.$('.choice[data-k="' + k + '"]', col).classList.add('on');
          },
          dataset: { k: k }
        }, [
          el('div', { class: 'choice-main' }, [
            el('div', { class: 'choice-title', text: a.label }),
            el('div', { class: 'choice-sub', text: a.hint })
          ]),
          el('div', { class: 'choice-mark', text: on ? '✓' : '' })
        ]));
      });
      host.appendChild(col);
      navButtons(host, { label: '下一步', onNext: next });

    } else if (step === 'goal') {
      say(host, 'askGoal');
      var tI = U.el('input', { class: 'input', type: 'number', inputmode: 'decimal', step: '0.5', placeholder: '例如 60', value: draft.targetWeightKg });
      host.appendChild(JF.ui.field('目标体重', el('div', { class: 'input-suffix' }, [tI, el('span', { text: '公斤' })])));

      var speedRow = el('div', { class: 'list' });
      Object.keys(JF.calc.SPEED).forEach(function (k) {
        var sp = JF.calc.SPEED[k];
        var on = draft.speed === k;
        speedRow.appendChild(el('button', {
          class: 'choice' + (on ? ' on' : ''), type: 'button', dataset: { k: k },
          onclick: function () {
            draft.speed = k;
            U.$$('.choice', speedRow).forEach(function (x) { x.classList.remove('on'); });
            U.$('.choice[data-k="' + k + '"]', speedRow).classList.add('on');
            updatePreview();
          }
        }, [
          el('div', { class: 'choice-main' }, [
            el('div', { class: 'choice-title', text: sp.label }),
            el('div', { class: 'choice-sub', text: sp.hint })
          ])
        ]));
      });
      host.appendChild(JF.ui.field('减重速度', speedRow));

      var preview = el('div', { class: 'card plain tight' });
      host.appendChild(preview);

      function calcNow() {
        return JF.calc.dailyLimit({
          weightKg: Number(draft.weightKg), heightCm: Number(draft.heightCm),
          age: U.ageFrom(draft.birthday) || 30, gender: draft.gender,
          activity: draft.activity, speed: draft.speed
        });
      }
      function updatePreview() {
        U.clear(preview);
        var r = calcNow();
        preview.appendChild(el('div', { class: 'small', text: '基础代谢 ' + r.bmr + ' 千卡 · 每天大约消耗 ' + r.tdee + ' 千卡' }));
        preview.appendChild(el('div', { class: 'stat-v mt8' }, [String(r.limit), el('small', { text: '千卡 / 天' })]));
        preview.appendChild(el('div', { class: 'small', text: '这是建议的每日热量上限，之后随时能在设置里改。' }));
      }
      tI.addEventListener('input', updatePreview);
      updatePreview();

      navButtons(host, {
        label: '就这样',
        onNext: function () {
          var tv = Number(tI.value);
          if (!(tv > 20 && tv < 300)) { U.toast('目标填个正常数字'); tI.focus(); return; }
          if (tv >= Number(draft.weightKg)) { U.toast('目标要比现在轻才对呀'); tI.focus(); return; }
          draft.targetWeightKg = tv;

          S.setProfile({
            name: draft.name, birthday: draft.birthday, gender: draft.gender,
            heightCm: draft.heightCm, activity: draft.activity,
            startWeightKg: Number(draft.weightKg), targetWeightKg: tv,
            speed: draft.speed, createdAt: Date.now()
          });
          S.addWeight(Number(draft.weightKg));
          S.addAffection(10, 'onboard');
          next();
        }
      });

    } else if (step === 'done') {
      var p = S.profile() || {};
      say(host, 'onboardDone', { limit: p.dailyLimit });
      host.appendChild(el('div', { class: 'card plain tight' }, [
        el('div', { class: 'kv' }, [el('span', { text: '称呼' }), el('b', { text: p.name })]),
        el('div', { class: 'kv' }, [el('span', { text: '起点' }), el('b', { text: U.fmtJin(p.startWeightKg) + ' 斤' })]),
        el('div', { class: 'kv' }, [el('span', { text: '目标' }), el('b', { text: U.fmtJin(p.targetWeightKg) + ' 斤' })]),
        el('div', { class: 'kv' }, [el('span', { text: '每日热量上限' }), el('b', { text: p.dailyLimit + ' 千卡' })])
      ]));
      host.appendChild(el('div', { class: 'small center mt8', text: '正式开始你的减肥计划吧，不要半途而弃哦~' }));
      navButtons(host, {
        label: '开始吧',
        onNext: function () {
          if (JF.app && JF.app.afterOnboarding) JF.app.afterOnboarding();
        }
      });
    }

    host.appendChild(el('div', { class: 'onboard-step', text: '第 ' + stepNo() + ' / ' + TOTAL + ' 步' }));
  }

  function render(host) {
    phase = 'intro';
    introIdx = 0;
    idx = 0;
    formAnimPending = false;
    U.clear(host);
    // 内容包一层：靠 margin:auto 把剩余空间分给上下，实现上下居中。
    // 比在 .onboard 上写 justify-content:center 安全——内容比屏幕高时不会裁掉顶部。
    root = el('div', { class: 'onboard-inner' });
    host.appendChild(root);
    paint();
  }

  JF.onboarding = { render: render };
})(window.JF = window.JF || {});
