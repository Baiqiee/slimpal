/* 减肥姬 — 基础代谢 / 每日热量上限 / 目标进度计算
 *
 * 公式用 Mifflin-St Jeor（目前营养学界对普通人群最准的估算式）：
 *   男：BMR = 10×体重(kg) + 6.25×身高(cm) − 5×年龄 + 5
 *   女：BMR = 10×体重(kg) + 6.25×身高(cm) − 5×年龄 − 161
 * 每日消耗 TDEE = BMR × 活动系数。
 * 每日热量上限 = TDEE − 缺口，缺口由「减重速度」决定，并设了安全下限。
 */
(function (JF) {
  'use strict';

  var ACTIVITY = {
    sedentary: { label: '基本不动', hint: '久坐办公，几乎不运动', factor: 1.2 },
    light: { label: '轻度活动', hint: '每周运动 1–3 次，或经常走动', factor: 1.375 },
    moderate: { label: '中度活动', hint: '每周运动 3–5 次', factor: 1.55 },
    active: { label: '高强度', hint: '每周运动 6 次以上，或体力工作', factor: 1.725 }
  };

  // 速度 → 每天热量缺口（kcal）。1 公斤脂肪约 7700 kcal，
  // 每天 250 kcal 缺口 ≈ 每周 0.23 公斤 ≈ 每周 0.45 斤。
  var SPEED = {
    slow: { label: '慢一点', hint: '每周约 0.5 斤，最不容易反弹', deficit: 250 },
    normal: { label: '正常', hint: '每周约 1 斤，比较稳', deficit: 500 },
    fast: { label: '快一点', hint: '每周约 1.5 斤，需要比较自律', deficit: 750 }
  };

  var KCAL_PER_KG_FAT = 7700;
  // 安全下限：无论怎么算，每日热量上限不低于「基础代谢」，
  // 并且不低于 1200（女）/1500（男）的通用健康底线。
  var ABS_FLOOR = { female: 1200, male: 1500 };

  function bmr(p) {
    var w = Number(p.weightKg) || 0;
    var h = Number(p.heightCm) || 0;
    var a = Number(p.age) || 30;
    var base = 10 * w + 6.25 * h - 5 * a;
    return p.gender === 'male' ? base + 5 : base - 161;
  }

  function tdee(p) {
    var f = (ACTIVITY[p.activity] || ACTIVITY.sedentary).factor;
    return bmr(p) * f;
  }

  /**
   * 由「当前体重 + 身高 + 年龄 + 性别 + 活动量 + 速度」推出每日热量上限。
   * 返回 { bmr, tdee, deficit, limit, floored }
   */
  function dailyLimit(p) {
    var b = bmr(p);
    var t = tdee(p);
    var deficit = (SPEED[p.speed] || SPEED.normal).deficit;
    var raw = t - deficit;
    var floorBmr = b;
    var floorAbs = ABS_FLOOR[p.gender === 'male' ? 'male' : 'female'];
    var floor = Math.max(floorBmr, floorAbs);
    var limit = Math.max(raw, floor);
    return {
      bmr: Math.round(b),
      tdee: Math.round(t),
      deficit: deficit,
      limit: Math.round(limit / 10) * 10,   // 取整到 10 千卡，读起来干净
      floored: limit > raw
    };
  }

  /** 从「起点体重」到「目标体重」的进度（0–1） */
  function goalProgress(startKg, targetKg, currentKg) {
    if (startKg === null || targetKg === null || currentKg === null) return 0;
    var total = startKg - targetKg;
    if (total <= 0) return currentKg <= targetKg ? 1 : 0;
    return JF.util.clamp((startKg - currentKg) / total, 0, 1);
  }

  /**
   * 减重里程碑：把「总目标」分成 10 份，每达成一份就恭喜一次。
   * 返回本次新达成的第 n 份（1–10），没新达成则返回 null。
   */
  function newMilestone(startKg, targetKg, currentKg, alreadyDone) {
    if (startKg === null || targetKg === null || currentKg === null) return null;
    var total = startKg - targetKg;
    if (total <= 0) return null;
    var lost = startKg - currentKg;
    if (lost <= 0) return null;
    var reached = Math.floor((lost / total) * 10 + 1e-9);
    reached = Math.min(reached, 10);
    var done = alreadyDone || [];
    for (var i = 1; i <= reached; i++) {
      if (done.indexOf(i) === -1) return i;
    }
    return null;
  }

  /** 某一里程碑对应「已经减掉多少斤」 */
  function milestoneJin(startKg, targetKg, step) {
    var total = startKg - targetKg;
    return JF.util.round1(JF.util.kgToJin(total * (step / 10)));
  }

  /** 预测：按当前速度，还要多少天到目标 */
  function daysToGoal(currentKg, targetKg, speed) {
    var perWeekKg = (SPEED[speed] || SPEED.normal).deficit * 7 / KCAL_PER_KG_FAT;
    var remain = currentKg - targetKg;
    if (remain <= 0) return 0;
    if (perWeekKg <= 0) return null;
    return Math.ceil(remain / perWeekKg * 7);
  }

  JF.calc = {
    ACTIVITY: ACTIVITY,
    SPEED: SPEED,
    bmr: bmr,
    tdee: tdee,
    dailyLimit: dailyLimit,
    goalProgress: goalProgress,
    newMilestone: newMilestone,
    milestoneJin: milestoneJin,
    daysToGoal: daysToGoal
  };
})(window.JF = window.JF || {});
