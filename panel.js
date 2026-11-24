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

  function setPoster(card, game, shape, width) {
    const poster = card.firstElementChild;
    if (!game.artwork || card.classList.contains('no-variants')) return;
    poster.sizes = Math.ceil(width) + 'px';
    if (card.dataset.shape === shape) return;
    card.dataset.shape = shape;
    const max = shape === 'wide' ? 910 : 512;
    const prefix = game.artwork + '/' + shape + '-';
    const sources = [prefix + '256.webp 256w'];
    if (shape === 'wide') sources.push(game.poster + ' 640w');
    sources.push(prefix + max + '.webp ' + max + 'w');
    poster.srcset = sources.join(', ');
  }

  function makeCard(game) {
    const card = document.createElement('a');
    card.className = 'card';
    card.href = game.url;
    card.setAttribute('aria-label', game.title);
    const poster = new Image();
    poster.alt = '';
    poster.onerror = () => {
      if (poster.hasAttribute('srcset')) {
        card.classList.add('no-variants');
        poster.removeAttribute('srcset');
        poster.src = game.poster;
      } else {
        card.classList.add('no-poster');
      }
    };
    if (!game.artwork) poster.src = game.poster;
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

  const shapes = [
    {name: 'wide', ratio: 16 / 9},
    {name: 'square', ratio: 1},
    {name: 'tall', ratio: 9 / 16}
  ];

  function measure(rows, gap) {
    const height = Math.max(1, (panel.clientHeight - gap * (rows.length - 1)) / rows.length);
    const slots = [];
    let score = 0;
    for (const columns of rows) {
      const width = Math.max(1, (panel.clientWidth - gap * (columns - 1)) / columns);
      const ratio = width / height;
      for (let i = 0; i < columns; i++) {
        const game = games[slots.length];
        const available = game.artwork ? shapes : [shapes[0]];
        let fit = 0;
        let shape;
        for (const art of available) {
          const retained = Math.min(ratio / art.ratio, art.ratio / ratio);
          if (retained > fit) {
            fit = retained;
            shape = art.name;
          }
        }
        score += fit;
        slots.push({width, shape, columns});
      }
    }
    return {rows, slots, score};
  }

  function fitPanel() {
    const count = games.length;
    if (!count) return;
    const grid = count <= 2 ? [count] : [2, count - 2];
    const candidates = layout === 'grid' ? [grid] : layout === 'strip'
      ? [[count]] : [grid, [count], Array(count).fill(1)];
    const gap = parseFloat(getComputedStyle(panel).gap) || 0;
    const best = candidates.map(rows => measure(rows, gap))
      .reduce((a, b) => b.score > a.score ? b : a);
    const tracks = Math.max(...best.rows);
    panel.style.gridTemplateColumns = 'repeat(' + tracks + ', minmax(0, 1fr))';
    panel.style.gridTemplateRows = 'repeat(' + best.rows.length + ', minmax(0, 1fr))';
    best.slots.forEach((slot, index) => {
      const card = panel.children[index];
      card.style.gridColumn = 'span ' + (tracks / slot.columns);
      setPoster(card, games[index], slot.shape, slot.width);
    });
  }

  function render() {
    const signature = JSON.stringify(games);
    if (signature !== rendered) {
      rendered = signature;
      stopPreview();
      panel.replaceChildren(...games.map(makeCard));
    }
    fitPanel();
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

  if ('ResizeObserver' in window) {
    new ResizeObserver(fitPanel).observe(panel);
  } else {
    window.addEventListener('resize', fitPanel);
  }
  window.addEventListener('pagehide', stopPreview);
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stopPreview(); });
  document.addEventListener('visibilitychange', () => document.hidden ? stopPreview() : refresh());
  refresh();
  setInterval(refresh, 60000);
})();
