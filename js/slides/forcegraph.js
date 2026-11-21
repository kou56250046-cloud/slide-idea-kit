/* 関係図が自分で整列する: 点どうしが反発し、つながりはばねで引き合い、揺れながら落ち着く */
(function () {
  'use strict';
  const { el, canvas, rng } = Lib;
  const W = 1760, H = 720;
  const GROUPS = [['経営企画', '#a78bfa'], ['営業', '#6ea8ff'], ['製造', '#4ade80'], ['物流', '#fbbf24'], ['開発', '#f472b6'], ['総務', '#22d3ee']];

  /* 各部署にハブ1つと担当者4人。部署をまたぐ連携を数本 */
  function build() {
    const r = rng(3), nodes = [], links = [];
    GROUPS.forEach(([name, c], gi) => {
      const hub = nodes.length;
      nodes.push({ label: name, c, hub: true, g: gi });
      for (let k = 0; k < 4; k++) { nodes.push({ label: '', c, hub: false, g: gi }); links.push([hub, nodes.length - 1, 90]); }
    });
    const hubs = nodes.map((n, i) => (n.hub ? i : -1)).filter((i) => i >= 0);
    hubs.forEach((h, i) => { if (i) links.push([hubs[0], h, 300]); });
    for (let k = 0; k < 6; k++) {
      const a = r.int(nodes.length), b = r.int(nodes.length);
      if (a !== b && nodes[a].g !== nodes[b].g) links.push([a, b, 260]);
    }
    return { nodes, links };
  }

  let cv, graph;

  function scatter() {
    const r = rng(Math.floor(Math.random() * 1e9));
    graph.nodes.forEach((n) => { n.x = r.range(100, W - 100); n.y = r.range(80, H - 80); n.vx = 0; n.vy = 0; });
  }

  Slides.register('forcegraph', {
    title: '関係図が自分で整列する',
    tech: 'ばねと反発の物理',
    mount(root) {
      cv = canvas(W, H, 'fg-cv');
      graph = build();
      root.append(Lib.head('FORCE LAYOUT', '関係図を、物理で自然に並べる', '点どうしは反発し、つながりはばねで引き合う。点をつかんで動かすと、全体が追いかけてくる。'),
        el('div', { class: 'fg-wrap' }, cv.el, el('button', { class: 'btn fg-btn', text: 'ばらばらにする', onclick: scatter })));
    },
    start(sc) {
      scatter();
      const ctx = cv.ctx, { nodes, links } = graph;
      const font = getComputedStyle(document.body).fontFamily;
      let drag = null;
      const pos = (e) => { const b = cv.el.getBoundingClientRect(); return [(e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H / b.height]; };
      sc.on(cv.el, 'pointerdown', (e) => {
        const [x, y] = pos(e);
        let best = null, bd = 40 * 40;
        nodes.forEach((n) => { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = n; } });
        if (best) { drag = best; cv.el.setPointerCapture(e.pointerId); }
      });
      sc.on(cv.el, 'pointermove', (e) => { if (drag) { const [x, y] = pos(e); drag.x = x; drag.y = y; drag.vx = 0; drag.vy = 0; } });
      sc.on(cv.el, 'pointerup', () => { drag = null; });

      sc.frame((dt) => {
        const s = Math.min(dt, 1 / 30) * 60;
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j];
            let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 0.01;
            const f = 4800 / d2, d = Math.sqrt(d2);
            dx /= d; dy /= d;
            a.vx += dx * f * s; a.vy += dy * f * s; b.vx -= dx * f * s; b.vy -= dy * f * s;
          }
        }
        for (const [i, j, len] of links) {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
          const f = (d - len) * 0.004 * s;
          a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
        }
        for (const n of nodes) {
          n.vx += (W / 2 - n.x) * 0.0006 * s; n.vy += (H / 2 - n.y) * 0.0012 * s;
          n.vx *= 0.86; n.vy *= 0.86;
          if (n !== drag) { n.x += n.vx * s; n.y += n.vy * s; }
          n.x = Lib.clamp(n.x, 30, W - 30); n.y = Lib.clamp(n.y, 30, H - 30);
        }
        ctx.clearRect(0, 0, W, H);
        for (const [i, j, len] of links) {
          const a = nodes[i], b = nodes[j];
          ctx.strokeStyle = len > 200 ? 'rgba(148,163,184,.45)' : a.c + '88';
          ctx.lineWidth = len > 200 ? 2 : 3;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.textAlign = 'center';
        for (const n of nodes) {
          ctx.fillStyle = n.c;
          ctx.beginPath(); ctx.arc(n.x, n.y, n.hub ? 26 : 11, 0, Math.PI * 2); ctx.fill();
          if (n === drag) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); }
          if (n.hub) { ctx.fillStyle = '#e6edf7'; ctx.font = '700 24px ' + font; ctx.fillText(n.label, n.x, n.y - 38); }
        }
      });
    },
  });
})();
