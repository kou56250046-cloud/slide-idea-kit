/* ピボット操作: 行・列・値・集計方法を切り替えると、集計表と積み上げ棒グラフがその場で組み替わる */
(function () {
  'use strict';
  const { el, svg, clear, ticks, fmtInt } = Lib;
  const CW = 700, CH = 640;
  const ROWS = [['region', '地域'], ['product', '商品'], ['month', '月']];
  const COLS = [[null, 'なし'], ['product', '商品'], ['region', '地域'], ['month', '月']];
  const MEASURES = [['sales', '売上'], ['qty', '販売数']];
  const FNS = [['sum', '合計'], ['avg', '平均'], ['count', '件数'], ['share', '構成比']];

  const state = { row: 'region', col: 'product', measure: 'sales', fn: 'sum' };
  let groups, tableBox, chart, note, prev = new Map(), scRef, rootEl;

  function fmt(v) {
    if (state.fn === 'share') return v.toFixed(1) + '%';
    if (state.fn === 'count') return fmtInt(v);
    if (state.measure === 'sales') return fmtInt(v / 1e4) + (state.fn === 'avg' ? '' : '');
    return state.fn === 'avg' ? v.toFixed(1) : fmtInt(v);
  }
  const unit = () => (state.fn === 'share' ? '%' : state.fn === 'count' ? '件（行数）' : state.measure === 'sales' ? '万円' : '個');
  const colorOf = (i, n) => 'hsl(' + Math.round(210 + (i / Math.max(1, n)) * 150) % 360 + ',65%,62%)';

  function group(label, opts, key, onChange) {
    const box = el('div', { class: 'pv-group' }, el('div', { class: 'pv-k', text: label }));
    const btns = el('div', { class: 'tabs' });
    opts.forEach(([v, name]) => btns.appendChild(el('button', { class: 'tab', 'data-v': String(v), text: name, onclick: () => { state[key] = v; onChange && onChange(); render(); } })));
    box.appendChild(btns);
    return { box, btns, key };
  }
  function syncButtons() {
    for (const g of groups) {
      [...g.btns.children].forEach((b) => {
        b.classList.toggle('on', b.dataset.v === String(state[g.key]));
        /* 列に行と同じ項目は選べない */
        b.disabled = g.key === 'col' && b.dataset.v === state.row;
      });
    }
  }

  function render() {
    if (state.col === state.row) state.col = null;
    syncButtons();
    const D = SalesData, a = D.aggregate(D.rows, state.row, state.col, state.measure, state.fn);
    const lab = (dim, v) => (dim ? D.label(dim, v) : v);
    /* 表 */
    clear(tableBox);
    const cols = a.colKeys.length + 2;
    const grid = el('div', { class: 'pv-grid', style: { gridTemplateColumns: '120px repeat(' + (cols - 2) + ', minmax(0, 1fr)) minmax(96px, 1.3fr)' } });
    grid.appendChild(el('span', { class: 'pv-h corner', text: D.DIMS[state.row].label + ' ＼ ' + (state.col ? D.DIMS[state.col].label : '') }));
    /* 列見出しに、グラフの色と同じ印を付ける（凡例を兼ねる） */
    a.colKeys.forEach((c, j) => grid.appendChild(el('span', { class: 'pv-h' }, state.col ? el('i', { class: 'pv-sw', style: { background: colorOf(j, a.colKeys.length) } }) : null, lab(state.col, c))));
    grid.appendChild(el('span', { class: 'pv-h total', text: '総計' }));
    const nums = [];
    const cell = (key, v, cls) => {
      const s = el('span', { class: 'pv-c ' + (cls || '') });
      nums.push({ s, from: prev.has(key) ? prev.get(key) : 0, to: v, key });
      grid.appendChild(s);
    };
    a.rowKeys.forEach((r, i) => {
      grid.appendChild(el('span', { class: 'pv-rh', text: lab(state.row, r) }));
      a.colKeys.forEach((c, j) => cell(r + '|' + c, a.cells[i][j]));
      cell(r + '|総計', a.rowTotals[i], 'total');
    });
    grid.appendChild(el('span', { class: 'pv-rh total', text: '総計' }));
    a.colKeys.forEach((c, j) => cell('総計|' + c, a.colTotals[j], 'total'));
    cell('総計|総計', a.total, 'total grand');
    tableBox.appendChild(grid);
    note.textContent = '単位: ' + unit() + '　／　データ 1,080 行（ダミー）を、この画面の中で集計している';

    /* 積み上げ棒（平均は積み上げると意味がないので、列ごとに横へ並べる） */
    clear(chart);
    const stacked = state.fn !== 'avg';
    const L = 110, B = 60, T = 20, pw = CW - L - 20, ph = CH - T - B;
    const maxV = stacked ? Math.max(...a.rowKeys.map((_, i) => a.cells[i].reduce((s, v) => s + v, 0))) : Math.max(...a.cells.flat());
    const tk = ticks(maxV, 5);
    for (const v of tk.values) {
      const y = T + ph - v / tk.max * ph;
      chart.appendChild(svg('line', { x1: L, x2: L + pw, y1: y, y2: y, class: v ? 'grid' : 'axis0' }));
      chart.appendChild(svg('text', { x: L - 8, y: y + 6, class: 'tick', 'text-anchor': 'end', text: fmt(v) }));
    }
    const bw = pw / a.rowKeys.length;
    const rects = [];
    a.rowKeys.forEach((r, i) => {
      let acc = 0;
      chart.appendChild(svg('text', { x: L + bw * (i + 0.5), y: CH - 30, class: 'tick', 'text-anchor': 'middle', text: lab(state.row, r) }));
      a.colKeys.forEach((c, j) => {
        const v = a.cells[i][j];
        const w = stacked ? bw * 0.7 : bw * 0.8 / a.colKeys.length;
        const x = stacked ? L + bw * i + bw * 0.15 : L + bw * i + bw * 0.1 + w * j;
        const rc = svg('rect', { x, width: Math.max(1, w - 1), fill: colorOf(j, a.colKeys.length) });
        chart.appendChild(rc);
        rects.push({ rc, base: stacked ? acc : 0, v });
        if (stacked) acc += v;
      });
    });
    const yOf = (v) => T + ph - v / tk.max * ph;

    /* 前の値から新しい値へ数え変える */
    const nextPrev = new Map();
    nums.forEach((n) => nextPrev.set(n.key, n.to));
    prev = nextPrev;
    scRef.tween(650, (e) => {
      for (const n of nums) n.s.textContent = fmt(n.from + (n.to - n.from) * e);
      for (const r of rects) {
        const top = yOf((r.base + r.v) * e), bottom = yOf(r.base * e);
        r.rc.setAttribute('y', top); r.rc.setAttribute('height', Math.max(0, bottom - top));
      }
    });
  }

  Slides.register('pivot', {
    title: 'ピボット操作',
    tech: '手元で集計して組み替える',
    mount(root) {
      rootEl = root;
      groups = [group('行', ROWS, 'row'), group('列', COLS, 'col'), group('値', MEASURES, 'measure'), group('集計', FNS, 'fn')];
      tableBox = el('div', { class: 'pv-table' });
      chart = svg('svg', { viewBox: '0 0 ' + CW + ' ' + CH, class: 'pv-chart' });
      note = el('p', { class: 'hint pv-note' });
      root.append(Lib.head('PIVOT', '切り口を変えると、表とグラフがその場で組み替わる', '行・列・値・集計方法を押すだけ。数字は前の値から数え変わる。'),
        el('div', { class: 'pv-controls' }, groups.map((g) => g.box)),
        el('div', { class: 'pv-layout' }, el('div', {}, tableBox, note), chart));
    },
    start(sc) {
      scRef = sc;
      prev = new Map();
      render();
      /* 触るまでは、切り口を自動で変えて見せる */
      const demo = [{ col: 'month' }, { fn: 'share' }, { row: 'product', col: 'region', fn: 'sum' }, { row: 'region', col: 'product', fn: 'sum' }];
      let k = 0, touched = false;
      sc.on(rootEl, 'pointerdown', () => { touched = true; });
      const tick = () => sc.timeout(() => { if (touched) return; Object.assign(state, demo[k++ % demo.length]); render(); tick(); }, 3000);
      tick();
    },
  });
})();
