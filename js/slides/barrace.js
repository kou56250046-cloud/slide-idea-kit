/* 棒グラフのレース: 年の間を補間し、順位が入れ替わると棒が滑って並び替わる */
(function () {
  'use strict';
  const { el, rng, fmtInt } = Lib;
  const NAMES = ['製品 Aurora', '製品 Breeze', '製品 Cobalt', '製品 Dune', '製品 Ember', '製品 Fjord', '製品 Glacier', '製品 Harbor'];
  const COLORS = ['#6ea8ff', '#a78bfa', '#4ade80', '#fbbf24', '#f87171', '#22d3ee', '#fb923c', '#f472b6'];
  const Y0 = 2015, Y1 = 2026, ROW = 88, SEC = 1.1;

  /* ダミーの年別売上。製品ごとに伸び方を変え、途中で順位が入れ替わるようにする */
  function makeData() {
    const r = rng(42);
    return NAMES.map((name, i) => {
      let v = 200 + r() * 600;
      const g = 0.02 + r() * 0.25, late = r() < 0.4 ? 0.25 : 0;
      const vals = [];
      for (let y = Y0; y <= Y1; y++) {
        vals.push(v);
        v *= 1 + g * (0.5 + r()) + (y > 2020 ? late : 0) - (y > 2022 && i % 3 === 0 ? 0.15 : 0);
      }
      return { name, color: COLORS[i], vals };
    });
  }

  let rows, yearEl, data;

  Slides.register('barrace', {
    title: '棒グラフのレース',
    tech: '年の間を補間して順位を入れ替え',
    mount(root) {
      data = makeData();
      const box = el('div', { class: 'br-box' });
      rows = data.map((d) => {
        const fill = el('div', { class: 'br-fill', style: { background: d.color } });
        const val = el('span', { class: 'br-val' });
        const row = el('div', { class: 'br-row' }, el('span', { class: 'br-name', text: d.name }), el('div', { class: 'br-track' }, fill, val));
        box.appendChild(row);
        return { row, fill, val, y: 0 };
      });
      yearEl = el('div', { class: 'br-year' });
      root.append(Lib.head('BAR CHART RACE', '順位の入れ替わりを、動きで見せる', '年ごとの売上（ダミー）。年と年の間を補間し、順位が変わると棒が滑って並び替わる。'), box, yearEl);
    },
    start(sc) {
      let t = 0, first = true;
      sc.frame((dt) => {
        t = Math.min(Y1 - Y0, t + dt / SEC);
        const yi = Math.min(Y1 - Y0 - 1, Math.floor(t)), f = Lib.easeInOutCubic(t - yi);
        const cur = data.map((d) => Lib.lerp(d.vals[yi], d.vals[yi + 1], t >= Y1 - Y0 ? 1 : f));
        const max = Math.max(...cur);
        const order = cur.map((v, i) => i).sort((a, b) => cur[b] - cur[a]);
        order.forEach((i, rank) => {
          const r = rows[i];
          const target = rank * ROW;
          r.y = first ? target : r.y + (target - r.y) * Math.min(1, dt * 7);
          r.row.style.transform = 'translateY(' + r.y.toFixed(1) + 'px)';
          r.fill.style.width = (cur[i] / max * 100).toFixed(2) + '%';
          r.val.textContent = fmtInt(cur[i]) + ' 百万円';
        });
        first = false;
        yearEl.textContent = String(Y0 + Math.round(t));
      });
    },
  });
})();
