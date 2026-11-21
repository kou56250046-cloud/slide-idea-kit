/* 言葉が変形する文字演出: 乱れた文字を経て、左から順に次の言葉へ確定していく */
(function () {
  'use strict';
  const { el, clear } = Lib;
  const PAIRS = [['課題', '解決策'], ['データ', '意思決定'], ['属人化', '仕組み化'], ['手作業', '自動化'], ['点', '線'], ['報告', '提案']];
  const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ01#$%&*+=?<>ABCDEFXYZ▓▒░';
  const SCRAMBLE = 900, PER_CHAR = 140, HOLD = 1500;

  let word, sub, stepsBox;

  /* from から to へ。t 経過ミリ秒での各文字を返す。確定した文字は ok=true */
  function frameAt(from, to, t, seeds) {
    const n = Math.max(from.length, to.length), out = [];
    for (let i = 0; i < n; i++) {
      const done = t > SCRAMBLE + i * PER_CHAR + seeds[i] * 120;
      if (done) { if (i < to.length) out.push({ c: to[i], ok: true }); }
      else if (t < 150 && i < from.length) out.push({ c: from[i], ok: false, old: true });
      else out.push({ c: GLYPHS[Math.floor(Math.random() * GLYPHS.length)], ok: false });
    }
    return out;
  }

  function render(chars) {
    clear(word);
    for (const ch of chars) word.appendChild(el('span', { class: 'mt-ch' + (ch.ok ? ' ok' : ch.old ? ' old' : ' noise'), text: ch.c }));
  }

  Slides.register('morphtext', {
    title: '言葉が変形する文字演出',
    tech: '文字の乱れ→確定',
    mount(root) {
      word = el('div', { class: 'mt-word' });
      sub = el('div', { class: 'mt-sub' });
      stepsBox = el('div', { class: 'mt-steps' }, PAIRS.map(() => el('i')));
      root.append(Lib.head('KINETIC TYPE', '言葉そのものを、変化させて見せる', '「課題」が崩れて「解決策」に組み替わる。ビフォー・アフターを一語で伝える。クリックで次へ。'),
        el('div', { class: 'mt-stage' }, word, sub), stepsBox);
      root.classList.add('mt');
    },
    start(sc) {
      let k = 0, phase = 'show', t = 0, seeds = [];
      const pair = () => PAIRS[k % PAIRS.length];
      const mark = () => [...stepsBox.children].forEach((d, i) => d.classList.toggle('on', i === k % PAIRS.length));
      const begin = () => { phase = 'show'; t = 0; render([...pair()[0]].map((c) => ({ c, ok: false, old: true }))); sub.textContent = 'BEFORE'; mark(); };
      begin();
      sc.on(word.parentNode, 'click', () => { if (phase === 'show') t = HOLD; else if (phase === 'hold') t = HOLD; });
      sc.frame((dt) => {
        t += dt * 1000;
        const [a, b] = pair();
        if (phase === 'show' && t >= HOLD) {
          phase = 'morph'; t = 0;
          seeds = Array.from({ length: Math.max(a.length, b.length) }, () => Math.random());
          sub.textContent = '';
        } else if (phase === 'morph') {
          const f = frameAt(a, b, t, seeds);
          render(f);
          if (f.every((x) => x.ok) && f.length === b.length) { phase = 'hold'; t = 0; sub.textContent = 'AFTER'; }
        } else if (phase === 'hold' && t >= HOLD + 600) {
          k++; begin();
        }
      });
    },
  });
})();
