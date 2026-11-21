/* レーン付きの業務フロー: 部署ごとのレーンに工程を置き、条件で決まる経路を順に光らせ、案件の点を進める */
(function () {
  'use strict';
  const { el, svg, clear } = Lib;
  const W = 1520, H = 640, LANE_H = 150, X0 = 150;
  const LANES = ['顧客', '営業', '審査', '経理'];
  /* [id, レーン, x, 名前, 日数, 形] */
  const NODES = [
    ['c1', 0, 230, '申込', 0], ['s1', 1, 380, '受付', 1], ['s2', 1, 540, '見積作成', 2], ['j1', 2, 700, '金額判定', 0, 'diamond'],
    ['r1', 2, 870, '部長承認', 2], ['r2', 2, 1040, '役員承認', 3], ['a1', 3, 870, '与信確認', 3], ['a2', 3, 1210, '請求書発行', 1], ['c2', 0, 1390, '受領', 0],
  ];
  const N = Object.fromEntries(NODES.map((n) => [n[0], { id: n[0], lane: n[1], x: n[2], name: n[3], days: n[4], shape: n[5] }]));
  const AMOUNTS = ['100 万円未満', '100〜1,000 万円', '1,000 万円以上'];

  /* 条件から通る工程の列を決める */
  function route(amount, isNew) {
    const p = ['c1', 's1', 's2', 'j1'];
    if (amount >= 1) p.push('r1');
    if (amount >= 2) p.push('r2');
    if (isNew) p.push('a1');
    p.push('a2', 'c2');
    return p;
  }
  const cy = (n) => 40 + N[n].lane * LANE_H + LANE_H / 2;
  /* 2つの工程を直角の折れ線で結ぶ。レーンをまたぐ線は、行き先のレーンの境目を横に走らせる
     （レーンの中央を走らせると、通らない工程の箱を横切って見える） */
  function legPts(a, b) {
    const x1 = N[a].x, y1 = cy(a), x2 = N[b].x, y2 = cy(b);
    if (y1 === y2) return [[x1, y1], [x2, y2]];
    const lane = N[b].lane, yc = y2 > y1 ? 40 + lane * LANE_H : 40 + (lane + 1) * LANE_H;
    return [[x1, y1], [x1, yc], [x2, yc], [x2, y2]];
  }
  /* 全条件の経路から、図に描く線を集める */
  const ALL_LEGS = (() => {
    const set = new Set();
    for (let a = 0; a < 3; a++) for (const nw of [false, true]) { const r = route(a, nw); for (let i = 1; i < r.length; i++) set.add(r[i - 1] + '>' + r[i]); }
    return [...set].map((k) => k.split('>'));
  })();

  let g, amtBox, newBox, stats, amount = 0, isNew = false, scRef;

  function draw(sc) {
    clear(g);
    LANES.forEach((name, i) => {
      const y = 40 + i * LANE_H;
      g.appendChild(svg('rect', { x: 0, y, width: W, height: LANE_H, fill: i % 2 ? '#0f1626' : '#111a2b' }));
      g.appendChild(svg('text', { x: 24, y: y + LANE_H / 2 + 9, class: 'sw-lane', text: name }));
    });
    g.appendChild(svg('line', { x1: X0 - 20, x2: X0 - 20, y1: 40, y2: 40 + LANES.length * LANE_H, stroke: '#243049', 'stroke-width': 2 }));
    const path = route(amount, isNew);
    const onPath = new Set(path), legs = [];
    for (const [a, b] of ALL_LEGS) {
      const pts = legPts(a, b), d = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join('');
      g.appendChild(svg('path', { d, class: 'sw-edge' }));
    }
    for (let i = 1; i < path.length; i++) {
      const pts = legPts(path[i - 1], path[i]);
      const hl = svg('path', { d: pts.map((p, j) => (j ? 'L' : 'M') + p[0] + ',' + p[1]).join(''), class: 'sw-hl', pathLength: 1 });
      g.appendChild(hl);
      legs.push({ hl, pts });
    }
    const nodeEls = {};
    for (const n of Object.values(N)) {
      const y = cy(n.id), on = onPath.has(n.id);
      const grp = svg('g', { class: 'sw-node' + (on ? ' on' : ' off') });
      if (n.shape === 'diamond') grp.appendChild(svg('path', { d: 'M' + n.x + ',' + (y - 44) + ' L' + (n.x + 70) + ',' + y + ' L' + n.x + ',' + (y + 44) + ' L' + (n.x - 70) + ',' + y + ' Z' }));
      else grp.appendChild(svg('rect', { x: n.x - 66, y: y - 34, width: 132, height: 68, rx: 12 }));
      grp.appendChild(svg('text', { x: n.x, y: y + (n.days ? 18 : 8), 'text-anchor': 'middle', text: n.name }));
      if (n.days) grp.appendChild(svg('text', { x: n.x + 58, y: y - 14, 'text-anchor': 'end', class: 'sw-days', text: n.days + '日' }));
      g.appendChild(grp);
      nodeEls[n.id] = grp;
    }
    const token = svg('circle', { r: 14, class: 'sw-token', cx: N.c1.x, cy: cy('c1') });
    g.appendChild(token);

    const days = path.reduce((s, id) => s + N[id].days, 0);
    const approvals = path.filter((id) => id === 'r1' || id === 'r2').length;
    stats.textContent = '';
    stats.append(
      el('div', { class: 'stat big' }, el('span', { class: 'stat-k', text: '所要日数（合計）' }), el('span', { class: 'stat-v', text: days + ' 日' })),
      el('div', { class: 'stat' }, el('span', { class: 'stat-k', text: '承認者' }), el('span', { class: 'stat-v', text: approvals + ' 人' })),
      el('div', { class: 'stat' }, el('span', { class: 'stat-k', text: '通る工程' }), el('span', { class: 'stat-v', text: path.length + ' 個' })));

    /* 経路を1区間ずつ光らせ、点を進める */
    (async () => {
      for (let i = 0; i < legs.length; i++) {
        const { hl, pts } = legs[i];
        const len = pts.slice(1).reduce((s, p, j) => s + Math.hypot(p[0] - pts[j][0], p[1] - pts[j][1]), 0);
        nodeEls[path[i]].classList.add('pass');
        await sc.tween(Math.max(350, len * 2.2), (e) => {
          hl.style.strokeDashoffset = 1 - e;
          let d = e * len;
          for (let j = 1; j < pts.length; j++) {
            const sl = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
            if (d <= sl || j === pts.length - 1) {
              const t = sl ? Math.min(1, d / sl) : 1;
              token.setAttribute('cx', pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * t);
              token.setAttribute('cy', pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * t);
              break;
            }
            d -= sl;
          }
        }, Lib.easeInOutCubic);
      }
      nodeEls[path[path.length - 1]].classList.add('pass');
    })();
  }

  function setOpt(box, i) { [...box.children].forEach((b, j) => b.classList.toggle('on', j === i)); }

  Slides.register('swimlane', {
    title: 'レーン付きの業務フロー',
    tech: '条件で経路が光る',
    mount(root) {
      g = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'sw-svg' });
      amtBox = el('div', { class: 'tabs sw-opts' }, AMOUNTS.map((a, i) => el('button', { class: 'tab', text: a, onclick: () => { amount = i; setOpt(amtBox, i); if (scRef) Deck.restart(); } })));
      newBox = el('div', { class: 'tabs sw-opts' }, ['既存の取引先', '新規の取引先'].map((a, i) => el('button', { class: 'tab', text: a, onclick: () => { isNew = !!i; setOpt(newBox, i); if (scRef) Deck.restart(); } })));
      stats = el('div', { class: 'stats' });
      root.append(Lib.head('SWIMLANE', '誰が、どの順で、何をするか', '部署ごとのレーンに工程を置く。条件を切り替えると、案件が通る道だけが光り、点がその道を進む。'),
        el('div', { class: 'sw-layout' }, g, el('div', { class: 'sl-side' }, el('div', { class: 'sw-k', text: '金額' }), amtBox, el('div', { class: 'sw-k', text: '取引先' }), newBox, stats)));
      setOpt(amtBox, amount); setOpt(newBox, isNew ? 1 : 0);
    },
    start(sc) { scRef = sc; draw(sc); },
  });
})();
