/* デッキ本体: スライドの組み立て・ページ送り・拡大縮小 */
(function () {
  'use strict';
  const { el } = Lib;
  const W = 1920, H = 1080;
  const stage = document.getElementById('stage');
  const list = Slides.list;

  const sections = list.map((def) => {
    const sec = el('section', { class: 'slide ' + (def.cls || ''), 'data-id': def.id });
    stage.appendChild(sec);
    try { def.mount(sec); } catch (e) { console.error('[deck] mount 失敗: ' + def.id, e); }
    return sec;
  });

  const pageNo = el('span', { class: 'page-no' });
  const progress = el('div', { class: 'progress-fill' });
  const bar = el('nav', { class: 'deckbar' },
    el('button', { class: 'nav-btn', title: '前へ (←)', onclick: () => go(cur - 1), text: '‹' }),
    pageNo,
    el('button', { class: 'nav-btn', title: '次へ (→)', onclick: () => go(cur + 1), text: '›' }),
    el('div', { class: 'progress' }, progress));
  stage.appendChild(bar);

  let cur = -1;
  let sc = null;

  function go(i) {
    i = Math.max(0, Math.min(list.length - 1, i | 0));
    if (i === cur) return;
    if (sc) { sc.dispose(); sc = null; }
    if (cur >= 0) sections[cur].classList.remove('active');
    cur = i;
    sections[cur].classList.add('active');
    sc = Lib.scope();
    try { list[cur].start && list[cur].start(sc); } catch (e) { console.error('[deck] start 失敗: ' + list[cur].id, e); }
    pageNo.textContent = (cur + 1) + ' / ' + list.length;
    progress.style.width = ((cur + 1) / list.length * 100) + '%';
    if (location.hash !== '#' + (cur + 1)) {
      try { history.replaceState(null, '', '#' + (cur + 1)); } catch (e) { /* file:// で拒否されても動作に影響しない */ }
    }
  }
  /* 今のスライドを最初から再生し直す */
  function restart() { const i = cur; cur = -1; sections[i].classList.remove('active'); go(i); }

  function fromHash() {
    const n = parseInt(location.hash.slice(1), 10);
    return Number.isFinite(n) ? n - 1 : 0;
  }

  let numBuf = '';
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && tag !== 'BUTTON')) { e.preventDefault(); go(cur + 1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(cur - 1); }
    else if (k === 'Home') go(0);
    else if (k === 'End') go(list.length - 1);
    else if (k === 'f' || k === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    }
    else if (k === 'r' || k === 'R') restart();
    else if (/^[0-9]$/.test(k)) { numBuf += k; }
    else if (k === 'Enter' && numBuf) { go(parseInt(numBuf, 10) - 1); numBuf = ''; }
    else if (k === 'Escape') numBuf = '';
  });

  function fit() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    stage.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  }
  window.addEventListener('resize', fit);
  window.addEventListener('hashchange', () => go(fromHash()));
  fit();

  window.Deck = { go, restart, get index() { return cur; }, list };
  go(fromHash());
})();
