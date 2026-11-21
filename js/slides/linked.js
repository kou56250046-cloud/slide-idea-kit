/* 表とグラフの連動: 表の行に乗せると散布図の点が光る。散布図を範囲選択すると、表がその店舗に絞り込まれる */
(function () {
  'use strict';
  const { el, svg, ticks, fmtInt } = Lib;
  const CW = 900, CH = 640, L = 100, B = 70, T = 20, R = 50;
  const REGION_COL = { 北海道: '#22d3ee', 東北: '#4ade80', 関東: '#6ea8ff', 中部: '#fbbf24', 関西: '#f472b6', 九州: '#a78bfa' };

  let stores, body, chart, countEl, pts = {}, rows = {}, sel = null;

  function build() {
    const D = SalesData;
    return D.DIMS.store.values.map((store) => {
      const rs = D.filter(D.rows, { store });
      const sales = rs.reduce((s, x) => s + x.sales, 0), qty = rs.reduce((s, x) => s + x.qty, 0);
      return { store, region: rs[0].region, sales, qty, yoy: D.YOY[store] };
    });
  }

  function hover(store, on) {
    if (pts[store]) pts[store].classList.toggle('hot', on);
    if (rows[store]) rows[store].classList.toggle('hot', on);
  }
  function applySel() {
    let n = 0;
    for (const s of stores) {
      const inSel = !sel || sel.has(s.store);
      rows[s.store].classList.toggle('hide', !inSel);
      pts[s.store].classList.toggle('dim', !inSel);
      if (inSel) n++;
    }
    countEl.textContent = sel ? stores.length + ' 店舗中 ' + n + ' 店舗を選択（空いた所をクリックで解除）' : '散布図をドラッグして範囲を選ぶと、表が絞り込まれる';
  }

  Slides.register('linked', {
    title: '表とグラフの連動',
    tech: 'ホバーと範囲選択を共有',
    mount(root) {
      stores = build();
      body = el('div', { class: 'lk-body' });
      const head = el('div', { class: 'lk-row lk-head' }, ['店舗', '地域', '年間売上', '前年比'].map((t) => el('span', { text: t })));
      stores.slice().sort((a, b) => b.sales - a.sales).forEach((s) => {
        const row = el('div', { class: 'lk-row' },
          el('span', { text: s.store }), el('span', {}, el('i', { class: 'lk-dot', style: { background: REGION_COL[s.region] } }), s.region),
          el('span', { text: fmtInt(s.sales / 1e4) + ' 万円' }), el('span', { class: s.yoy >= 0 ? 'up' : 'down', text: (s.yoy > 0 ? '+' : '') + s.yoy.toFixed(1) + '%' }));
        row.addEventListener('pointerenter', () => hover(s.store, true));
        row.addEventListener('pointerleave', () => hover(s.store, false));
        rows[s.store] = row;
        body.appendChild(row);
      });
      chart = svg('svg', { viewBox: '0 0 ' + CW + ' ' + CH, class: 'lk-chart' });
      countEl = el('p', { class: 'hint' });
      root.append(Lib.head('LINKED VIEWS', '表とグラフを、同じものとして動かす', '行に乗せると点が光り、点に乗せると行が光る。散布図を囲むと、表がその店舗だけになる。'),
        el('div', { class: 'lk-layout' }, el('div', { class: 'lk-table' }, head, body), el('div', {}, chart, countEl)));

      /* 散布図: 横 = 売上、縦 = 前年比。点 = 店舗。右下は「大きいが伸びていない店」 */
      const xs = stores.map((s) => s.sales), Y0 = -20, Y1 = 30;
      const tx = ticks(Math.max(...xs) * 1.05, 5);
      const pw = CW - L - R, ph = CH - T - B;
      const X = (v) => L + v / tx.max * pw, Y = (v) => T + (Y1 - v) / (Y1 - Y0) * ph;
      for (let v = Y0; v <= Y1; v += 10) {
        chart.appendChild(svg('line', { x1: L, x2: L + pw, y1: Y(v), y2: Y(v), class: v ? 'grid' : 'axis0' }));
        chart.appendChild(svg('text', { x: L - 10, y: Y(v) + 6, class: 'tick', 'text-anchor': 'end', text: (v > 0 ? '+' : '') + v + '%' }));
      }
      for (const v of tx.values) if (v <= tx.max) chart.appendChild(svg('text', { x: X(v), y: T + ph + 32, class: 'tick', 'text-anchor': 'middle', text: v ? (v / 1e8).toFixed(1) + '億' : '0' }));
      chart.appendChild(svg('line', { x1: L, x2: L, y1: T, y2: T + ph, class: 'axis0' }));
      chart.appendChild(svg('text', { x: L + pw, y: CH - 6, class: 'axis-label', 'text-anchor': 'end', text: '年間売上 →' }));
      chart.appendChild(svg('text', { x: L + 10, y: T + 22, class: 'axis-label', text: '↑ 前年比' }));
      chart.appendChild(svg('text', { x: L + pw - 10, y: Y(-15), class: 'lk-zone', 'text-anchor': 'end', text: '大きいが伸びていない' }));
      chart.appendChild(svg('text', { x: L + 10, y: Y(21), class: 'lk-zone', text: '小さいが伸びている' }));
      const brush = svg('rect', { class: 'lk-brush', width: 0, height: 0 });
      chart.appendChild(brush);
      for (const s of stores) {
        const c = svg('circle', { cx: X(s.sales), cy: Y(s.yoy), r: 11, fill: REGION_COL[s.region], class: 'lk-pt' });
        c.appendChild(svg('title', { text: s.store }));
        c.addEventListener('pointerenter', () => hover(s.store, true));
        c.addEventListener('pointerleave', () => hover(s.store, false));
        chart.appendChild(c);
        pts[s.store] = c;
        s.px = X(s.sales); s.py = Y(s.yoy);
      }

      /* 範囲選択。座標は表示の拡大縮小を戻して SVG の座標にする */
      const toSvg = (e) => { const b = chart.getBoundingClientRect(); return [(e.clientX - b.left) * CW / b.width, (e.clientY - b.top) * CH / b.height]; };
      let start = null;
      chart.addEventListener('pointerdown', (e) => { start = toSvg(e); chart.setPointerCapture(e.pointerId); });
      chart.addEventListener('pointermove', (e) => {
        if (!start) return;
        const [x, y] = toSvg(e);
        brush.setAttribute('x', Math.min(x, start[0])); brush.setAttribute('y', Math.min(y, start[1]));
        brush.setAttribute('width', Math.abs(x - start[0])); brush.setAttribute('height', Math.abs(y - start[1]));
      });
      chart.addEventListener('pointerup', (e) => {
        if (!start) return;
        const [x, y] = toSvg(e), x0 = Math.min(x, start[0]), x1 = Math.max(x, start[0]), y0 = Math.min(y, start[1]), y1 = Math.max(y, start[1]);
        start = null;
        brush.setAttribute('width', 0); brush.setAttribute('height', 0);
        if (x1 - x0 < 6 && y1 - y0 < 6) { sel = null; applySel(); return; }
        sel = new Set(stores.filter((s) => s.px >= x0 && s.px <= x1 && s.py >= y0 && s.py <= y1).map((s) => s.store));
        applySel();
      });
      applySel();
    },
    start(sc) {
      sel = null;
      applySel();
      /* 最初に一度、売上の大きい店舗を自動で囲んで見せる */
      const top = stores.filter((s) => s.sales > 1e8 && s.yoy < 0);
      sc.timeout(() => { sel = new Set(top.map((s) => s.store)); applySel(); }, 1800);
      sc.timeout(() => { if (sel && sel.size === top.length) { sel = null; applySel(); } }, 5200);
    },
  });
})();
