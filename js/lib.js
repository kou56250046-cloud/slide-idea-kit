/* 共通部品: DOM 生成・乱数・アニメーションの後始末・数値の整形 */
(function () {
  'use strict';
  const SVGNS = 'http://www.w3.org/2000/svg';

  function apply(node, attrs) {
    if (!attrs) return node;
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') node.textContent = v;
      else if (k === 'style' && typeof v === 'object') {
        /* CSS 変数（--x）は代入では入らないので setProperty で入れる */
        for (const sk in v) {
          if (v[sk] == null) continue;
          if (sk.slice(0, 2) === '--') node.style.setProperty(sk, String(v[sk]));
          else node.style[sk] = v[sk];
        }
      }
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : String(v));
    }
    return node;
  }
  function append(node, children) {
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    }
    return node;
  }
  const el = (tag, attrs, ...ch) => append(apply(document.createElement(tag), attrs), ch);
  const svg = (tag, attrs, ...ch) => append(apply(document.createElementNS(SVGNS, tag), attrs), ch);
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

  /* シード付き乱数（mulberry32）。同じシードなら同じ列を返す */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    const f = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.int = (n) => Math.floor(f() * n);
    f.range = (a0, b0) => a0 + f() * (b0 - a0);
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(f() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    };
    return f;
  }

  /* スライド1回分の寿命。登録したタイマー・ループ・イベントを dispose でまとめて止める */
  function scope() {
    let alive = true;
    const timers = new Set();
    const frames = new Set();
    const offs = [];
    const s = {
      get alive() { return alive; },
      timeout(fn, ms) {
        const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms);
        timers.add(id);
        return id;
      },
      wait(ms) { return new Promise((res) => s.timeout(res, ms)); },
      /* fn(dt秒, now) を毎フレーム呼ぶ。false を返すと止まる */
      frame(fn) {
        const h = { id: 0 };
        let last = performance.now();
        const tick = (now) => {
          if (!alive) return;
          const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
          last = now;
          if (fn(dt, now) === false) { frames.delete(h); return; }
          h.id = requestAnimationFrame(tick);
        };
        h.id = requestAnimationFrame(tick);
        frames.add(h);
        return { stop() { cancelAnimationFrame(h.id); frames.delete(h); } };
      },
      /* ms かけて 0→1 を ease で回す */
      tween(ms, fn, ease) {
        const e = ease || easeOutCubic;
        return new Promise((res) => {
          let t = 0;
          s.frame((dt) => {
            t = Math.min(1, t + (dt * 1000) / ms);
            fn(e(t));
            if (t >= 1) { res(); return false; }
          });
        });
      },
      on(target, ev, fn, opt) {
        target.addEventListener(ev, fn, opt);
        offs.push(() => target.removeEventListener(ev, fn, opt));
      },
      dispose() {
        alive = false;
        timers.forEach(clearTimeout); timers.clear();
        frames.forEach((h) => cancelAnimationFrame(h.id)); frames.clear();
        offs.forEach((f) => f()); offs.length = 0;
      },
    };
    return s;
  }

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* 目盛り: 0 から max を含む「きりのいい」刻み */
  function ticks(max, count) {
    if (!(max > 0)) return { max: 1, step: 0.2, values: [0, 0.2, 0.4, 0.6, 0.8, 1] };
    const raw = max / (count || 5);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
    const top = Math.ceil(max / step) * step;
    const values = [];
    for (let v = 0; v <= top + step / 2; v += step) values.push(v);
    return { max: top, step, values };
  }

  const fmtInt = (v) => Math.round(v).toLocaleString('ja-JP');
  function fmtYen(v) {
    const a = Math.abs(v), sign = v < 0 ? '−' : '';
    if (a >= 1e8) return sign + (a / 1e8).toFixed(a >= 1e9 ? 1 : 2) + '億円';
    if (a >= 1e4) return sign + fmtInt(a / 1e4) + '万円';
    return sign + fmtInt(a) + '円';
  }

  /* スライド見出し */
  function head(kicker, title, lead) {
    return el('header', { class: 'slide-head' },
      el('div', { class: 'kicker', text: kicker }),
      el('h2', { text: title }),
      lead ? el('p', { class: 'lead', text: lead }) : null);
  }

  /* 高解像度キャンバス。座標は w×h のまま書ける */
  function canvas(w, h, cls) {
    const r = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const c = el('canvas', { width: w * r, height: h * r, class: cls || null, style: { width: w + 'px', height: h + 'px' } });
    const ctx = c.getContext('2d');
    ctx.scale(r, r);
    return { el: c, ctx, w, h };
  }

  /* ラベル付きスライダー */
  function slider(opt) {
    const out = el('output', { class: 'sl-val' });
    const input = el('input', { type: 'range', min: opt.min, max: opt.max, step: opt.step, value: opt.value });
    const show = () => { out.textContent = opt.format ? opt.format(+input.value) : input.value; };
    input.addEventListener('input', () => { show(); opt.onInput && opt.onInput(+input.value); });
    show();
    const wrap = el('label', { class: 'sl' }, el('span', { class: 'sl-name', text: opt.label }), out, input);
    return { el: wrap, input, get value() { return +input.value; }, set(v) { input.value = v; show(); } };
  }

  window.Lib = { el, svg, clear, rng, scope, easeOutCubic, easeInOutCubic, lerp, clamp, ticks, fmtInt, fmtYen, head, canvas, slider };
  window.Slides = {
    list: [],
    register(id, def) { def.id = id; this.list.push(def); },
  };
})();
