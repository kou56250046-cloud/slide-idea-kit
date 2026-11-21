/* 手描き風の図解: 線をわずかにゆがめ、手で引くように順に描く。描き終わると線が小さく震え続ける */
(function () {
  'use strict';
  const { el, svg, rng } = Lib;
  const W = 1760, H = 720;

  /* 2点間を、ゆがんだ2本の曲線で結ぶ（手で2回なぞったように見える） */
  function roughLine(r, x1, y1, x2, y2, amp) {
    const len = Math.hypot(x2 - x1, y2 - y1), a = amp * Math.min(1, len / 200);
    let d = '';
    for (let k = 0; k < 2; k++) {
      const j = () => r.range(-a, a);
      const mx = x1 + (x2 - x1) * r.range(0.4, 0.6) + j(), my = y1 + (y2 - y1) * r.range(0.4, 0.6) + j();
      d += 'M' + (x1 + j() * 0.5) + ',' + (y1 + j() * 0.5) + ' Q' + mx + ',' + my + ' ' + (x2 + j() * 0.5) + ',' + (y2 + j() * 0.5) + ' ';
    }
    return d;
  }
  function roughRect(r, x, y, w, h) {
    return roughLine(r, x, y, x + w, y, 6) + roughLine(r, x + w, y, x + w, y + h, 6) + roughLine(r, x + w, y + h, x, y + h, 6) + roughLine(r, x, y + h, x, y, 6);
  }
  /* 少しはみ出して重なる楕円 */
  function roughEllipse(r, cx, cy, rx, ry) {
    let d = '';
    /* 半径の揺らぎはゆっくり変える（点ごとの乱数だとギザギザになる） */
    const start = r.range(0, Math.PI * 2), n = 72, p1 = r.range(0, 6), p2 = r.range(0, 6);
    for (let i = 0; i <= n + 6; i++) {
      const t = start + (i / n) * Math.PI * 2;
      const k = 1 + 0.035 * Math.sin(2 * t + p1) + 0.02 * Math.sin(3 * t + p2) + (i / n) * 0.05;
      d += (i ? 'L' : 'M') + (cx + Math.cos(t) * rx * k).toFixed(1) + ',' + (cy + Math.sin(t) * ry * k).toFixed(1);
    }
    return d;
  }
  function roughArrow(r, x1, y1, x2, y2) {
    const ang = Math.atan2(y2 - y1, x2 - x1), s = 26;
    return roughLine(r, x1, y1, x2, y2, 10) +
      roughLine(r, x2, y2, x2 - s * Math.cos(ang - 0.45), y2 - s * Math.sin(ang - 0.45), 2) +
      roughLine(r, x2, y2, x2 - s * Math.cos(ang + 0.45), y2 - s * Math.sin(ang + 0.45), 2);
  }

  /* 図の部品。shape(r) は path の d を返す。text は描き終わってから出す */
  const PARTS = [
    { shape: (r) => roughRect(r, 80, 230, 420, 220), color: '#e6edf7', text: [[290, 320, '問い合わせが', 40], [290, 375, '月 400 件', 48]] },
    { shape: (r) => roughArrow(r, 520, 340, 680, 340), color: '#94a3b8' },
    { shape: (r) => roughEllipse(r, 900, 340, 200, 130), color: '#fbbf24', text: [[900, 320, '原因', 32], [900, 375, '手順書が古い', 44]] },
    { shape: (r) => roughArrow(r, 1120, 340, 1280, 340), color: '#94a3b8' },
    { shape: (r) => roughRect(r, 1300, 230, 400, 220), color: '#4ade80', text: [[1500, 320, '対策', 32], [1500, 375, '動く手順書', 48]] },
    { shape: (r) => roughLine(r, 760, 500, 1040, 506, 4) + roughLine(r, 770, 516, 1030, 520, 4), color: '#f87171' },
    { shape: (r) => roughArrow(r, 1180, 620, 1040, 520), color: '#f87171', text: [[1200, 650, 'ここが本丸！', 40, 'start']] },
  ];

  let g, items;

  Slides.register('sketch', {
    title: '手描き風の図解',
    tech: 'SVG の線をゆがめて順に描く',
    mount(root) {
      g = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'sk-svg' });
      items = PARTS.map((p, i) => {
        const path = svg('path', { class: 'sk-path', stroke: p.color, pathLength: 1 });
        const texts = (p.text || []).map(([x, y, t, fs, anchor]) => svg('text', { x, y, 'font-size': fs, fill: p.color, class: 'sk-text', 'text-anchor': anchor || 'middle', transform: 'rotate(' + (i % 2 ? 1.5 : -1.5) + ' ' + x + ' ' + y + ')', text: t }));
        g.append(path, ...texts);
        return { p, path, texts };
      });
      root.append(Lib.head('SKETCH', 'ホワイトボードに描くように、図を育てる', '線は毎回わずかにゆがめて描く。描き終わった後も小さく震え、手描きらしさが残る。'), el('div', { class: 'sk-board' }, g));
    },
    start(sc) {
      const r = rng(11);
      items.forEach((it) => {
        it.path.setAttribute('d', it.p.shape(r));
        it.path.style.strokeDashoffset = 1;
        it.texts.forEach((t) => t.classList.remove('in'));
      });
      (async () => {
        await sc.wait(400);
        for (const it of items) {
          await sc.tween(it.p.text ? 900 : 500, (e) => { it.path.style.strokeDashoffset = 1 - e; }, (t) => t);
          it.texts.forEach((t) => t.classList.add('in'));
          await sc.wait(150);
        }
        /* 描き終わったら、線を時々引き直して震わせる */
        let k = 0;
        sc.frame((dt) => {
          k += dt;
          if (k < 0.16) return;
          k = 0;
          const rr = rng(Math.floor(Math.random() * 1e9));
          items.forEach((it) => it.path.setAttribute('d', it.p.shape(rr)));
        });
      })();
    },
  });
})();
