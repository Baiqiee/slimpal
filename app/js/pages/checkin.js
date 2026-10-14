/* 减肥姬 — 打卡页：今天吃了什么（不设固定餐次，吃一餐加一条） */
(function (JF) {
  'use strict';

  var U = JF.util;
  var S = JF.store;
  var ui = JF.ui;
  var A = JF.actions;
  var el = U.el;

  var viewedKey = null;   // 正在查看哪一天；null = 今天

  function render(host, nav) {
    U.clear(host);
    var today = U.todayKey();
    var key = viewedKey || today;
    var isToday = key === today;
    var meals = S.todayMeals(key);
    var used = S.kcalOn(key);
    var p = S.profile() || {};
    var limit = p.dailyLimit || 0;
    var over = limit > 0 && used > limit;

    // ---- 日期切换 ----
    var canForward = key < today;
    host.appendChild(el('div', { class: 'day-nav' }, [
      el('button', {
        class: 'icon-btn', type: 'button', title: '前一天',
        onclick: function () { viewedKey = U.dateKey(U.addDays(U.parseKey(key), -1)); nav.refresh(); }
      }, ['‹']),
      el('div', { class: 'day-nav-label' }, [
        el('div', { class: 'day-nav-main', text: isToday ? '今天' : U.prettyDate(key) }),
        el('div', { class: 'day-nav-sub', text: isToday ? U.prettyDate(key) : '' })
      ]),
      el('button', {
        class: 'icon-btn' + (canForward ? '' : ' off'), type: 'button', title: '后一天',
        disabled: !canForward,
        onclick: function () {
          if (!canForward) return;
          var nk = U.dateKey(U.addDays(U.parseKey(key), 1));
          viewedKey = nk === today ? null : nk;
          nav.refresh();
        }
      }, ['›'])
    ]));

    // ---- 合计 ----
    host.appendChild(ui.card({
      className: 'tight',
      children: [
        el('div', { class: 'bar-row' }, [
          el('div', { class: 'bar-label', text: isToday ? '今天一共吃了' : '这天一共吃了' }),
          el('div', { class: 'bar-value' }, [
            String(used),
            el('small', { class: 'small', text: limit ? (' / ' + limit + ' 千卡') : ' 千卡' })
          ])
        ]),
        el('div', { class: 'bar' + (over ? ' amber' : '') }, [
          el('i', { style: 'width:' + (limit ? U.clamp(used / limit, 0, 1) * 100 : 0).toFixed(1) + '%' })
        ]),
        el('div', { class: 'bar-row mt8' }, [
          el('div', { class: 'bar-label', text: meals.length + ' 笔记录' }),
          el('div', {
            class: 'bar-label',
            text: limit ? (over ? ('超出 ' + (used - limit) + ' 千卡') : ('还可以吃 ' + (limit - used) + ' 千卡')) : ''
          })
        ])
      ]
    }));

    // ---- 记一笔按钮 ----
    if (isToday) {
      host.appendChild(el('button', {
        class: 'btn primary block mb8', type: 'button',
        onclick: function () { A.addMealSheet(nav.refresh); }
      }, ['＋ 记一笔（吃了什么）']));
    } else {
      host.appendChild(el('div', { class: 'small center mb8', text: '过去的记录只能查看，不能补记' }));
    }

    // ---- 明细 ----
    if (!meals.length) {
      host.appendChild(ui.card({
        children: [ui.emptyState(JF.chloe.active().assets.chibi,
          isToday ? '今天还没记东西。每吃一餐就加一条，不用管是早餐还是夜宵。' : '这天没有记录')]
      }));
      return;
    }

    host.appendChild(el('div', { class: 'list meal-list' }, meals.map(function (m) {
      return el('div', { class: 'row meal-row' }, [
        el('div', { class: 'meal-time', text: m.time }),
        el('div', { class: 'row-main' }, [
          el('div', { class: 'row-title', text: m.name })
        ]),
        el('div', { class: 'row-kcal', text: m.kcal + ' 千卡' }),
        isToday ? el('button', {
          class: 'mini-btn danger', type: 'button',
          onclick: function () {
            ui.confirm({ title: '删掉这条？', text: m.name + ' · ' + m.kcal + ' 千卡', ok: '删除', danger: true })
              .then(function (yes) { if (yes) { S.removeMeal(m.id); nav.refresh(); } });
          }
        }, ['删']) : null
      ].filter(Boolean));
    })));

    if (isToday && meals.length >= 2) {
      var avg = Math.round(used / meals.length);
      host.appendChild(el('div', { class: 'small center mt12', text: '平均每笔 ' + avg + ' 千卡' }));
    }
  }

  JF.pages = JF.pages || {};
  JF.pages.checkin = {
    render: render,
    reset: function () { viewedKey = null; }
  };
})(window.JF = window.JF || {});
