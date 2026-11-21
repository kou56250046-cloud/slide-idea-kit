/* スライダーで変わるグラフ: 入力のたびに計算し直して SVG を描き直す */
(function () {
  'use strict';
  const { el, svg, clear, ticks, fmtYen, fmtInt, slider } = Lib;

  const pct = (v) => v.toFixed(1) + '%';
  const yen = (v) => fmtYen(v);
  const unit = (s) => (v) => fmtInt(v) + s;

  /* 0 を必ず含み、min〜max を覆う刻み */
  function niceRange(min, max) {
    min = Math.min(0, min); max = Math.max(0, max);
    if (max - min <= 0) max = 1;
    const step = ticks(max - min, 5).step;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const values = [];
    for (let v = lo; v <= hi + step / 2; v += step) values.push(Math.abs(v) < step / 1e6 ? 0 : v);
    return { min: lo, max: hi, values };
  }

  const TOPICS = [
    {
      id: 'compound', name: '複利と積立', demo: 'r',
      xLabel: '経過年数', xFmt: (v) => v + '年', yFmt: yen,
      params: [
        { key: 'P', label: '初期投資', min: 0, max: 5000000, step: 100000, value: 1000000, format: yen },
        { key: 'm', label: '毎月の積立', min: 0, max: 100000, step: 5000, value: 30000, format: yen },
        { key: 'r', label: '年利', min: 0, max: 10, step: 0.1, value: 5, format: pct },
        { key: 'N', label: '運用年数', min: 1, max: 40, step: 1, value: 20, format: unit('年') },
      ],
      compute(p) {
        const val = [[0, p.P]], prin = [[0, p.P]];
        let v = p.P;
        for (let t = 1; t <= p.N * 12; t++) {
          v = v * (1 + p.r / 100 / 12) + p.m;
          val.push([t / 12, v]);
          prin.push([t / 12, p.P + p.m * t]);
        }
        const principal = p.P + p.m * p.N * 12;
        return {
          xMax: p.N,
          series: [
            { pts: val, color: '#6ea8ff', width: 4, area: 'rgba(110,168,255,0.18)', label: '評価額' },
            { pts: prin, color: '#9aa6b8', width: 3, area: 'rgba(154,166,184,0.20)', dash: '10 8', label: '元本（払い込み累計）' },
          ],
          marks: [{ x: p.N, y: v, label: fmtYen(v), color: '#6ea8ff' }],
          stats: [
            ['最終評価額', fmtYen(v), 'big'],
            ['元本', fmtYen(principal), ''],
            ['運用益', fmtYen(v - principal), v - principal >= 0 ? 'good' : 'bad'],
            ['元本に対する倍率', principal > 0 ? (v / principal).toFixed(2) + ' 倍' : '—', ''],
          ],
        };
      },
    },
    {
      id: 'bep', name: '損益分岐点', demo: 'price',
      xLabel: '販売数', xFmt: unit('個'), yFmt: yen,
      params: [
        { key: 'F', label: '固定費', min: 1000000, max: 10000000, step: 100000, value: 3000000, format: yen },
        { key: 'price', label: '販売単価', min: 1000, max: 10000, step: 100, value: 5000, format: yen },
        { key: 'v', label: '1個あたり変動費', min: 0, max: 8000, step: 100, value: 2000, format: yen },
        { key: 'Q', label: '想定販売数', min: 0, max: 5000, step: 50, value: 1500, format: unit('個') },
      ],
      compute(p) {
        const xMax = 5000;
        const rev = [[0, 0], [xMax, p.price * xMax]];
        const cost = [[0, p.F], [xMax, p.F + p.v * xMax]];
        const fixed = [[0, p.F], [xMax, p.F]];
        const m = p.price - p.v;
        const q = m > 0 ? p.F / m : Infinity;
        const profit = m * p.Q - p.F;
        const marks = [{ x: p.Q, y: p.price * p.Q, label: '想定 ' + fmtYen(profit), color: profit >= 0 ? '#4ade80' : '#f87171' }];
        if (q <= xMax) marks.unshift({ x: q, y: p.price * q, label: '分岐点 ' + fmtInt(q) + '個', color: '#fbbf24' });
        return {
          xMax,
          series: [
            { pts: fixed, color: '#9aa6b8', width: 2, dash: '6 8', label: '固定費' },
            { pts: cost, color: '#fb923c', width: 4, label: '総費用' },
            { pts: rev, color: '#6ea8ff', width: 4, label: '売上' },
          ],
          vline: { x: p.Q, color: profit >= 0 ? '#4ade80' : '#f87171' },
          marks,
          stats: [
            ['損益分岐点', Number.isFinite(q) ? fmtInt(q) + ' 個' : '到達しない', 'big'],
            ['分岐点の売上', Number.isFinite(q) ? fmtYen(p.price * q) : '—', ''],
            ['想定販売数での利益', fmtYen(profit), profit >= 0 ? 'good' : 'bad'],
            ['安全余裕率', p.Q > 0 && Number.isFinite(q) ? ((p.Q - q) / p.Q * 100).toFixed(1) + '%' : '—', profit >= 0 ? 'good' : 'bad'],
          ],
        };
      },
    },
    {
      id: 'price', name: '価格と売上・利益', demo: 'b',
      xLabel: '販売価格', xFmt: yen, yFmt: yen, yMinClip: 0.6,
      params: [
        { key: 'a', label: '最大需要（価格 0 円のとき）', min: 1000, max: 10000, step: 100, value: 5000, format: unit('個') },
        { key: 'b', label: '価格感応度（100円上げると減る数）', min: 20, max: 300, step: 5, value: 100, format: unit('個') },
        { key: 'c', label: '1個あたり原価', min: 0, max: 5000, step: 100, value: 1500, format: yen },
      ],
      compute(p) {
        const xMax = 10000;
        const k = p.b / 100;
        const qOf = (x) => Math.max(0, p.a - k * x);
        const rev = [], pro = [];
        for (let x = 0; x <= xMax; x += 50) { rev.push([x, x * qOf(x)]); pro.push([x, (x - p.c) * qOf(x)]); }
        const cutoff = p.a / k;
        const best = Math.min(xMax, Math.max(p.c, (cutoff + p.c) / 2));
        const bestProfit = (best - p.c) * qOf(best);
        const revBest = Math.min(xMax, cutoff / 2);
        return {
          xMax,
          series: [
            { pts: rev, color: '#6ea8ff', width: 4, label: '売上' },
            { pts: pro, color: '#4ade80', width: 4, area: 'rgba(74,222,128,0.15)', label: '利益' },
          ],
          marks: [
            { x: revBest, y: revBest * qOf(revBest), label: '売上最大 ' + fmtYen(revBest), color: '#6ea8ff' },
            { x: best, y: bestProfit, label: '利益最大 ' + fmtYen(best), color: '#4ade80' },
          ],
          stats: [
            ['利益が最大になる価格', fmtYen(best), 'big'],
            ['そのときの販売数', fmtInt(qOf(best)) + ' 個', ''],
            ['最大利益', fmtYen(bestProfit), bestProfit >= 0 ? 'good' : 'bad'],
            ['売上が最大になる価格', fmtYen(revBest), ''],
          ],
        };
      },
    },
  ];

  const CW = 1180, CH = 720, L = 150, R = 40, T = 30, B = 80;

  function drawChart(root, topic, d) {
    clear(root);
    const pw = CW - L - R, ph = CH - T - B;
    let ymin = 0, ymax = 0;
    for (const s of d.series) for (const [, y] of s.pts) { if (y > ymax) ymax = y; if (y < ymin) ymin = y; }
    if (topic.yMinClip) ymin = Math.max(ymin, -topic.yMinClip * ymax);
    const yr = niceRange(ymin, ymax * 1.05);
    const xt = ticks(d.xMax, 6);
    const X = (x) => L + (x / d.xMax) * pw;
    const Y = (y) => T + ((yr.max - y) / (yr.max - yr.min)) * ph;

    const clipId = 'clip-' + topic.id;
    root.appendChild(svg('defs', {}, svg('clipPath', { id: clipId }, svg('rect', { x: L, y: T, width: pw, height: ph }))));

    for (const v of yr.values) {
      root.appendChild(svg('line', { x1: L, x2: L + pw, y1: Y(v), y2: Y(v), class: v === 0 ? 'axis0' : 'grid' }));
      root.appendChild(svg('text', { x: L - 14, y: Y(v) + 7, class: 'tick', 'text-anchor': 'end', text: topic.yFmt(v) }));
    }
    for (const v of xt.values) {
      if (v > d.xMax + 1e-9) continue;
      root.appendChild(svg('text', { x: X(v), y: T + ph + 36, class: 'tick', 'text-anchor': 'middle', text: topic.xFmt(v) }));
    }
    root.appendChild(svg('text', { x: L + pw, y: CH - 6, class: 'axis-label', 'text-anchor': 'end', text: topic.xLabel + ' →' }));

    const g = svg('g', { 'clip-path': 'url(#' + clipId + ')' });
    root.appendChild(g);
    for (const s of d.series) {
      const line = s.pts.map(([x, y], i) => (i ? 'L' : 'M') + X(x).toFixed(1) + ',' + Y(y).toFixed(1)).join('');
      if (s.area) {
        const last = s.pts[s.pts.length - 1], first = s.pts[0];
        g.appendChild(svg('path', { d: line + 'L' + X(last[0]) + ',' + Y(0) + 'L' + X(first[0]) + ',' + Y(0) + 'Z', fill: s.area }));
      }
      g.appendChild(svg('path', { d: line, fill: 'none', stroke: s.color, 'stroke-width': s.width, 'stroke-dasharray': s.dash || null, 'stroke-linejoin': 'round' }));
    }
    if (d.vline) g.appendChild(svg('line', { x1: X(d.vline.x), x2: X(d.vline.x), y1: T, y2: T + ph, stroke: d.vline.color, 'stroke-width': 2, 'stroke-dasharray': '4 6' }));
    d.marks.forEach((m, i) => {
      const cx = X(m.x), cy = Y(Math.max(yr.min, Math.min(yr.max, m.y)));
      g.appendChild(svg('circle', { cx, cy, r: 9, fill: m.color, stroke: '#0b0f17', 'stroke-width': 3 }));
      const left = cx > L + pw * 0.7;
      const ty = Math.max(T + 30, cy - 22 - i * 40);
      g.appendChild(svg('text', { x: cx + (left ? -16 : 16), y: ty, class: 'mark-label', fill: m.color, 'text-anchor': left ? 'end' : 'start', text: m.label }));
    });
  }

  function legend(d) {
    return d.series.slice().reverse().map((s) => el('span', { class: 'lg' },
      el('i', { style: { background: s.dash ? 'transparent' : s.color, borderTop: s.dash ? '3px dashed ' + s.color : null } }), s.label));
  }

  let chartSvg, legendBox, controls, statsBox, tabs, cur = 0, sliders = {}, values = {};

  function render() {
    const t = TOPICS[cur];
    const d = t.compute(values[t.id]);
    drawChart(chartSvg, t, d);
    clear(legendBox).append(...legend(d));
    clear(statsBox);
    for (const [k, v, cls] of d.stats) statsBox.appendChild(el('div', { class: 'stat ' + cls }, el('span', { class: 'stat-k', text: k }), el('span', { class: 'stat-v', text: v })));
  }

  function select(i) {
    cur = i;
    const t = TOPICS[i];
    [...tabs.children].forEach((b, j) => b.classList.toggle('on', j === i));
    clear(controls);
    sliders = {};
    for (const p of t.params) {
      const s = slider({ ...p, value: values[t.id][p.key], onInput: (v) => { values[t.id][p.key] = v; render(); } });
      sliders[p.key] = s;
      controls.appendChild(s.el);
    }
    render();
  }

  /* デモ: 指定のスライダーを最小→最大→元の値まで自動で動かす */
  let demoRunning = false;
  async function demo(sc) {
    if (demoRunning) return;
    demoRunning = true;
    const myCur = cur;
    const t = TOPICS[cur];
    const p = t.params.find((q) => q.key === t.demo);
    const s = sliders[p.key];
    const orig = values[t.id][p.key];
    const set = (v) => {
      if (cur !== myCur) return; /* 途中で題材を変えたら止める */
      const snapped = Math.round(v / p.step) * p.step;
      values[t.id][p.key] = +snapped.toFixed(4);
      s.set(values[t.id][p.key]);
      render();
    };
    s.el.classList.add('demo');
    await sc.tween(1400, (e) => set(Lib.lerp(orig, p.min, e)), Lib.easeInOutCubic);
    await sc.tween(2400, (e) => set(Lib.lerp(p.min, p.max, e)), Lib.easeInOutCubic);
    await sc.tween(1400, (e) => set(Lib.lerp(p.max, orig, e)), Lib.easeInOutCubic);
    s.el.classList.remove('demo');
    demoRunning = false;
  }

  let scRef = null;

  Slides.register('sliders', {
    title: 'スライダーで変わるグラフ',
    tech: 'SVG を毎回描き直す',
    mount(root) {
      for (const t of TOPICS) { values[t.id] = {}; for (const p of t.params) values[t.id][p.key] = p.value; }
      chartSvg = svg('svg', { class: 'chart', viewBox: '0 0 ' + CW + ' ' + CH, width: CW, height: CH });
      legendBox = el('div', { class: 'legend' });
      tabs = el('div', { class: 'tabs' }, TOPICS.map((t, i) => el('button', { class: 'tab', text: t.name, onclick: () => select(i) })));
      controls = el('div', { class: 'controls' });
      statsBox = el('div', { class: 'stats' });
      const demoBtn = el('button', { class: 'btn', text: '▶ 自動で動かす', onclick: () => { if (scRef && scRef.alive) demo(scRef); } });
      root.append(
        Lib.head('INTERACTIVE CHART', 'スライダーを動かすと、グラフがその場で変わる', '入力のたびに計算し直して SVG を描き直しています。縦軸は 0 から。'),
        el('div', { class: 'sl-layout' },
          el('div', { class: 'sl-chart' }, legendBox, chartSvg),
          el('div', { class: 'sl-side' }, tabs, controls, statsBox, demoBtn)));
      select(0);
    },
    start(sc) {
      scRef = sc;
      demoRunning = false; /* 前回のデモはスライドを離れた時点で止まっている */
      select(cur);
      sc.wait(700).then(() => demo(sc));
    },
  });
})();
