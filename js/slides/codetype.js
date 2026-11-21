/* コードが書かれていく: 段階ごとに数行ずつ打ち込み、説明している行を光らせる */
(function () {
  'use strict';
  const { el, clear } = Lib;

  const CODE = [
    '// 毎月積み立てたときの複利計算',
    'function simulate(initial, monthly, ratePct, years) {',
    '  let value = initial;',
    '  const history = [];',
    '  for (let m = 1; m <= years * 12; m++) {',
    '    value = value * (1 + ratePct / 100 / 12) + monthly;',
    '    if (m % 12 === 0) history.push(Math.round(value));',
    '  }',
    '  return history;',
    '}',
    '',
    'const result = simulate(1_000_000, 30_000, 5, 20);',
    'console.log(result.at(-1)); // → 15,043,650',
  ];
  /* to までの行を打ち、from〜to を光らせる */
  const STEPS = [
    { from: 0, to: 1, title: '入口', note: '初期額・毎月の額・年利・年数を受け取る関数を用意する。' },
    { from: 2, to: 3, title: '準備', note: '評価額を初期額で始め、年ごとの記録を入れる配列を作る。' },
    { from: 4, to: 7, title: '本体', note: '1か月ごとに月利をかけて積立額を足す。12か月ごとに記録する。' },
    { from: 8, to: 9, title: '戻り値', note: '年ごとの評価額の配列を返す。' },
    { from: 11, to: 12, title: '実行', note: '100万円から始め、毎月3万円を年利5%で20年。最終年は約1,504万円。' },
  ];
  const KW = /^(function|let|const|for|if|return)$/;

  /* 1行を色分けしたトークンに分ける */
  function tokenize(line) {
    const out = [];
    const re = /(\/\/.*$)|('[^']*')|(\b\d[\d_]*\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z_$\d])/g;
    let m;
    while ((m = re.exec(line))) {
      if (m[1]) out.push([m[1], 'c-com']);
      else if (m[2]) out.push([m[2], 'c-str']);
      else if (m[3]) out.push([m[3], 'c-num']);
      else if (m[4]) out.push([m[4], KW.test(m[4]) ? 'c-kw' : line[re.lastIndex] === '(' ? 'c-fn' : 'c-id']);
      else out.push([m[0], m[6] ? 'c-op' : '']);
    }
    return out;
  }

  let lines, noteBox, stepsBox;

  Slides.register('codetype', {
    title: 'コードが書かれていく',
    tech: '1行ずつ表示・注目行を強調',
    mount(root) {
      const pre = el('div', { class: 'ct-code' });
      lines = CODE.map((src, i) => {
        const text = el('span', { class: 'ct-text' });
        const row = el('div', { class: 'ct-line' }, el('span', { class: 'ct-no', text: String(i + 1) }), text);
        pre.appendChild(row);
        return { row, text, src };
      });
      noteBox = el('div', { class: 'ct-note' });
      stepsBox = el('ol', { class: 'ct-steps' }, STEPS.map((s) => el('li', { text: s.title })));
      root.append(
        Lib.head('LIVE CODING', 'コードが書かれていく様子を見せる', '段階ごとに数行ずつ打ち込み、いま説明している行だけを明るくする。クリックで次へ。'),
        el('div', { class: 'ct-layout' }, el('div', { class: 'ct-editor' }, el('div', { class: 'ct-tab', text: 'simulate.js' }), pre), el('div', { class: 'ct-side' }, stepsBox, noteBox)));
    },
    start(sc) {
      lines.forEach((l) => { clear(l.text); l.row.className = 'ct-line'; });
      clear(noteBox);
      [...stepsBox.children].forEach((li) => { li.className = ''; });
      let skip = false;
      sc.on(lines[0].row.parentNode.parentNode, 'click', () => { skip = true; });
      const wait = (ms) => new Promise((res) => {
        let t = 0;
        sc.frame((dt) => { t += dt * 1000; if (skip || t >= ms) { res(); return false; } });
      });

      (async () => {
        let typed = 0;
        for (let si = 0; si < STEPS.length; si++) {
          const st = STEPS[si];
          skip = false;
          lines.forEach((l, i) => { l.row.classList.toggle('dim', i < st.from); l.row.classList.remove('hl'); });
          [...stepsBox.children].forEach((li, i) => { li.className = i < si ? 'done' : i === si ? 'on' : ''; });
          for (; typed <= st.to; typed++) {
            const l = lines[typed];
            l.row.classList.add('shown');
            for (let c = 1; c <= l.src.length; c++) {
              if (!skip) await new Promise((res) => sc.timeout(res, 14));
              if (!sc.alive) return;
              if (skip) c = l.src.length;
              clear(l.text).append(...tokenize(l.src.slice(0, c)).map(([s, cls]) => el('span', { class: cls || null, text: s })));
            }
          }
          lines.forEach((l, i) => l.row.classList.toggle('hl', i >= st.from && i <= st.to));
          clear(noteBox).append(el('div', { class: 'ct-note-k', text: (si + 1) + '. ' + st.title }), el('p', { text: st.note }));
          noteBox.classList.remove('in'); void noteBox.offsetWidth; noteBox.classList.add('in');
          skip = false;
          await wait(3200);
          if (!sc.alive) return;
        }
        lines.forEach((l) => l.row.classList.remove('dim', 'hl'));
        [...stepsBox.children].forEach((li) => { li.className = 'done'; });
      })();
    },
  });
})();
