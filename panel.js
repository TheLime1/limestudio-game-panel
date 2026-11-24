(() => {
  'use strict';
  const panel = document.getElementById('games');
  const status = document.getElementById('status');
  const query = new URLSearchParams(location.search);
  const layout = query.get('layout');
  const excluded = query.get('exclude');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const ranks = new Map();
  let games = [];
  let rendered = '';
  let activeVideo;
  let loading = false;
  let keyboardInput = false;
  document.addEventListener('keydown', () => { keyboardInput = true; });
  document.addEventListener('pointerdown', () => { keyboardInput = false; }, true);

  function stopPreview() {
    if (!activeVideo) return;
    const video = activeVideo;
    activeVideo = null;
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
  }

  function startPreview(card, game) {
    if (activeVideo && activeVideo.parentNode === card) return;
    stopPreview();
    if (!game.video || reducedMotion.matches || document.hidden) return;
    const video = document.createElement('video');
    activeVideo = video;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('aria-hidden', 'true');
    video.addEventListener('playing', () => video.classList.add('ready'), {once: true});
    const restorePoster = () => { if (activeVideo === video) stopPreview(); };
    card.insertBefore(video, card.lastChild);
    const fallback = game.video.replace('media/', 'media/vp8/');
    let usingFallback = !video.canPlayType('video/webm; codecs="av01.0.05M.08"');
    function play() {
      video.src = usingFallback ? fallback : game.video;
      video.play().catch(() => {
        if (activeVideo !== video) return;
        if (usingFallback) return restorePoster();
        usingFallback = true;
        play();
      });
    }
    play();
  }

  function makeCard(game) {
    const card = document.createElement('a');
    card.className = 'card';
    card.href = game.url;
    card.setAttribute('aria-label', game.title);
    const poster = new Image();
    poster.alt = '';
    poster.onerror = () => card.classList.add('no-poster');
    poster.src = game.poster;
    const caption = document.createElement('span');
    caption.className = 'caption';
    caption.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.textContent = game.title;
    const arrow = document.createElement('span');
    arrow.textContent = '→';
    caption.append(name, arrow);
    card.append(poster, caption);
    card.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') startPreview(card, game); });
    card.addEventListener('focus', () => { if (matchMedia('(hover: hover)').matches || keyboardInput) startPreview(card, game); });
    const leave = () => { if (activeVideo && activeVideo.parentNode === card) stopPreview(); };
    card.addEventListener('pointerleave', leave);
    card.addEventListener('blur', leave);
    return card;
  }

  function chooseRows(count) {
    if (layout === 'strip') return [count];
    const grid = count <= 2 ? [count] : [2, count - 2];
    if (layout === 'grid') return grid;
    const candidates = [[count], grid, Array(count).fill(1)];
    const gap = parseFloat(getComputedStyle(panel).gap) || 0;
    // Pick the packing that crops the least 16:9 artwork across all cards.
    const score = rows => {
      const height = Math.max(1, (panel.clientHeight - gap * (rows.length - 1)) / rows.length);
      return rows.reduce((total, cols) => {
        const width = Math.max(1, (panel.clientWidth - gap * (cols - 1)) / cols);
        const ratio = (width / height) / (16 / 9);
        return total + cols * Math.min(ratio, 1 / ratio);
      }, 0);
    };
    return candidates.reduce((best, rows) => score(rows) > score(best) ? rows : best);
  }

  function render() {
    if (!games.length) {
      stopPreview();
      panel.replaceChildren();
      rendered = '';
      return;
    }
    const rows = chooseRows(games.length);
    const signature = JSON.stringify([games, rows]);
    if (signature === rendered) return;
    rendered = signature;
    stopPreview();
    const fragment = document.createDocumentFragment();
    let index = 0;
    for (const columns of rows) {
      const row = document.createElement('div');
      row.className = 'row';
      for (let col = 0; col < columns; col++) row.append(makeCard(games[index++]));
      fragment.append(row);
    }
    panel.replaceChildren(fragment);
  }

  async function refresh() {
    if (loading || document.hidden) return;
    loading = true;
    try {
      const response = await fetch('./games.json', {cache: 'no-store'});
      if (!response.ok) throw Error('Catalog unavailable');
      const data = await response.json();
      const byId = new Map(data.games.map(game => [game.id, game]));
      const pool = [...new Set(data.playlist)].filter(id => byId.has(id) && id !== excluded);
      // Four or fewer preserve the editor's order. Larger pools rotate on each open.
      if (pool.length > 4) {
        for (const id of pool) if (!ranks.has(id)) ranks.set(id, Math.random());
        pool.sort((a, b) => ranks.get(a) - ranks.get(b));
      }
      games = pool.slice(0, 4).map(id => byId.get(id));
      status.textContent = games.length ? '' : 'No games featured right now.';
      status.hidden = Boolean(games.length);
      render();
    } catch {
      if (!games.length) {
        status.hidden = false;
        const link = document.createElement('a');
        link.href = 'https://sbox.game/limestudio/~packages?type=game';
        link.textContent = 'Browse LimeStudio games';
        status.replaceChildren(link);
      }
    } finally { loading = false; }
  }

  window.addEventListener('resize', render);
  window.addEventListener('pagehide', stopPreview);
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stopPreview(); });
  document.addEventListener('visibilitychange', () => document.hidden ? stopPreview() : refresh());
  refresh();
  setInterval(refresh, 60000);
})();
