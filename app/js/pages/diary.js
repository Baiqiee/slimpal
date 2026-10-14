/* 减肥姬 — 日记页：每天一篇，自动带上当天的体重和热量 */
(function (JF) {
  'use strict';

  var U = JF.util;
  var S = JF.store;
  var ui = JF.ui;
  var A = JF.actions;
  var el = U.el;

  var MOODS = [
    { key: 'great', emoji: '😄', label: '很好' },
    { key: 'good', emoji: '🙂', label: '还行' },
    { key: 'meh', emoji: '😐', label: '一般' },
    { key: 'tired', emoji: '😮‍💨', label: '有点累' },
    { key: 'bad', emoji: '😣', label: '难受' },
    { key: 'proud', emoji: '😤', label: '很有干劲' }
  ];

  function moodEmoji(key) {
    var m = MOODS.filter(function (x) { return x.key === key; })[0];
    return m ? m.emoji : '·';
  }

  function dayMeta(key) {
    var w = S.weightOn(key);
    var kcal = S.kcalOn(key);
    var n = S.todayMeals(key).length;
    var bits = [];
    if (w) bits.push('体重 ' + U.fmtJin(w.kg) + ' 斤');
    if (n) bits.push(kcal + ' 千卡 / ' + n + ' 笔');
    return bits.join(' · ');
  }

  function render(host, nav) {
    U.clear(host);
    var today = U.todayKey();
    var entry = S.diaryOn(today) || { mood: 'good', text: '' };
    var mood = entry.mood || 'good';

    // ---- 今天这篇 ----
    var ta = el('textarea', {
      class: 'textarea',
      placeholder: '今天怎么样？随便写两句就行。\n\n不想写也没关系，我不会催你的。',
      maxlength: 3000
    });
    ta.value = entry.text || '';

    var moodRow = el('div', { class: 'mood-row' });
    MOODS.forEach(function (m) {
      var b = el('button', {
        class: 'mood' + (m.key === mood ? ' on' : ''), type: 'button', title: m.label,
        onclick: function () {
          mood = m.key;
          U.$$('.mood', moodRow).forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
        }
      }, [m.emoji]);
      moodRow.appendChild(b);
    });

    var meta = dayMeta(today);

    host.appendChild(ui.card({
      title: '今天',
      hint: U.prettyDate(today),
      children: [
        el('div', { class: 'field' }, [
          el('label', { class: 'field-label', text: '心情' }),
          moodRow
        ]),
        ta,
        meta ? el('div', { class: 'diary-meta', text: '自动带上：' + meta }) : null,
        el('button', {
          class: 'btn primary block mt12', type: 'button',
          onclick: function () {
            var text = ta.value.trim();
            var isNew = !S.diaryOn(today);
            S.saveDiary(today, mood, text);
            U.toast(text ? '写好了' : '已清空今天这篇');
            if (isNew && text) A.react('diarySaved');
            nav.refresh();
          }
        }, ['保存今天的日记'])
      ].filter(Boolean)
    }));

    // ---- 历史 ----
    var list = S.diarySorted().filter(function (d) { return d.date !== today; });
    var streak = S.diaryStreak();

    host.appendChild(ui.card({
      title: '以前的',
      hint: streak > 1 ? ('连续写了 ' + streak + ' 天') : (list.length + ' 篇'),
      children: list.length ? [el('div', {}, list.map(function (d) {
        return el('div', { class: 'diary-item' }, [
          el('div', { class: 'diary-date' }, [
            el('span', { class: 'diary-mood', text: moodEmoji(d.mood) }),
            el('span', { text: U.prettyDate(d.date) })
          ]),
          d.text ? el('div', { class: 'diary-text', text: d.text }) : el('div', { class: 'small', text: '（这天没写字）' }),
          (function () {
            var m = dayMeta(d.date);
            return m ? el('div', { class: 'diary-meta', text: m }) : null;
          })()
        ].filter(Boolean));
      }))] : [ui.emptyState(JF.chloe.active().assets.chibi, '还没有以前的日记')]
    }));
  }

  JF.pages = JF.pages || {};
  JF.pages.diary = { render: render, moodEmoji: moodEmoji };
})(window.JF = window.JF || {});
