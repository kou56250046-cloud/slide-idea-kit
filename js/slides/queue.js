/* 待ち行列シミュレーション: 到着の多さと窓口の数を変えると、行列が伸び縮みする（M/M/c） */
(function () {
  'use strict';
  const { el, svg, clear, canvas, slider } = Lib;
  const W = 1240, H = 520, MU = 1.2; /* 1窓口が1分に処理できる人数。画面の1秒 = 1分 */
  const QX = 860, QY = 260, GAP = 28, WX = 1060;

  /* アーラン C 式で理論上の平均待ち時間（分）。行列が伸び続けるなら Infinity */
  function erlangWq(lam, c, mu) {
    const a = lam / mu, rho = a / c;
    if (rho >= 1) return Infinity;
    let sum = 0, term = 1;
    for (let k = 0; k < c; k++) { if (k) term *= a / k; sum += term; }
    const last = term * (a / c) / (1 - rho);
    return (last / (sum + last)) / (c * mu - lam);
  }

  let cv, lamSl, cSl, statBox, spark;

  Slides.register('queue', {
    title: '待ち行列シミュレーション',
    tech: '確率で動くエージェント',
    mount(root) {
      cv = canvas(W, H, 'q-cv');
      lamSl = slider({ label: '1分あたりの来客', min: 1, max: 8, step: 0.5, value: 3, format: (v) => v.toFixed(1) + ' 人' });
      cSl = slider({ label: '窓口の数', min: 1, max: 6, step: 1, value: 2, format: (v) => v + ' 窓口' });
      statBox = el('div', { class: 'stats' });
      spark = svg('svg', { class: 'q-spark', viewBox: '0 0 1240 150', width: 1240, height: 150 });
      root.append(Lib.head('QUEUE SIMULATION', '窓口を1つ増やすと、行列はどれだけ減るか', '人が来る間隔も、処理にかかる時間もランダム。画面の1秒を1分として動かしている。'),
        el('div', { class: 'q-layout' },
          el('div', {}, cv.el, el('div', { class: 'q-spark-cap', text: '待っている人数（直近90秒）' }), spark),
          el('div', { class: 'sl-side' }, lamSl.el, cSl.el, statBox)));
    },
    start(sc) {
      const ctx = cv.ctx;
      const exp = (rate) => -Math.log(1 - Math.random()) / rate;
      let people = [], queue = [], win = Array(6).fill(null), nextArr = 0.2, waits = [], hist = [], histT = 0, statT = 1;

      sc.frame((dt) => {
        const lam = lamSl.value, c = cSl.value;
        nextArr -= dt;
        while (nextArr <= 0) {
          const p = { x: -20, y: QY, tx: 0, ty: QY, st: 'queue', arr: 0, age: 0 };
          people.push(p); queue.push(p);
          nextArr += exp(lam);
        }
        for (const p of people) p.age += dt;
        /* 空いた窓口へ */
        for (let j = 0; j < c; j++) {
          if (!win[j] && queue.length) {
            const p = queue.shift();
            p.st = 'serve'; p.left = exp(MU); p.win = j;
            waits.push(p.age); if (waits.length > 40) waits.shift();
            win[j] = p;
          }
        }
        for (let j = 0; j < 6; j++) {
          const p = win[j];
          if (!p) continue;
          p.left -= dt;
          if (p.left <= 0) { p.st = 'leave'; win[j] = null; }
        }
        const wy = (j) => (c === 1 ? QY : 60 + j * ((H - 120) / Math.max(1, c - 1)));
        queue.forEach((p, i) => { p.tx = QX - i * GAP; p.ty = QY; });
        for (const p of people) {
          if (p.st === 'serve') { p.tx = WX + 50; p.ty = wy(p.win); }
          if (p.st === 'leave') { p.tx = W + 40; }
          const k = Math.min(1, dt * 6);
          p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k;
        }
        people = people.filter((p) => !(p.st === 'leave' && p.x > W + 20));

        histT += dt;
        if (histT >= 0.5) { histT = 0; hist.push(queue.length); if (hist.length > 180) hist.shift(); }

        /* 描画 */
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#141c2b'; ctx.fillRect(0, QY - 22, QX + 20, 44);
        for (let j = 0; j < c; j++) {
          ctx.fillStyle = win[j] ? '#1f3b2e' : '#1a2233';
          ctx.fillRect(WX, wy(j) - 34, 110, 68);
          ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2; ctx.strokeRect(WX, wy(j) - 34, 110, 68);
        }
        for (const p of people) {
          if (p.x < -10) continue;
          ctx.fillStyle = p.st === 'queue' ? (p.age > 3 ? '#f87171' : '#fbbf24') : p.st === 'serve' ? '#4ade80' : '#64748b';
          ctx.beginPath(); ctx.arc(p.x, p.y - 8, 8, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(p.x - 7, p.y + 2, 14, 16);
        }

        statT += dt;
        if (statT < 0.25) return;
        statT = 0;
        const rho = lam / (c * MU), wq = erlangWq(lam, c, MU);
        const meas = waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0;
        clear(statBox).append(
          el('div', { class: 'stat ' + (rho >= 1 ? 'bad' : rho > 0.85 ? 'warn' : 'good') }, el('span', { class: 'stat-k', text: '窓口の稼働率' }), el('span', { class: 'stat-v', text: (rho * 100).toFixed(0) + '%' })),
          el('div', { class: 'stat' }, el('span', { class: 'stat-k', text: '待っている人' }), el('span', { class: 'stat-v', text: queue.length + ' 人' })),
          el('div', { class: 'stat' }, el('span', { class: 'stat-k', text: '平均待ち（実測・直近40人）' }), el('span', { class: 'stat-v', text: meas.toFixed(1) + ' 分' })),
          el('div', { class: 'stat ' + (wq === Infinity ? 'bad' : '') }, el('span', { class: 'stat-k', text: '平均待ち（理論値）' }), el('span', { class: 'stat-v', text: wq === Infinity ? '行列が伸び続ける' : wq.toFixed(1) + ' 分' })));
        const max = Math.max(10, ...hist);
        const pts = hist.map((v, i) => (i * 1240 / 179).toFixed(1) + ',' + (140 - v / max * 130).toFixed(1)).join(' ');
        clear(spark).append(
          svg('line', { x1: 0, x2: 1240, y1: 140, y2: 140, class: 'axis0' }),
          svg('text', { x: 4, y: 20, class: 'tick', text: max + '人' }),
          svg('polyline', { points: pts, fill: 'none', stroke: '#fbbf24', 'stroke-width': 3 }));
      });
    },
  });
})();
