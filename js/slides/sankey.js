/* サンキー図: 予算の流れ（財源 → 部門 → 用途）。配分を変えると帯の太さがなめらかに変わり、帯の中を粒子が流れる */
(function () {
  'use strict';
  const { el, svg, clear, canvas, slider } = Lib;
  const W = 1320, H = 680, NODE_W = 26, PAD = 26, K = 5.2; /* K: 1億円あたりの px */
  const COLS = [
    [['本業売上', 60], ['新規事業', 25], ['補助金', 15]],
    [['営業', 0], ['開発', 0], ['管理', 0]],
    [['人件費', 0], ['投資', 0], ['外注', 0], ['内部留保', 0]],
  ];
  const XS = [70, 610, 1150];
  const COLORS = { 本業売上: '#6ea8ff', 新規事業: '#a78bfa', 補助金: '#22d3ee', 営業: '#fbbf24', 開発: '#4ade80', 管理: '#f472b6' };

  /* 配分から流れ [from, to, 億円] を作る */
  function flows(dev, inv) {
    const out = [];
    for (const [src, amt] of COLS[0]) {
      out.push([src, '営業', amt * (1 - dev) * 0.6], [src, '開発', amt * dev], [src, '管理', amt * (1 - dev) * 0.4]);
    }
    const dept = (d) => out.filter((f) => f[1] === d).reduce((s, f) => s + f[2], 0);
    const s = dept('営業'), d = dept('開発'), a = dept('管理');
    out.push(['営業', '人件費', s * 0.6], ['営業', '外注', s * 0.3], ['営業', '内部留保', s * 0.1]);
    out.push(['開発', '投資', d * inv], ['開発', '人件費', d * (1 - inv) * 0.7], ['開発', '外注', d * (1 - inv) * 0.3]);
    out.push(['管理', '人件費', a * 0.5], ['管理', '外注', a * 0.2], ['管理', '内部留保', a * 0.3]);
    return out;
  }

  /* 流れの値から、各ノードの位置と各帯の上端・下端を計算する */
  function layout(fl) {
    const nodes = {};
    COLS.forEach((col, ci) => {
      const vals = col.map(([name]) => Math.max(fl.filter((f) => f[0] === name).reduce((s, f) => s + f[2], 0), fl.filter((f) => f[1] === name).reduce((s, f) => s + f[2], 0)));
      const total = vals.reduce((s, v) => s + v, 0) * K + PAD * (col.length - 1);
      let y = (H - total) / 2;
      col.forEach(([name], i) => { nodes[name] = { x: XS[ci], y, h: vals[i] * K, v: vals[i], outY: y, inY: y }; y += vals[i] * K + PAD; });
    });
    const links = fl.map(([a, b, v]) => {
      const A = nodes[a], B = nodes[b], w = v * K;
      const l = { a, b, v, w, y0: A.outY, y1: B.inY };
      A.outY += w; B.inY += w;
      return l;
    });
    return { nodes, links };
  }

  let svgEl, cv, devSl, invSl;

  Slides.register('sankey', {
    title: 'サンキー図',
    tech: '帯の太さ = 量、粒子で流れ',
    mount(root) {
      svgEl = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'sk2-svg' });
      cv = canvas(W, H, 'sk2-cv');
      devSl = slider({ label: '開発への配分', min: 10, max: 60, step: 1, value: 25, format: (v) => v + '%' });
      invSl = slider({ label: '開発費のうち投資に回す割合', min: 10, max: 80, step: 1, value: 30, format: (v) => v + '%' });
      root.append(Lib.head('SANKEY', 'お金の流れを、帯の太さで見せる', '財源 → 部門 → 用途。配分を動かすと帯の太さがなめらかに変わる。帯の中の点は流れの向き。'),
        el('div', { class: 'sl-layout sk2-layout' }, el('div', { class: 'sk2-wrap' }, svgEl, cv.el), el('div', { class: 'sl-side' }, devSl.el, invSl.el, el('p', { class: 'hint', text: '単位: 億円（ダミー）。帯の太さは金額に比例。' }))));
    },
    start(sc) {
      const ctx = cv.ctx;
      let cur = flows(devSl.value / 100, invSl.value / 100).map((f) => f.slice());
      let parts = [];
      sc.frame((dt) => {
        const target = flows(devSl.value / 100, invSl.value / 100);
        cur.forEach((f, i) => { f[2] += (target[i][2] - f[2]) * Math.min(1, dt * 5); });
        const { nodes, links } = layout(cur);
        clear(svgEl);
        for (const l of links) {
          if (l.w < 0.3) continue;
          const x0 = nodes[l.a].x + NODE_W, x1 = nodes[l.b].x, xm = (x0 + x1) / 2;
          svgEl.appendChild(svg('path', {
            d: 'M' + x0 + ',' + l.y0 + ' C' + xm + ',' + l.y0 + ' ' + xm + ',' + l.y1 + ' ' + x1 + ',' + l.y1 + ' L' + x1 + ',' + (l.y1 + l.w) + ' C' + xm + ',' + (l.y1 + l.w) + ' ' + xm + ',' + (l.y0 + l.w) + ' ' + x0 + ',' + (l.y0 + l.w) + ' Z',
            fill: COLORS[l.a] || '#64748b', 'fill-opacity': 0.28,
          }));
        }
        Object.keys(nodes).forEach((name, i) => {
          const n = nodes[name], right = n.x > W / 2 + 200;
          svgEl.appendChild(svg('rect', { x: n.x, y: n.y, width: NODE_W, height: Math.max(2, n.h), rx: 4, fill: COLORS[name] || '#94a3b8' }));
          svgEl.appendChild(svg('text', { x: right ? n.x - 12 : n.x + NODE_W + 12, y: n.y + n.h / 2 + 8, class: 'sk2-label', 'text-anchor': right ? 'end' : 'start', text: name + ' ' + n.v.toFixed(1) }));
        });
        /* 粒子: 帯の量に比例して生まれ、帯の中をベジェ曲線に沿って進む */
        for (const l of links) {
          if (Math.random() < l.v * dt * 0.45) parts.push({ l: l.a + '>' + l.b, t: 0, off: Math.random(), sp: 0.35 + Math.random() * 0.15 });
        }
        const byKey = {};
        links.forEach((l) => { byKey[l.a + '>' + l.b] = l; });
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        parts = parts.filter((p) => {
          p.t += dt * p.sp;
          const l = byKey[p.l];
          if (!l || p.t >= 1) return false;
          const x0 = nodes[l.a].x + NODE_W, x1 = nodes[l.b].x, t = p.t, u = 1 - t;
          const x = u * u * u * x0 + 3 * u * u * t * ((x0 + x1) / 2) + 3 * u * t * t * ((x0 + x1) / 2) + t * t * t * x1;
          const yTop = (u * u * u + 3 * u * u * t) * l.y0 + (3 * u * t * t + t * t * t) * l.y1;
          ctx.beginPath(); ctx.arc(x, yTop + l.w * (0.15 + 0.7 * p.off), 2.4, 0, Math.PI * 2); ctx.fill();
          return true;
        });
      });
    },
  });
})();
