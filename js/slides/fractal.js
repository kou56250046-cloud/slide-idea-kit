/* 無限ズームのフラクタル: マンデルブロ集合の境界の1点へ、指数的に寄り続ける。
   毎フレーム全画素を計算すると重いので、倍率が2倍になるごとに1枚だけ計算し（キー画像）、
   その間は今のキー画像を拡大して見せる。次のキー画像は毎フレーム数ミリ秒ずつ裏で計算する */
(function () {
  'use strict';
  const { el } = Lib;
  const W = 1760, H = 740;
  const RW = 528, RH = 222;
  const CX = -0.743643887037151, CY = 0.131825904205330;
  const BUDGET = 7; /* 1フレームで計算に使ってよいミリ秒 */
  const MAXK = 40; /* 2^40 倍で精度が尽きるので最初に戻る */
  const PAL = (() => {
    const p = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 256 * Math.PI * 2;
      p[i * 3] = 128 + 127 * Math.sin(t + 4.0);
      p[i * 3 + 1] = 128 + 127 * Math.sin(t + 5.0);
      p[i * 3 + 2] = 128 + 127 * Math.sin(t + 6.0);
    }
    return p;
  })();

  function makeKey() {
    const c = el('canvas', { width: RW, height: RH });
    const ctx = c.getContext('2d');
    return { c, ctx, img: ctx.createImageData(RW, RH), row: 0, k: -1 };
  }

  /* キー画像 key の y0〜y1 行を、倍率 2^k で計算する */
  function rows(key, y0, y1) {
    const scale = Math.pow(2, key.k);
    const maxIt = Math.min(1200, Math.floor(120 + 45 * key.k));
    const px = 3.2 / scale / RW, d = key.img.data;
    for (let y = y0; y < y1; y++) {
      const ci = CY + (y - RH / 2) * px;
      for (let x = 0; x < RW; x++) {
        const cr = CX + (x - RW / 2) * px;
        let zr = 0, zi = 0, n = 0, zr2 = 0, zi2 = 0;
        while (zr2 + zi2 < 16 && n < maxIt) { zi = 2 * zr * zi + ci; zr = zr2 - zi2 + cr; zr2 = zr * zr; zi2 = zi * zi; n++; }
        const o = (y * RW + x) * 4;
        if (n >= maxIt) { d[o] = d[o + 1] = d[o + 2] = 0; }
        else {
          const sm = n + 1 - Math.log2(Math.log2(zr2 + zi2) / 2);
          const k = (Math.floor(sm * 6 + key.k * 12) & 255) * 3;
          d[o] = PAL[k]; d[o + 1] = PAL[k + 1]; d[o + 2] = PAL[k + 2];
        }
        d[o + 3] = 255;
      }
    }
  }
  /* 予算の範囲で次のキー画像を進める。出来上がったら true */
  function work(key, until) {
    while (key.row < RH && performance.now() < until) { rows(key, key.row, Math.min(RH, key.row + 4)); key.row += 4; }
    if (key.row >= RH) { key.ctx.putImageData(key.img, 0, 0); return true; }
    return false;
  }
  function begin(key, k) { key.k = k; key.row = 0; }

  let view, zoomEl;

  Slides.register('fractal', {
    title: '無限ズームのフラクタル',
    tech: '画素ごとに漸化式を計算',
    mount(root) {
      view = el('canvas', { width: W, height: H, class: 'fr-cv' });
      zoomEl = el('div', { class: 'fr-zoom' });
      root.append(Lib.head('INFINITE ZOOM', '寄っても寄っても、新しい模様が現れる', 'z → z² + c を画素ごとに繰り返すだけの式。拡大し続け、計算の精度が尽きたら最初に戻る。クリックで一時停止。'),
        el('div', { class: 'fr-wrap' }, view, zoomEl));
    },
    start(sc) {
      let cur = makeKey(), next = makeKey(), nextReady = false, scale = 1, paused = false, waiting = 0;
      begin(cur, 0); work(cur, Infinity);
      begin(next, 1);
      const ctx = view.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      sc.on(view, 'click', () => { paused = !paused; });
      sc.frame((dt) => {
        if (!nextReady) nextReady = work(next, performance.now() + BUDGET);
        const limit = Math.pow(2, cur.k + 1);
        if (!paused) {
          const want = scale * Math.exp(dt * 0.55);
          /* 次のキー画像が間に合っていなければ、そこで待つ */
          if (want >= limit && !nextReady) { scale = limit * 0.9999; waiting += dt; } else scale = want;
        }
        if (scale >= limit && nextReady) {
          const t = cur; cur = next; next = t; nextReady = false;
          if (cur.k >= MAXK) { scale = 1; begin(cur, 0); work(cur, Infinity); }
          begin(next, cur.k + 1);
        }
        /* 今のキー画像の中央を、倍率の差だけ切り出して引き伸ばす */
        const f = scale / Math.pow(2, cur.k), sw = RW / f, sh = RH / f;
        ctx.drawImage(cur.c, (RW - sw) / 2, (RH - sh) / 2, sw, sh, 0, 0, W, H);
        zoomEl.textContent = '倍率 ×' + (scale < 1e4 ? scale.toFixed(1) : scale.toExponential(2)) + (paused ? '　⏸' : '');
      });
    },
  });
})();
