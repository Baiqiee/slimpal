/* 减肥姬 — 手写 SVG 图表（不引第三方库，保证完全离线） */
(function (JF) {
  'use strict';

  var U = JF.util;
  var el = U.el;
  var NS = 'http://www.w3.org/2000/svg';

  function s(tag, attrs, children) {
    var n = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (attrs[k] === null || attrs[k] === undefined) return;
      n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  function frame(w, h) {
    return s('svg', { class: 'chart', viewBox: '0 0 ' + w + ' ' + h, width: '100%', height: h, preserveAspectRatio: 'xMidYMid meet' });
  }

  /**
   * 折线图。points: [{key, value}]，按 key 升序。
   * opts: { unit, target, height }
   */
  function line(points, opts) {
    opts = opts || {};
    var W = 320, H = opts.height || 150;
    var padL = 34, padR = 12, padT = 14, padB = 22;
    if (!points.length) return el('div', { class: 'chart-empty', text: '还没有数据' });

    var vals = points.map(function (p) { return p.value; });
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    if (opts.target !== undefined && opts.target !== null) {
      min = Math.min(min, opts.target); max = Math.max(max, opts.target);
    }
    if (max - min < 0.4) { min -= 0.3; max += 0.3; }
    var pad = (max - min) * 0.14;
    min -= pad; max += pad;

    var x = function (i) { return padL + (W - padL - padR) * (points.length === 1 ? 0.5 : i / (points.length - 1)); };
    var y = function (v) { return padT + (H - padT - padB) * (1 - (v - min) / (max - min)); };

    var svg = frame(W, H);

    // 网格 + 刻度
    [0, 0.5, 1].forEach(function (t) {
      var v = min + (max - min) * t;
      var yy = y(v);
      svg.appendChild(s('line', { x1: padL - 4, y1: yy, x2: W - padR, y2: yy, stroke: '#F4DDE4', 'stroke-width': 1 }));
      svg.appendChild(s('text', {
        x: padL - 7, y: yy + 3.5, 'text-anchor': 'end',
        'font-size': 9, fill: '#B9A6AD'
      }, [document.createTextNode((Math.round(v * 10) / 10).toString())]));
    });

    // 目标线
    if (opts.target !== undefined && opts.target !== null) {
      var ty = y(opts.target);
      svg.appendChild(s('line', {
        x1: padL - 2, y1: ty, x2: W - padR, y2: ty,
        stroke: '#6FBF9C', 'stroke-width': 1.4, 'stroke-dasharray': '4 3'
      }));
    }

    // 面积 + 折线
    var dPath = points.map(function (p, i) { return (i ? 'L' : 'M') + x(i) + ' ' + y(p.value); }).join(' ');
    if (points.length > 1) {
      var area = dPath + ' L' + x(points.length - 1) + ' ' + (H - padB) + ' L' + x(0) + ' ' + (H - padB) + ' Z';
      var gid = 'g' + Math.random().toString(36).slice(2, 7);
      svg.appendChild(s('defs', {}, [
        s('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, [
          s('stop', { offset: '0%', 'stop-color': '#EF8FAB', 'stop-opacity': .28 }),
          s('stop', { offset: '100%', 'stop-color': '#EF8FAB', 'stop-opacity': 0 })
        ])
      ]));
      svg.appendChild(s('path', { d: area, fill: 'url(#' + gid + ')' }));
    }
    svg.appendChild(s('path', { d: dPath, fill: 'none', stroke: '#E06C90', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

    points.forEach(function (p, i) {
      svg.appendChild(s('circle', { cx: x(i), cy: y(p.value), r: i === points.length - 1 ? 3.6 : 2.4, fill: '#fff', stroke: '#E06C90', 'stroke-width': 1.8 }));
    });

    // x 轴标签（最多 5 个）
    var step = Math.max(1, Math.ceil(points.length / 5));
    points.forEach(function (p, i) {
      if (i % step !== 0 && i !== points.length - 1) return;
      svg.appendChild(s('text', {
        x: x(i), y: H - 6, 'text-anchor': 'middle', 'font-size': 9, fill: '#B9A6AD'
      }, [document.createTextNode(U.prettyDateShort(p.key))]));
    });

    return svg;
  }

  /** 柱状图。items: [{key, value, over}] */
  function bars(items, opts) {
    opts = opts || {};
    var W = 320, H = opts.height || 130;
    var padL = 30, padR = 8, padT = 12, padB = 20;
    if (!items.length) return el('div', { class: 'chart-empty', text: '还没有数据' });

    var max = Math.max.apply(null, items.map(function (i) { return i.value; }));
    if (opts.limit) max = Math.max(max, opts.limit);
    max = max * 1.15 || 1;

    var n = items.length;
    var gap = 3;
    var bw = (W - padL - padR - gap * (n - 1)) / n;
    var base = H - padB;
    var svg = frame(W, H);

    svg.appendChild(s('line', { x1: padL - 4, y1: base, x2: W - padR, y2: base, stroke: '#F4DDE4', 'stroke-width': 1 }));

    if (opts.limit) {
      var ly = base - (base - padT) * (opts.limit / max);
      svg.appendChild(s('line', {
        x1: padL - 4, y1: ly, x2: W - padR, y2: ly,
        stroke: '#EAA94F', 'stroke-width': 1.3, 'stroke-dasharray': '4 3'
      }));
      svg.appendChild(s('text', { x: padL - 7, y: ly + 3.5, 'text-anchor': 'end', 'font-size': 9, fill: '#EAA94F' },
        [document.createTextNode(String(opts.limit))]));
    }

    items.forEach(function (it, i) {
      var h = Math.max(2, (base - padT) * (it.value / max));
      var x = padL + i * (bw + gap);
      svg.appendChild(s('rect', {
        x: x, y: base - h, width: bw, height: h, rx: Math.min(3, bw / 2),
        fill: it.over ? '#E9A0A8' : '#F3B7C8'
      }));
    });

    var step = Math.max(1, Math.ceil(n / 6));
    items.forEach(function (it, i) {
      if (i % step !== 0 && i !== n - 1) return;
      svg.appendChild(s('text', {
        x: padL + i * (bw + gap) + bw / 2, y: H - 5, 'text-anchor': 'middle', 'font-size': 9, fill: '#B9A6AD'
      }, [document.createTextNode(U.prettyDateShort(it.key))]));
    });

    return svg;
  }

  JF.charts = { line: line, bars: bars };
})(window.JF = window.JF || {});
