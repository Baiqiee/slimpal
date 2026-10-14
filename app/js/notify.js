/* 减肥姬 — 提醒
 *
 * 规则：只要「最近一次记录饮食」或「上次提醒」超过 23 小时，就该提醒一次；
 * 提醒后计时重新开始，所以最多一天一次。
 * 落在免打扰时段（默认 22:00–08:00）内的提醒顺延到时段结束后。
 *
 * 三种落地方式，按环境自动挑：
 *   安卓   用系统级本地通知（App 关着也会响）
 *   桌面   程序常驻托盘，用定时器到点就弹系统通知
 *   浏览器 用通知 API，没授权就退回应用内提示条
 */
(function (JF) {
  'use strict';

  var U = JF.util;
  var S = JF.store;
  var THRESHOLD_MS = 23 * 3600 * 1000;

  function capPlugin() {
    try {
      return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null;
    } catch (e) { return null; }
  }

  function native() { return window.jianfeijiNative || null; }

  function minutesOf(hhmm) {
    var p = String(hhmm || '0:0').split(':');
    return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0);
  }

  function atMinutes(date, mins) {
    var d = new Date(date.getTime());
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    return d;
  }

  /** 把时间点推出免打扰时段 */
  function avoidQuiet(d) {
    var st = S.state().settings;
    var qs = minutesOf(st.quietStart);
    var qe = minutesOf(st.quietEnd);
    if (qs === qe) return d;
    var m = d.getHours() * 60 + d.getMinutes();
    var inQuiet = qs < qe ? (m >= qs && m < qe) : (m >= qs || m < qe);
    if (!inQuiet) return d;
    // 顺延到免打扰结束的时刻
    var out = atMinutes(d, qe);
    if (out <= d || (qs > qe && m >= qs)) {
      if (out <= d) out = new Date(out.getTime() + 86400000);
    }
    return out;
  }

  function baseTime() {
    var f = S.state().flags;
    var p = S.profile() || {};
    return Math.max(f.lastMealAt || 0, f.lastNotifyAt || 0, p.createdAt || 0);
  }

  function nextFireAt() {
    var base = baseTime();
    if (!base) return null;
    return avoidQuiet(new Date(base + THRESHOLD_MS));
  }

  function title() {
    var c = JF.chloe.active();
    return c ? c.name : '减肥姬';
  }

  function body() {
    var p = S.profile() || {};
    var name = p.name || '你';
    var kcal = S.kcalOn(U.todayKey());
    if (!S.todayMeals().length) {
      return name + '，今天还没记吃的东西哦，我有点担心。';
    }
    if (!S.weightOn(U.todayKey())) {
      return name + '，今天还没称体重，要不要去称一下？';
    }
    return name + '，已经 ' + kcal + ' 千卡了，别忘了记一笔。';
  }

  // ---------- 三种通道 ----------
  var CHANNEL_ID = 'jianfeiji-reminder';
  var NOTIFY_ID = 1024;
  var androidReady = null;

  /** 安卓：建通知通道 + 申请通知权限（只在第一次真正做一次） */
  function ensureAndroid() {
    var LN = capPlugin();
    if (!LN) return Promise.resolve(null);
    if (androidReady) return androidReady;

    androidReady = LN.createChannel({
      id: CHANNEL_ID,
      name: '打卡提醒',
      description: '超过 23 小时没记录饮食时提醒你',
      importance: 4,
      visibility: 1,
      vibration: true
    }).catch(function (e) { console.warn('创建通知通道失败', e); })
      .then(function () {
        return LN.checkPermissions().catch(function () { return { display: 'prompt' }; });
      })
      .then(function (perm) {
        if (perm && perm.display === 'granted') return perm;
        return LN.requestPermissions().catch(function () { return null; });
      })
      .catch(function () { return null; });

    return androidReady;
  }

  function cancelAndroid() {
    var LN = capPlugin();
    if (!LN) return;
    LN.cancel({ notifications: [{ id: NOTIFY_ID }] }).catch(function () {});
  }

  function fireAndroid(atDate) {
    var LN = capPlugin();
    if (!LN) return false;
    cancelAndroid();
    LN.schedule({
      notifications: [{
        id: NOTIFY_ID,
        title: title(),
        body: body(),
        channelId: CHANNEL_ID,
        // 不用精确闹钟：精确闹钟在安卓 12+ 要单独申请权限，
        // 而打卡提醒差几分钟完全没关系。
        schedule: { at: atDate, repeats: true, every: 'day' }
      }]
    }).catch(function (e) { console.warn('排定通知失败', e); });
    return true;
  }

  function fireNow() {
    S.markNotified();
    var t = title(), b = body();
    var n = native();
    if (n && typeof n.notify === 'function') {
      try { n.notify(t, b); } catch (e) { console.warn(e); }
      return true;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification(t, { body: b }); return true; } catch (e) { /* fallthrough */ }
    }
    // 最后兜底：应用内提示条
    U.toast(t + '：' + b, 5200);
    return false;
  }

  /** 每次记录后调用：重新排定下一次提醒 */
  function sync() {
    var st = S.state().settings;
    var LN = capPlugin();

    if (!st.notify) {
      cancelAndroid();
      return;
    }
    var at = nextFireAt();
    if (!at) return;

    if (LN) {
      // 安卓交给系统通知，App 关着也会响
      ensureAndroid().then(function () { fireAndroid(at); });
      return;
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch (e) { /* 忽略 */ }
    }
  }

  /** 定时检查（桌面常驻 / 浏览器开着时） */
  function tick() {
    var st = S.state().settings;
    if (!st.notify) return;
    if (!S.profile()) return;
    if (capPlugin()) return;          // 安卓交给系统通知，不用轮询
    var at = nextFireAt();
    if (!at) return;
    if (Date.now() < at.getTime()) return;
    var q = avoidQuiet(new Date());
    if (Math.abs(q.getTime() - Date.now()) > 60000) return;   // 还在免打扰里
    fireNow();
  }

  JF.notify = {
    sync: sync,
    tick: tick,
    nextFireAt: nextFireAt,
    fireNow: fireNow,
    body: body,
    ensureAndroid: ensureAndroid
  };
})(window.JF = window.JF || {});
