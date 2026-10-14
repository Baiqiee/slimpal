/* 减肥姬 — 首页：小克 + 今天没做的事 + 各模块摘要 */
(function (JF) {
  'use strict';

  var U = JF.util;
  var S = JF.store;
  var ui = JF.ui;
  var A = JF.actions;
  var el = U.el;
  var NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function ring(used, limit) {
    var R = 50, C = 2 * Math.PI * R;
    var ratio = limit > 0 ? U.clamp(used / limit, 0, 1) : 0;
    var over = limit > 0 && used > limit;
    var svg = svgEl('svg', { width: 116, height: 116, viewBox: '0 0 116 116' });
    svg.appendChild(svgEl('circle', { cx: 58, cy: 58, r: R, fill: 'none', stroke: '#FCE4EB', 'stroke-width': 10 }));
    svg.appendChild(svgEl('circle', {
      cx: 58, cy: 58, r: R, fill: 'none',
      stroke: over ? '#E9A0A8' : '#EF8FAB',
      'stroke-width': 10, 'stroke-linecap': 'round',
      'stroke-dasharray': C,
      'stroke-dashoffset': C * (1 - ratio),
      style: 'transition: stroke-dashoffset .5s ease'
    }));
    var remain = Math.max(0, limit - used);
    return el('div', { class: 'ring' }, [
      svg,
      el('div', { class: 'ring-center' }, [
        el('div', { class: 'ring-num', text: over ? '+' + (used - limit) : String(remain) }),
        el('div', { class: 'ring-unit', text: over ? '超出千卡' : '还能吃千卡' })
      ])
    ]);
  }

  function kcalCard() {
    var p = S.profile() || {};
    var limit = p.dailyLimit || 0;
    var used = S.kcalOn(U.todayKey());
    var meals = S.todayMeals();
    var over = limit > 0 && used > limit;
    return ui.card({
      title: '今天的热量',
      hint: limit ? ('上限 ' + limit + ' 千卡') : '',
      children: [
        el('div', { class: 'ring-wrap' }, [
          ring(used, limit),
          el('div', { class: 'ring-side' }, [
            el('div', { class: 'k', text: '已经吃了' }),
            el('div', { class: 'v' }, [String(used), el('small', { text: ' 千卡' })]),
            el('div', { class: 'k', text: '记录笔数' }),
            el('div', { class: 'v' + (over ? ' danger' : ' mint'), text: meals.length + ' 笔' })
          ])
        ])
      ]
    });
  }

  function goalCard() {
    var p = S.profile() || {};
    var cur = S.currentWeightKg();
    var start = p.startWeightKg, target = p.targetWeightKg;
    if (cur === null || start === null || target === null) {
      return ui.card({ title: '目标', children: [el('div', { class: 'small', text: '还没有设定目标' })] });
    }
    var progress = JF.calc.goalProgress(start, target, cur);
    var lost = Math.max(0, start - cur);
    var togo = Math.max(0, cur - target);
    var days = JF.calc.daysToGoal(cur, target, p.speed);
    return ui.card({
      title: '目标进度',
      hint: U.fmtJin(start - target) + ' 斤',
      children: [
        el('div', { class: 'bar-row' }, [
          el('div', { class: 'bar-label', text: '已经减了' }),
          el('div', { class: 'bar-value', text: U.fmtJin(lost) + ' 斤' })
        ]),
        el('div', { class: 'bar' }, [el('i', { style: 'width:' + (progress * 100).toFixed(1) + '%' })]),
        el('div', { class: 'bar-row mt8' }, [
          el('div', { class: 'bar-label', text: '当前 ' + U.fmtJin(cur) + ' 斤' }),
          el('div', { class: 'bar-label', text: togo > 0 ? ('还差 ' + U.fmtJin(togo) + ' 斤') : '已达成 🎉' })
        ]),
        days !== null && togo > 0
          ? el('div', { class: 'small mt8', text: '按现在的速度，大约还要 ' + days + ' 天' })
          : null
      ].filter(Boolean)
    });
  }

  function todoCard(nav) {
    var today = U.todayKey();
    var items = [];

    var meals = S.todayMeals(today);
    items.push({
      done: meals.length > 0,
      text: meals.length > 0 ? ('今天已经记了 ' + meals.length + ' 笔') : '记一笔今天吃了什么',
      go: '去记',
      act: function () { A.addMealSheet(nav.refresh); }
    });

    var w = S.weightOn(today);
    items.push({
      done: !!w,
      text: w ? ('今天体重 ' + U.fmtJin(w.kg) + ' 斤') : '今天还没称体重',
      go: '去称',
      act: function () { A.weighSheet(nav.refresh); }
    });

    var d = S.diaryOn(today);
    var wrote = d && (d.text || '').trim();
    items.push({
      done: !!wrote,
      text: wrote ? '今天的日记写好了' : '今天还没写日记',
      go: '去写',
      act: function () { nav.go('diary'); }
    });

    var remain = items.filter(function (i) { return !i.done; }).length;
    return ui.card({
      title: '今天还没做的事',
      hint: remain ? ('还剩 ' + remain + ' 件') : '全部完成 ✓',
      children: items.map(function (it) {
        return el('div', { class: 'todo' + (it.done ? ' done' : '') }, [
          el('div', { class: 'todo-dot', text: it.done ? '✓' : '·' }),
          el('div', { class: 'todo-text', text: it.text }),
          it.done ? null : el('button', { class: 'mini-btn primary', type: 'button', onclick: it.act }, [it.go])
        ].filter(Boolean));
      })
    });
  }

  function todayListCard(nav) {
    var meals = S.todayMeals();
    var children;
    if (!meals.length) {
      children = [ui.emptyState(JF.chloe.active().assets.chibi, '今天还没记东西，吃一餐就加一条吧')];
    } else {
      children = [el('div', { class: 'list' }, meals.map(function (m) {
        return el('div', { class: 'row' }, [
          el('div', { class: 'row-main' }, [
            el('div', { class: 'row-title', text: m.name }),
            el('div', { class: 'row-sub', text: m.time })
          ]),
          el('div', { class: 'row-kcal', text: m.kcal + ' 千卡' }),
          el('button', {
            class: 'mini-btn danger', type: 'button', title: '删除',
            onclick: function () {
              ui.confirm({ title: '删掉这条？', text: m.name + ' · ' + m.kcal + ' 千卡', ok: '删除', danger: true })
                .then(function (yes) { if (yes) { S.removeMeal(m.id); nav.refresh(); } });
            }
          }, ['删'])
        ]);
      }))];
    }
    return ui.card({
      title: '今天吃了什么',
      hint: S.todayMeals().length + ' 笔',
      action: ui.linkBtn('查看全部', function () { nav.go('checkin'); }),
      children: children
    });
  }

  function render(host, nav) {
    U.clear(host);
    host.appendChild(JF.chloe.renderHero({}));

    host.appendChild(el('div', { class: 'quick-row' }, [
      el('button', { class: 'quick', type: 'button', onclick: function () { A.weighSheet(nav.refresh); } }, [
        el('div', { class: 'quick-glyph mint' }, ['⚖️']),
        el('div', { class: 'quick-body' }, [
          el('div', { class: 'quick-label', text: '称体重' }),
          el('div', {
            class: 'quick-value',
            text: (function () {
              var w = S.weightOn(U.todayKey());
              if (w) return U.fmtJin(w.kg) + ' 斤';
              var l = S.latestWeight();
              return l ? U.fmtJin(l.kg) + ' 斤' : '还没记';
            })()
          })
        ])
      ]),
      el('button', { class: 'quick', type: 'button', onclick: function () { A.addMealSheet(nav.refresh); } }, [
        el('div', { class: 'quick-glyph amber' }, ['🍚']),
        el('div', { class: 'quick-body' }, [
          el('div', { class: 'quick-label', text: '记一餐' }),
          el('div', { class: 'quick-value', text: '吃了什么' })
        ])
      ]),
      el('button', { class: 'quick', type: 'button', onclick: function () { nav.go('diary'); } }, [
        el('div', { class: 'quick-glyph' }, ['🔥']),
        el('div', { class: 'quick-body' }, [
          el('div', { class: 'quick-label', text: '连续记录' }),
          el('div', { class: 'quick-value', text: S.streak() + ' 天' })
        ])
      ])
    ]));

    host.appendChild(kcalCard());
    host.appendChild(goalCard());
    host.appendChild(todoCard(nav));
    host.appendChild(todayListCard(nav));
  }

  JF.pages = JF.pages || {};
  JF.pages.home = { render: render };
})(window.JF = window.JF || {});
