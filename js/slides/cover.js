/* 表紙: 背景で点が漂い、近い点どうしを線でつなぐ */
(function () {
  'use strict';
  const { el, canvas, rng } = Lib;
  let cv;

  Slides.register('cover', {
    title: '表紙',
    cls: 'cover',
    mount(root) {
      cv = canvas(1920, 1080, 'cover-bg');
      root.append(cv.el,
        el('div', { class: 'cover-body' },
          el('div', { class: 'kicker', text: 'SLIDE IDEA KIT' }),
          el('h1', {}, '動くスライド', el('br'), el('span', { class: 'grad', text: '見本集' })),
          el('p', { class: 'lead', text: 'ターミナル演出・モデル比較・学習する AI・無限ズーム・ピボット ほか 29 の見せ方' }),
          el('ul', { class: 'keys' },
            el('li', {}, el('kbd', { text: '←' }), el('kbd', { text: '→' }), ' ページ送り'),
            el('li', {}, el('kbd', { text: 'F' }), ' 全画面'),
            el('li', {}, el('kbd', { text: 'R' }), ' このスライドを最初から'),
            el('li', {}, el('kbd', { text: 'End' }), ' 目次')),
          el('a', { class: 'prompt-link', href: 'prompts.html', target: '_blank', text: 'Gemini 用プロンプト集を開く →' })));
    },
    start(sc) {
      const r = rng(7);
      const pts = Array.from({ length: 90 }, () => ({ x: r() * 1920, y: r() * 1080, vx: r.range(-20, 20), vy: r.range(-20, 20) }));
      const ctx = cv.ctx;
      sc.frame((dt) => {
        ctx.clearRect(0, 0, 1920, 1080);
        for (const p of pts) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.x < 0 || p.x > 1920) p.vx *= -1;
          if (p.y < 0 || p.y > 1080) p.vy *= -1;
        }
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 200 * 200) {
              ctx.strokeStyle = 'rgba(110,168,255,' + (0.25 * (1 - Math.sqrt(d2) / 200)).toFixed(3) + ')';
              ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
            }
          }
        }
        ctx.fillStyle = 'rgba(150,200,255,0.7)';
        for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill(); }
      });
    },
  });
})();
