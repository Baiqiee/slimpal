/* 减肥姬 — 应用外壳：路由、底部导航、启动流程 */
(function (JF) {
  'use strict';

  var U = JF.util;
  var S = JF.store;
  var ui = JF.ui;
  var el = U.el;

  // 底部导航的图标：手写 SVG，不用 emoji。
  // 原因有两个：
  //   1. emoji 在 Windows 和安卓上长得完全不一样，四个里只要混进一个
  //      单色文字符号（原来的「✎」）就会显得格格不入；
  //   2. emoji 的颜色固定，没法跟着选中态变色。
  // 统一成 currentColor 描边的线性图标后，四个风格一致，选中时一起变粉。
  var NAV_ICONS = {
    // 碗 + 热气
    food: [
      'M3.6 11.6h16.8a8.4 8.4 0 0 1-8.4 8.4 8.4 8.4 0 0 1-8.4-8.4z',
      'M9.3 8.8c0-1.6 1.3-2.1 1.3-3.6',
      'M13.8 8.8c0-1.6 1.3-2.1 1.3-3.6'
    ],
    // 圆圈 + 勾
    checkin: [
      'M20.4 12a8.4 8.4 0 1 1-16.8 0 8.4 8.4 0 0 1 16.8 0z',
      'M8.4 12.2l2.7 2.7 5.2-6'
    ],
    // 本子
    diary: [
      'M6.4 3.8h10.8a1.8 1.8 0 0 1 1.8 1.8v12.8a1.8 1.8 0 0 1-1.8 1.8H6.4',
      'M6.4 3.8A1.8 1.8 0 0 0 4.6 5.6v12.8a1.8 1.8 0 0 0 1.8 1.8',
      'M9.4 8.7h6',
      'M9.4 12.3h4.1'
    ],
    // 柱状图
    stats: [
      'M5 20.2v-6.4',
      'M12 20.2V5.2',
      'M19 20.2v-9.4',
      'M3.2 20.2h17.6'
    ]
  };

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function navIcon(kind) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '23');
    svg.setAttribute('height', '23');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.9');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    (NAV_ICONS[kind] || []).forEach(function (d) {
      var p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    });
    return svg;
  }

  var TABS = [
    { id: 'food',    page: 'food',    label: '吃',   icon: 'food' },
    { id: 'checkin', page: 'checkin', label: '打卡', icon: 'checkin' },
    { id: 'home',    page: 'home',    label: '首页', center: true },
    { id: 'diary',   page: 'diary',   label: '日记', icon: 'diary' },
    { id: 'stats',   page: 'stats',   label: '数据', icon: 'stats' }
  ];

  var current = 'home';
  var host = null;
  var viewEl = null;
  var tabEl = null;

  function renderTabs() {
    U.clear(tabEl);
    TABS.forEach(function (t) {
      var on = t.id === current;
      var glyph;
      if (t.center) {
        // 中间那个钮放她的脸部特写（不是 Q 版），占满整个圆
        glyph = el('div', { class: 'tab-glyph' }, [
          el('img', { class: 'tab-face', src: JF.chloe.active().assets.navFace, alt: t.label })
        ]);
      } else {
        glyph = el('div', { class: 'tab-glyph' }, [navIcon(t.icon)]);
      }
      tabEl.appendChild(el('button', {
        class: 'tab' + (t.center ? ' center' : '') + (on ? ' on' : ''),
        type: 'button',
        onclick: function () { go(t.id); }
      }, [glyph, el('div', { class: 'tab-label', text: t.label })]));
    });
  }

  function renderView() {
    var page = (TABS.filter(function (t) { return t.id === current; })[0] || TABS[2]).page;
    var mod = JF.pages[page];
    viewEl.scrollTop = 0;
    if (!mod) { U.clear(viewEl).appendChild(el('div', { class: 'empty', text: '页面还没做好' })); return; }
    mod.render(viewEl, nav);
  }

  function go(id) {
    if (id === current) { renderView(); return; }
    current = id;
    renderTabs();
    renderView();
  }

  var nav = {
    go: go,
    refresh: function () { renderTabs(); renderView(); },
    current: function () { return current; }
  };

  function topbar() {
    var p = S.profile() || {};
    // 左上角显示的是「角色名」，不是 App 名（App 名是"减肥姬"，在关于里看）
    var left = el('div', {}, [
      el('div', { class: 'topbar-title', text: JF.chloe.active().name }),
      el('div', { class: 'topbar-sub', text: U.greeting() + (p.name ? ('，' + p.name) : '') })
    ]);
    return el('div', { class: 'topbar' }, [
      left,
      el('div', { class: 'topbar-spacer' }),
      el('button', {
        class: 'icon-btn', type: 'button', title: '设置',
        onclick: function () { openSettings(); }
      }, ['⚙'])
    ]);
  }

  /** 设置做成整屏浮层，这样不用为它单开一个导航标签 */
  function openSettings() {
    var layer = el('div', { class: 'onboard' });
    var inner = el('div', {});
    layer.appendChild(el('div', { class: 'topbar' }, [
      el('button', {
        class: 'icon-btn', type: 'button', title: '返回',
        onclick: function () { document.getElementById('app').removeChild(layer); }
      }, ['‹']),
      el('div', { class: 'topbar-title', text: '设置' }),
      el('div', { class: 'topbar-spacer' })
    ]));
    layer.appendChild(inner);
    document.getElementById('app').appendChild(layer);
    JF.pages.settings.render(inner, { go: function () {}, refresh: function () {
      JF.pages.settings.render(inner, { go: function () {}, refresh: function () {} });
    } });
  }

  function buildShell() {
    var app = document.getElementById('app');
    U.clear(app);
    viewEl = el('main', { class: 'view' });
    tabEl = el('nav', { class: 'tabbar' });
    app.appendChild(topbar());
    app.appendChild(viewEl);
    app.appendChild(tabEl);
    renderTabs();
    renderView();
  }

  function showOnboarding() {
    var app = document.getElementById('app');
    U.clear(app);
    var layer = el('div', { class: 'onboard' });
    app.appendChild(layer);
    JF.onboarding.render(layer);
  }

  /** 启动后该主动弹出来的东西：生日祝福、里程碑祝贺 */
  function bootSpecials() {
    var p = S.profile();
    if (!p) return;
    setTimeout(function () {
      if (U.isBirthdayToday(p.birthday)) {
        var done = S.state().flags.birthdayWished.some(function (y) {
          return String(y) === String(new Date().getFullYear());
        });
        if (!done) {
          var text = JF.chloe.pick('birthday', { name: p.name }, true);
          // 和里程碑用同一套「小克居中淡入」的庆祝样式
          JF.actions.celebrate({
            text: text,
            pose: 'alt',
            note: '生日快乐，' + p.name,
            button: '谢谢你，小克',
            onClose: function () { S.markBirthdayWished(new Date().getFullYear()); }
          });
          return;
        }
      }
      JF.actions.checkMilestone();
    }, 700);
  }

  function startTimers() {
    JF.notify.sync();
    setInterval(function () { JF.notify.tick(); }, 60000);
    setTimeout(function () { JF.notify.tick(); }, 5000);

    // 从后台切回前台时重新排定一次（手机上很常见：放口袋里待一天）
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        JF.notify.sync();
        if (S.profile()) { renderTabs(); renderView(); }
      }
    });
  }

  function boot() {
    JF.native = window.slimpalNative || null;
    JF.store.load();
    if (!S.profile()) {
      showOnboarding();
    } else {
      buildShell();
      bootSpecials();
    }
    startTimers();
    JF.store.subscribe(function () { /* 页面各自刷新，这里只做兜底 */ });
  }

  JF.app = {
    boot: boot,
    go: go,
    nav: nav,
    afterOnboarding: function () {
      buildShell();
      current = 'home';
      go('home');
      bootSpecials();
      JF.notify.sync();
    },
    restart: function () { boot(); },
    openSettings: openSettings
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.JF = window.JF || {});
