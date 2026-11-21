/* 粒子で文字を組み立てる: 数千の点が言葉の形に集まり、次の言葉へ崩れて組み替わる。マウスの近くの点は逃げる */
(function () {
  'use strict';
  const { el, canvas } = Lib;
  const W = 1760, H = 760, N = 3600, STEP = 6;
  const WORDS = ['DATA', '分析', '意思決定', 'IMPACT'];

  let cv, parts, targets = [];

  /* 文字を見えない canvas に描き、塗られた画素から点の座標を取る */
  function sample(word) {
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const c = off.getContext('2d');
    const font = getComputedStyle(document.body).fontFamily;
    let size = 340;
    c.font = '900 ' + size + 'px ' + font;
    while (c.measureText(word).width > W * 0.88 && size > 80) { size -= 10; c.font = '900 ' + size + 'px ' + font; }
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(word, W / 2, H / 2);
    const data = c.getImageData(0, 0, W, H).data, pts = [];
    for (let y = 0; y < H; y += STEP) for (let x = 0; x < W; x += STEP) if (data[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
    return pts;
  }

  /* 点を目標へ割り当てる。余った点は画面全体に薄く散らす */
  function assign(word) {
    const pts = sample(word);
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pts[i]; pts[i] = pts[j]; pts[j] = t; }
    parts.forEach((p, i) => {
      if (i < pts.length) { p.tx = pts[i][0]; p.ty = pts[i][1]; p.free = false; }
      else { p.tx = Math.random() * W; p.ty = Math.random() * H; p.free = true; }
      /* 組み替えの瞬間に外へはじく */
      p.vx += (Math.random() - 0.5) * 30; p.vy += (Math.random() - 0.5) * 30;
    });
  }

  Slides.register('particletext', {
    title: '粒子で文字を組み立てる',
    tech: 'canvas の画素から点群を作る',
    mount(root) {
      cv = canvas(W, H, 'pt-cv');
      root.append(Lib.head('PARTICLE TYPE', '数千の点が、言葉の形に集まる', 'クリックで次の言葉へ。マウスを近づけると点が逃げる。'), cv.el);
      parts = Array.from({ length: N }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, tx: 0, ty: 0, free: true }));
    },
    start(sc) {
      let k = 0, auto = 0, mx = -999, my = -999;
      parts.forEach((p) => { p.x = Math.random() * W; p.y = Math.random() * H; p.vx = 0; p.vy = 0; });
      assign(WORDS[0]);
      const next = () => { k = (k + 1) % WORDS.length; auto = 0; assign(WORDS[k]); };
      sc.on(cv.el, 'click', next);
      sc.on(cv.el, 'pointermove', (e) => { const b = cv.el.getBoundingClientRect(); mx = (e.clientX - b.left) * W / b.width; my = (e.clientY - b.top) * H / b.height; });
      sc.on(cv.el, 'pointerleave', () => { mx = -999; my = -999; });
      const ctx = cv.ctx;
      sc.frame((dt) => {
        auto += dt;
        if (auto > 4.5) next();
        const s = Math.min(dt, 1 / 30) * 60;
        ctx.fillStyle = 'rgba(11,15,23,0.35)';
        ctx.fillRect(0, 0, W, H);
        for (const p of parts) {
          p.vx += (p.tx - p.x) * 0.012 * s; p.vy += (p.ty - p.y) * 0.012 * s;
          const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
          if (d2 < 120 * 120) { const f = (1 - Math.sqrt(d2) / 120) * 4 * s; const d = Math.sqrt(d2) || 1; p.vx += dx / d * f; p.vy += dy / d * f; }
          p.vx *= 0.86; p.vy *= 0.86;
          p.x += p.vx * s; p.y += p.vy * s;
          if (p.free) { ctx.fillStyle = 'rgba(110,168,255,0.18)'; ctx.fillRect(p.x, p.y, 2, 2); }
          else {
            const hue = 200 + (p.x / W) * 120;
            ctx.fillStyle = 'hsl(' + hue.toFixed(0) + ',90%,68%)';
            ctx.fillRect(p.x - 1.5, p.y - 1.5, 3.2, 3.2);
          }
        }
      });
    },
  });
})();
