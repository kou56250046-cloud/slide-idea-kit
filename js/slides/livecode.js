/* ライブコーディング: 左のコードを書き換えると、右のグラフがすぐに変わる */
(function () {
  'use strict';
  const { el, svg, clear, ticks } = Lib;
  const CW = 860, CH = 620;

  const PRESETS = [
    ['サイン波', '// 数の配列を return すると、右にグラフが出ます\nconst data = [];\nfor (let i = 0; i < 40; i++) {\n  data.push(Math.sin(i / 4) * 30 + 50);\n}\nreturn data;'],
    ['複利', '// 年利 r で 20 年運用（元本 100）\nconst r = 0.05;\nconst data = [];\nlet v = 100;\nfor (let y = 0; y <= 20; y++) {\n  data.push(v);\n  v = v * (1 + r);\n}\nreturn data;'],
    ['ランダムウォーク', '// 毎回ランダムに上下する\nconst data = [50];\nfor (let i = 1; i < 60; i++) {\n  const step = (Math.random() - 0.5) * 10;\n  data.push(Math.max(0, data[i - 1] + step));\n}\nreturn data;'],
    ['フィボナッチ', '// 前の2つを足していく\nconst data = [1, 1];\nwhile (data.length < 15) {\n  const n = data.length;\n  data.push(data[n - 1] + data[n - 2]);\n}\nreturn data;'],
  ];

  let ta, chart, status, presetBox;

  function draw(data) {
    clear(chart);
    const L = 90, R = 20, T = 20, B = 50, pw = CW - L - R, ph = CH - T - B;
    const t = ticks(Math.max(...data, 0), 5);
    const X = (i) => L + (data.length === 1 ? pw / 2 : i / (data.length - 1) * pw);
    const Y = (v) => T + ph - Math.max(0, v) / t.max * ph;
    for (const v of t.values) {
      chart.appendChild(svg('line', { x1: L, x2: L + pw, y1: Y(v), y2: Y(v), class: v === 0 ? 'axis0' : 'grid' }));
      chart.appendChild(svg('text', { x: L - 12, y: Y(v) + 7, class: 'tick', 'text-anchor': 'end', text: Lib.fmtInt(v) }));
    }
    const bw = Math.max(2, pw / data.length * 0.6);
    data.forEach((v, i) => chart.appendChild(svg('rect', { x: X(i) - bw / 2, y: Y(v), width: bw, height: Y(0) - Y(v), fill: 'rgba(110,168,255,.25)' })));
    chart.appendChild(svg('path', { d: data.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(''), fill: 'none', stroke: '#6ea8ff', 'stroke-width': 4, 'stroke-linejoin': 'round' }));
  }

  /* 打ったコードを関数として実行する。ここで動くのは発表者が手元で打った文字だけ */
  function run() {
    const t0 = performance.now();
    try {
      const out = new Function(ta.value)();
      if (!Array.isArray(out) || !out.length || out.some((v) => typeof v !== 'number' || !Number.isFinite(v))) throw new Error('数の配列を return してください');
      if (out.length > 2000) throw new Error('点が多すぎます（2000 まで）');
      draw(out);
      status.className = 'lc-status ok';
      status.textContent = '✓ ' + out.length + ' 点を描画（' + (performance.now() - t0).toFixed(1) + ' ms）';
    } catch (e) {
      status.className = 'lc-status err';
      status.textContent = '✗ ' + e.message + '（前のグラフを表示中）';
    }
  }

  function load(i) {
    ta.value = PRESETS[i][1];
    [...presetBox.children].forEach((b, j) => b.classList.toggle('on', j === i));
    run();
  }

  Slides.register('livecode', {
    title: 'ライブコーディング',
    tech: '書き換えると即時に再描画',
    mount(root) {
      ta = el('textarea', { class: 'lc-code', spellcheck: 'false' });
      chart = svg('svg', { viewBox: '0 0 ' + CW + ' ' + CH, class: 'lc-chart' });
      status = el('div', { class: 'lc-status' });
      presetBox = el('div', { class: 'tabs' }, PRESETS.map((p, i) => el('button', { class: 'tab', text: p[0], onclick: () => load(i) })));
      let timer = 0;
      ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 250); });
      ta.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        e.preventDefault();
        const s = ta.selectionStart;
        ta.setRangeText('  ', s, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
      });
      root.append(Lib.head('LIVE CODING', 'コードを書き換えると、その場でグラフが変わる', '数字を1つ変えるだけで結果が変わる様子を、聞き手の前で見せる。'),
        presetBox,
        el('div', { class: 'lc-layout' }, el('div', { class: 'lc-left' }, ta, status), chart));
      load(0);
    },
    start() { /* 書き換えた内容は残す。開き直しても最初に戻さない */ },
  });
})();
