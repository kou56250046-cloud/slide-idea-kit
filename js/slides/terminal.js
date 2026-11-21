/* ターミナル風の自己紹介: 台本 SCRIPT を順に「打って」出力を流す */
(function () {
  'use strict';
  const { el, clear } = Lib;

  const FACE = String.raw`
          .-""""""""-.
        .'            '.
       /   .--.  .--.   \
      :   ( () )( () )   :
      |    '--'  '--'    |
      :        /\        :
       \    \______/    /
        '.            .'
     _____'-.______.-'_____
    /  [ data ]  [ ship ]  \
`.split('\n').slice(1, -1);

  /* 台本: cmd を打ち、out を lineDelay ミリ秒ごとに1行ずつ出す。行は文字列か [文字列, クラス] */
  const SCRIPT = [
    { cmd: 'whoami', out: [['山田 太郎  (Taro Yamada)  ※ダミー', 't-hl'], ['データ分析 / 業務改善エンジニア', 't-dim']] },
    { cmd: 'cat career.log', lineDelay: 260, out: [
      [' 2014  ', 't-num', '情報工学科 卒業'],
      [' 2014  ', 't-num', 'SIer で業務システム開発  ', '', '(Java / SQL)', 't-dim'],
      [' 2019  ', 't-num', '事業会社へ。売上データの可視化を担当'],
      [' 2022  ', 't-num', '機械学習で需要予測  ', '', '→ 在庫 18% 削減', 't-ok'],
      [' 2025  ', 't-num', '生成 AI で議事録・報告書の自動化を推進'],
    ] },
    { cmd: './face.sh --ascii', lineDelay: 70, out: FACE.map((l) => [l, 't-face']) },
    { cmd: 'ls skills/', out: [['python/  ', 't-dir', 'sql/  ', 't-dir', 'javascript/  ', 't-dir', 'statistics/  ', 't-dir', 'facilitation/', 't-dir']] },
    { cmd: 'echo $MOTTO', out: [['"小さく作って、早く見せる"', 't-str']] },
  ];

  let body, scroller;

  function prompt(line) {
    line.append(el('span', { class: 't-arrow', text: '➜ ' }), el('span', { class: 't-path', text: '~ ' }));
  }

  /* 出力1行。[文字列, クラス, 文字列, クラス, ...] を色分けして並べる */
  function outLine(spec) {
    const row = el('div', { class: 't-line' });
    const parts = typeof spec === 'string' ? [spec] : spec;
    for (let i = 0; i < parts.length; i += 2) {
      row.appendChild(el('span', { class: parts[i + 1] || null, text: parts[i] }));
    }
    return row;
  }

  function scroll() { scroller.scrollTop = scroller.scrollHeight; }

  Slides.register('terminal', {
    title: 'ターミナル風の自己紹介',
    tech: '打鍵アニメーション',
    mount(root) {
      body = el('div', { class: 't-body' });
      scroller = el('div', { class: 't-scroll' }, body);
      const win = el('div', { class: 't-win' },
        el('div', { class: 't-bar' },
          el('i', { class: 'dot r' }), el('i', { class: 'dot y' }), el('i', { class: 'dot g' }),
          el('span', { class: 't-title', text: 'taro — -zsh — 120×32' })),
        scroller);
      root.append(win, el('p', { class: 'hint t-hint', text: 'クリックで最後まで飛ばす / 終わったらクリックでもう一度' }));
      root.classList.add('terminal');
    },
    start(sc) {
      let skip = false, finished = false;
      const wait = (ms) => (skip ? Promise.resolve() : sc.wait(ms));
      sc.on(scroller.parentNode, 'click', () => {
        if (finished) Deck.restart(); else skip = true;
      });

      (async () => {
        clear(body);
        body.appendChild(outLine(['Last login: Thu Nov 20 09:00:00 on ttys001', 't-dim']));
        await wait(600);
        for (const step of SCRIPT) {
          if (!sc.alive) return;
          const line = el('div', { class: 't-line' });
          prompt(line);
          const typed = el('span', { class: 't-cmd' });
          const cursor = el('span', { class: 't-cursor' });
          line.append(typed, cursor);
          body.appendChild(line);
          scroll();
          await wait(450);
          for (const ch of step.cmd) {
            typed.textContent += ch;
            /* 人が打つように速さを揺らす。空白の後は少し間を置く */
            await wait(45 + Math.random() * 90 + (ch === ' ' ? 120 : 0));
            if (!sc.alive) return;
          }
          await wait(280);
          cursor.remove();
          for (const o of step.out) {
            body.appendChild(outLine(o));
            scroll();
            await wait(step.lineDelay || 140);
            if (!sc.alive) return;
          }
          await wait(500);
        }
        const last = el('div', { class: 't-line' });
        prompt(last);
        last.appendChild(el('span', { class: 't-cursor' }));
        body.appendChild(last);
        scroll();
        finished = true;
      })();
    },
  });
})();
