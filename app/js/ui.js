/* 减肥姬 — 共用界面组件（卡片、弹层、确认框） */
(function (JF) {
  'use strict';

  var U = JF.util;
  var el = U.el;

  function card(opts) {
    var head = null;
    if (opts.title || opts.hint || opts.action) {
      head = el('div', { class: 'card-head' }, [
        opts.title ? el('div', { class: 'card-title', text: opts.title }) : null,
        opts.hint ? el('div', { class: 'card-hint', text: opts.hint }) : null,
        el('div', { class: 'spacer' }),
        opts.action || null
      ]);
    }
    return el('div', { class: 'card' + (opts.className ? ' ' + opts.className : '') },
      [head].concat(opts.children || []));
  }

  function linkBtn(text, onclick) {
    return el('button', { class: 'link-btn', type: 'button', onclick: onclick }, [text]);
  }

  var sheetHost = null;

  function sheet(opts) {
    closeSheet();
    var body = el('div', {}, opts.children || []);
    var actions = opts.actions ? el('div', { class: 'sheet-actions' }, opts.actions) : null;
    var box = el('div', { class: 'sheet' }, [
      el('div', { class: 'sheet-title' }, [
        el('span', { text: opts.title || '' }),
        el('div', { class: 'spacer' }),
        el('button', { class: 'mini-btn', type: 'button', onclick: closeSheet }, ['关闭'])
      ]),
      body, actions
    ]);
    var mask = el('div', {
      class: 'mask',
      onclick: function (e) { if (e.target === mask) closeSheet(); }
    }, [box]);
    sheetHost = mask;
    document.getElementById('app').appendChild(mask);
    if (opts.onOpen) opts.onOpen(body);
    var first = mask.querySelector('input, textarea, select');
    if (first) setTimeout(function () { first.focus(); }, 120);
    return mask;
  }

  function closeSheet() {
    if (sheetHost && sheetHost.parentNode) sheetHost.parentNode.removeChild(sheetHost);
    sheetHost = null;
  }

  function confirmBox(opts) {
    return new Promise(function (resolve) {
      sheet({
        title: opts.title || '确认',
        children: [el('div', { class: 'small', text: opts.text || '' })],
        actions: [
          el('button', { class: 'btn ghost', type: 'button', onclick: function () { closeSheet(); resolve(false); } },
            [opts.cancel || '取消']),
          el('button', {
            class: 'btn ' + (opts.danger ? 'danger' : 'primary'), type: 'button',
            onclick: function () { closeSheet(); resolve(true); }
          }, [opts.ok || '确定'])
        ]
      });
    });
  }

  function field(label, control) {
    return el('div', { class: 'field' }, [
      label ? el('label', { class: 'field-label', text: label }) : null,
      control
    ]);
  }

  function input(attrs) { return el('input', Object.assign({ class: 'input' }, attrs || {})); }
  function select(options, value, onchange) {
    var s = el('select', { class: 'select', onchange: onchange });
    options.forEach(function (o) {
      var opt = el('option', { value: o.value }, [o.label]);
      if (String(o.value) === String(value)) opt.selected = true;
      s.appendChild(opt);
    });
    return s;
  }

  function numberField(label, value, unit, attrs) {
    var inp = input(Object.assign({ type: 'number', inputmode: 'decimal', value: value }, attrs || {}));
    return field(label, el('div', { class: 'input-suffix' }, [inp, el('span', { text: unit })]));
  }

  function emptyState(chibiPath, text) {
    return el('div', { class: 'empty' }, [
      chibiPath ? el('img', { src: chibiPath, alt: '' }) : null,
      el('div', { text: text })
    ]);
  }

  JF.ui = {
    card: card, linkBtn: linkBtn, sheet: sheet, closeSheet: closeSheet,
    confirm: confirmBox, field: field, input: input, select: select,
    numberField: numberField, emptyState: emptyState
  };
})(window.JF = window.JF || {});
