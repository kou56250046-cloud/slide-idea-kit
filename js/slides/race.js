/* モデル比較シミュレーション: 正確さの違う5モデルが同じ問題を同時に解く様子を再生する。
   LLM は呼ばない。各モデルは「正確さ p」「1回の推論で進める量 k」だけで振る舞いが決まる */
(function () {
  'use strict';
  const { el, clear, rng, canvas } = Lib;
  const SIZE = 306;

  const MODELS = [
    { name: 'Frontier-XL', tag: '大規模・推論強化', p: 0.97, k: 3, color: '#a78bfa' },
    { name: 'Pro-L', tag: '大規模', p: 0.9, k: 2, color: '#6ea8ff' },
    { name: 'Standard-M', tag: '中規模', p: 0.8, k: 2, color: '#4ade80' },
    { name: 'Lite-S', tag: '小規模', p: 0.65, k: 1, color: '#fbbf24' },
    { name: 'Nano-XS', tag: '超小型', p: 0.5, k: 1, color: '#f87171' },
  ];

  /* ───────── ナンプレ ───────── */
  const sudoku = {
    id: 'sudoku', name: 'ナンプレ', maxSteps: 150,
    rule: '空きマスに数字を入れる。誤りは見直しで気づけば消して入れ直す',
    setup(seed) {
      const r = rng(seed);
      const digits = r.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const order = () => r.shuffle([0, 1, 2]).flatMap((b) => r.shuffle([0, 1, 2]).map((i) => b * 3 + i));
      const rows = order(), cols = order();
      const sol = [];
      for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
        const ry = rows[y], cx = cols[x];
        sol.push(digits[(3 * (ry % 3) + Math.floor(ry / 3) + cx) % 9]);
      }
      const idx = r.shuffle([...Array(81).keys()]);
      const given = Array(81).fill(false);
      idx.slice(0, 34).forEach((i) => { given[i] = true; });
      return { sol, given };
    },
    init(sh) {
      return { val: sh.sol.map((v, i) => (sh.given[i] ? v : 0)), st: sh.given.map((g) => (g ? 'given' : 'empty')), changed: new Set(), errors: 0 };
    },
    step(s, sh, m, r) {
      s.changed = new Set();
      /* 見直し: 誤りに気づく確率は正確さに比例 */
      const detect = 0.3 + 0.6 * m.p;
      s.st.forEach((st, i) => {
        if (st === 'bad' && r() < detect) { s.st[i] = 'empty'; s.val[i] = 0; s.changed.add(i); }
      });
      const empties = [];
      s.st.forEach((st, i) => { if (st === 'empty' && !s.changed.has(i)) empties.push(i); });
      r.shuffle(empties);
      for (const i of empties.slice(0, m.k)) {
        if (r() < m.p) { s.val[i] = sh.sol[i]; s.st[i] = 'ok'; }
        else { let w; do { w = 1 + r.int(9); } while (w === sh.sol[i]); s.val[i] = w; s.st[i] = 'bad'; s.errors++; }
        s.changed.add(i);
      }
    },
    done: (s) => s.st.every((st) => st === 'ok' || st === 'given'),
    progress: (s) => s.st.filter((st) => st === 'ok' || st === 'given').length / 81,
    view(box) {
      const grid = el('div', { class: 'sd-grid' });
      const cells = [], base = [];
      for (let i = 0; i < 81; i++) {
        const y = Math.floor(i / 9), x = i % 9;
        base.push('sd-cell' + (x % 3 === 2 && x < 8 ? ' br' : '') + (y % 3 === 2 && y < 8 ? ' bb' : ''));
        const c = el('div', { class: base[i] });
        cells.push(c); grid.appendChild(c);
      }
      box.appendChild(grid);
      return { cells, base };
    },
    draw(v, s) {
      for (let i = 0; i < 81; i++) {
        v.cells[i].className = v.base[i] + ' ' + s.st[i] + (s.changed.has(i) ? ' pop' : '');
        v.cells[i].textContent = s.val[i] ? String(s.val[i]) : '';
      }
    },
  };

  /* ───────── 迷路 ───────── */
  const N = 15;
  const maze = {
    id: 'maze', name: '迷路の探索', maxSteps: 150,
    rule: '分かれ道で正しい方を選ぶ確率が p。行き止まりに入ったら引き返す',
    setup(seed) {
      const r = rng(seed);
      const open = Array(N * N).fill(0); /* 1:上 2:右 4:下 8:左 */
      const seen = Array(N * N).fill(false);
      const stack = [0]; seen[0] = true;
      const D = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]];
      while (stack.length) {
        const c = stack[stack.length - 1], x = c % N, y = (c / N) | 0;
        const nb = D.filter(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < N && ny < N && !seen[ny * N + nx]; });
        if (!nb.length) { stack.pop(); continue; }
        const [dx, dy, a, b] = r.pick(nb);
        const n = (y + dy) * N + (x + dx);
        open[c] |= a; open[n] |= b; seen[n] = true; stack.push(n);
      }
      /* 通路は格子の内側にしか開けていないので、範囲外は出てこない */
      const nbrs = (c) => {
        const out = [];
        if (open[c] & 1) out.push(c - N);
        if (open[c] & 2) out.push(c + 1);
        if (open[c] & 4) out.push(c + N);
        if (open[c] & 8) out.push(c - 1);
        return out;
      };
      const goal = N * N - 1;
      const dist = Array(N * N).fill(Infinity); dist[goal] = 0;
      const q = [goal];
      while (q.length) { const c = q.shift(); for (const n of nbrs(c)) if (dist[n] === Infinity) { dist[n] = dist[c] + 1; q.push(n); } }
      return { open, nbrs, dist, goal };
    },
    init() { return { stack: [0], visited: new Set([0]), dead: new Set(), errors: 0 }; },
    step(s, sh, m, r) {
      for (let i = 0; i < m.k * 2; i++) {
        const cur = s.stack[s.stack.length - 1];
        if (cur === sh.goal) return;
        const cand = sh.nbrs(cur).filter((n) => !s.visited.has(n));
        if (!cand.length) { s.dead.add(s.stack.pop()); continue; }
        const good = cand.find((n) => sh.dist[n] < sh.dist[cur]);
        const pick = good !== undefined && r() < m.p ? good : r.pick(cand);
        if (good !== undefined && pick !== good) s.errors++;
        s.visited.add(pick); s.stack.push(pick);
      }
    },
    done: (s, sh) => s.stack[s.stack.length - 1] === sh.goal,
    progress(s, sh) {
      let best = Infinity;
      for (const c of s.stack) best = Math.min(best, sh.dist[c]);
      return 1 - best / sh.dist[0];
    },
    view(box) { const cv = canvas(SIZE, SIZE, 'mz-cv'); box.appendChild(cv.el); return cv; },
    draw(v, s, sh, m) {
      const ctx = v.ctx, cs = SIZE / N;
      ctx.fillStyle = '#0d131f'; ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = 'rgba(248,113,113,0.22)';
      for (const c of s.dead) ctx.fillRect((c % N) * cs, ((c / N) | 0) * cs, cs, cs);
      ctx.fillStyle = 'rgba(255,215,0,0.9)';
      ctx.fillRect((N - 1) * cs + 3, (N - 1) * cs + 3, cs - 6, cs - 6);
      ctx.strokeStyle = m.color; ctx.lineWidth = cs * 0.38; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      s.stack.forEach((c, i) => { const px = (c % N + 0.5) * cs, py = (((c / N) | 0) + 0.5) * cs; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.stroke();
      const h = s.stack[s.stack.length - 1];
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc((h % N + 0.5) * cs, (((h / N) | 0) + 0.5) * cs, cs * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3a4a66'; ctx.lineWidth = 2; ctx.lineCap = 'square';
      ctx.beginPath();
      for (let c = 0; c < N * N; c++) {
        const x = (c % N) * cs, y = ((c / N) | 0) * cs, o = sh.open[c];
        if (!(o & 1)) { ctx.moveTo(x, y); ctx.lineTo(x + cs, y); }
        if (!(o & 8)) { ctx.moveTo(x, y); ctx.lineTo(x, y + cs); }
        if ((c % N) === N - 1 && !(o & 2)) { ctx.moveTo(x + cs, y); ctx.lineTo(x + cs, y + cs); }
        if (((c / N) | 0) === N - 1 && !(o & 4)) { ctx.moveTo(x, y + cs); ctx.lineTo(x + cs, y + cs); }
      }
      ctx.stroke();
    },
  };

  /* ───────── 文章の穴埋め ───────── */
  const TARGET = 'シミュレーション では 、 モデル ごと に 正確さ を 確率 として 与え 、 同じ 乱数 の 種 から 毎回 同じ 結果 を 再生 する 。'.split(' ');
  const DISTRACT = ['予測', '学習', '速度', '精度', 'データ', '手順', 'は', 'が', 'で', '最適化', '評価', '推論', '品質', '関数', '要約', '分類'];
  const cloze = {
    id: 'cloze', name: '文章の生成', maxSteps: 60,
    rule: 'トークンを順に出す。誤りに気づくと、そこから後ろを取り消して書き直す',
    setup() { return {}; },
    init() { return { out: [], pos: 0, errors: 0 }; },
    step(s, sh, m, r) {
      s.out.forEach((t) => { if (t.struck) t.age++; });
      s.out = s.out.filter((t) => !t.struck || t.age < 2);
      const live = s.out.filter((t) => !t.struck);
      const bad = live.findIndex((t) => !t.ok);
      if (bad >= 0 && r() < 0.25 + 0.6 * m.p) {
        live.slice(bad).forEach((t) => { t.struck = true; t.age = 0; });
        s.pos = bad;
        return;
      }
      for (let i = 0; i < m.k && s.pos < TARGET.length; i++) {
        if (r() < m.p) s.out.push({ t: TARGET[s.pos], ok: true, fresh: true });
        else { let w; do { w = r.pick(DISTRACT); } while (w === TARGET[s.pos]); s.out.push({ t: w, ok: false, fresh: true }); s.errors++; }
        s.pos++;
      }
    },
    done: (s) => s.pos >= TARGET.length && s.out.every((t) => t.struck || t.ok),
    progress(s) {
      let n = 0;
      for (const t of s.out) { if (t.struck) continue; if (!t.ok) break; n++; }
      return n / TARGET.length;
    },
    view(box) { const p = el('div', { class: 'cz-box' }); box.appendChild(p); return { p }; },
    draw(v, s) {
      clear(v.p);
      for (const t of s.out) {
        v.p.appendChild(el('span', { class: 'cz-tok' + (t.struck ? ' struck' : t.ok ? '' : ' bad') + (t.fresh ? ' fresh' : ''), text: t.t }));
        t.fresh = false;
      }
      v.p.appendChild(el('span', { class: 'cz-caret' }));
    },
  };

  /* ───────── 巡回セールスマン ───────── */
  const tourLen = (t, P) => { let d = 0; for (let i = 0; i < t.length; i++) { const a = P[t[i]], b = P[t[(i + 1) % t.length]]; d += Math.hypot(a[0] - b[0], a[1] - b[1]); } return d; };
  const rev = (t, i, j) => { const n = t.slice(); while (i < j) { const x = n[i]; n[i] = n[j]; n[j] = x; i++; j--; } return n; };
  function bestMove(t, P) {
    let best = null, bl = tourLen(t, P);
    for (let i = 1; i < t.length - 1; i++) for (let j = i + 1; j < t.length; j++) {
      const n = rev(t, i, j), l = tourLen(n, P);
      if (l < bl - 1e-9) { bl = l; best = n; }
    }
    return best;
  }
  const tsp = {
    id: 'tsp', name: '巡回セールスマン', maxSteps: 80,
    rule: '経路の一部を入れ替えて短くする。p の確率で最善手、外すと悪い手を打つ',
    setup(seed) {
      const r = rng(seed);
      const P = Array.from({ length: 22 }, () => [r.range(22, SIZE - 22), r.range(22, SIZE - 22)]);
      const start = r.shuffle([...Array(P.length).keys()]);
      /* 目標: 共通の初期経路から最善手だけを打ち続けて着く距離。
         全体の最良解を目標にすると、正確なモデルほど局所解で行き詰まり順位が逆転する */
      let t = start.slice(), n;
      while ((n = bestMove(t, P))) t = n;
      return { P, ref: tourLen(t, P), start, startLen: tourLen(start, P) };
    },
    init(sh) { return { t: sh.start.slice(), len: sh.startLen, errors: 0 }; },
    step(s, sh, m, r) {
      for (let k = 0; k < m.k; k++) {
        if (tsp.done(s, sh)) return;
        let n = null;
        if (r() < m.p) n = bestMove(s.t, sh.P);
        if (!n) {
          const i = 1 + r.int(s.t.length - 2), j = i + 1 + r.int(s.t.length - 1 - i);
          n = rev(s.t, i, j);
          if (tourLen(n, sh.P) > s.len) s.errors++;
        }
        s.t = n; s.len = tourLen(n, sh.P);
      }
    },
    done: (s, sh) => s.len <= sh.ref * 1.001,
    progress: (s, sh) => Math.max(0, Math.min(1, (sh.startLen - s.len) / (sh.startLen - sh.ref))),
    extra: (s, sh) => '目標との差 ' + (s.len <= sh.ref ? '' : '+') + ((s.len / sh.ref - 1) * 100).toFixed(1) + '%',
    view(box) { const cv = canvas(SIZE, SIZE, 'mz-cv'); box.appendChild(cv.el); return cv; },
    draw(v, s, sh, m) {
      const ctx = v.ctx;
      ctx.fillStyle = '#0d131f'; ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.strokeStyle = m.color; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.beginPath();
      s.t.forEach((c, i) => { const [x, y] = sh.P[c]; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.closePath(); ctx.stroke();
      for (const [x, y] of sh.P) { ctx.fillStyle = '#e6edf7'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); }
    },
  };

  const TASKS = [sudoku, maze, cloze, tsp];

  /* 1問ぶんを走らせる。DOM なしでも動く（確認用） */
  function makeRun(task, seed) {
    const shared = task.setup(seed);
    return MODELS.map((m, i) => ({ m, r: rng(seed * 7919 + i + 1), s: task.init(shared), steps: 0, solved: false, over: false, rank: 0, shared }));
  }
  function tick(task, run, n) {
    let rank = run.filter((x) => x.solved).length;
    const newly = [];
    for (const x of run) {
      if (x.solved || x.over) continue;
      task.step(x.s, x.shared, x.m, x.r);
      x.steps = n;
      if (task.done(x.s, x.shared)) { x.solved = true; newly.push(x); }
      else if (n >= task.maxSteps) x.over = true;
    }
    /* 同じステップで解いたものは同順位 */
    if (newly.length) { rank++; newly.forEach((x) => { x.rank = rank; }); }
    return run.every((x) => x.solved || x.over);
  }
  window.__race = {
    headless(taskId, seed) {
      const task = TASKS.find((t) => t.id === taskId);
      const run = makeRun(task, seed);
      let n = 0;
      while (!tick(task, run, ++n));
      return run.map((x) => ({ name: x.m.name, solved: x.solved, steps: x.steps, errors: x.s.errors, rank: x.rank }));
    },
  };

  /* ───────── 画面 ───────── */
  let taskIdx = 0, seed = 1, speed = 1, playing = true;
  let panelsBox, stepNo, tabsBox, playBtn, speedBtn, seedNo, ruleText, summary;
  let run, views, panelEls, n, acc, sc;

  function buildPanels() {
    clear(panelsBox);
    const task = TASKS[taskIdx];
    views = []; panelEls = [];
    run.forEach((x) => {
      const board = el('div', { class: 'rc-board' });
      const stat = el('div', { class: 'rc-stat' });
      const bar = el('i', { style: { background: x.m.color } });
      const badge = el('div', { class: 'rc-badge' });
      const panel = el('div', { class: 'rc-panel', style: { '--c': x.m.color } },
        el('div', { class: 'rc-name' }, el('b', { text: x.m.name }), el('span', { text: x.m.tag })),
        el('div', { class: 'rc-param', text: '正確さ p=' + x.m.p.toFixed(2) + '　1回で ' + x.m.k + ' 手' }),
        board, el('div', { class: 'rc-prog' }, bar), stat, badge);
      panelsBox.appendChild(panel);
      views.push(task.view(board));
      panelEls.push({ panel, stat, bar, badge });
    });
  }

  function drawAll() {
    const task = TASKS[taskIdx];
    run.forEach((x, i) => {
      task.draw(views[i], x.s, x.shared, x.m);
      const pe = panelEls[i];
      pe.bar.style.width = (task.progress(x.s, x.shared) * 100).toFixed(1) + '%';
      pe.stat.textContent = '推論 ' + x.steps + ' 回　誤り ' + x.s.errors + (task.extra ? '\n' + task.extra(x.s, x.shared) : '');
      pe.panel.classList.toggle('solved', x.solved);
      pe.panel.classList.toggle('over', x.over);
      pe.badge.textContent = x.solved ? (x.rank === 1 ? '🏆 ' : '✓ ') + x.rank + '位　' + x.steps + ' 回で正解' : x.over ? '✗ ' + task.maxSteps + ' 回で打ち切り' : '';
    });
    stepNo.textContent = String(n).padStart(3, '0');
  }

  function reset() {
    const task = TASKS[taskIdx];
    run = makeRun(task, seed);
    n = 0; acc = 0;
    [...tabsBox.children].forEach((b, i) => b.classList.toggle('on', i === taskIdx));
    ruleText.textContent = task.rule;
    seedNo.textContent = '問題 #' + seed;
    summary.textContent = '';
    buildPanels();
    drawAll();
  }

  function finish() {
    const solved = run.filter((x) => x.solved).sort((a, b) => a.steps - b.steps);
    summary.textContent = solved.length
      ? '最少: ' + solved[0].m.name + ' ' + solved[0].steps + ' 回　正解 ' + solved.length + ' / ' + run.length + ' モデル'
      : '正解したモデルなし';
  }

  function loop(s) {
    s.frame((dt) => {
      if (!playing) return;
      acc += dt * speed;
      if (acc < 0.38) return;
      acc = 0;
      const allDone = tick(TASKS[taskIdx], run, ++n);
      drawAll();
      if (allDone) { finish(); playing = false; playBtn.textContent = '▶ 再生'; }
    });
  }

  function setPlaying(v) { playing = v; playBtn.textContent = v ? '⏸ 一時停止' : '▶ 再生'; }

  Slides.register('race', {
    title: 'モデル比較シミュレーション',
    tech: 'シード付き乱数で再現',
    mount(root) {
      tabsBox = el('div', { class: 'tabs' }, TASKS.map((t, i) => el('button', { class: 'tab', text: t.name, onclick: () => { taskIdx = i; reset(); setPlaying(true); } })));
      playBtn = el('button', { class: 'btn', onclick: () => { if (run.every((x) => x.solved || x.over)) reset(); setPlaying(!playing); } });
      speedBtn = el('button', { class: 'btn', text: '速度 ×1', onclick: () => { speed = speed >= 4 ? 1 : speed * 2; speedBtn.textContent = '速度 ×' + speed; } });
      seedNo = el('span', { class: 'rc-seed' });
      stepNo = el('span', { class: 'rc-step-no' });
      ruleText = el('p', { class: 'rc-rule' });
      summary = el('span', { class: 'rc-summary' });
      panelsBox = el('div', { class: 'rc-panels' });
      root.append(
        Lib.head('MODEL RACE', '同じ問題を5つのモデルが同時に解く', '正確さが高いモデルほど、少ない推論回数で正解にたどり着く（シミュレーション）'),
        el('div', { class: 'rc-top' }, tabsBox,
          el('div', { class: 'rc-ctrl' },
            playBtn, speedBtn,
            el('button', { class: 'btn', text: '↺ 最初から', onclick: () => { reset(); setPlaying(true); } }),
            el('button', { class: 'btn', text: '別の問題', onclick: () => { seed++; reset(); setPlaying(true); } }),
            seedNo)),
        el('div', { class: 'rc-meta' }, ruleText, el('div', { class: 'rc-step' }, '推論ステップ #', stepNo), summary),
        panelsBox);
      run = makeRun(TASKS[0], seed);
      n = 0;
      reset();
    },
    start(s) {
      sc = s;
      reset();
      setPlaying(true);
      loop(s);
    },
  });
})();
