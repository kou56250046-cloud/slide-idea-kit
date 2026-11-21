/* CSS 3D の構成図: 3つの層を重ね、ドラッグで回し、ボタンで層を離して見せる */
(function () {
  'use strict';
  const { el } = Lib;
  const LAYERS = [
    { name: 'データ層', color: '#fbbf24', items: ['売上DB', '顧客DB', '操作ログ'] },
    { name: 'API 層', color: '#4ade80', items: ['認証', '集計 API', '検索'] },
    { name: '画面層', color: '#6ea8ff', items: ['ダッシュボード', '入力フォーム', '通知'] },
  ];

  let scene, world, btn, open = false;

  Slides.register('cube3d', {
    title: 'CSS 3D で回る構成図',
    tech: 'transform-style: preserve-3d',
    mount(root) {
      world = el('div', { class: 'c3-world' }, LAYERS.map((L, i) => el('div', { class: 'c3-layer', style: { '--i': i, '--c': L.color } },
        el('div', { class: 'c3-name', text: L.name }),
        el('div', { class: 'c3-items' }, L.items.map((t) => el('div', { class: 'c3-chip', text: t }))))));
      scene = el('div', { class: 'c3-scene' }, world);
      btn = el('button', { class: 'btn', text: '層を離す', onclick: () => { open = !open; world.classList.toggle('open', open); btn.textContent = open ? '層を重ねる' : '層を離す'; } });
      root.append(Lib.head('CSS 3D', '構成図を立体にして、回しながら説明する', 'ドラッグで回転。ボタンで層の間を広げる。WebGL を使わず CSS だけで描いている。'),
        scene, el('div', { class: 'c3-ctrl' }, btn));
    },
    start(sc) {
      let rz = -30, rx = 58, drag = null, idle = 0;
      open = false; world.classList.remove('open'); btn.textContent = '層を離す';
      sc.timeout(() => { open = true; world.classList.add('open'); btn.textContent = '層を重ねる'; }, 1200);
      sc.on(scene, 'pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, rz, rx }; scene.setPointerCapture(e.pointerId); });
      sc.on(scene, 'pointermove', (e) => {
        if (!drag) return;
        rz = drag.rz + (e.clientX - drag.x) * 0.4;
        rx = Lib.clamp(drag.rx - (e.clientY - drag.y) * 0.3, 10, 85);
        idle = 0;
      });
      sc.on(scene, 'pointerup', () => { drag = null; });
      sc.frame((dt) => {
        idle += dt;
        if (!drag && idle > 1.5) rz += dt * 14; /* 触っていないときはゆっくり回る */
        world.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateZ(' + rz.toFixed(2) + 'deg)';
      });
    },
  });
})();
