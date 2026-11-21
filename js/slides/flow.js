/* 粒子で流れを見せる: 案件が工程を流れ、手作業の工程で詰まる様子を点の動きで見せる */
(function () {
  'use strict';
  const { el, canvas, slider } = Lib;
  const W = 1760, H = 680;
  const NODES = {
    in: [120, 340, '受付'], judge: [440, 340, '振り分け'],
    auto: [820, 170, '自動処理'], manual: [820, 510, '手作業で確認'], out: [1220, 340, '完了'],
  };
  const SPEED = 420; /* px/秒 */
  const SERVERS = 2, SERVICE = 1.1; /* 手作業: 担当2名、1件あたり平均1.1秒 */

  let cv, autoRate = 0.3, rateSl, statBox;

  function seg(a, b) { return [NODES[a][0], NODES[a][1], NODES[b][0], NODES[b][1]]; }

  Slides.register('flow', {
    title: '粒子で流れを見せる',
    tech: 'canvas の粒子',
    mount(root) {
      cv = canvas(W, H, 'fl-cv');
      rateSl = slider({ label: '自動化率', min: 0, max: 100, step: 5, value: 30, format: (v) => v + '%', onInput: (v) => { autoRate = v / 100; } });
      statBox = el('div', { class: 'fl-stats' });
      root.append(Lib.head('PARTICLE FLOW', '案件の流れを、点の動きで見せる', '1つの点が1件。手作業の工程に点がたまる。自動化率を上げると詰まりが消える。'),
        el('div', { class: 'fl-wrap' }, cv.el, el('div', { class: 'fl-side' }, rateSl.el, statBox)));
    },
    start(sc) {
      autoRate = rateSl.value / 100;
      const ctx = cv.ctx;
      let parts = [], queue = [], serving = [], spawn = 0, done = 0, now = 0;
      const leads = [];
      const mk = () => ({ legs: [seg('in', 'judge')], leg: 0, t: 0, born: now, kind: 'new' });
      const font = '600 24px ' + getComputedStyle(document.body).fontFamily;
      let statT = 1;

      sc.frame((dt) => {
        now += dt;
        spawn += dt * 5.5;
        while (spawn >= 1) { spawn--; parts.push(mk()); }

        for (const p of parts) {
          if (p.wait) continue;
          const [x1, y1, x2, y2] = p.legs[p.leg];
          p.t += (dt * SPEED) / Math.hypot(x2 - x1, y2 - y1);
          if (p.t < 1) continue;
          p.t = 0;
          const end = p.leg === p.legs.length - 1;
          if (!end) { p.leg++; continue; }
          if (p.kind === 'new') {
            p.kind = Math.random() < autoRate ? 'auto' : 'manual';
            p.legs = [seg('judge', p.kind)]; p.leg = 0;
          } else if (p.kind === 'auto' || p.kind === 'served') {
            if (p.legs[0][2] === NODES.out[0]) { p.gone = true; done++; leads.push(now - p.born); if (leads.length > 60) leads.shift(); }
            else { p.legs = [seg(p.kind === 'auto' ? 'auto' : 'manual', 'out')]; p.leg = 0; }
          } else if (p.kind === 'manual') {
            p.wait = true; queue.push(p);
          }
        }
        /* 手作業の窓口: 空いていれば待ち行列の先頭を処理する */
        serving = serving.filter((sv) => {
          sv.left -= dt;
          if (sv.left > 0) return true;
          const p = sv.p; p.wait = false; p.kind = 'served'; p.legs = [seg('manual', 'out')]; p.leg = 0;
          return false;
        });
        while (serving.length < SERVERS && queue.length) serving.push({ p: queue.shift(), left: -Math.log(1 - Math.random()) * SERVICE });
        parts = parts.filter((p) => !p.gone);

        /* 描画 */
        ctx.clearRect(0, 0, W, H);
        ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a2233';
        for (const [a, b] of [['in', 'judge'], ['judge', 'auto'], ['judge', 'manual'], ['auto', 'out'], ['manual', 'out']]) {
          const [x1, y1, x2, y2] = seg(a, b);
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
        const jam = Math.min(1, queue.length / 40);
        for (const k in NODES) {
          const [x, y, name] = NODES[k];
          ctx.fillStyle = k === 'manual' ? 'rgb(' + Math.round(40 + 180 * jam) + ',40,60)' : '#22304a';
          ctx.beginPath(); ctx.arc(x, y, 58, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e6edf7'; ctx.font = font; ctx.textAlign = 'center';
          ctx.fillText(name, x, y + 96);
        }
        /* 待ち行列は窓口の左に積み上げる */
        queue.forEach((p, i) => {
          if (i >= 150) return; /* 描くのは150件まで。件数は右の数字で出す */
          const col = i % 10, row = Math.floor(i / 10);
          ctx.fillStyle = '#f87171';
          ctx.beginPath(); ctx.arc(NODES.manual[0] - 90 - row * 18, NODES.manual[1] - 80 + col * 18, 6, 0, Math.PI * 2); ctx.fill();
        });
        for (const p of parts) {
          if (p.wait) continue;
          const [x1, y1, x2, y2] = p.legs[p.leg];
          ctx.fillStyle = p.kind === 'auto' ? '#4ade80' : p.kind === 'served' ? '#fbbf24' : p.kind === 'manual' ? '#f87171' : '#6ea8ff';
          ctx.beginPath(); ctx.arc(x1 + (x2 - x1) * p.t, y1 + (y2 - y1) * p.t, 7, 0, Math.PI * 2); ctx.fill();
        }
        statT += dt;
        if (statT < 0.25) return;
        statT = 0;
        const avg = leads.length ? leads.reduce((a, b) => a + b, 0) / leads.length : 0;
        statBox.textContent = '';
        statBox.append(
          el('div', { class: 'stat' }, el('span', { class: 'stat-k', text: '手作業の待ち' }), el('span', { class: 'stat-v' + (queue.length > 20 ? ' bad' : ''), text: queue.length + ' 件' })),
          el('div', { class: 'stat' }, el('span', { class: 'stat-k', text: '直近60件の平均所要' }), el('span', { class: 'stat-v', text: avg.toFixed(1) + ' 秒' })),
          el('div', { class: 'stat' }, el('span', { class: 'stat-k', text: '完了' }), el('span', { class: 'stat-v', text: done + ' 件' })),
          el('p', { class: 'fl-legend', text: '● 青: 受付 → 振り分け　● 緑: 自動　● 赤: 手作業待ち　● 黄: 確認済み' }));
      });
    },
  });
})();
