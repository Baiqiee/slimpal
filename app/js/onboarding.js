/* 减肥姬 — 开头引导：小克一步步问你，问完算出每日热量上限 */
(function (JF) {
  'use strict';

  var U = JF.util;
  var S = JF.store;
  var el = U.el;

  var STEPS = ['welcome', 'name', 'birthday', 'gender', 'body', 'activity', 'goal', 'done'];
  var idx = 0;
  var draft = {
    name: '', birthday: '', gender: 'female',
    heightCm: '', weightKg: '', activity: 'light',
    targetWeightKg: '', speed: 'normal'
  };

  function say(host, scene, extra) {
    var c = JF.chloe.active();
    var text = JF.chloe.pick(scene, Object.assign({ name: draft.name || '你' }, extra || {}), true);
    host.appendChild(el('div', { class: 'onboard-say' }, [
      el('img', {
        class: 'onboard-face',
        src: JF.chloe.facePath(scene === 'askActivity' ? 'cheer' : (scene === 'onboardDone' ? 'laugh' : 'calm')),
        alt: ''
      }),
      el('div', { class: 'speech' }, [
        el('div', { class: 'speech-name', text: c.name }),
        el('div', { class: 'speech-text', text: text })
      ])
    ]));
  }

  function next(host) { idx++; renderInto(host); }
  function back(host) { if (idx > 0) { idx--; renderInto(host); } }

  function navButtons(host, opts) {
    opts = opts || {};
    host.appendChild(el('div', { class: 'sheet-actions' }, [
      idx > 1 ? el('button', { class: 'btn ghost', type: 'button', onclick: function () { back(host); } }, ['上一步']) : null,
      el('button', {
        class: 'btn primary', type: 'button', style: 'flex:2',
        disabled: !!opts.disabled,
        onclick: opts.onNext
      }, [opts.label || '下一步'])
    ].filter(Boolean)));
  }

  function renderInto(host) {
    U.clear(host);
    var step = STEPS[idx];
    var c = JF.chloe.active();

    host.appendChild(el('div', { class: 'onboard-top' }, [
      el('img', { src: idx <= 1 ? c.assets.portrait : c.assets.chibi, alt: c.name })
    ]));

    if (step === 'welcome') {
      say(host, 'firstMeet');
      navButtons(host, { label: '开始', onNext: function () { next(host); } });

    } else if (step === 'name') {
      say(host, 'askName');
      var nameI = U.el('input', { class: 'input', type: 'text', placeholder: '我的名字 / 昵称', maxlength: 20, value: draft.name });
      host.appendChild(JF.ui.field('', nameI));
      navButtons(host, {
        label: '就叫这个',
        onNext: function () {
          var v = nameI.value.trim();
          if (!v) { U.toast('写个名字吧'); nameI.focus(); return; }
          draft.name = v; next(host);
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
          draft.birthday = bI.value; next(host);
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
      navButtons(host, { label: '下一步', onNext: function () { next(host); } });

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
          draft.heightCm = h; draft.weightKg = w; next(host);
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
      navButtons(host, { label: '下一步', onNext: function () { next(host); } });

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
          next(host);
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
      host.appendChild(el('div', { class: 'small center mt8', text: '每减掉目标的十分之一，我都会来恭喜你一次。' }));
      navButtons(host, {
        label: '开始吧',
        onNext: function () {
          if (JF.app && JF.app.afterOnboarding) JF.app.afterOnboarding();
        }
      });
    }

    host.appendChild(el('div', { class: 'onboard-step', text: '第 ' + Math.min(idx + 1, STEPS.length) + ' / ' + STEPS.length + ' 步' }));
  }

  function render(host) {
    idx = 0;
    U.clear(host);
    // 内容包一层：靠 margin:auto 把剩余空间分给上下，实现上下居中。
    // 比在 .onboard 上写 justify-content:center 安全——内容比屏幕高时不会裁掉顶部。
    var inner = el('div', { class: 'onboard-inner' });
    host.appendChild(inner);
    renderInto(inner);
  }

  JF.onboarding = { render: render };
})(window.JF = window.JF || {});
