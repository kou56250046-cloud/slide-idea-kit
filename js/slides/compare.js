/* 前後比較: 2枚の図を重ね、つまみの位置で上の図を切り抜く */
(function () {
  'use strict';
  const { el, svg } = Lib;
  const W = 1400, H = 700;
  const DATA = [['A部門', 820, 760], ['B部門', 1190, 900], ['C部門', 640, 700], ['D部門', 980, 1010], ['E部門', 450, 520]];

  /* 改善前: 色が多い、目盛りが細かい、凡例が遠い、結論がない */
  function before() {
    const s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'cmp-svg' });
    s.appendChild(svg('rect', { width: W, height: H, fill: '#f4ecd8' }));
    s.appendChild(svg('text', { x: 40, y: 60, 'font-size': 30, fill: '#333', text: '部門別売上推移比較表（前年度・今年度）' }));
    for (let i = 0; i <= 24; i++) s.appendChild(svg('line', { x1: 120, x2: 1100, y1: 120 + i * 22, y2: 120 + i * 22, stroke: '#b9ad90', 'stroke-width': 1 }));
    const rainbow = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe'];
    DATA.forEach(([, a, b], i) => {
      const x = 160 + i * 190;
      [a, b].forEach((v, j) => {
        const h = v * 0.4;
        s.appendChild(svg('rect', { x: x + j * 70, y: 648 - h, width: 60, height: h, fill: rainbow[i * 2 + j], stroke: '#000', 'stroke-width': 2 }));
        s.appendChild(svg('rect', { x: x + j * 70 + 60, y: 648 - h + 10, width: 12, height: h - 10, fill: '#00000055' }));
        s.appendChild(svg('text', { x: x + j * 70 + 4, y: 640 - h, 'font-size': 13, fill: '#555', text: v.toFixed(1) }));
      });
    });
    s.appendChild(svg('rect', { x: 1140, y: 120, width: 230, height: 420, fill: '#fff', stroke: '#999' }));
    DATA.forEach(([n], i) => [0, 1].forEach((j) => {
      s.appendChild(svg('rect', { x: 1160, y: 140 + (i * 2 + j) * 38, width: 22, height: 22, fill: rainbow[i * 2 + j] }));
      s.appendChild(svg('text', { x: 1192, y: 158 + (i * 2 + j) * 38, 'font-size': 16, fill: '#333', text: n + (j ? '（今年度）' : '（前年度）') }));
    }));
    return s;
  }

  /* 改善後: 結論を見出しに、注目する1本だけ色、値は棒の横に直接 */
  function after() {
    const s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'cmp-svg' });
    s.appendChild(svg('rect', { width: W, height: H, fill: '#101624' }));
    s.appendChild(svg('text', { x: 60, y: 80, 'font-size': 44, 'font-weight': 700, fill: '#e6edf7', text: 'B部門が前年比 +32% で全社を牽引' }));
    s.appendChild(svg('text', { x: 60, y: 125, 'font-size': 22, fill: '#8b98ad', text: '今年度の売上（百万円）。灰色の線は前年度' }));
    const sorted = DATA.slice().sort((a, b) => b[1] - a[1]);
    sorted.forEach(([n, a, b], i) => {
      const y = 180 + i * 98, hot = n === 'B部門';
      s.appendChild(svg('text', { x: 200, y: y + 44, 'font-size': 30, fill: hot ? '#e6edf7' : '#8b98ad', 'text-anchor': 'end', text: n }));
      const K = 0.7;
      s.appendChild(svg('rect', { x: 230, y: y + 10, width: a * K, height: 52, rx: 6, fill: hot ? '#6ea8ff' : '#334155' }));
      s.appendChild(svg('line', { x1: 230 + b * K, x2: 230 + b * K, y1: y + 2, y2: y + 70, stroke: '#8b98ad', 'stroke-width': 3 }));
      const d = ((a / b - 1) * 100).toFixed(0);
      /* 値は棒と前年線の右側に置く */
      s.appendChild(svg('text', { x: 250 + Math.max(a, b) * K, y: y + 46, 'font-size': 28, 'font-weight': hot ? 700 : 400, fill: hot ? '#6ea8ff' : '#8b98ad', text: a.toLocaleString() + '　' + (d >= 0 ? '+' : '') + d + '%' }));
    });
    return s;
  }

  let wrap, top, handle, pos = 50;
  function setPos(p) {
    pos = Lib.clamp(p, 0, 100);
    top.style.clipPath = 'inset(0 0 0 ' + pos + '%)';
    handle.style.left = pos + '%';
  }

  Slides.register('compare', {
    title: '前後比較スライダー',
    tech: 'clip-path で切り抜き',
    mount(root) {
      top = el('div', { class: 'cmp-layer top' }, after());
      handle = el('div', { class: 'cmp-handle' }, el('span', { text: '◀ ▶' }));
      wrap = el('div', { class: 'cmp-wrap' },
        el('div', { class: 'cmp-layer' }, before()), top, handle,
        el('span', { class: 'cmp-tag l', text: 'BEFORE' }), el('span', { class: 'cmp-tag r', text: 'AFTER' }));
      root.append(Lib.head('BEFORE / AFTER', 'つまみを左右に動かして、改善前と後を見比べる', '同じデータを2通りに描いて重ねている。ドラッグで境目が動く。'), wrap);
    },
    start(sc) {
      let drag = false;
      const move = (e) => { const r = wrap.getBoundingClientRect(); setPos((e.clientX - r.left) / r.width * 100); };
      sc.on(wrap, 'pointerdown', (e) => { drag = true; wrap.setPointerCapture(e.pointerId); move(e); });
      sc.on(wrap, 'pointermove', (e) => { if (drag) move(e); });
      sc.on(wrap, 'pointerup', () => { drag = false; });
      /* 最初に一度、自動で端から端まで動かして見せる */
      setPos(100);
      (async () => {
        await sc.wait(500);
        await sc.tween(1600, (e) => { if (!drag) setPos(100 - 100 * e); }, Lib.easeInOutCubic);
        await sc.tween(1200, (e) => { if (!drag) setPos(50 * e); }, Lib.easeInOutCubic);
      })();
    },
  });
})();
