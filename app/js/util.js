/* 减肥姬 — 通用工具函数
 * 经典脚本（非 ES module），这样 file:// 直接打开也能跑。
 */
(function (JF) {
  'use strict';

  // ---------- DOM ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

  // ---------- 日期 ----------
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** 本地日期键：YYYY-MM-DD（不用 toISOString，避免时区偏移） */
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayKey() { return dateKey(new Date()); }

  function parseKey(key) {
    var p = String(key).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function addDays(date, n) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + n);
    return d;
  }

  function daysBetween(aKey, bKey) {
    var a = parseKey(aKey), b = parseKey(bKey);
    return Math.round((b - a) / 86400000);
  }

  var WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

  function prettyDate(key) {
    var d = parseKey(key);
    return d.getMonth() + 1 + '月' + d.getDate() + '日 周' + WEEKDAY[d.getDay()];
  }

  function prettyDateShort(key) {
    var d = parseKey(key);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function nowTime() {
    var d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function greeting() {
    var h = new Date().getHours();
    if (h < 5) return '夜深了';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    if (h < 23) return '晚上好';
    return '夜深了';
  }

  // ---------- 数值 ----------
  /** 1 公斤 = 2 斤；全 App 对外显示「斤」 */
  function kgToJin(kg) { return kg * 2; }
  function jinToKg(jin) { return jin / 2; }

  function round1(n) { return Math.round(n * 10) / 10; }

  function fmtJin(kg) {
    var j = kgToJin(kg);
    return (Math.round(j * 10) / 10).toString();
  }

  function fmtSigned(fn, n) {
    var v = fn(n);
    return (v > 0 ? '+' : '') + v;
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** 由生日算周岁 */
  function ageFrom(birthdayKey, onDate) {
    if (!birthdayKey) return null;
    var b = parseKey(birthdayKey);
    var d = onDate || new Date();
    var age = d.getFullYear() - b.getFullYear();
    var m = d.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && d.getDate() < b.getDate())) age--;
    return age;
  }

  /** 今天是不是生日（只比月日） */
  function isBirthdayToday(birthdayKey, onDate) {
    if (!birthdayKey) return false;
    var b = parseKey(birthdayKey);
    var d = onDate || new Date();
    return b.getMonth() === d.getMonth() && b.getDate() === d.getDate();
  }

  // ---------- 提示 ----------
  var toastTimer = null;
  function toast(msg, ms) {
    var box = document.getElementById('toast');
    if (!box) return;
    box.textContent = msg;
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.classList.remove('show'); }, ms || 1900);
  }

  JF.util = {
    $: $, $$: $$, el: el, clear: clear,
    dateKey: dateKey, todayKey: todayKey, parseKey: parseKey, addDays: addDays,
    daysBetween: daysBetween, prettyDate: prettyDate, prettyDateShort: prettyDateShort,
    nowTime: nowTime, greeting: greeting, pad2: pad2,
    kgToJin: kgToJin, jinToKg: jinToKg, round1: round1, fmtJin: fmtJin, fmtSigned: fmtSigned,
    clamp: clamp, uid: uid, escapeHtml: escapeHtml, ageFrom: ageFrom, isBirthdayToday: isBirthdayToday,
    toast: toast
  };
})(window.JF = window.JF || {});
