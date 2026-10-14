/* 减肥姬 — 数据仓库
 *
 * 全部数据存在本机：桌面端是一个 JSON 文件（由 Electron 主进程负责读写），
 * 浏览器与手机端退回 localStorage。两种情况下刷新、关闭、重启都不会丢。
 */
(function (JF) {
  'use strict';

  var U = JF.util;
  var KEY = 'slimpal.state.v1';
  var SCHEMA = 1;

  // 桌面端会把下面这个对象注入进来，用来把数据写到真正的文件里
  var bridge = (typeof window !== 'undefined' && window.slimpalNative) || null;

  function blankState() {
    return {
      schema: SCHEMA,
      profile: null,                    // 未完成开头引导时为 null
      weights: [],                      // {date, kg, ts}
      meals: [],                        // {id, date, time, name, kcal, ts}
      foods: [],                        // 食物库 {id, name, kcal, portion, ts}
      starred: [],                      // 常吃置顶（存食物名）
      diary: [],                        // {date, mood, text, ts}
      affection: { points: 0 },
      milestones: [],                   // 已恭喜过的里程碑序号 1–10
      flags: { lastMealAt: null, lastNotifyAt: null, birthdayWished: [] },
      settings: {
        notify: true,
        quietStart: '22:00',
        quietEnd: '08:00',
        autostart: true
      }
    };
  }

  var state = blankState();
  var listeners = [];

  // ---------- 存取 ----------
  function readLocal() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('读取本地数据失败', e);
      return null;
    }
  }

  function writeLocal(obj) {
    try {
      localStorage.setItem(KEY, JSON.stringify(obj));
      return true;
    } catch (e) {
      console.warn('写入本地数据失败', e);
      U.toast('保存失败：本机存储已满或被禁用');
      return false;
    }
  }

  function merge(raw) {
    var base = blankState();
    if (!raw || typeof raw !== 'object') return base;
    Object.keys(base).forEach(function (k) {
      if (raw[k] !== undefined && raw[k] !== null) base[k] = raw[k];
    });
    // settings 逐项合并，避免旧版本缺字段
    base.settings = Object.assign(blankState().settings, raw.settings || {});
    if (!Array.isArray(base.milestones)) base.milestones = [];
    if (!Array.isArray(base.starred)) base.starred = [];
    if (!Array.isArray(base.flags.birthdayWished)) base.flags.birthdayWished = [];
    return base;
  }

  function load() {
    // 桌面端：优先读真正的数据文件；读不到再退回浏览器存储
    var raw = null;
    if (bridge && typeof bridge.load === 'function') {
      try { raw = bridge.load(); } catch (e) { console.warn('从数据文件读取失败', e); }
    }
    if (raw) {
      try { state = merge(JSON.parse(raw)); }
      catch (e) { console.warn('数据文件解析失败，改用浏览器存储', e); state = merge(readLocal()); }
    } else {
      state = merge(readLocal());
    }
    applyLimit();
    return state;
  }

  function persist() {
    var json = JSON.stringify(state);
    var okLocal = writeLocal(state);
    if (bridge && typeof bridge.save === 'function') {
      try { bridge.save(json); } catch (e) { console.warn('写入数据文件失败', e); }
    }
    return okLocal;
  }

  function emit() {
    listeners.forEach(function (fn) { try { fn(state); } catch (e) { console.error(e); } });
  }

  function commit() {
    persist();
    emit();
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }

  // ---------- 读取派生值 ----------
  function profile() { return state.profile; }

  function todayMeals(dateKey) {
    var k = dateKey || U.todayKey();
    return state.meals.filter(function (m) { return m.date === k; })
      .sort(function (a, b) { return a.ts - b.ts; });
  }

  function kcalOn(dateKey) {
    return todayMeals(dateKey).reduce(function (s, m) { return s + (Number(m.kcal) || 0); }, 0);
  }

  function mealsOn(dateKey) { return todayMeals(dateKey); }

  /** 最新一次体重（公斤）；没记过就返回 null */
  function latestWeight() {
    if (!state.weights.length) return null;
    var sorted = state.weights.slice().sort(function (a, b) {
      return a.date === b.date ? b.ts - a.ts : (a.date < b.date ? -1 : 1);
    });
    return sorted[sorted.length - 1];
  }

  function currentWeightKg() {
    var w = latestWeight();
    if (w) return w.kg;
    return state.profile ? state.profile.startWeightKg : null;
  }

  function weightOn(dateKey) {
    var hit = state.weights.filter(function (w) { return w.date === dateKey; });
    return hit.length ? hit[hit.length - 1] : null;
  }

  /** 连续记录天数：从今天往回数，哪天一条饮食记录都没有就停下 */
  function streak() {
    var n = 0;
    var cursor = new Date();
    // 今天还没记不算断，从昨天继续数
    if (!todayMeals(U.dateKey(cursor)).length) cursor = U.addDays(cursor, -1);
    for (var i = 0; i < 3650; i++) {
      var k = U.dateKey(cursor);
      if (todayMeals(k).length) { n++; cursor = U.addDays(cursor, -1); }
      else break;
    }
    return n;
  }

  /** 常吃列表：由真实打卡记录统计出来，不是另一份手填的表 */
  function frequentFoods(limit) {
    var byName = {};
    state.meals.forEach(function (m) {
      var key = (m.name || '').trim();
      if (!key) return;
      var rec = byName[key] || (byName[key] = { name: key, count: 0, lastTs: 0, lastKcal: 0, totalKcal: 0 });
      rec.count++;
      rec.totalKcal += Number(m.kcal) || 0;
      if (m.ts >= rec.lastTs) { rec.lastTs = m.ts; rec.lastKcal = Number(m.kcal) || 0; }
    });
    var list = Object.keys(byName).map(function (k) {
      var r = byName[k];
      r.avgKcal = Math.round(r.totalKcal / r.count);
      r.starred = state.starred.indexOf(r.name) !== -1;
      return r;
    });
    list.sort(function (a, b) {
      if (a.starred !== b.starred) return a.starred ? -1 : 1;
      if (a.count !== b.count) return b.count - a.count;
      return b.lastTs - a.lastTs;
    });
    return limit ? list.slice(0, limit) : list;
  }

  function isStarred(name) { return state.starred.indexOf(name) !== -1; }

  // ---------- 好感度 ----------
  var LEVELS = [
    { min: 0, name: '刚认识', call: '你' },
    { min: 60, name: '熟人', call: '你' },
    { min: 180, name: '朋友', call: '你' },
    { min: 400, name: '好朋友', call: '你' },
    { min: 800, name: '很重要的人', call: '你' },
    { min: 1500, name: '特别的人', call: '你' }
  ];

  function affectionLevel() {
    var pts = state.affection.points || 0;
    var idx = 0;
    for (var i = 0; i < LEVELS.length; i++) if (pts >= LEVELS[i].min) idx = i;
    var next = LEVELS[idx + 1];
    return {
      level: idx + 1,
      name: LEVELS[idx].name,
      points: pts,
      nextAt: next ? next.min : null,
      toNext: next ? Math.max(0, next.min - pts) : 0
    };
  }

  function addAffection(n, reason) {
    if (!n) return;
    if (state.affection.points === undefined) state.affection.points = 0;
    state.affection.points += n;
    state.affection.lastReason = reason || null;
  }

  // ---------- 写入操作 ----------
  /**
   * 每日热量上限是「算出来的」，不是填出来的：
   * 体重一变、活动量一变、目标速度一变，上限就跟着变。
   * 每次资料或体重变化后调用一次，把结果缓存在 profile 上供界面显示。
   */
  function applyLimit() {
    if (!state.profile || !JF.calc) return;
    var p = state.profile;
    var age = U.ageFrom(p.birthday) || p.ageFallback || 30;
    var kg = currentWeightKg();
    if (kg === null || !p.heightCm) return;
    var r = JF.calc.dailyLimit({
      weightKg: kg, heightCm: p.heightCm, age: age,
      gender: p.gender, activity: p.activity, speed: p.speed
    });
    p.dailyLimit = r.limit;
    p.bmr = r.bmr;
    p.tdee = r.tdee;
    p.limitFloored = r.floored;
  }

  function setProfile(patch) {
    state.profile = Object.assign({}, state.profile || {}, patch);
    applyLimit();
    commit();
  }

  function addMeal(meal) {
    var m = {
      id: U.uid(),
      date: meal.date || U.todayKey(),
      time: meal.time || U.nowTime(),
      name: (meal.name || '').trim(),
      kcal: Math.max(0, Math.round(Number(meal.kcal) || 0)),
      ts: Date.now()
    };
    if (!m.name) return null;
    state.meals.push(m);
    state.flags.lastMealAt = m.ts;
    addAffection(3, 'meal');
    commit();
    return m;
  }

  function removeMeal(id) {
    state.meals = state.meals.filter(function (m) { return m.id !== id; });
    commit();
  }

  function addWeight(kg, dateKey) {
    var k = dateKey || U.todayKey();
    var kgv = Number(kg);
    if (!(kgv > 0)) return null;
    state.weights = state.weights.filter(function (w) { return w.date !== k; });
    var rec = { date: k, kg: Math.round(kgv * 10) / 10, ts: Date.now() };
    state.weights.push(rec);
    state.weights.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    applyLimit();
    commit();
    return rec;
  }

  function weightsSorted() {
    return state.weights.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }

  // 食物库
  function addFood(f) {
    var name = (f.name || '').trim();
    if (!name) return null;
    var exist = state.foods.filter(function (x) { return x.name === name; })[0];
    if (exist) {
      exist.kcal = Math.round(Number(f.kcal) || exist.kcal);
      if (f.portion) exist.portion = f.portion;
      exist.ts = Date.now();
      commit();
      return exist;
    }
    var rec = {
      id: U.uid(), name: name,
      kcal: Math.max(0, Math.round(Number(f.kcal) || 0)),
      portion: (f.portion || '1 份').trim(),
      ts: Date.now()
    };
    state.foods.push(rec);
    commit();
    return rec;
  }

  function updateFood(id, patch) {
    state.foods.forEach(function (f) { if (f.id === id) Object.assign(f, patch); });
    commit();
  }

  function removeFood(id) {
    state.foods = state.foods.filter(function (f) { return f.id !== id; });
    commit();
  }

  function foodsSorted() {
    return state.foods.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  }

  function toggleStar(name) {
    var i = state.starred.indexOf(name);
    if (i === -1) state.starred.push(name); else state.starred.splice(i, 1);
    commit();
  }

  // 日记
  function saveDiary(dateKey, mood, text) {
    var k = dateKey || U.todayKey();
    var existing = state.diary.filter(function (d) { return d.date === k; })[0];
    if (existing) {
      existing.mood = mood;
      existing.text = text;
      existing.ts = Date.now();
    } else {
      state.diary.push({ date: k, mood: mood, text: text, ts: Date.now() });
      addAffection(5, 'diary');
    }
    commit();
  }

  function diaryOn(dateKey) {
    return state.diary.filter(function (d) { return d.date === dateKey; })[0] || null;
  }

  function diarySorted() {
    return state.diary.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  function diaryStreak() {
    var n = 0;
    var cursor = new Date();
    if (!diaryOn(U.dateKey(cursor))) cursor = U.addDays(cursor, -1);
    for (var i = 0; i < 3650; i++) {
      var k = U.dateKey(cursor);
      var d = diaryOn(k);
      if (d && (d.text || '').trim()) { n++; cursor = U.addDays(cursor, -1); } else break;
    }
    return n;
  }

  // 里程碑 / 生日
  function markMilestone(step) {
    if (state.milestones.indexOf(step) === -1) {
      state.milestones.push(step);
      state.milestones.sort(function (a, b) { return a - b; });
    }
    addAffection(30, 'milestone');
    commit();
  }

  function markBirthdayWished(yearKey) {
    if (state.flags.birthdayWished.indexOf(String(yearKey)) === -1) {
      state.flags.birthdayWished.push(String(yearKey));
    }
    addAffection(20, 'birthday');
    commit();
  }

  // 设置
  function setSetting(key, value) {
    state.settings[key] = value;
    commit();
  }

  function markNotified() {
    state.flags.lastNotifyAt = Date.now();
    persist();
  }

  // ---------- 备份 ----------
  function exportJson() {
    return JSON.stringify({
      app: '减肥姬', schema: SCHEMA,
      exportedAt: new Date().toISOString(),
      data: state
    }, null, 2);
  }

  function importJson(text) {
    var parsed = JSON.parse(text);
    var data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || typeof data !== 'object') throw new Error('文件内容不是有效的备份');
    state = merge(data);
    applyLimit();
    commit();
    return true;
  }

  function resetAll() {
    state = blankState();
    commit();
  }

  JF.store = {
    KEY: KEY,
    state: function () { return state; },
    load: load, persist: persist, commit: commit, subscribe: subscribe,
    blankState: blankState,
    profile: profile, setProfile: setProfile,
    todayMeals: todayMeals, mealsOn: mealsOn, kcalOn: kcalOn,
    latestWeight: latestWeight, currentWeightKg: currentWeightKg, weightOn: weightOn,
    addWeight: addWeight, weightsSorted: weightsSorted,
    addMeal: addMeal, removeMeal: removeMeal, streak: streak,
    frequentFoods: frequentFoods, isStarred: isStarred, toggleStar: toggleStar,
    addFood: addFood, updateFood: updateFood, removeFood: removeFood, foodsSorted: foodsSorted,
    saveDiary: saveDiary, diaryOn: diaryOn, diarySorted: diarySorted, diaryStreak: diaryStreak,
    affectionLevel: affectionLevel, addAffection: addAffection,
    markMilestone: markMilestone, markBirthdayWished: markBirthdayWished,
    setSetting: setSetting, markNotified: markNotified,
    applyLimit: applyLimit,
    exportJson: exportJson, importJson: importJson, resetAll: resetAll
  };
})(window.JF = window.JF || {});
