/* ファネル: 点が上から落ち、段階ごとに通過率でこぼれ落ちて減っていく。歩留まりを変えると最終の受注が変わる */
(function () {
  'use strict';
  const { el, canvas, slider, fmtInt, fmtYen } = Lib;
  const W = 1100, H = 700;
  const STAGES = ['訪問', '資料請求', '商談', '見積', '受注'];
  const VISITS = 10000, PRICE = 1500000;
  const BAND = 118, TOP = 40, MAXW = 900;
  const RATES = [
    { label: '資料請求率', min: 1, max: 20, step: 0.5, value: 8 },
    { label: '商談化率', min: 10, max: 80, step: 1, value: 40 },
    { label: '見積率', min: 20, max: 90, step: 1, value: 60 },
    { label: '受注率', min: 5, max: 60, step: 1, value: 30 },
  ];

  let cv, sliders, stats;

  const counts = () => {
    const n = [VISITS];
    sliders.forEach((s, i) => n.push(n[i] * s.value / 100));
    return n;
  };
  /* 幅は件数の 0.35 乗に比例させる（受注が細くなりすぎて見えなくなるのを防ぐ。数字は実数で出す） */
  const widthOf = (n) => MAXW * Math.pow(Math.max(n, 0.5) / VISITS, 0.35);

  Slides.register('funnel', {
    title: 'ファネル',
    tech: '通過率で点がこぼれる',
    mount(root) {
      cv = canvas(W, H, 'fn-cv');
      sliders = RATES.map((r) => slider({ ...r, format: (v) => v + '%' }));
      stats = el('div', { class: 'stats' });
      root.append(Lib.head('FUNNEL', 'どの段階で、どれだけこぼれているか', '1つの点が1人。段階を通るたびに、通過できなかった点が横へこぼれ落ちる。歩留まりを動かすと受注が変わる。'),
        el('div', { class: 'sl-layout fn-layout' }, cv.el, el('div', { class: 'sl-side' }, ...sliders.map((s) => s.el), stats)));
    },
    start(sc) {
      const ctx = cv.ctx, font = getComputedStyle(document.body).fontFamily;
      let parts = [], spawn = 0, statT = 1;
      let widths = counts().map(widthOf);
      sc.frame((dt) => {
        const n = counts();
        /* 帯の幅はなめらかに追いかける */
        widths = widths.map((w, i) => w + (widthOf(n[i]) - w) * Math.min(1, dt * 6));
        spawn += dt * 70;
        while (spawn >= 1) { spawn--; parts.push({ x: (Math.random() - 0.5) * widths[0] * 0.9, y: TOP, vx: 0, vy: 200 + Math.random() * 80, st: 0, out: false, a: 1 }); }
        for (const p of parts) {
          if (p.out) { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a -= dt * 0.9; continue; }
          p.y += p.vy * dt;
          const stage = Math.floor((p.y - TOP) / BAND);
          if (stage > p.st && stage < STAGES.length) {
            /* 段階の境目で、通過率に従って残るかこぼれるかを決める */
            if (Math.random() * 100 > sliders[stage - 1].value) { p.out = true; p.vx = (p.x >= 0 ? 1 : -1) * (180 + Math.random() * 220); p.vy = -80; }
            else { p.st = stage; p.x *= widths[stage] / widths[stage - 1]; }
          }
          if (p.y > TOP + BAND * STAGES.length) p.a = 0;
        }
        parts = parts.filter((p) => p.a > 0 && p.y < H + 20);

        ctx.clearRect(0, 0, W, H);
        const cx = W / 2 - 60;
        STAGES.forEach((name, i) => {
          const y = TOP + i * BAND, w0 = widths[i], w1 = i + 1 < STAGES.length ? widths[i + 1] : widths[i] * 0.9;
          ctx.fillStyle = 'hsla(' + (215 + i * 22) + ',70%,55%,0.22)';
          ctx.beginPath(); ctx.moveTo(cx - w0 / 2, y); ctx.lineTo(cx + w0 / 2, y); ctx.lineTo(cx + w1 / 2, y + BAND - 6); ctx.lineTo(cx - w1 / 2, y + BAND - 6); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#e6edf7'; ctx.font = '700 24px ' + font; ctx.textAlign = 'left';
          ctx.fillText(name, cx + Math.max(w0, w1) / 2 + 24, y + 48);
          ctx.fillStyle = '#8b98ad'; ctx.font = '22px ' + font;
          ctx.fillText(fmtInt(n[i]) + ' 件' + (i ? '（' + sliders[i - 1].value + '%）' : ''), cx + Math.max(w0, w1) / 2 + 24, y + 80);
        });
        for (const p of parts) {
          ctx.globalAlpha = Math.max(0, p.a);
          ctx.fillStyle = p.out ? '#f87171' : p.st === STAGES.length - 1 ? '#4ade80' : '#6ea8ff';
          ctx.beginPath(); ctx.arc(cx + p.x, p.y, 3.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        statT += dt;
        if (statT < 0.25) return;
        statT = 0;
        const won = n[n.length - 1];
        /* いちばん効く改善: どの段階を +1pt 上げると受注が最も増えるか */
        let best = 0, bestGain = 0;
        sliders.forEach((s, i) => { const g = won * ((s.value + 1) / s.value - 1); if (g > bestGain) { bestGain = g; best = i; } });
        stats.textContent = '';
        stats.append(
          el('div', { class: 'stat big' }, el('span', { class: 'stat-k', text: '月の受注' }), el('span', { class: 'stat-v', text: won.toFixed(1) + ' 件' })),
          el('div', { class: 'stat' }, el('span', { class: 'stat-k', text: '受注額（単価 150 万円）' }), el('span', { class: 'stat-v', text: fmtYen(won * PRICE) })),
          el('div', { class: 'stat good wide' }, el('span', { class: 'stat-k', text: '+1pt 上げたとき最も受注が増える段階' }), el('span', { class: 'stat-v', text: RATES[best].label + ' +' + bestGain.toFixed(1) + '件' })));
      });
    },
  });
})();
