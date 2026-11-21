/* その場で学習するニューラルネット: 2-8-8-1 の小さなネットを、画面の前で実際に学習させる */
(function () {
  'use strict';
  const { el, svg, clear, canvas, rng } = Lib;
  const SIZES = [2, 8, 8, 1];

  /* ───── 学習の本体（DOM に依存しない。tests/nn.test.mjs から呼ぶ） ───── */
  function Net(sizes, r) {
    this.sizes = sizes;
    this.W = []; this.b = [];
    for (let l = 0; l < sizes.length - 1; l++) {
      const n = sizes[l], m = sizes[l + 1], s = Math.sqrt(1 / n);
      this.W.push(Float64Array.from({ length: n * m }, () => r.range(-1, 1) * s * 1.5));
      this.b.push(new Float64Array(m));
    }
  }
  /* 隠れ層は tanh、出力は sigmoid。各層の出力を返す */
  Net.prototype.forward = function (x) {
    const acts = [x];
    for (let l = 0; l < this.W.length; l++) {
      const a = acts[l], n = this.sizes[l], m = this.sizes[l + 1], W = this.W[l], out = new Float64Array(m);
      const last = l === this.W.length - 1;
      for (let j = 0; j < m; j++) {
        let z = this.b[l][j];
        for (let i = 0; i < n; i++) z += W[j * n + i] * a[i];
        out[j] = last ? 1 / (1 + Math.exp(-z)) : Math.tanh(z);
      }
      acts.push(out);
    }
    return acts;
  };
  /* 1件ぶんの確率的勾配降下。損失は交差エントロピー */
  Net.prototype.trainOne = function (x, y, lr) {
    const acts = this.forward(x);
    const L = this.W.length;
    let delta = Float64Array.of(acts[L][0] - y);
    for (let l = L - 1; l >= 0; l--) {
      const n = this.sizes[l], m = this.sizes[l + 1], W = this.W[l], a = acts[l];
      const prev = new Float64Array(n);
      for (let j = 0; j < m; j++) {
        for (let i = 0; i < n; i++) {
          prev[i] += W[j * n + i] * delta[j];
          W[j * n + i] -= lr * delta[j] * a[i];
        }
        this.b[l][j] -= lr * delta[j];
      }
      if (l > 0) for (let i = 0; i < n; i++) prev[i] *= 1 - a[i] * a[i];
      delta = prev;
    }
    const p = Math.min(1 - 1e-9, Math.max(1e-9, acts[L][0]));
    return -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  };
  Net.prototype.predict = function (x) { const a = this.forward(x); return a[a.length - 1][0]; };

  /* データ: 範囲は -1〜1。y は 0 か 1 */
  function makeData(kind, seed, n) {
    const r = rng(seed), out = [];
    n = n || 240;
    for (let i = 0; i < n; i++) {
      if (kind === 'spiral') {
        const c = i % 2, t = (i >> 1) / (n / 2) * 3.2 + 0.25, a = t * 1.9 + c * Math.PI;
        const rr = t / 3.6;
        out.push([Math.cos(a) * rr + r.range(-0.04, 0.04), Math.sin(a) * rr + r.range(-0.04, 0.04), c]);
      } else {
        const x = r.range(-1, 1), y = r.range(-1, 1);
        if (kind === 'xor') { if (Math.abs(x) < 0.08 || Math.abs(y) < 0.08) { i--; continue; } out.push([x, y, x * y > 0 ? 1 : 0]); }
        else out.push([x, y, Math.hypot(x, y) < 0.55 ? 1 : 0]);
      }
    }
    return out;
  }
  function train(net, data, steps, lr, r) {
    let loss = 0;
    for (let s = 0; s < steps; s++) { const d = data[r.int(data.length)]; loss += net.trainOne([d[0], d[1]], d[2], lr); }
    return loss / steps;
  }
  function accuracy(net, data) {
    let ok = 0;
    for (const d of data) if ((net.predict([d[0], d[1]]) > 0.5 ? 1 : 0) === d[2]) ok++;
    return ok / data.length;
  }
  window.__nn = { Net, makeData, train, accuracy, SIZES };

  /* ───── 画面 ───── */
  /* 3つ目は1フレームの学習回数。学習の途中が見えるよう、5秒前後で解けるくらいに絞る */
  const KINDS = [['xor', 'XOR（市松）', 10], ['circle', '円', 60], ['spiral', '渦巻き', 150]];
  const MAP = 600, GRIDN = 60;
  let mapCv, netSvg, lossSvg, statBox, tabs, kind = 0;

  /* 判定の濃淡は GRIDN×GRIDN の画素に書いてから引き伸ばす（fillRect を 3600 回呼ぶと重い） */
  let off, offCtx, offImg;
  function drawMap(net, data) {
    if (!off) {
      off = document.createElement('canvas'); off.width = GRIDN; off.height = GRIDN;
      offCtx = off.getContext('2d'); offImg = offCtx.createImageData(GRIDN, GRIDN);
    }
    const px = offImg.data, xy = [0, 0];
    for (let gy = 0; gy < GRIDN; gy++) for (let gx = 0; gx < GRIDN; gx++) {
      xy[0] = gx / GRIDN * 2 - 1 + 1 / GRIDN; xy[1] = gy / GRIDN * 2 - 1 + 1 / GRIDN;
      const p = net.predict(xy);
      /* 1 は青、0 はオレンジ。境界ほど背景に近い暗さ */
      const k = 0.15 + Math.abs(p - 0.5) * 1.1, o = (gy * GRIDN + gx) * 4;
      const [r0, g0, b0] = p > 0.5 ? [110, 168, 255] : [251, 146, 60];
      px[o] = 13 + (r0 - 13) * k; px[o + 1] = 19 + (g0 - 19) * k; px[o + 2] = 31 + (b0 - 31) * k; px[o + 3] = 255;
    }
    offCtx.putImageData(offImg, 0, 0);
    const ctx = mapCv.ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, MAP, MAP);
    for (const d of data) {
      ctx.fillStyle = d[2] ? '#6ea8ff' : '#fb923c';
      ctx.strokeStyle = '#0b0f17'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc((d[0] + 1) / 2 * MAP, (d[1] + 1) / 2 * MAP, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  function drawNet(net) {
    clear(netSvg);
    const Wd = 520, Hd = 600, xs = SIZES.map((_, l) => 50 + l * (Wd - 100) / (SIZES.length - 1));
    const ys = SIZES.map((n) => Array.from({ length: n }, (_, i) => Hd / 2 + (i - (n - 1) / 2) * 62));
    for (let l = 0; l < net.W.length; l++) {
      const n = SIZES[l], m = SIZES[l + 1];
      for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
        const w = net.W[l][j * n + i];
        netSvg.appendChild(svg('line', { x1: xs[l], y1: ys[l][i], x2: xs[l + 1], y2: ys[l + 1][j], stroke: w > 0 ? '#6ea8ff' : '#fb923c', 'stroke-width': Math.min(8, Math.abs(w) * 2.2).toFixed(2), 'stroke-opacity': Math.min(0.9, 0.15 + Math.abs(w) * 0.35).toFixed(2) }));
      }
    }
    SIZES.forEach((n, l) => ys[l].forEach((y) => netSvg.appendChild(svg('circle', { cx: xs[l], cy: y, r: 16, fill: '#162033', stroke: '#8b98ad', 'stroke-width': 2 }))));
    ['入力 x, y', '隠れ層 8', '隠れ層 8', '出力'].forEach((t, l) => netSvg.appendChild(svg('text', { x: xs[l], y: 30, class: 'tick', 'text-anchor': 'middle', text: t })));
  }

  function drawLoss(hist) {
    clear(lossSvg);
    if (hist.length < 2) return;
    const max = Math.max(...hist, 0.1);
    lossSvg.appendChild(svg('line', { x1: 0, x2: 480, y1: 130, y2: 130, class: 'axis0' }));
    lossSvg.appendChild(svg('polyline', { points: hist.map((v, i) => (i / (hist.length - 1) * 480).toFixed(1) + ',' + (130 - v / max * 120).toFixed(1)).join(' '), fill: 'none', stroke: '#fbbf24', 'stroke-width': 3 }));
  }

  let scRef;
  Slides.register('nn', {
    title: 'その場で学習するニューラルネット',
    tech: '順伝播・逆伝播を自前で計算',
    mount(root) {
      mapCv = canvas(MAP, MAP, 'nn-map');
      netSvg = svg('svg', { viewBox: '0 0 520 600', class: 'nn-net' });
      lossSvg = svg('svg', { viewBox: '0 0 480 140', class: 'nn-loss' });
      statBox = el('div', { class: 'stats nn-stats' });
      tabs = el('div', { class: 'tabs' }, KINDS.map((k, i) => el('button', { class: 'tab', text: k[1], onclick: () => { kind = i; if (scRef) Deck.restart(); } })));
      root.append(Lib.head('NEURAL NETWORK', '小さな AI が、目の前で学習していく', '本当に計算している。左の色は AI の判定（青 / オレンジ）、中央の線の太さは重みの大きさ。'),
        el('div', { class: 'nn-layout' },
          mapCv.el, netSvg,
          el('div', { class: 'nn-side' }, tabs, statBox, el('div', { class: 'q-spark-cap', text: '損失（小さいほど良い）' }), lossSvg,
            el('button', { class: 'btn', text: '↺ 最初から学習', onclick: () => Deck.restart() }))));
    },
    start(sc) {
      scRef = sc;
      [...tabs.children].forEach((b, i) => b.classList.toggle('on', i === kind));
      const r = rng(Math.floor(Math.random() * 1e9));
      const data = makeData(KINDS[kind][0], 9);
      const net = new Net(SIZES, r);
      const hist = [];
      let steps = 0, f = 0;
      const lr = KINDS[kind][0] === 'spiral' ? 0.02 : 0.03;
      sc.frame(() => {
        const per = KINDS[kind][2];
        const loss = train(net, data, per, lr, r);
        steps += per;
        hist.push(loss); if (hist.length > 240) hist.shift();
        f++;
        if (f % 2) return;
        drawMap(net, data);
        if (f % 6 === 0) {
          drawNet(net);
          drawLoss(hist);
          const acc = accuracy(net, data);
          clear(statBox).append(
            el('div', { class: 'stat' }, el('span', { class: 'stat-k', text: '学習した回数' }), el('span', { class: 'stat-v', text: Lib.fmtInt(steps) })),
            el('div', { class: 'stat ' + (acc > 0.95 ? 'good' : '') }, el('span', { class: 'stat-k', text: '正解率' }), el('span', { class: 'stat-v', text: (acc * 100).toFixed(1) + '%' })));
        }
      });
    },
  });
})();
