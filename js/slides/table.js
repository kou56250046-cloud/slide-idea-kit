/* 動く表: ① 並び替えで行が滑る ② しきい値を超えたセルが光るヒートマップ ③ 表のセルが飛んで棒グラフになる */
(function () {
  'use strict';
  const { el, clear, slider, fmtInt } = Lib;
  const ROW = 31;

  /* 店舗ごとの表（SalesData を集計）。前年比はダミー */
  function storeTable() {
    const D = SalesData;
    return D.DIMS.store.values.map((store) => {
      const rows = D.filter(D.rows, { store });
      const sales = rows.reduce((s, x) => s + x.sales, 0), qty = rows.reduce((s, x) => s + x.qty, 0);
      return { store, region: rows[0].region, sales, yoy: D.YOY[store], qty, unit: sales / qty };
    });
  }
  const COLS = [
    ['store', '店舗', (v) => v], ['region', '地域', (v) => v], ['sales', '売上', (v) => fmtInt(v / 1e4) + ' 万円'],
    ['yoy', '前年比', (v) => (v > 0 ? '+' : '') + v.toFixed(1) + '%'], ['qty', '販売数', (v) => fmtInt(v)], ['unit', '客単価', (v) => fmtInt(v) + ' 円'],
  ];

  let box, tabs, mode = 0, scRef, data;

  /* ① 並び替え: 行は絶対配置。並びが変わると top のトランジションで滑る */
  function sortView(sc) {
    const head = el('div', { class: 'tb-row tb-head' });
    const body = el('div', { class: 'tb-body', style: { height: data.length * ROW + 'px' } });
    const rows = data.map((d) => {
      const row = el('div', { class: 'tb-row' }, COLS.map(([k, , f]) => el('span', { class: 'tb-c tb-' + k + (k === 'yoy' ? (d.yoy >= 0 ? ' up' : ' down') : ''), text: f(d[k]) })));
      body.appendChild(row);
      return { d, row };
    });
    let key = null, desc = true, touched = false;
    const apply = () => {
      const order = rows.slice().sort((a, b) => {
        if (!key) return 0;
        const x = a.d[key], y = b.d[key];
        return (typeof x === 'string' ? x.localeCompare(y, 'ja') : x - y) * (desc ? -1 : 1);
      });
      order.forEach((r, i) => { r.row.style.top = i * ROW + 'px'; });
      [...head.children].forEach((h, i) => { h.className = 'tb-c tb-h' + (COLS[i][0] === key ? ' on' : ''); h.textContent = COLS[i][1] + (COLS[i][0] === key ? (desc ? ' ▼' : ' ▲') : ''); });
      rows.forEach((r) => [...r.row.children].forEach((c, i) => c.classList.toggle('sorted', COLS[i][0] === key)));
    };
    COLS.forEach(([k]) => head.appendChild(el('button', { class: 'tb-c tb-h', onclick: () => { touched = true; if (key === k) desc = !desc; else { key = k; desc = true; } apply(); } })));
    apply();
    box.append(el('p', { class: 'hint', text: '見出しを押すと、その列で並び替わる（もう一度押すと逆順）。' }), head, body);
    /* 触るまでは、自動で列を変えて並び替えて見せる */
    const demo = ['sales', 'yoy', 'unit', 'qty'];
    let k = 0;
    const tick = () => sc.timeout(() => { if (touched) return; key = demo[k++ % demo.length]; desc = true; apply(); tick(); }, 2400);
    sc.timeout(() => { if (!touched) { key = demo[k++]; apply(); } tick(); }, 900);
  }

  /* ② ヒートマップ: 店舗 × 月の売上。しきい値を超えたセルだけ光る */
  function heatView() {
    const D = SalesData;
    const agg = D.aggregate(D.rows, 'store', 'month', 'sales', 'sum');
    const all = agg.cells.flat(), max = Math.max(...all), min = Math.min(...all);
    const grid = el('div', { class: 'hm-grid' });
    grid.appendChild(el('span', { class: 'hm-h' }));
    agg.colKeys.forEach((m) => grid.appendChild(el('span', { class: 'hm-h', text: m + '月' })));
    const cells = [];
    agg.rowKeys.forEach((store, i) => {
      grid.appendChild(el('span', { class: 'hm-name', text: store }));
      agg.cells[i].forEach((v) => {
        const t = (v - min) / (max - min);
        const c = el('span', { class: 'hm-cell', title: store + ' ' + fmtInt(v / 1e4) + '万円', style: { background: 'hsl(' + (220 - t * 180) + ',70%,' + (18 + t * 38) + '%)' } });
        grid.appendChild(c);
        cells.push({ c, v });
      });
    });
    const count = el('div', { class: 'stat-v' });
    const sl = slider({ label: 'しきい値（売上）', min: Math.floor(min / 1e5) * 10, max: Math.ceil(max / 1e5) * 10, step: 10, value: Math.round(max * 0.7 / 1e5) * 10, format: (v) => fmtInt(v) + ' 万円以上', onInput: () => mark() });
    function mark() {
      let n = 0;
      for (const { c, v } of cells) { const hit = v >= sl.value * 1e4; c.classList.toggle('hit', hit); c.classList.toggle('dim', !hit); if (hit) n++; }
      count.textContent = n + ' / ' + cells.length + ' セル';
    }
    mark();
    box.append(el('div', { class: 'hm-layout' }, grid, el('div', { class: 'sl-side' }, sl.el, el('div', { class: 'stat' }, el('span', { class: 'stat-k', text: 'しきい値を超えたセル' }), count),
      el('p', { class: 'hint', text: '色が濃く明るいほど売上が大きい。超えたセルは白い枠で光り、それ以外は暗くなる。' }))));
  }

  /* ③ 表からグラフへ: 地域ごとの値セルが飛んで棒の上に乗り、棒が伸びる */
  function morphView(sc) {
    const D = SalesData, agg = D.aggregate(D.rows, 'region', null, 'sales', 'sum');
    const vals = agg.rowTotals, max = Math.max(...vals);
    const stage = el('div', { class: 'mo-stage' });
    const items = agg.rowKeys.map((name, i) => {
      const label = el('div', { class: 'mo-label', text: name });
      const val = el('div', { class: 'mo-val', text: Lib.fmtYen(vals[i]) });
      const bar = el('div', { class: 'mo-bar' });
      stage.append(bar, label, val);
      return { label, val, bar, v: vals[i] };
    });
    let graph = false;
    const place = () => {
      items.forEach((it, i) => {
        if (!graph) {
          /* 表: 縦に並んだ2列 */
          Object.assign(it.label.style, { left: '200px', top: 40 + i * 64 + 'px' });
          Object.assign(it.val.style, { left: '420px', top: 40 + i * 64 + 'px' });
          Object.assign(it.bar.style, { left: 120 + i * 220 + 'px', height: '0px' });
        } else {
          const h = it.v / max * 420, x = 120 + i * 220;
          Object.assign(it.label.style, { left: x + 'px', top: '560px' });
          Object.assign(it.bar.style, { left: x + 'px', height: h + 'px' });
          Object.assign(it.val.style, { left: x + 'px', top: 560 - h - 56 + 'px' });
        }
        it.label.style.transitionDelay = it.val.style.transitionDelay = it.bar.style.transitionDelay = (graph ? i * 0.08 : 0) + 's';
      });
      btn.textContent = graph ? '表に戻す' : 'グラフにする';
      stage.classList.toggle('graph', graph);
    };
    const btn = el('button', { class: 'btn', onclick: () => { graph = !graph; place(); } });
    box.append(el('div', { class: 'mo-top' }, el('p', { class: 'hint', text: '地域別の売上。ボタンで、表の数字がそのまま棒グラフの上に飛んでいく。' }), btn), stage);
    place();
    sc.timeout(() => { graph = true; place(); }, 1500);
  }

  function select(i) {
    mode = i;
    [...tabs.children].forEach((b, j) => b.classList.toggle('on', j === i));
    clear(box);
    [sortView, heatView, morphView][i](scRef);
  }

  Slides.register('table', {
    title: '動く表',
    tech: '並び替え・ヒートマップ・表→グラフ',
    mount(root) {
      data = storeTable();
      /* タブを押したら、前のタブのタイマーを止めるためにスライドごと再開してから切り替える */
      tabs = el('div', { class: 'tabs' }, ['並び替え', 'ヒートマップ', '表からグラフへ'].map((t, i) => el('button', { class: 'tab', text: t, onclick: () => { mode = i; Deck.restart(); } })));
      box = el('div', { class: 'tb-box' });
      root.append(Lib.head('LIVE TABLE', '表も、動かすと読み方が変わる', '並び替えで行が滑る。しきい値で光るセル。表の数字がそのまま棒グラフになる。'), tabs, box);
    },
    start(sc) { scRef = sc; select(mode); },
  });
})();
