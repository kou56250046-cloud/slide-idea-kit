/* 3D の棒グラフ都市: 支店ごとの売上が立体のビルとして地面から伸び、ゆっくり回る。
   CSS 3D で 125 枚の面を重ねると GPU の無い環境で極端に重くなるため、canvas に自前で投影して描く */
(function () {
  'use strict';
  const { el, canvas, rng } = Lib;
  const W = 1760, H = 700, GRID = 5, CELL = 1, BW = 0.6, MAXH = 3.2, S = 100;
  const AREAS = ['北海道', '東北', '関東', '中部', '関西'];
  const HOT = [110, 168, 255], COLD = [51, 65, 85];

  let cv, bars, font;

  /* 地面の座標 (x, y) と高さ z を画面へ。a は回転、t は見下ろす角度 */
  function project(x, y, z, a, t) {
    const xr = x * Math.cos(a) - y * Math.sin(a);
    const yr = x * Math.sin(a) + y * Math.cos(a);
    /* 手前（yr が大きい）ほど少し大きく描いて遠近を出す */
    const s = S * (1 + yr * 0.07);
    return [W / 2 + xr * s, H / 2 + 5 + yr * s * Math.sin(t) - z * s * Math.cos(t), yr];
  }
  const rgb = (c, k) => 'rgb(' + c.map((v) => Math.min(255, Math.round(v * k))).join(',') + ')';

  function poly(ctx, pts, fill) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1; ctx.stroke();
  }

  function draw(a, t) {
    const ctx = cv.ctx, off = (GRID * CELL) / 2;
    ctx.clearRect(0, 0, W, H);
    /* 地面と格子 */
    const g = [[-off - 0.2, -off - 0.2], [off + 0.2, -off - 0.2], [off + 0.2, off + 0.2], [-off - 0.2, off + 0.2]].map(([x, y]) => project(x, y, 0, a, t));
    poly(ctx, g, '#111a2a');
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
    for (let i = 0; i <= GRID; i++) {
      const p = -off + i * CELL;
      let s = project(p, -off, 0, a, t), e = project(p, off, 0, a, t);
      ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
      s = project(-off, p, 0, a, t); e = project(off, p, 0, a, t);
      ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
    }
    /* 地域名（行の左端） */
    ctx.fillStyle = '#8b98ad'; ctx.font = '700 22px ' + font; ctx.textAlign = 'center';
    AREAS.forEach((name, i) => { const p = project(-off - 0.6, -off + (i + 0.5) * CELL, 0, a, t); ctx.fillText(name, p[0], p[1]); });

    /* ビルは奥から順に描く（画家のアルゴリズム） */
    const order = bars.map((b) => ({ b, d: project(b.x, b.y, 0, a, t)[2] })).sort((p, q) => p.d - q.d);
    for (const { b } of order) {
      const h = b.cur, x0 = b.x - BW / 2, x1 = b.x + BW / 2, y0 = b.y - BW / 2, y1 = b.y + BW / 2;
      const base = b.hot ? HOT : COLD;
      /* 側面4枚。外向きの法線が手前（回転後の y が正）を向く面だけ描く */
      const sides = [
        [[x0, y1], [x1, y1], [0, 1]], [[x1, y0], [x0, y0], [0, -1]],
        [[x1, y1], [x1, y0], [1, 0]], [[x0, y0], [x0, y1], [-1, 0]],
      ];
      for (const [p, q, n] of sides) {
        const ny = n[0] * Math.sin(a) + n[1] * Math.cos(a);
        if (ny <= 0) continue;
        const nx = n[0] * Math.cos(a) - n[1] * Math.sin(a);
        poly(ctx, [project(p[0], p[1], 0, a, t), project(q[0], q[1], 0, a, t), project(q[0], q[1], h, a, t), project(p[0], p[1], h, a, t)], rgb(base, 0.55 + 0.3 * (nx + 1) / 2));
      }
      const top = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => project(x, y, h, a, t));
      poly(ctx, top, rgb(base, 1.3));
      if (b.hot && b.cur >= b.h * 0.99) {
        const c = project(b.x, b.y, h, a, t);
        ctx.fillStyle = '#fff'; ctx.font = '800 24px ' + font; ctx.textAlign = 'center';
        ctx.fillText(b.v + '億', c[0], c[1] - 14);
      }
    }
  }

  Slides.register('city3d', {
    title: '3D の棒グラフ都市',
    tech: 'canvas に自前で投影',
    mount(root) {
      const r = rng(21);
      bars = [];
      for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
        const v = Math.round(20 + r() * 80 + (i === 2 ? 25 : 0) + (j === 1 && i === 2 ? 30 : 0));
        bars.push({ v, i, j, x: -GRID / 2 + (j + 0.5) * CELL, y: -GRID / 2 + (i + 0.5) * CELL, cur: 0 });
      }
      const max = Math.max(...bars.map((b) => b.v));
      const top3 = bars.slice().sort((p, q) => q.v - p.v).slice(0, 3);
      bars.forEach((b) => { b.h = b.v / max * MAXH; b.hot = top3.includes(b); });
      cv = canvas(W, H, 'cy-cv');
      root.append(Lib.head('3D CITY', '数字を、ビルの高さにして見せる', '地域（行）× 支店（列）の売上。地面から伸び、ゆっくり回る。ドラッグで回せる。'),
        cv.el, el('div', { class: 'cy-info', text: '青いビル = 売上上位3支店' }));
    },
    start(sc) {
      font = getComputedStyle(document.body).fontFamily;
      let a = -0.75, t = 0.95, drag = null, idle = 0, swing = 0, base = -0.75;
      bars.forEach((b) => { b.cur = 0; });
      bars.forEach((b, k) => sc.timeout(() => sc.tween(900, (e) => { b.cur = b.h * e; }), 300 + (b.i + b.j) * 120 + k * 10));
      sc.on(cv.el, 'pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, a, t }; cv.el.setPointerCapture(e.pointerId); });
      sc.on(cv.el, 'pointermove', (e) => {
        if (!drag) return;
        a = drag.a + (e.clientX - drag.x) * 0.006;
        t = Lib.clamp(drag.t - (e.clientY - drag.y) * 0.004, 0.35, 1.45);
        idle = 0;
      });
      sc.on(cv.el, 'pointerup', () => { drag = null; });
      sc.frame((dt) => {
        idle += dt;
        /* 触っていないときは斜め 45° を中心にゆっくり振る（正面になると立体感が消えるため） */
        if (!drag && idle > 1.5) { swing += dt * 0.35; a = base + 0.45 * Math.sin(swing); } else if (drag) { base = a; swing = 0; }
        draw(a, t);
      });
    },
  });
})();
