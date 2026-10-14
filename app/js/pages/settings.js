/* 减肥姬 — 设置：改资料与目标、提醒、备份、关于小克 */
(function (JF) {
  'use strict';

  var U = JF.util;
  var S = JF.store;
  var ui = JF.ui;
  var el = U.el;

  var FACE_LABELS = {
    calm: '平静', happy: '开心', laugh: '大笑', cheer: '加油',
    shy: '害羞', serious: '认真', tired: '疲惫', angry: '生气', bashful: '腼腆'
  };

  /** 关于页里的制作人署名 */
  var MAKER = '白切';

  // ---------- 资料 ----------
  function profileSheet(nav) {
    var p = S.profile() || {};
    var nameI = ui.input({ type: 'text', value: p.name || '', placeholder: '我该怎么叫你' });
    var bdayI = ui.input({ type: 'date', value: p.birthday || '' });
    var genderS = ui.select([
      { value: 'female', label: '女生' },
      { value: 'male', label: '男生' }
    ], p.gender || 'female');
    var heightI = ui.input({ type: 'number', value: p.heightCm || '', placeholder: '例如 168' });
    var actS = ui.select(Object.keys(JF.calc.ACTIVITY).map(function (k) {
      return { value: k, label: JF.calc.ACTIVITY[k].label + '（' + JF.calc.ACTIVITY[k].hint + '）' };
    }), p.activity || 'sedentary');

    ui.sheet({
      title: '我的资料',
      children: [
        ui.field('称呼', nameI),
        ui.field('生日（那天我会祝福你）', bdayI),
        el('div', { class: 'input-row' }, [
          ui.field('性别', genderS),
          ui.field('身高', el('div', { class: 'input-suffix' }, [heightI, el('span', { text: '厘米' })]))
        ]),
        ui.field('平时活动量', actS),
        el('div', { class: 'small', text: '这些只用来算你每天能消耗多少，改完每日上限会自动重算。' })
      ],
      actions: [
        el('button', { class: 'btn ghost', type: 'button', onclick: ui.closeSheet }, ['取消']),
        el('button', {
          class: 'btn primary', type: 'button',
          onclick: function () {
            var name = nameI.value.trim();
            if (!name) { U.toast('总得有个称呼吧'); nameI.focus(); return; }
            var h = Number(heightI.value);
            if (!(h > 80 && h < 250)) { U.toast('身高填个正常数字'); heightI.focus(); return; }
            S.setProfile({
              name: name, birthday: bdayI.value || null, gender: genderS.value,
              heightCm: h, activity: actS.value
            });
            ui.closeSheet();
            U.toast('资料已更新');
            nav.refresh();
          }
        }, ['保存'])
      ]
    });
  }

  // ---------- 目标 ----------
  function goalSheet(nav) {
    var p = S.profile() || {};
    var cur = S.currentWeightKg();
    var targetI = ui.input({
      type: 'number', step: '0.5', inputmode: 'decimal',
      value: p.targetWeightKg !== null && p.targetWeightKg !== undefined ? p.targetWeightKg : ''
    });
    var speedS = ui.select(Object.keys(JF.calc.SPEED).map(function (k) {
      return { value: k, label: JF.calc.SPEED[k].label + ' —— ' + JF.calc.SPEED[k].hint };
    }), p.speed || 'normal');

    var preview = el('div', { class: 'card plain tight' });
    function updatePreview() {
      var tv = Number(targetI.value);
      if (!(tv > 0)) { U.clear(preview).appendChild(el('div', { class: 'small', text: '填个目标体重就能看到预估。' })); return; }
      var r = JF.calc.dailyLimit({
        weightKg: cur, heightCm: p.heightCm, age: U.ageFrom(p.birthday) || 30,
        gender: p.gender, activity: p.activity, speed: speedS.value
      });
      var days = JF.calc.daysToGoal(cur, tv, speedS.value);
      U.clear(preview);
      preview.appendChild(el('div', { class: 'small', text: '基础代谢 ' + r.bmr + ' 千卡 · 每日消耗约 ' + r.tdee + ' 千卡' }));
      preview.appendChild(el('div', { class: 'stat-v mt8' }, [String(r.limit), el('small', { text: '千卡 / 天（上限）' })]));
      if (days !== null) preview.appendChild(el('div', { class: 'small', text: '按这个速度大约还要 ' + days + ' 天减到目标' }));
      if (r.floored) preview.appendChild(el('div', { class: 'small', text: '已按健康下限保护，不会再往下压。' }));
    }
    targetI.addEventListener('input', updatePreview);
    speedS.addEventListener('change', updatePreview);

    ui.sheet({
      title: '减肥目标',
      children: [
        ui.field('目标体重', el('div', { class: 'input-suffix' }, [targetI, el('span', { text: '公斤' })])),
        ui.field('减重速度', speedS),
        preview,
        el('div', { class: 'small mt8', text: '当前体重 ' + (cur !== null ? U.fmtJin(cur) + ' 斤（' + cur + ' 公斤）' : '未知') })
      ],
      actions: [
        el('button', { class: 'btn ghost', type: 'button', onclick: ui.closeSheet }, ['取消']),
        el('button', {
          class: 'btn primary', type: 'button',
          onclick: function () {
            var tv = Number(targetI.value);
            if (!(tv > 20 && tv < 300)) { U.toast('目标填个正常数字'); targetI.focus(); return; }
            if (cur !== null && tv >= cur) { U.toast('目标要比现在轻才对呀'); return; }
            S.setProfile({ targetWeightKg: tv, speed: speedS.value });
            ui.closeSheet();
            U.toast('目标已更新，每日上限 ' + (S.profile().dailyLimit) + ' 千卡');
            nav.refresh();
          }
        }, ['保存'])
      ],
      onOpen: updatePreview
    });
  }

  // ---------- 备份 ----------
  function exportBackup() {
    var json = S.exportJson();
    var stamp = U.todayKey().replace(/-/g, '');
    var name = '减肥姬-备份-' + stamp + '.json';
    try {
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = el('a', { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 800);
      U.toast('已导出：' + name);
    } catch (e) {
      // 兜底：把内容放到文本框里让用户自己复制
      var ta = el('textarea', { class: 'textarea' });
      ta.value = json;
      ui.sheet({
        title: '复制这份备份',
        children: [el('div', { class: 'small', text: '自动下载没成功，请手动全选复制下面内容，存成 .json 文件。' }), ta]
      });
    }
  }

  function importBackup(nav) {
    var file = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    document.body.appendChild(file);
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        ui.confirm({
          title: '导入备份？',
          text: '这会用备份里的内容覆盖现在机器上的全部数据（饮食记录、体重、日记、食物库）。',
          ok: '覆盖导入', danger: true
        }).then(function (yes) {
          if (!yes) return;
          try {
            S.importJson(String(reader.result));
            U.toast('导入成功');
            nav.refresh();
          } catch (e) {
            U.toast('这个文件读不了：' + (e.message || '格式不对'));
          }
        });
      };
      reader.readAsText(f);
      document.body.removeChild(file);
    });
    file.click();
  }

  // ---------- 页面 ----------
  function render(host, nav) {
    U.clear(host);
    var p = S.profile() || {};
    var c = JF.chloe.active();
    var aff = S.affectionLevel();
    var native = JF.native;

    // 小克
    host.appendChild(ui.card({
      title: '陪我的人',
      children: [
        el('div', { class: 'chara-head' }, [
          el('img', { class: 'chara-face', src: JF.chloe.facePath('calm'), alt: '' }),
          el('div', { class: 'chara-body' }, [
            el('div', { class: 'chara-name' }, [c.name, el('span', { class: 'chara-en', text: ' ' + c.nameEn })]),
            el('div', { class: 'small', text: c.intro }),
            el('div', { class: 'aff-heart mt8', text: '好感度 ' + aff.points + ' · ' + aff.name }),
            aff.nextAt ? el('div', { class: 'small', text: '再 ' + aff.toNext + ' 点升级' }) : null
          ].filter(Boolean))
        ]),
        el('div', { class: 'small mt12 mb8', text: '她现在的表情（点一下可以看大图）' }),
        el('div', { class: 'face-grid' }, Object.keys(c.assets.faces).map(function (k) {
          return el('div', {
            class: 'face-cell', title: FACE_LABELS[k] || k,
            onclick: function () {
              ui.sheet({
                title: FACE_LABELS[k] || k,
                children: [el('img', { src: JF.chloe.facePath(k), style: 'width:100%;border-radius:16px;display:block' })]
              });
            }
          }, [
            el('img', { src: JF.chloe.facePath(k), alt: '' }),
            el('b', { text: FACE_LABELS[k] || k })
          ]);
        })),
        el('div', { class: 'small mt12', text: '已经解锁 ' + S.state().milestones.length + '/10 个减重里程碑' })
      ].filter(Boolean)
    }));

    // 我的资料
    host.appendChild(ui.card({
      title: '我的资料',
      action: ui.linkBtn('修改', function () { profileSheet(nav); }),
      children: [
        el('div', { class: 'kv' }, [el('span', { text: '称呼' }), el('b', { text: p.name || '—' })]),
        el('div', { class: 'kv' }, [el('span', { text: '生日' }), el('b', { text: p.birthday || '—' })]),
        el('div', { class: 'kv' }, [el('span', { text: '性别' }), el('b', { text: p.gender === 'male' ? '男生' : '女生' })]),
        el('div', { class: 'kv' }, [el('span', { text: '身高' }), el('b', { text: (p.heightCm || '—') + ' 厘米' })]),
        el('div', { class: 'kv' }, [el('span', { text: '活动量' }), el('b', { text: (JF.calc.ACTIVITY[p.activity] || {}).label || '—' })])
      ]
    }));

    // 目标
    host.appendChild(ui.card({
      title: '我的目标',
      action: ui.linkBtn('修改', function () { goalSheet(nav); }),
      children: [
        el('div', { class: 'kv' }, [el('span', { text: '起点体重' }), el('b', { text: p.startWeightKg ? U.fmtJin(p.startWeightKg) + ' 斤' : '—' })]),
        el('div', { class: 'kv' }, [el('span', { text: '目标体重' }), el('b', { text: p.targetWeightKg ? U.fmtJin(p.targetWeightKg) + ' 斤' : '—' })]),
        el('div', { class: 'kv' }, [el('span', { text: '减重速度' }), el('b', { text: (JF.calc.SPEED[p.speed] || JF.calc.SPEED.normal).label })]),
        el('div', { class: 'kv' }, [el('span', { text: '基础代谢' }), el('b', { text: (p.bmr || '—') + ' 千卡' })]),
        el('div', { class: 'kv' }, [el('span', { text: '每日消耗约' }), el('b', { text: (p.tdee || '—') + ' 千卡' })]),
        el('div', { class: 'kv' }, [el('span', { text: '每日热量上限' }), el('b', { text: (p.dailyLimit || '—') + ' 千卡' })])
      ]
    }));

    // 提醒
    var notifyToggle = el('button', {
      class: 'chip' + (S.state().settings.notify ? ' on' : ''), type: 'button',
      onclick: function () {
        var nu = !S.state().settings.notify;
        S.setSetting('notify', nu);
        if (JF.notify && JF.notify.sync) JF.notify.sync();
        nav.refresh();
      }
    }, [S.state().settings.notify ? '已开启' : '已关闭']);

    host.appendChild(ui.card({
      title: '提醒',
      children: [
        el('div', { class: 'kv' }, [el('span', { text: '超过 23 小时没记录就提醒我' }), notifyToggle]),
        el('div', { class: 'kv' }, [
          el('span', { text: '免打扰时段' }),
          el('b', { text: S.state().settings.quietStart + ' – ' + S.state().settings.quietEnd })
        ]),
        el('div', { class: 'small mt8', text: '免打扰时段内不会弹通知，会顺延到时段结束后再提醒。' })
      ]
    }));

    // 桌面专属
    if (native && native.setAutostart) {
      var autoOn = S.state().settings.autostart;
      host.appendChild(ui.card({
        title: '电脑上',
        children: [
          el('div', { class: 'kv' }, [
            el('span', { text: '开机自动启动' }),
            el('button', {
              class: 'chip' + (autoOn ? ' on' : ''), type: 'button',
              onclick: function () {
                var nu = !S.state().settings.autostart;
                S.setSetting('autostart', nu);
                try { native.setAutostart(nu); } catch (e) { /* 忽略 */ }
                nav.refresh();
              }
            }, [autoOn ? '已开启' : '已关闭'])
          ]),
          el('div', { class: 'small mt8', text: '关闭窗口不会退出程序，它会待在右下角托盘里继续帮你计时。想彻底退出：右键托盘图标 → 退出。' })
        ]
      }));
    }

    // 数据
    host.appendChild(ui.card({
      title: '我的数据',
      hint: '全部存在这台设备上',
      children: [
        el('div', { class: 'small mb8', text: '换手机、重装之前记得导出一次。卸载 App 会把数据一起删掉。' }),
        el('div', { class: 'btn-row' }, [
          el('button', { class: 'btn sm', type: 'button', onclick: exportBackup }, ['导出备份']),
          el('button', { class: 'btn sm ghost', type: 'button', onclick: function () { importBackup(nav); } }, ['导入备份'])
        ]),
        el('button', {
          class: 'btn danger block mt12', type: 'button',
          onclick: function () {
            ui.confirm({
              title: '清空全部数据？',
              text: '饮食记录、体重、日记、食物库、好感度都会没掉，而且不能恢复。建议先导出备份。',
              ok: '确认清空', danger: true
            }).then(function (yes) {
              if (!yes) return;
              S.resetAll();
              U.toast('已清空');
              if (JF.app && JF.app.restart) JF.app.restart();
            });
          }
        }, ['清空全部数据'])
      ]
    }));

    // 关于
    host.appendChild(ui.card({
      title: '关于',
      children: [
        el('div', { class: 'kv' }, [el('span', { text: 'App' }), el('b', { text: '减肥姬' })]),
        el('div', { class: 'kv' }, [el('span', { text: '当前角色' }), el('b', { text: c.name + ' / ' + c.nameEn })]),
        el('div', { class: 'kv' }, [el('span', { text: '制作人' }), el('b', { text: MAKER })])
      ]
    }));
  }

  JF.pages = JF.pages || {};
  JF.pages.settings = { render: render, profileSheet: profileSheet, goalSheet: goalSheet };
})(window.JF = window.JF || {});
