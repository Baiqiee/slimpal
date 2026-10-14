/* 减肥姬 — 数据与回顾：体重曲线、热量柱状图、阶段统计 */
(function (JF) {
  'use strict';

  var U = JF.util;
  var S = JF.store;
  var ui = JF.ui;
  var el = U.el;

  var range = 30;   // 7 | 30 | 0(全部)

  function sinceKey(days) {
    if (!days) return null;
    return U.dateKey(U.addDays(new Date(), -(days - 1)));
  }

  function weightSeries(days) {
    var from = sinceKey(days);
    return S.weightsSorted()
      .filter(function (w) { return !from || w.date >= from; })
      .map(function (w) { return { key: w.date, value: U.round1(U.kgToJin(w.kg)) }; });
  }

  function kcalSeries(days) {
    var out = [];
    var limit = (S.profile() || {}).dailyLimit || 0;
    if (days) {
      for (var i = days - 1; i >= 0; i--) {
        var k = U.dateKey(U.addDays(new Date(), -i));
        var v = S.kcalOn(k);
        out.push({ key: k, value: v, over: limit > 0 && v > limit });
      }
    } else {
      var dates = {};
      S.state().meals.forEach(function (m) { dates[m.date] = 1; });
      Object.keys(dates).sort().forEach(function (k) {
        var v = S.kcalOn(k);
        out.push({ key: k, value: v, over: limit > 0 && v > limit });
      });
    }
    return out;
  }

  function statsBlock(days) {
    var p = S.profile() || {};
    var from = sinceKey(days);

    var mealsInRange = S.state().meals.filter(function (m) { return !from || m.date >= from; });
    var daySet = {};
    mealsInRange.forEach(function (m) { daySet[m.date] = 1; });
    var loggedDays = Object.keys(daySet).length;
    var totalKcal = mealsInRange.reduce(function (s, m) { return s + (Number(m.kcal) || 0); }, 0);
    var avg = loggedDays ? Math.round(totalKcal / loggedDays) : 0;

    var ws = weightSeries(days);
    var change = ws.length >= 2 ? U.round1(ws[ws.length - 1].value - ws[0].value) : null;

    var cur = S.currentWeightKg();
    var togo = (cur !== null && p.targetWeightKg !== null) ? U.round1(U.kgToJin(cur - p.targetWeightKg)) : null;

    var cells = [
      { k: '平均每天摄入', v: avg || '—', u: '千卡' },
      { k: '有记录的天数', v: loggedDays, u: '天' },
      { k: days ? '体重变化' : '累计体重变化', v: change === null ? '—' : (change > 0 ? '+' + change : String(change)), u: '斤' },
      { k: '距目标还差', v: togo === null ? '—' : (togo > 0 ? togo : 0), u: '斤' }
    ];

    return el('div', { class: 'stat-grid' }, cells.map(function (c) {
      return el('div', { class: 'stat' }, [
        el('div', { class: 'stat-k', text: c.k }),
        el('div', { class: 'stat-v' }, [String(c.v), el('small', { text: c.u })])
      ]);
    }));
  }

  function render(host, nav) {
    U.clear(host);
    var p = S.profile() || {};

    host.appendChild(el('div', { class: 'seg' }, [
      el('button', { class: range === 7 ? 'on' : '', type: 'button', onclick: function () { range = 7; nav.refresh(); } }, ['近 7 天']),
      el('button', { class: range === 30 ? 'on' : '', type: 'button', onclick: function () { range = 30; nav.refresh(); } }, ['近 30 天']),
      el('button', { class: range === 0 ? 'on' : '', type: 'button', onclick: function () { range = 0; nav.refresh(); } }, ['全部'])
    ]));

    // ---- 体重 ----
    var ws = weightSeries(range);
    var targetJin = (p.targetWeightKg !== null && p.targetWeightKg !== undefined) ? U.round1(U.kgToJin(p.targetWeightKg)) : null;
    host.appendChild(ui.card({
      title: '体重曲线',
      hint: '单位：斤',
      children: [
        ws.length >= 1
          ? JF.charts.line(ws, { target: targetJin })
          : el('div', { class: 'chart-empty', text: '还没称过体重，去首页称一下吧' }),
        targetJin !== null ? el('div', { class: 'small center', text: '绿色虚线 = 目标 ' + targetJin + ' 斤' }) : null
      ].filter(Boolean)
    }));

    // ---- 热量 ----
    var ks = kcalSeries(range);
    var hasData = ks.some(function (i) { return i.value > 0; });
    host.appendChild(ui.card({
      title: '每天吃进去的热量',
      hint: '单位：千卡',
      children: [
        hasData ? JF.charts.bars(ks, { limit: p.dailyLimit }) : el('div', { class: 'chart-empty', text: '还没有饮食记录' }),
        p.dailyLimit ? el('div', { class: 'small center', text: '橙色虚线 = 上限 ' + p.dailyLimit + ' 千卡' }) : null
      ].filter(Boolean)
    }));

    // ---- 统计 ----
    host.appendChild(ui.card({
      title: range === 0 ? '全部统计' : ('近 ' + range + ' 天'),
      children: [statsBlock(range)]
    }));

    // ---- 目标 ----
    if (p.targetWeightKg !== null && p.targetWeightKg !== undefined && p.startWeightKg) {
      var cur = S.currentWeightKg();
      var prog = JF.calc.goalProgress(p.startWeightKg, p.targetWeightKg, cur);
      var days = JF.calc.daysToGoal(cur, p.targetWeightKg, p.speed);
      host.appendChild(ui.card({
        title: '目标',
        children: [
          el('div', { class: 'bar-row' }, [
            el('div', { class: 'bar-label', text: '起点 ' + U.fmtJin(p.startWeightKg) + ' 斤' }),
            el('div', { class: 'bar-value', text: (prog * 100).toFixed(0) + '%' })
          ]),
          el('div', { class: 'bar mint' }, [el('i', { style: 'width:' + (prog * 100).toFixed(1) + '%' })]),
          el('div', { class: 'bar-row mt8' }, [
            el('div', { class: 'bar-label', text: '现在 ' + (cur !== null ? U.fmtJin(cur) + ' 斤' : '—') }),
            el('div', { class: 'bar-label', text: '目标 ' + U.fmtJin(p.targetWeightKg) + ' 斤' })
          ]),
          el('div', { class: 'small mt8', text: [
            '减重速度：' + (JF.calc.SPEED[p.speed] || JF.calc.SPEED.normal).label,
            '每日上限：' + (p.dailyLimit || '—') + ' 千卡',
            days !== null && days > 0 ? ('按当前速度还需 ' + days + ' 天') : null
          ].filter(Boolean).join(' · ') })
        ]
      }));
    }
  }

  JF.pages = JF.pages || {};
  JF.pages.stats = { render: render };
})(window.JF = window.JF || {});
