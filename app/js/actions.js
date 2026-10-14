/* 减肥姬 — 共用操作（加一餐、称体重、编辑食物、小克反应） */
(function (JF) {
  'use strict';

  var U = JF.util;
  var S = JF.store;
  var ui = JF.ui;
  var el = U.el;

  /** 记录成功后，让小克站出来说一句（galgame 式的即时反馈） */
  function react(scene, extraCtx, force) {
    var said = JF.chloe.say(scene, extraCtx, force);
    if (!said.text) return;
    var c = JF.chloe.active();
    var box = el('div', { class: 'react-pop' }, [
      el('img', { class: 'react-face', src: JF.chloe.facePath(said.expr), alt: '' }),
      el('div', { class: 'react-body' }, [
        el('div', { class: 'react-name', text: c.name }),
        el('div', { class: 'react-text', text: said.text })
      ])
    ]);
    document.getElementById('app').appendChild(box);
    requestAnimationFrame(function () { box.classList.add('on'); });
    setTimeout(function () {
      box.classList.remove('on');
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 300);
    }, 3400);
  }

  // ---------------- 加一餐 ----------------
  function addMealSheet(onDone) {
    var foods = S.foodsSorted();
    var frequent = S.frequentFoods(8);

    var nameInput = ui.input({ type: 'text', placeholder: '吃了什么，例如：鸡胸肉沙拉', maxlength: 40 });
    var kcalInput = ui.input({ type: 'number', inputmode: 'numeric', placeholder: '热量', min: 0, max: 5000 });
    var timeInput = ui.input({ type: 'time', value: U.nowTime() });

    var quickBox = el('div', { class: 'chips' });
    function renderQuick() {
      U.clear(quickBox);
      var pool = frequent.length ? frequent : foods.map(function (f) {
        return { name: f.name, lastKcal: f.kcal, count: 0 };
      });
      if (!pool.length) {
        quickBox.appendChild(el('div', { class: 'small', text: '还没有常吃记录。你可以先在「吃」里建几个自己的食物，以后一键就能记。' }));
        return;
      }
      pool.slice(0, 8).forEach(function (f) {
        quickBox.appendChild(el('button', {
          class: 'chip sm', type: 'button',
          onclick: function () {
            nameInput.value = f.name;
            kcalInput.value = f.lastKcal || '';
            kcalInput.focus();
          }
        }, [f.name + ' · ' + (f.lastKcal || 0) + '千卡']));
      });
    }
    renderQuick();

    ui.sheet({
      title: '记一笔',
      children: [
        ui.field('吃了什么', nameInput),
        el('div', { class: 'field' }, [
          el('label', { class: 'field-label', text: '常吃（点一下就填好）' }),
          quickBox
        ]),
        el('div', { class: 'input-row' }, [
          ui.field('热量（千卡）', kcalInput),
          ui.field('时间', timeInput)
        ])
      ],
      actions: [
        el('button', { class: 'btn ghost', type: 'button', onclick: ui.closeSheet }, ['取消']),
        el('button', {
          class: 'btn primary', type: 'button',
          onclick: function () {
            var name = nameInput.value.trim();
            var kcal = Number(kcalInput.value);
            if (!name) { U.toast('先写点吃了什么吧'); nameInput.focus(); return; }
            if (!(kcal >= 0) || kcalInput.value === '') { U.toast('热量填个数字'); kcalInput.focus(); return; }
            var before = S.kcalOn(U.todayKey());
            S.addMeal({ name: name, kcal: kcal, time: timeInput.value || U.nowTime() });
            ui.closeSheet();
            var after = S.kcalOn(U.todayKey());
            var limit = (S.profile() || {}).dailyLimit || 0;
            var scene = 'mealLogged';
            if (limit && after > limit) scene = 'overLimit';
            else if (kcal >= 600) scene = 'mealLoggedBig';
            else if (limit && (limit - after) <= 200) scene = 'nearLimit';
            react(scene);
            if (before === 0) { /* 今天第一笔，额外给点好感 */ S.addAffection(2, 'firstMeal'); }
            if (onDone) onDone();
          }
        }, ['记下来'])
      ]
    });
  }

  // ---------------- 称体重 ----------------
  function weighSheet(onDone) {
    var last = S.latestWeight();
    var cur = S.currentWeightKg();
    var kgInput = ui.input({
      type: 'number', inputmode: 'decimal', step: '0.1',
      value: cur !== null ? (Math.round(cur * 10) / 10) : '',
      placeholder: '例如 62.5'
    });
    var hint = el('div', { class: 'small', text: last ? ('上次：' + U.fmtJin(last.kg) + ' 斤（' + last.date + '）') : '这是第一次称重' });

    ui.sheet({
      title: '今天的体重',
      children: [
        ui.field('体重', el('div', { class: 'input-suffix' }, [kgInput, el('span', { text: '公斤' })])),
        hint,
        el('div', { class: 'small mt8', text: '每天称一次就够，同一天再称会覆盖。' })
      ],
      actions: [
        el('button', { class: 'btn ghost', type: 'button', onclick: ui.closeSheet }, ['取消']),
        el('button', {
          class: 'btn primary', type: 'button',
          onclick: function () {
            var kg = Number(kgInput.value);
            if (!(kg > 20 && kg < 300)) { U.toast('这个数字好像不太对'); kgInput.focus(); return; }
            var prev = S.currentWeightKg();
            S.addWeight(kg);
            S.addAffection(4, 'weigh');
            ui.closeSheet();
            if (prev === null) react('weightFirst');
            else {
              var diff = U.round1(U.kgToJin(prev - kg));
              if (diff > 0) react('weightDown', { diff: diff });
              else if (diff < 0) react('weightUp', { diff: Math.abs(diff) });
              else react('weightSame');
            }
            checkMilestone();
            if (onDone) onDone();
          }
        }, ['记下来'])
      ]
    });
  }

  /** 达成 1/10 里程碑时，弹一张专门的祝贺卡 */
  function checkMilestone() {
    var p = S.profile();
    if (!p) return false;
    var cur = S.currentWeightKg();
    var step = JF.calc.newMilestone(p.startWeightKg, p.targetWeightKg, cur, S.state().milestones);
    if (step === null) return false;

    var total = p.startWeightKg - p.targetWeightKg;
    var done = cur <= p.targetWeightKg;
    var jin = done ? U.round1(U.kgToJin(total)) : JF.calc.milestoneJin(p.startKg || p.startWeightKg, p.targetWeightKg, step);

    var text = done
      ? JF.chloe.pick('goalReached', { name: p.name, jin: jin }, true)
      : JF.chloe.pick('milestone', { name: p.name, jin: jin, toTarget: U.round1(U.kgToJin(cur - p.targetWeightKg)) }, true);

    S.markMilestone(step);

    ui.sheet({
      title: done ? '目标达成！' : ('第 ' + step + '/10 个里程碑'),
      children: [
        el('div', { class: 'celebrate' }, [
          el('img', { src: JF.chloe.facePath('laugh'), alt: '' }),
          el('div', { class: 'celebrate-text', text: text })
        ]),
        el('div', { class: 'small center mt8', text: '已经减重 ' + jin + ' 斤' })
      ],
      actions: [el('button', { class: 'btn primary block', type: 'button', onclick: ui.closeSheet }, ['继续加油'])]
    });
    return true;
  }

  // ---------------- 食物库编辑 ----------------
  function foodEditSheet(food, onDone) {
    var isNew = !food;
    food = food || { name: '', kcal: '', portion: '1 份' };
    var nameInput = ui.input({ type: 'text', value: food.name, placeholder: '食物名称', maxlength: 40 });
    var kcalInput = ui.input({ type: 'number', value: food.kcal, placeholder: '热量', min: 0 });
    var portionInput = ui.input({ type: 'text', value: food.portion || '1 份', placeholder: '例如：1 份 / 100 克 / 1 杯' });

    ui.sheet({
      title: isNew ? '新建食物' : '编辑食物',
      children: [
        ui.field('名称', nameInput),
        el('div', { class: 'input-row' }, [
          ui.field('热量', el('div', { class: 'input-suffix' }, [kcalInput, el('span', { text: '千卡' })])),
          ui.field('份量', portionInput)
        ]),
        el('div', { class: 'small', text: '这里存的是「字典」——常用的东西建一次，以后记账点一下就填好。' })
      ],
      actions: [
        isNew ? null : el('button', {
          class: 'btn danger', type: 'button',
          onclick: function () {
            S.removeFood(food.id); ui.closeSheet(); U.toast('已删除'); if (onDone) onDone();
          }
        }, ['删除']),
        el('button', {
          class: 'btn primary', type: 'button', style: 'flex:2',
          onclick: function () {
            var name = nameInput.value.trim();
            var kcal = Number(kcalInput.value);
            if (!name) { U.toast('填个名字'); nameInput.focus(); return; }
            if (!(kcal >= 0) || kcalInput.value === '') { U.toast('填个热量'); kcalInput.focus(); return; }
            var payload = { name: name, kcal: kcal, portion: portionInput.value.trim() || '1 份' };
            if (isNew) S.addFood(payload); else S.updateFood(food.id, payload);
            ui.closeSheet();
            U.toast(isNew ? '已加入食物库' : '已保存');
            if (onDone) onDone();
          }
        }, [isNew ? '添加' : '保存'])
      ].filter(Boolean)
    });
  }

  /** 从常吃一键记上（用上次的热量） */
  function quickLog(food, onDone) {
    S.addMeal({ name: food.name, kcal: food.lastKcal || food.avgKcal || 0 });
    var limit = (S.profile() || {}).dailyLimit || 0;
    var after = S.kcalOn(U.todayKey());
    var scene = 'mealLogged';
    if (limit && after > limit) scene = 'overLimit';
    else if (limit && (limit - after) <= 200) scene = 'nearLimit';
    react(scene);
    if (onDone) onDone();
  }

  JF.actions = {
    react: react,
    addMealSheet: addMealSheet,
    weighSheet: weighSheet,
    foodEditSheet: foodEditSheet,
    quickLog: quickLog,
    checkMilestone: checkMilestone
  };
})(window.JF = window.JF || {});
