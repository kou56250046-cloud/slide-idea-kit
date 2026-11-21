/* クイズ形式: 選ぶと正解が開き、会場の予想（ダミー）の割合が伸びて、解説が出る */
(function () {
  'use strict';
  const { el, clear } = Lib;
  const QUESTIONS = [
    { q: '同じ誕生日の2人がいる確率が 50% を超えるのは、何人集まったとき？', choices: ['23人', '50人', '100人', '183人'], answer: 0, votes: [14, 31, 28, 27],
      note: '23人で約 50.7%。「2人の組」が 253 通りもあるため、直感よりずっと少ない人数で起きる。' },
    { q: '毎日 1% ずつ良くなると、1年（365日）後には何倍？', choices: ['約 1.4 倍', '約 3.7 倍', '約 12 倍', '約 37.8 倍'], answer: 3, votes: [22, 35, 26, 17],
      note: '1.01 の 365 乗 ≒ 37.8。逆に毎日 1% ずつ悪くなると 0.99 の 365 乗 ≒ 0.03 まで落ちる。' },
    { q: '1 から 100 までを全部足すと？', choices: ['4,950', '5,050', '5,100', '10,000'], answer: 1, votes: [24, 52, 15, 9],
      note: '1+100、2+99 … と組にすると 101 が 50 組。(1+100)×100÷2 = 5,050。' },
  ];
  const MARK = ['A', 'B', 'C', 'D'];

  let qNo, qText, list, note, nextBtn;

  function show(sc, i) {
    const Q = QUESTIONS[i];
    qNo.textContent = 'Q' + (i + 1) + ' / ' + QUESTIONS.length;
    qText.textContent = Q.q;
    clear(list); clear(note); note.classList.remove('in'); nextBtn.hidden = true;
    let answered = false;
    const rows = Q.choices.map((c, j) => {
      const fill = el('i', { class: 'qz-fill' });
      const pct = el('span', { class: 'qz-pct' });
      const btn = el('button', { class: 'qz-choice' }, el('b', { text: MARK[j] }), el('span', { class: 'qz-label', text: c }), el('div', { class: 'qz-bar' }, fill), pct);
      btn.addEventListener('click', () => reveal(j));
      list.appendChild(btn);
      return { btn, fill, pct };
    });
    function reveal(pick) {
      if (answered) return;
      answered = true;
      rows.forEach((r, j) => {
        r.btn.classList.add(j === Q.answer ? 'right' : j === pick ? 'wrong' : 'dim');
        r.btn.disabled = true;
      });
      sc.tween(1200, (e) => rows.forEach((r, j) => {
        r.fill.style.width = (Q.votes[j] * e) + '%';
        r.pct.textContent = Math.round(Q.votes[j] * e) + '%';
      }));
      sc.timeout(() => {
        note.append(el('div', { class: 'qz-note-k', text: (pick === Q.answer ? '正解！' : '正解は ' + MARK[Q.answer]) + '　会場の予想（ダミー）は右の割合' }), el('p', { text: Q.note }));
        note.classList.add('in');
        nextBtn.hidden = false;
        nextBtn.textContent = i + 1 < QUESTIONS.length ? '次の問題 →' : '最初の問題へ';
      }, 1300);
    }
    nextBtn.onclick = () => show(sc, (i + 1) % QUESTIONS.length);
  }

  Slides.register('quiz', {
    title: 'クイズで問いかける',
    tech: '選ぶと正解と割合が開く',
    mount(root) {
      qNo = el('div', { class: 'qz-no' });
      qText = el('div', { class: 'qz-q' });
      list = el('div', { class: 'qz-list' });
      note = el('div', { class: 'qz-note' });
      nextBtn = el('button', { class: 'btn qz-next', hidden: true });
      root.append(Lib.head('QUIZ', '聞く側に考えてもらってから、答えを見せる', '選んだ瞬間に正解と「会場の予想」の割合が開く。集計はせず、手元だけで動く。'),
        el('div', { class: 'qz-card' }, qNo, qText, list, el('div', { class: 'qz-foot' }, note, nextBtn)));
    },
    start(sc) { show(sc, 0); },
  });
})();
