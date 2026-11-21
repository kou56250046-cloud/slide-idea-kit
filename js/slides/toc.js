/* 目次: 登録済みのスライドを並べ、押すとそこへ飛ぶ */
(function () {
  'use strict';
  const { el, head } = Lib;

  Slides.register('toc', {
    title: '目次',
    mount(root) {
      const grid = el('ol', { class: 'toc-grid' });
      Slides.list.forEach((def, i) => {
        if (def.id === 'toc') return;
        grid.appendChild(el('li', {},
          el('button', { class: 'toc-item', onclick: () => Deck.go(i) },
            el('span', { class: 'toc-no', text: String(i + 1).padStart(2, '0') }),
            el('span', { class: 'toc-title', text: def.title }),
            def.tech ? el('span', { class: 'toc-tech', text: def.tech }) : null)));
      });
      root.append(head('INDEX', '目次', '押すとそのスライドへ移動します。数字を打って Enter でも移動できます。'), grid,
        el('a', { class: 'prompt-link', href: 'prompts.html', target: '_blank', text: 'それぞれを Gemini に作らせるプロンプト集を開く →' }));
    },
  });
})();
