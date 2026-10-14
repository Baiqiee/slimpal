/* 减肥姬 —「吃」页：食物库（自己建的热量表） + 常吃（按你实际吃的次数自动排） */
(function (JF) {
  'use strict';

  var U = JF.util;
  var S = JF.store;
  var ui = JF.ui;
  var A = JF.actions;
  var el = U.el;

  var tab = 'frequent';   // frequent | library

  function frequentPanel(host, nav) {
    var list = S.frequentFoods(0);
    if (!list.length) {
      host.appendChild(ui.card({
        children: [ui.emptyState(JF.chloe.active().assets.chibi,
          '这里会自动出现你吃得最多的东西。先去「打卡」记几笔吧。')]
      }));
      return;
    }

    host.appendChild(el('div', { class: 'small mb8', text: '按你实际吃的次数排的，点「再来一份」就按上次的热量记上。' }));

    host.appendChild(el('div', { class: 'panel' }, [el('div', { class: 'list' }, list.map(function (f) {
      return el('div', { class: 'row' }, [
        el('div', { class: 'row-main' }, [
          el('div', { class: 'row-title' }, [
            f.starred ? el('span', { class: 'star', text: '★ ' }) : null,
            f.name
          ].filter(Boolean)),
          el('div', { class: 'row-sub', text: '吃过 ' + f.count + ' 次 · 上次 ' + f.lastKcal + ' 千卡' })
        ]),
        el('div', { class: 'row-actions' }, [
          el('button', {
            class: 'mini-btn' + (f.starred ? ' star-on' : ''), type: 'button',
            title: f.starred ? '取消置顶' : '置顶',
            onclick: function () { S.toggleStar(f.name); nav.refresh(); }
          }, ['★']),
          el('button', {
            class: 'mini-btn', type: 'button', title: '改热量',
            onclick: function () {
              var input = ui.input({ type: 'number', value: f.lastKcal });
              ui.sheet({
                title: '「' + f.name + '」记多少千卡',
                children: [
                  ui.field('热量', el('div', { class: 'input-suffix' }, [input, el('span', { text: '千卡' })])),
                  el('div', { class: 'small', text: '只改这一次记录，不改历史。' })
                ],
                actions: [
                  el('button', { class: 'btn ghost', type: 'button', onclick: ui.closeSheet }, ['取消']),
                  el('button', {
                    class: 'btn primary', type: 'button',
                    onclick: function () {
                      var kcal = Number(input.value);
                      if (!(kcal >= 0)) { U.toast('填个数字'); return; }
                      ui.closeSheet();
                      S.addMeal({ name: f.name, kcal: kcal });
                      A.react('mealLogged');
                      nav.refresh();
                    }
                  }, ['记上'])
                ]
              });
            }
          }, ['改']),
          el('button', {
            class: 'mini-btn primary', type: 'button',
            onclick: function () { A.quickLog(f, nav.refresh); }
          }, ['再来一份'])
        ])
      ]);
    }))]));
  }

  function libraryPanel(host, nav) {
    var foods = S.foodsSorted();
    host.appendChild(el('div', { class: 'small mb8', text: '这是你自己的热量字典：常用的东西建一次，以后记账点一下就填好。' }));

    if (!foods.length) {
      host.appendChild(ui.card({
        children: [ui.emptyState(JF.chloe.active().assets.chibi, '食物库还是空的，建几个你常吃的东西吧。')]
      }));
    } else {
      host.appendChild(el('div', { class: 'panel' }, [el('div', { class: 'list' }, foods.map(function (f) {
        return el('div', { class: 'row' }, [
          el('div', { class: 'row-main' }, [
            el('div', { class: 'row-title', text: f.name }),
            el('div', { class: 'row-sub', text: f.portion + ' · ' + f.kcal + ' 千卡' })
          ]),
          el('div', { class: 'row-actions' }, [
            el('button', {
              class: 'mini-btn primary', type: 'button',
              onclick: function () {
                S.addMeal({ name: f.name, kcal: f.kcal });
                A.react('mealLogged');
                nav.refresh();
              }
            }, ['记上']),
            el('button', {
              class: 'mini-btn', type: 'button',
              onclick: function () { A.foodEditSheet(f, nav.refresh); }
            }, ['编辑'])
          ])
        ]);
      }))]));
    }

    host.appendChild(el('button', {
      class: 'btn primary block mt12', type: 'button',
      onclick: function () { A.foodEditSheet(null, nav.refresh); }
    }, ['＋ 新建食物']));
  }

  function render(host, nav) {
    U.clear(host);

    host.appendChild(el('div', { class: 'seg' }, [
      el('button', {
        class: tab === 'frequent' ? 'on' : '', type: 'button',
        onclick: function () { tab = 'frequent'; nav.refresh(); }
      }, ['常吃']),
      el('button', {
        class: tab === 'library' ? 'on' : '', type: 'button',
        onclick: function () { tab = 'library'; nav.refresh(); }
      }, ['食物库'])
    ]));

    if (tab === 'frequent') frequentPanel(host, nav);
    else libraryPanel(host, nav);
  }

  JF.pages = JF.pages || {};
  JF.pages.food = { render: render };
})(window.JF = window.JF || {});
