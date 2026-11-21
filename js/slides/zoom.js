/* ズームで掘り下げる: 1枚の大きな SVG の viewBox を動かしてカメラのように寄る */
(function () {
  'use strict';
  const { el, svg } = Lib;
  const W = 1760, H = 700;

  function box(g, x, y, w, h, title, color, fs) {
    g.appendChild(svg('rect', { x, y, width: w, height: h, rx: Math.min(w, h) * 0.04, fill: color + '22', stroke: color, 'stroke-width': fs * 0.08 }));
    g.appendChild(svg('text', { x: x + fs * 0.6, y: y + fs * 1.3, 'font-size': fs, 'font-weight': 700, fill: '#e6edf7', text: title }));
  }

  /* 全社 → 製造部 → 工程B → 設備2 の入れ子。奥ほど文字が小さく、寄らないと読めない */
  function world() {
    const g = svg('g');
    const depts = [['営業部', 60, 80, '#6ea8ff'], ['物流部', 60, 450, '#4ade80'], ['管理部', 520, 450, '#fbbf24']];
    for (const [n, x, y, c] of depts) {
      box(g, x, y, 420, 300, n, c, 40);
      g.appendChild(svg('text', { x: x + 24, y: y + 120, 'font-size': 22, fill: '#8b98ad', text: '（この部門の詳細は省略）' }));
    }
    box(g, 980, 80, 720, 670, '製造部', '#a78bfa', 40);
    const procs = [['工程A 切断', 1010, 160], ['工程B 加工', 1350, 160], ['工程C 組立', 1010, 450], ['工程D 検査', 1350, 450]];
    for (const [n, x, y] of procs) box(g, x, y, 320, 270, n, '#a78bfa', 22);
    /* 工程B の中の設備 */
    const eq = [['設備1', 1366, 210, '稼働 92%'], ['設備2', 1470, 210, '稼働 61%'], ['設備3', 1574, 210, '稼働 88%']];
    for (const [n, x, y, k] of eq) {
      box(g, x, y, 90, 150, n, n === '設備2' ? '#f87171' : '#22d3ee', 9);
      g.appendChild(svg('text', { x: x + 6, y: y + 36, 'font-size': 7, fill: '#cbd5e1', text: k }));
    }
    /* 設備2 の中の明細。ほとんど点にしか見えない大きさ */
    const dx = 1476, dy = 260;
    g.appendChild(svg('text', { x: dx, y: dy, 'font-size': 4, fill: '#f87171', 'font-weight': 700, text: '停止の内訳（今月）' }));
    [['段取り替え', 38], ['部品待ち', 27], ['故障', 21], ['その他', 9]].forEach(([n, v], i) => {
      g.appendChild(svg('text', { x: dx, y: dy + 8 + i * 7, 'font-size': 3.2, fill: '#cbd5e1', text: n }));
      g.appendChild(svg('rect', { x: dx + 20, y: dy + 5.5 + i * 7, width: v * 0.9, height: 3, fill: i === 0 ? '#f87171' : '#475569' }));
      g.appendChild(svg('text', { x: dx + 22 + v * 0.9, y: dy + 8 + i * 7, 'font-size': 3, fill: '#94a3b8', text: v + 'h' }));
    });
    g.appendChild(svg('text', { x: dx, y: dy + 40, 'font-size': 3, fill: '#fbbf24', text: '→ 段取り替えの短縮が最優先' }));
    return g;
  }

  const SHOTS = [
    { x: -75, y: 40, w: 1910, cap: '全社の全体像' },
    { x: 960, y: 60, w: 760, cap: '製造部に寄る' },
    { x: 1180, y: 140, w: 700, cap: '工程B の中に3台の設備' },
    { x: 1300, y: 195, w: 430, cap: '稼働率が低い設備2' },
    { x: 1450, y: 247, w: 150, cap: '停止の内訳 → 段取り替えが最大' },
  ];

  let s, cap, dots, view = { x: 0, y: 0, w: W };
  function apply(v) { s.setAttribute('viewBox', v.x + ' ' + v.y + ' ' + v.w + ' ' + v.w * H / W); }

  Slides.register('zoom', {
    title: 'ズームで掘り下げる',
    tech: 'SVG の viewBox を動かす',
    mount(root) {
      s = svg('svg', { class: 'zm-svg', width: W, height: H }, world());
      cap = el('div', { class: 'zm-cap' });
      dots = el('div', { class: 'zm-dots' }, SHOTS.map(() => el('i')));
      root.append(Lib.head('ZOOM', '1枚の図の中へ、カメラが寄っていく', '全体から細部へ。寄るほど小さな文字が読めるようになる。クリックで次へ。'),
        el('div', { class: 'zm-wrap' }, s, cap, dots));
      apply(view);
    },
    start(sc) {
      let i = 0, busy = false;
      view = { ...SHOTS[0] }; apply(view);
      const show = async (k) => {
        busy = true;
        const from = { ...view }, to = SHOTS[k];
        cap.textContent = to.cap;
        [...dots.children].forEach((d, j) => d.classList.toggle('on', j === k));
        /* 幅は対数で補間すると、拡大の速さが一定に見える */
        await sc.tween(1500, (e) => {
          const lw = Math.exp(Lib.lerp(Math.log(from.w), Math.log(to.w), e));
          const t = (from.w === to.w) ? e : (from.w - lw) / (from.w - to.w);
          view = { x: Lib.lerp(from.x, to.x, t), y: Lib.lerp(from.y, to.y, t), w: lw };
          apply(view);
        }, Lib.easeInOutCubic);
        busy = false;
      };
      const next = () => { if (busy) return; i = (i + 1) % SHOTS.length; show(i); };
      show(0);
      sc.on(s.parentNode, 'click', next);
      const auto = () => sc.timeout(() => { next(); auto(); }, 3200);
      auto();
    },
  });
})();
