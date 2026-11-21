/* 数字が数え上がる KPI と、順に組み上がるグラフ */
(function () {
  'use strict';
  const { el, svg, clear } = Lib;
  const CARDS = [
    { k: '売上（今期累計）', v: 12.4, fmt: (x) => x.toFixed(1) + '億円', d: '+8.2%', up: true, spark: [8, 9, 8.5, 9.6, 10.2, 10.8, 11.1, 12.4] },
    { k: '受注件数', v: 3482, fmt: (x) => Math.round(x).toLocaleString() + '件', d: '+12.0%', up: true, spark: [2600, 2700, 2900, 2850, 3100, 3200, 3350, 3482] },
    { k: '解約率', v: 2.1, fmt: (x) => x.toFixed(1) + '%', d: '−0.4pt', up: true, spark: [3.1, 2.9, 2.8, 2.7, 2.5, 2.4, 2.2, 2.1] },
    { k: '顧客満足度', v: 4.6, fmt: (x) => x.toFixed(1), d: '+0.2', up: true, spark: [4.2, 4.3, 4.3, 4.4, 4.4, 4.5, 4.5, 4.6] },
  ];
  const MONTHS = [62, 70, 68, 75, 81, 79, 88, 92, 90, 97, 118, 104];

  let cards, bars, note;

  function sparkPath(vals) {
    const min = Math.min(...vals), max = Math.max(...vals);
    return vals.map((v, i) => (i ? 'L' : 'M') + (i * 300 / (vals.length - 1)).toFixed(1) + ',' + (54 - (v - min) / (max - min || 1) * 48).toFixed(1)).join('');
  }

  Slides.register('kpi', {
    title: '数え上がる KPI',
    tech: 'カウントアップと時間差の表示',
    mount(root) {
      cards = CARDS.map((c) => {
        const num = el('div', { class: 'kp-num' });
        const line = svg('path', { d: sparkPath(c.spark), class: 'kp-line', pathLength: 1 });
        const card = el('div', { class: 'kp-card' },
          el('div', { class: 'kp-k', text: c.k }), num,
          el('div', { class: 'kp-d ' + (c.up ? 'up' : 'down'), text: '前期比 ' + c.d }),
          svg('svg', { viewBox: '0 0 300 60', class: 'kp-spark' }, line));
        return { card, num, c };
      });
      bars = svg('svg', { viewBox: '0 0 1760 400', class: 'kp-bars' });
      note = el('div', { class: 'kp-note', text: '11月に月間売上が過去最高（1.18億円）。年末商戦の前倒しが効いた。' });
      root.append(Lib.head('KPI', '数字は数え上げ、グラフは順に組み上げる', '一度に全部を出さず、目で追える順に見せる。'),
        el('div', { class: 'kp-row' }, cards.map((x) => x.card)), bars, note);
    },
    start(sc) {
      cards.forEach((x) => { x.card.classList.remove('in'); x.num.textContent = x.c.fmt(0); });
      note.classList.remove('in');
      clear(bars);
      const max = 120, bw = 100, gap = 40, base = 340;
      const rects = MONTHS.map((v, i) => {
        const x = 40 + i * (bw + gap);
        const r = svg('rect', { x, y: base, width: bw, height: 0, rx: 6, fill: i === 10 ? '#6ea8ff' : '#334155' });
        bars.append(r, svg('text', { x: x + bw / 2, y: base + 40, class: 'tick', 'text-anchor': 'middle', text: (i + 1) + '月' }));
        return { r, h: v / max * 300 };
      });
      bars.appendChild(svg('line', { x1: 20, x2: 1740, y1: base, y2: base, class: 'axis0' }));
      void bars.getBoundingClientRect();

      cards.forEach((x, i) => {
        sc.timeout(() => {
          x.card.classList.add('in');
          sc.tween(1600, (e) => { x.num.textContent = x.c.fmt(x.c.v * e); });
        }, 300 + i * 250);
      });
      rects.forEach((b, i) => {
        sc.timeout(() => sc.tween(600, (e) => { b.r.setAttribute('y', base - b.h * e); b.r.setAttribute('height', b.h * e); }), 1700 + i * 110);
      });
      sc.timeout(() => note.classList.add('in'), 1700 + 12 * 110 + 500);
    },
  });
})();
