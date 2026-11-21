/* 年表とガントチャート: 線が伸びて出来事が順に現れる / 工程の棒が伸び、遅れが赤くなる */
(function () {
  'use strict';
  const { el, svg, clear } = Lib;
  const W = 1760, H = 700;

  const EVENTS = [
    [2015, '創業', '3名で受託分析を開始'], [2017, '初の自社製品', '需要予測ツール β 版'], [2019, '拠点を拡大', '大阪・福岡に営業所'],
    [2020, 'リモート移行', '全社テレワークへ'], [2022, '黒字化', '売上 10 億円を突破'], [2024, '生成 AI 導入', '報告書作成を自動化'], [2026, '海外展開', 'シンガポール法人を設立'],
  ];
  /* [工程, 予定開始週, 予定週数, 実績週数（遅れは予定より長い）] */
  const TASKS = [['要件定義', 0, 3, 3], ['基本設計', 2, 3, 4], ['画面開発', 5, 4, 4], ['API 開発', 5, 5, 7], ['データ移行', 8, 3, 3], ['結合テスト', 10, 3, 4], ['受入テスト', 13, 2, 2], ['本番切替', 15, 1, 1]];
  const WEEKS = 18, TODAY = 11;

  let box, tabs, mode = 0;

  function drawTimeline(sc) {
    const g = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'tl-svg' });
    box.appendChild(g);
    const y0 = 360, x0 = 80, x1 = W - 80, Y0 = 2014, Y1 = 2027;
    const X = (y) => x0 + (y - Y0) / (Y1 - Y0) * (x1 - x0);
    const line = svg('line', { x1: x0, x2: x0, y1: y0, y2: y0, stroke: '#6ea8ff', 'stroke-width': 6, 'stroke-linecap': 'round' });
    g.appendChild(line);
    for (let y = 2015; y <= 2026; y++) g.appendChild(svg('text', { x: X(y), y: y0 + 44, class: 'tick', 'text-anchor': 'middle', text: String(y) }));
    const items = EVENTS.map(([yr, t, d], i) => {
      const up = i % 2 === 0, x = X(yr), ty = up ? y0 - 150 : y0 + 110;
      const grp = svg('g', { class: 'tl-ev' },
        svg('line', { x1: x, x2: x, y1: y0, y2: up ? ty + 52 : ty - 34, stroke: '#334155', 'stroke-width': 2 }),
        svg('circle', { cx: x, cy: y0, r: 12, fill: '#0b0f17', stroke: '#6ea8ff', 'stroke-width': 4 }),
        svg('text', { x, y: ty, class: 'tl-title', 'text-anchor': 'middle', text: t }),
        svg('text', { x, y: ty + 32, class: 'tl-desc', 'text-anchor': 'middle', text: d }));
      g.appendChild(grp);
      return { grp, x };
    });
    sc.tween(4200, (e) => {
      const x = x0 + (x1 - x0) * e;
      line.setAttribute('x2', x);
      items.forEach((it) => it.grp.classList.toggle('in', it.x <= x + 1));
    }, (t) => t);
  }

  function drawGantt(sc) {
    const g = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'tl-svg' });
    box.appendChild(g);
    const L = 220, R = W - 40, T = 60, RH = 72;
    const X = (w) => L + w / WEEKS * (R - L);
    for (let w = 0; w <= WEEKS; w += 2) {
      g.appendChild(svg('line', { x1: X(w), x2: X(w), y1: T - 20, y2: T + TASKS.length * RH, class: 'grid' }));
      g.appendChild(svg('text', { x: X(w), y: T - 30, class: 'tick', 'text-anchor': 'middle', text: w + '週' }));
    }
    const bars = TASKS.map(([name, s, plan, act], i) => {
      const y = T + i * RH + 14;
      g.appendChild(svg('text', { x: L - 20, y: y + 32, class: 'gt-name', 'text-anchor': 'end', text: name }));
      g.appendChild(svg('rect', { x: X(s), y, width: X(s + plan) - X(s), height: 44, rx: 8, class: 'gt-plan' }));
      const bar = svg('rect', { x: X(s), y, width: 0, height: 44, rx: 8, class: 'gt-bar' });
      const over = svg('rect', { x: X(s + plan), y, width: 0, height: 44, rx: 8, class: 'gt-over' });
      const lab = svg('text', { x: X(s + act) + 12, y: y + 30, class: 'gt-delay', text: act > plan ? '+' + (act - plan) + '週 遅れ' : '' });
      g.append(bar, over, lab);
      return { s, plan, act, bar, over, lab };
    });
    const today = svg('g', { class: 'gt-today' },
      svg('line', { x1: X(TODAY), x2: X(TODAY), y1: T - 20, y2: T + TASKS.length * RH, stroke: '#fbbf24', 'stroke-width': 3, 'stroke-dasharray': '8 6' }),
      svg('text', { x: X(TODAY) + 8, y: T + TASKS.length * RH + 30, fill: '#fbbf24', 'font-size': 24, 'font-weight': 700, text: '今日（第' + TODAY + '週）' }));
    g.appendChild(today);
    bars.forEach((b, i) => {
      sc.timeout(() => sc.tween(700, (e) => {
        const w = Math.min(b.plan, b.act) * e;
        b.bar.setAttribute('width', X(b.s + w) - X(b.s));
      }).then(() => {
        if (b.act <= b.plan) return;
        return sc.tween(600, (e) => b.over.setAttribute('width', X(b.s + b.plan + (b.act - b.plan) * e) - X(b.s + b.plan))).then(() => b.lab.classList.add('in'));
      }), 300 + i * 260);
    });
    sc.timeout(() => today.classList.add('in'), 300 + TASKS.length * 260 + 900);
  }

  function select(sc, i) {
    mode = i;
    [...tabs.children].forEach((b, j) => b.classList.toggle('on', j === i));
    clear(box);
    (i === 0 ? drawTimeline : drawGantt)(sc);
  }

  let scRef;
  Slides.register('timeline', {
    title: '年表とガントチャート',
    tech: '時間の流れを順に描く',
    mount(root) {
      tabs = el('div', { class: 'tabs' }, ['年表', 'ガントチャート'].map((t, i) => el('button', { class: 'tab', text: t, onclick: () => scRef && select(scRef, i) })));
      box = el('div', { class: 'tl-box' });
      root.append(Lib.head('TIMELINE', '時間の流れを、左から順に描いていく', '年表は線が伸びるにつれて出来事が現れる。ガントは遅れた工程だけが赤く伸びる。'), tabs, box);
    },
    start(sc) { scRef = sc; select(sc, mode); },
  });
})();
