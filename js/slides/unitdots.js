/* 1人を1点で見せる: 1000個の点が、全体 → 部門別 → 年代別 → 満足度別へ流れるように並び替わる */
(function () {
  'use strict';
  const { el, canvas, rng } = Lib;
  const W = 1760, H = 640, N = 1000, GAP = 13, BASE = 545;

  const DEPTS = [['営業', 0.3, '#6ea8ff'], ['製造', 0.35, '#a78bfa'], ['物流', 0.15, '#4ade80'], ['管理', 0.1, '#fbbf24'], ['開発', 0.1, '#f472b6']];
  const AGES = ['20代', '30代', '40代', '50代', '60代'];
  const SATS = ['とても不満', '不満', 'ふつう', '満足', 'とても満足'];
  const SAT_COL = ['#f87171', '#fb923c', '#94a3b8', '#86efac', '#4ade80'];

  /* ダミーの社員 1000 人 */
  function people() {
    const r = rng(5), out = [];
    for (let i = 0; i < N; i++) {
      let u = r(), d = 0;
      while (u > DEPTS[d][1] && d < DEPTS.length - 1) { u -= DEPTS[d][1]; d++; }
      const age = Math.min(4, Math.floor(Math.abs(r() + r() + r() - 1.5) * 2.2 + (d === 1 ? 1 : 0)));
      const sat = Math.max(0, Math.min(4, Math.round(2.4 + (d === 4 ? 0.8 : d === 2 ? -0.7 : 0) + (r() - 0.5) * 3)));
      out.push({ d, age, sat, x: W / 2, y: H / 2, fx: 0, fy: 0, tx: 0, ty: 0, delay: r() * 0.35 });
    }
    return out;
  }

  /* 並び方ごとに、目標座標・色・見出しを決める */
  const VIEWS = [
    { name: '全体', key: null, labels: ['社員 1,000 人（1点 = 1人）'] },
    { name: '部門別', key: 'd', labels: DEPTS.map((x) => x[0]) },
    { name: '年代別', key: 'age', labels: AGES },
    { name: '満足度別', key: 'sat', labels: SATS },
  ];
  function color(p, v) {
    if (v.key === 'sat') return SAT_COL[p.sat];
    return DEPTS[p.d][2];
  }
  function layout(ps, v) {
    if (!v.key) {
      const cols = 50, ox = (W - cols * 16) / 2;
      ps.forEach((p, i) => { p.tx = ox + (i % cols) * 16; p.ty = 130 + Math.floor(i / cols) * 20; });
      return [{ x: W / 2, label: v.labels[0], n: N }];
    }
    const groups = v.labels.map(() => []);
    ps.forEach((p) => groups[p[v.key]].push(p));
    const cw = W / groups.length, cols = 12;
    return groups.map((gp, gi) => {
      const cx = cw * gi + cw / 2, ox = cx - (cols * GAP) / 2;
      gp.forEach((p, k) => { p.tx = ox + (k % cols) * GAP; p.ty = BASE - Math.floor(k / cols) * GAP; });
      return { x: cx, label: v.labels[gi], n: gp.length };
    });
  }

  let cv, tabs, ps, cur = 0, heads = [], t = 1;

  function go(i) {
    cur = i;
    [...tabs.children].forEach((b, j) => b.classList.toggle('on', j === i));
    ps.forEach((p) => { p.fx = p.x; p.fy = p.y; });
    heads = layout(ps, VIEWS[i]);
    t = 0;
  }

  Slides.register('unitdots', {
    title: '1人を1点で見せる',
    tech: '1000個の点の並び替え',
    mount(root) {
      cv = canvas(W, H, 'ud-cv');
      tabs = el('div', { class: 'tabs' }, VIEWS.map((v, i) => el('button', { class: 'tab', text: v.name, onclick: () => go(i) })));
      root.append(Lib.head('UNIT VISUALIZATION', '割合ではなく、人数として見せる', '1つの点が1人。同じ1000人が、切り口を変えるたびに流れるように並び替わる。'), tabs, cv.el);
      ps = people();
    },
    start(sc) {
      ps.forEach((p, i) => { p.x = W / 2 + Math.cos(i) * 40; p.y = H / 2 + Math.sin(i) * 40; });
      go(0);
      let auto = 0;
      const ctx = cv.ctx;
      const font = getComputedStyle(document.body).fontFamily;
      sc.frame((dt) => {
        t += dt / 1.6;
        auto += dt;
        if (auto > 4.5) { auto = 0; go((cur + 1) % VIEWS.length); }
        ctx.clearRect(0, 0, W, H);
        const v = VIEWS[cur];
        for (const p of ps) {
          const e = Lib.easeInOutCubic(Lib.clamp((t - p.delay) / (1 - 0.35), 0, 1));
          p.x = Lib.lerp(p.fx, p.tx, e); p.y = Lib.lerp(p.fy, p.ty, e);
          ctx.fillStyle = color(p, v);
          ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
        }
        const a = Lib.clamp((t - 0.7) * 3, 0, 1);
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        for (const h of heads) {
          const y = v.key ? BASE + 46 : 96;
          ctx.fillStyle = '#e6edf7'; ctx.font = '700 28px ' + font; ctx.fillText(h.label, h.x, y);
          if (v.key) { ctx.fillStyle = '#8b98ad'; ctx.font = '22px ' + font; ctx.fillText(h.n + ' 人（' + (h.n / 10).toFixed(1) + '%）', h.x, y + 34); }
        }
        ctx.globalAlpha = 1;
      });
      sc.on(cv.el, 'click', () => go((cur + 1) % VIEWS.length));
    },
  });
})();
