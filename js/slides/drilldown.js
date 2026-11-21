/* ドリルダウン: 棒を押すと、その内訳の棒に分かれる（全社 → 地域 → 店舗 → 商品）。上の階層表示で戻れる */
(function () {
  'use strict';
  const { el, svg, clear, ticks, fmtYen } = Lib;
  const W = 1760, H = 640, L = 120, B = 70, T = 30;
  const LEVELS = ['region', 'store', 'product'];

  let chart, crumbs, info, path = [], scRef, busy = false;

  /* 今の階層の棒: [{key, v}]（大きい順） */
  function current() {
    const D = SalesData, cond = {};
    path.forEach((v, i) => { cond[LEVELS[i]] = v; });
    const src = D.filter(D.rows, cond), dim = LEVELS[path.length];
    const a = D.aggregate(src, dim, null, 'sales', 'sum');
    return { dim, total: a.total, bars: a.rowKeys.map((k, i) => ({ key: k, v: a.rowTotals[i] })).sort((x, y) => y.v - x.v) };
  }

  function drawCrumbs() {
    clear(crumbs);
    const names = ['全社'].concat(path);
    names.forEach((n, i) => {
      if (i) crumbs.appendChild(el('span', { class: 'dd-sep', text: '›' }));
      const last = i === names.length - 1;
      crumbs.appendChild(el('button', { class: 'dd-crumb' + (last ? ' on' : ''), text: n, disabled: last, onclick: () => { if (busy) return; path = path.slice(0, i); draw(); } }));
    });
  }

  function draw(fromRect) {
    drawCrumbs();
    const { dim, total, bars } = current();
    clear(chart);
    const pw = W - L - 40, ph = H - T - B, tk = ticks(bars[0].v, 5);
    const Y = (v) => T + ph - v / tk.max * ph;
    for (const v of tk.values) {
      chart.appendChild(svg('line', { x1: L, x2: L + pw, y1: Y(v), y2: Y(v), class: v ? 'grid' : 'axis0' }));
      chart.appendChild(svg('text', { x: L - 12, y: Y(v) + 7, class: 'tick', 'text-anchor': 'end', text: fmtYen(v) }));
    }
    const bw = pw / bars.length, leaf = path.length === LEVELS.length - 1;
    info.textContent = (path.length ? path[path.length - 1] : '全社') + ' の売上 ' + fmtYen(total) + '　内訳: ' + SalesData.DIMS[dim].label + '別' + (leaf ? '（これ以上は分かれない）' : '（棒を押すと内訳へ）');
    const items = bars.map((b, i) => {
      const x = L + bw * i + bw * 0.15, w = bw * 0.7;
      const rect = svg('rect', { x, y: Y(0), width: w, height: 0, rx: 6, class: 'dd-bar' + (leaf ? ' leaf' : '') });
      const lab = svg('text', { x: x + w / 2, y: H - 40, class: 'dd-label', 'text-anchor': 'middle', text: SalesData.label(dim, b.key) });
      const val = svg('text', { x: x + w / 2, y: Y(b.v) - 12, class: 'dd-val', 'text-anchor': 'middle', text: (b.v / total * 100).toFixed(0) + '%' });
      val.style.opacity = 0;
      chart.append(rect, lab, val);
      if (!leaf) rect.addEventListener('click', () => drill(b.key, rect));
      return { rect, val, b, x, w };
    });
    /* 親の棒の位置から広がって、子の棒が伸びる */
    const sx = fromRect ? fromRect.x : null, sw = fromRect ? fromRect.w : null;
    scRef.tween(800, (e) => {
      items.forEach((it, i) => {
        const d = Lib.clamp(e * 1.6 - i * (0.6 / items.length), 0, 1), k = Lib.easeOutCubic(d);
        const x = sx == null ? it.x : Lib.lerp(sx + sw * i / items.length, it.x, k), w = sx == null ? it.w : Lib.lerp(sw / items.length, it.w, k);
        it.rect.setAttribute('x', x); it.rect.setAttribute('width', w);
        it.rect.setAttribute('y', Y(it.b.v * k)); it.rect.setAttribute('height', Y(0) - Y(it.b.v * k));
        it.val.style.opacity = k;
      });
    }, (t) => t);
  }

  async function drill(key, rect) {
    if (busy) return;
    busy = true;
    /* 押した棒を横いっぱいに広げ、他の棒を消してから内訳を描く */
    const x0 = +rect.getAttribute('x'), w0 = +rect.getAttribute('width');
    const others = [...chart.querySelectorAll('.dd-bar, .dd-val, .dd-label')].filter((n) => n !== rect);
    await scRef.tween(450, (e) => {
      rect.setAttribute('x', Lib.lerp(x0, L, e)); rect.setAttribute('width', Lib.lerp(w0, W - L - 40, e));
      others.forEach((n) => { n.style.opacity = 1 - e; });
    }, Lib.easeInOutCubic);
    path.push(key);
    draw({ x: L, w: W - L - 40 });
    busy = false;
  }

  Slides.register('drilldown', {
    title: 'ドリルダウン',
    tech: '押すと内訳に分かれる',
    mount(root) {
      crumbs = el('div', { class: 'dd-crumbs' });
      info = el('p', { class: 'hint' });
      chart = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'dd-chart' });
      root.append(Lib.head('DRILL DOWN', '全体から、原因の場所まで掘っていく', '全社 → 地域 → 店舗 → 商品。棒を押すとその内訳に分かれる。上の階層表示で戻れる。'), crumbs, info, chart);
    },
    start(sc) {
      scRef = sc; path = []; busy = false;
      draw();
      /* 最初に1回、自動で最大の地域へ掘って見せる */
      sc.timeout(() => {
        if (path.length || busy) return;
        const first = chart.querySelector('.dd-bar');
        if (first) drill(current().bars[0].key, first);
      }, 2200);
    },
  });
})();
