/* =====================================================================
   Lumen Architettura — motore comune: dati, API, tavolozze, router,
   intestazione e piè di pagina, comparse allo scorrimento, parallasse,
   visore foto, pulsante "Colori".
   ===================================================================== */
'use strict';

const ARCH = (() => {
  const boot = window.__BOOT__;
  const startedAt = performance.now();
  const SPLASH_MS = 1900;

  // ------------------------------------------------------------ tavolozze
  const THEMES = [
    { id: 'carta', name: 'Carta', dark: false, paper: '#F3F1EC', concrete: '#E6E2D9', surface: '#FBFAF7', ink: '#1F1F1D', muted: '#6B675F',
      accent: '#A9573A', accentDeep: '#93492F', onAccent: '#FFFFFF', night: '#1C1C1B', mutedDark: '#B9B4AA' },
    { id: 'calce', name: 'Calce', dark: false, paper: '#F6F6F4', concrete: '#EAEAE6', surface: '#FFFFFF', ink: '#1E2328', muted: '#676D73',
      accent: '#2F5266', accentDeep: '#2F5266', onAccent: '#FFFFFF', night: '#1A1F24', mutedDark: '#B2B8BE' },
    { id: 'salvia', name: 'Salvia', dark: false, paper: '#EDEFE8', concrete: '#E0E4D8', surface: '#F8F9F4', ink: '#28332B', muted: '#626D65',
      accent: '#7B6236', accentDeep: '#6C552D', onAccent: '#FFFFFF', night: '#202B23', mutedDark: '#B1BBB3' },
    { id: 'grafite', name: 'Grafite', dark: true, paper: '#1D1E20', concrete: '#25272A', surface: '#2C2E32', ink: '#EDEBE6', muted: '#A9A6A0',
      accent: '#D2A26E', accentDeep: '#DCB07F', onAccent: '#1D1E20', night: '#121314', mutedDark: '#A9A6A0' },
    { id: 'cotto', name: 'Cotto', dark: true, paper: '#2B211C', concrete: '#342822', surface: '#3C2F28', ink: '#F2E8DC', muted: '#BFAE9F',
      accent: '#E3896B', accentDeep: '#EA9A7E', onAccent: '#2B1A14', night: '#1B1411', mutedDark: '#BFAE9F' },
    { id: 'notte', name: 'Notte', dark: true, paper: '#141A22', concrete: '#1B232D', surface: '#222B36', ink: '#E9ECEF', muted: '#A2AAB3',
      accent: '#E0B47C', accentDeep: '#E6C08E', onAccent: '#141A22', night: '#0C1015', mutedDark: '#A2AAB3' },
  ];
  const themeById = (id) => THEMES.find((t) => t.id === id);
  let visitorTheme = null;
  let trialUnlocked = false;

  const look = () => boot.look || { defaultTheme: 'carta', hidden: [], switcher: 'tutti' };
  const defaultTheme = () => themeById(look().defaultTheme) || THEMES[0];
  const currentTheme = () => themeById(visitorTheme) || defaultTheme();
  const offeredThemes = () => THEMES.filter((t) => !(look().hidden || []).includes(t.id) || t.id === defaultTheme().id);
  const switcherVisible = () => look().switcher === 'tutti' || (look().switcher === 'link' && trialUnlocked);

  function applyTheme(fade) {
    const t = currentTheme();
    const r = document.documentElement;
    if (fade) {
      r.classList.add('theme-fade');
      clearTimeout(applyTheme.timer);
      applyTheme.timer = setTimeout(() => r.classList.remove('theme-fade'), 700);
    }
    const vars = { paper: t.paper, concrete: t.concrete, surface: t.surface, ink: t.ink, muted: t.muted, accent: t.accent,
      'accent-deep': t.accentDeep, 'on-accent': t.onAccent, night: t.night, 'muted-dark': t.mutedDark };
    for (const [k, v] of Object.entries(vars)) r.style.setProperty('--' + k, v);
    r.style.colorScheme = t.dark ? 'dark' : 'light';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', t.paper);
  }

  function selectTheme(id) {
    if (!themeById(id) || id === currentTheme().id) return;
    visitorTheme = id;
    applyTheme(true);
    renderSwitcher();
  }

  /** ?prova=1 sblocca il pulsante dei colori, ?tema=grafite apre il sito con quella tavolozza. */
  function applyLinkParams(q) {
    if (q.get('prova') === '1') trialUnlocked = true;
    const t = q.get('tema');
    if (t && themeById(t)) visitorTheme = t;
  }

  // ------------------------------------------------------------ utilità
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ms = (name, cls = '') => `<span class="ms ${cls}" aria-hidden="true">${name}</span>`;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const pad2 = (n) => String(n).padStart(2, '0');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const phoneDigits = (p) => String(p || '').replace(/[^0-9+]/g, '');
  const mapsUrl = (a) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a);
  const isPhone = () => innerWidth < 600;
  const screenH = () => Math.max(innerHeight, innerWidth < 600 ? 560 : 620);
  const untilSplashEnds = () => Math.max(0, SPLASH_MS - (performance.now() - startedAt));

  /** Testo su più righe: ogni a capo diventa una riga. */
  const lines = (s) => String(s || '').split('\n');

  const fmtDate = (iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('it-IT', opts);
  };

  // ------------------------------------------------------------ API
  async function api(action, body, opts = {}) {
    const init = { method: body === undefined ? 'GET' : 'POST', headers: { 'X-CSRF': boot.csrf }, credentials: 'same-origin' };
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch('api.php?a=' + encodeURIComponent(action) + (opts.query || ''), init);
    } catch {
      throw new Error('Connessione non riuscita: controlla la rete e riprova.');
    }
    let data = {};
    try { data = await res.json(); } catch { /* risposta non JSON */ }
    if (data.csrf) boot.csrf = data.csrf;
    if (!res.ok) {
      const e = new Error(data.errore || 'Qualcosa non ha funzionato. Riprova.');
      e.status = res.status;
      throw e;
    }
    return data;
  }

  // ------------------------------------------------------------ foto
  const STEPS = [480, 800, 1200, 1600, 2000, 2600];
  function srcset(url) {
    if (!/images\.unsplash\.com/.test(url)) return '';
    const set = STEPS.map((w) => `${url.replace(/([?&])w=\d+/, '$1w=' + w)}${/[?&]w=/.test(url) ? '' : (url.includes('?') ? '&' : '?') + 'w=' + w} ${w}w`);
    return ` srcset="${esc(set.join(', '))}" sizes="(max-width: 600px) 100vw, 60vw"`;
  }
  /** Foto con dissolvenza all'arrivo (o un segnaposto se manca). */
  function ph(url, { dark = false, cls = '', alt = '', eager = false, attrs = '' } = {}) {
    const u = String(url || '').trim();
    const inner = u
      ? `<img src="${esc(u)}"${srcset(u)} alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
      : `<span class="ph-x">${ms('architecture')}</span>`;
    return `<div class="ph ${dark ? 'dark' : ''} ${cls}" ${attrs}>${inner}</div>`;
  }
  // Le foto si mostrano quando arrivano; se non si caricano, segnaposto.
  document.addEventListener('load', (e) => { if (e.target.tagName === 'IMG') e.target.classList.add('ok'); }, true);
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.parentElement?.classList.contains('ph')) img.outerHTML = `<span class="ph-x">${ms('architecture')}</span>`;
  }, true);

  // ------------------------------------------------------------ titoli e comparse
  /** Titolo che sale riga per riga; l'ultima riga in corsivo colorato. */
  function rt(text, { cls = '', accentLast = true, delay = 0, tag = 'h2', accentColor = '' } = {}) {
    const ls = lines(text);
    const style = accentColor ? ` style="--rt-accent:${accentColor}"` : '';
    return `<${tag} class="rt serif ${cls}" data-delay="${delay}" aria-label="${esc(ls.join(' '))}"${style}>${ls
      .map((l, i) => `<span class="rt-line${accentLast && i === ls.length - 1 && ls.length > 1 ? ' acc' : ''}" aria-hidden="true"><span style="transition-delay:${Math.min(i * 0.12, 0.5)}s">${esc(l)}</span></span>`)
      .join('')}</${tag}>`;
  }
  const reveal = (html, delay = 0, extra = '') => `<div data-reveal data-delay="${delay}" ${extra}>${html}</div>`;

  let observer = null;
  function watchReveals(root) {
    observer ??= new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        observer.unobserve(e.target);
        const el = e.target;
        const wait = untilSplashEnds() + (+el.dataset.delay || 0);
        setTimeout(() => show(el), wait);
      }
    }, { threshold: 0.05 });
    $$('[data-reveal], .rt, [data-count], .pbar', root).forEach((el) => observer.observe(el));
  }
  function show(el) {
    el.classList.add('in');
    if (el.dataset.count !== undefined) countUp(el);
    if (el.classList.contains('pbar')) {
      const fi = $('.fi', el);
      if (fi) fi.style.width = el.dataset.value + '%';
      const pct = $('.pct', el);
      if (pct) countUp(pct, el.dataset.value + '%', 1600);
    }
  }
  /** Numero che "conta" fino al valore (es. "420+" → 0…420 con il "+" fisso). */
  function countUp(el, value = el.dataset.count, dur = 2200) {
    const m = /^(\D*)(\d[\d.]*)(.*)$/.exec(String(value).trim());
    if (!m) { el.textContent = value; return; }
    const [, pre, digits, suf] = m;
    const target = parseInt(digits.replace(/\./g, ''), 10) || 0;
    const dots = digits.includes('.');
    const fmt = (n) => (dots ? n.toLocaleString('it-IT') : String(n));
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const k = 1 - Math.pow(1 - t, 3);
      el.textContent = pre + fmt(Math.round(target * k)) + suf;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------ parallasse
  function updateParallax() {
    const vh = innerHeight;
    for (const el of $$('.parallax')) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) continue;
      const child = el.firstElementChild;
      const extent = +el.dataset.extent || 0.22;
      child.style.height = `${100 * (1 + extent)}%`;
      const t = clamp((r.top + r.height / 2) / Math.max(vh, 1), 0, 1);
      const dy = -(r.height * extent) * (1 - t);
      child.style.transform = `translate3d(0, ${dy.toFixed(1)}px, 0)`;
    }
  }
  /** Foto che scorre più lentamente della pagina. */
  const parallax = (url, { extent = 0.22, dark = false, cls = '' } = {}) =>
    `<div class="parallax ${cls}" data-extent="${extent}">${ph(url, { dark })}</div>`;

  // ------------------------------------------------------------ messaggi
  function toast(msg, err = false) {
    $('.toast')?.remove();
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), err ? 6000 : 3000);
  }

  // ------------------------------------------------------------ visore foto
  function lightbox(photos, index) {
    let i = index;
    const el = document.createElement('div');
    el.className = 'lightbox';
    el.setAttribute('role', 'dialog');
    el.innerHTML = `<div class="top"><span class="cnt"></span><button class="icon-b x" aria-label="Chiudi">${ms('close')}</button></div>
      <div class="mid"><button class="nav-b p" aria-label="Precedente">${ms('arrow_back')}</button><div class="stage"></div>
      <button class="nav-b n" aria-label="Successiva">${ms('arrow_forward')}</button></div><div class="cap"></div>`;
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => el.classList.add('on'));
    const stage = $('.stage', el);
    const draw = (dir = 0) => {
      const old = $('img', stage);
      const img = document.createElement('img');
      img.src = photos[i].url;
      img.alt = photos[i].caption || '';
      img.style.opacity = '0';
      img.style.transform = `translateX(${dir * 40}px)`;
      stage.appendChild(img);
      requestAnimationFrame(() => { img.style.opacity = '1'; img.style.transform = 'none'; });
      if (old) { old.style.opacity = '0'; old.style.transform = `translateX(${-dir * 40}px)`; setTimeout(() => old.remove(), 450); }
      $('.cnt', el).textContent = `${pad2(i + 1)} / ${pad2(photos.length)}`;
      $('.cap', el).textContent = photos[i].caption || '';
      $('.p', el).disabled = i === 0;
      $('.n', el).disabled = i === photos.length - 1;
    };
    const go = (d) => { const n = clamp(i + d, 0, photos.length - 1); if (n !== i) { i = n; draw(d); } };
    const close = () => {
      el.classList.remove('on');
      document.body.style.overflow = '';
      removeEventListener('keydown', key);
      setTimeout(() => el.remove(), 300);
    };
    const key = (e) => { if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'Escape') close(); };
    addEventListener('keydown', key);
    $('.x', el).onclick = close;
    $('.p', el).onclick = () => go(-1);
    $('.n', el).onclick = () => go(1);
    let x0 = null;
    stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    stage.addEventListener('pointerup', (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 40) go(e.clientX < x0 ? 1 : -1); x0 = null; });
    draw();
  }

  // ------------------------------------------------------------ logo
  /** Il simbolo: due archi uno dentro l'altro su una linea di terra. */
  function logoMark(size = '2.5rem') {
    return `<svg viewBox="0 0 100 100" style="width:${size};height:${size}" aria-hidden="true"><rect width="100" height="100" rx="22" style="fill:var(--accent)"/>
      <path d="M22 76H78M29 76V50a21 21 0 0 1 42 0v26M42 76V61a8 8 0 0 1 16 0v15" fill="none" style="stroke:var(--on-accent)" stroke-width="6.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }
  /** Simbolo + nome breve + resto della ragione sociale (o il logo caricato). */
  function logo({ height = '2.5rem', light = false } = {}) {
    const c = boot.content;
    if ((c.logo || '').trim()) return `<span class="logo" style="--lh:${height}"><img src="${esc(c.logo)}" alt="${esc(c.companyName)}"></span>`;
    const rest = String(c.companyName || '').replace(c.shortName || '', '').trim();
    return `<span class="logo ${light ? 'light' : ''}" style="--lh:${height}" aria-label="${esc(c.companyName)}">${logoMark(height)}
      <span><span class="ln">${esc(c.shortName)}</span>${rest ? `<span class="ls">${esc(rest)}</span>` : ''}</span></span>`;
  }

  // ------------------------------------------------------------ struttura delle pagine
  const NAV = [['Home', '/'], ['Progetti', '/progetti'], ['Servizi', '/servizi'], ['Studio', '/studio'], ['Contatti', '/contatti']];
  const isActive = (path, cur) => (path === '/' ? cur === '/' : cur.startsWith(path));
  let scaffold = { current: '/', overHero: false };
  let menuOpen = false;
  let swOpen = false;
  let lastY = 0;
  let headerHidden = false;

  function headerHtml() {
    const c = scaffold.current;
    const logged = !!boot.client;
    // Tre colonne: logo, voci numerate al centro, area clienti e menu a destra.
    return `<div class="h-l"><a href="./" aria-label="Home">${logo({ height: 'clamp(2rem, calc(2rem + (100vw - 22.5rem) * .0048), 2.375rem)' })}</a></div>
      <nav class="nav">${NAV.map(([l, p], i) => `<a class="hl ${isActive(p, c) ? 'active' : ''}" href="${link(p)}"><span><small>${pad2(i + 1)}</small>${l}</span></a>`).join('')}</nav>
      <div class="h-r"><a class="client-pill ${c.startsWith('/area-clienti') ? 'active' : ''}" href="area-clienti">${ms(logged ? 'person' : 'person_outline')}Area clienti</a>
      <button class="burger ${menuOpen ? 'open' : ''}" aria-label="${menuOpen ? 'Chiudi menu' : 'Apri menu'}"><i></i><i></i></button></div>`;
  }

  function updateHeader() {
    const h = $('#hdr');
    if (!h) return;
    const y = scrollY;
    const transparent = scaffold.overHero && y <= 40 && !menuOpen;
    h.classList.toggle('clear', transparent);
    h.classList.toggle('menu-open', menuOpen);
    $$('.logo', h).forEach((l) => l.classList.toggle('light', transparent));
    // Nascosta mentre si scende, ricompare appena si risale.
    if (y > 400 && y > lastY + 2) headerHidden = true;
    else if (y < lastY - 2 || y <= 400) headerHidden = false;
    h.classList.toggle('hidden', headerHidden && !menuOpen);
    lastY = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    const bar = $('#ptop');
    if (bar) bar.style.width = (max > 0 ? clamp(y / max, 0, 1) * 100 : 0) + '%';
  }

  function toggleMenu(open = !menuOpen) {
    menuOpen = open;
    $('#mmenu')?.remove();
    const h = $('#hdr');
    if (h) h.innerHTML = headerHtml();
    if (open) {
      const k = boot.content.contacts || {};
      const items = [...NAV, ['Area clienti', '/area-clienti']];
      const m = document.createElement('div');
      m.id = 'mmenu';
      m.className = 'mmenu';
      m.innerHTML = items.map(([l, p], i) => `<a class="big ${isActive(p, scaffold.current) ? 'cur' : ''}" href="${link(p)}" style="animation-delay:${i * 0.07}s"><small>${pad2(i + 1)}</small>${l}</a>`).join('')
        + '<div class="sep"></div>'
        + (k.phone ? `<a class="mc" href="tel:${phoneDigits(k.phone)}">${ms('call')}${esc(k.phone)}</a>` : '')
        + (k.email ? `<a class="mc" href="mailto:${esc(k.email)}">${ms('mail')}${esc(k.email)}</a>` : '')
        + (k.address ? `<a class="mc" href="${mapsUrl(k.address)}" target="_blank" rel="noopener">${ms('place')}${esc(k.address)}</a>` : '');
      m.addEventListener('click', (e) => { if (e.target.closest('a')) toggleMenu(false); });
      document.body.appendChild(m);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    renderSwitcher();
    updateHeader();
  }

  function footerHtml() {
    const c = boot.content;
    const k = c.contacts || {};
    const fl = (l, href, ext) => `<a class="hl" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}><span>${esc(l)}</span></a><br>`;
    // Invito a scrivere in alto, il nome dello studio a tutta larghezza, poi le colonne.
    // Ai clienti già collegati non serve l'invito al primo incontro.
    const cta = scaffold.current.startsWith('/area-clienti') ? '' : `<div class="f-cta"><p class="serif">Hai uno spazio<br><em>da immaginare?</em></p>
        <a class="btn light big" href="contatti">Prenota un primo incontro${ms('arrow_outward')}</a></div>`;
    return `<footer class="footer"><div class="wrap">${cta}
      <div class="f-word serif" aria-hidden="true">${esc(c.shortName || c.companyName)}</div>
      <div class="cols">
      <div>${logo({ height: '2.25rem', light: true })}<p>${esc(c.footerText)}</p></div>
      <div><div class="ft">Pagine</div>${[...NAV, ['Area clienti', '/area-clienti']].map(([l, p]) => fl(l, link(p))).join('')}</div>
      <div><div class="ft">Studio</div>
        ${k.address ? fl(k.address, mapsUrl(k.address), true) : ''}${k.phone ? fl(k.phone, 'tel:' + phoneDigits(k.phone)) : ''}
        ${k.email ? fl(k.email, 'mailto:' + k.email) : ''}${k.hours ? `<span class="fh">${esc(k.hours)}</span>` : ''}</div>
      <div><div class="ft">Seguici</div>
        ${[['Instagram', k.instagram], ['Facebook', k.facebook], ['LinkedIn', k.linkedin]].filter(([, u]) => u).map(([l, u]) => fl(l, u, true)).join('')}</div>
      </div>
      <div class="bottom"><span>© ${new Date().getFullYear()} ${esc(c.companyName)}${k.vat ? ' · ' + esc(k.vat) : ''}</span>
        <span class="legal"><a class="hl" href="privacy"><span>Privacy</span></a><a class="hl" href="cookie"><span>Cookie</span></a>
        <a class="hl" href="admin"><span>Area riservata</span></a></span></div></div></footer>`;
  }

  // ------------------------------------------------------------ pulsante Colori
  function swatch(t, on = false) {
    return `<span class="swatch ${on ? 'on' : ''}"><i style="background:${t.paper}"></i>
      <i style="background:${t.accent};clip-path:polygon(100% 0,100% 100%,0 100%)"></i><b style="background:${t.ink}"></b></span>`;
  }
  function renderSwitcher() {
    $('#switcher')?.remove();
    if (!scaffold.site || menuOpen || !switcherVisible()) return;
    const cur = currentTheme();
    const el = document.createElement('div');
    el.id = 'switcher';
    el.className = 'switcher';
    el.innerHTML = (swOpen
      ? `<div class="sw-panel"><div class="tt">Colori del sito</div>${offeredThemes()
        .map((t) => `<div class="sw-row ${t.id === cur.id ? 'on' : ''}" data-t="${t.id}" role="button" aria-label="Colori ${esc(t.name)}">
          ${swatch(t, t.id === cur.id)}<span><span class="n">${esc(t.name)}</span><br><span class="k">${t.dark ? 'Scuro' : 'Chiaro'}</span></span>
          ${t.id === cur.id ? ms('check') : ''}</div>`).join('')}</div>`
      : '')
      + `<button class="sw-btn ${swOpen ? '' : 'closed'}" aria-label="${swOpen ? 'Chiudi colori' : 'Cambia colori'}">${swatch(cur)}${ms(swOpen ? 'close' : 'palette')}<span class="lbl">${swOpen ? 'Chiudi' : 'Colori'}</span></button>`;
    el.addEventListener('click', (e) => {
      const row = e.target.closest('[data-t]');
      if (row) return selectTheme(row.dataset.t);
      if (e.target.closest('.sw-btn')) { swOpen = !swOpen; renderSwitcher(); }
    });
    document.body.appendChild(el);
  }

  // ------------------------------------------------------------ router
  // Indirizzi veri (/progetti/villa-le-querce): il sito può stare anche in una
  // sottocartella, indicata da <base href> (es. /Lumen-Architettura/ su GitHub Pages).
  const BASE = new URL(document.baseURI).pathname;
  const routes = [];
  let cleanups = [];
  const onCleanup = (fn) => cleanups.push(fn);
  const route = (pattern, handler) => routes.push({ re: new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$'), handler });

  /** Indirizzo relativo di una pagina del sito: '/' → './', '/progetti' → 'progetti'. */
  const link = (path) => (path === '/' ? './' : path.replace(/^\//, ''));
  /** "Casa Bianca sul mare" → "casa-bianca-sul-mare" (uguale a slug() in inc/funzioni.php). */
  const slug = (s) => String(s || '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'progetto';
  /** Indirizzo di un progetto; con l'id in coda se due titoli coincidono. */
  function projectSlug(p, list = boot.projects) {
    const seen = new Set();
    for (const x of list) {
      let s = slug(x.title);
      if (seen.has(s)) s += '-' + x.id;
      seen.add(s);
      if (x.id === p.id) return s;
    }
    return p.id;
  }
  const projectLink = (p) => 'progetti/' + projectSlug(p);

  function parsePath() {
    const path = '/' + decodeURI(location.pathname.slice(BASE.length)).replace(/\/+$/, '');
    return { path, query: new URLSearchParams(location.search) };
  }

  /** Va a una pagina del sito senza ricaricare: go('admin/cantieri?id=…'). */
  function go(path, { replace = false } = {}) {
    const url = BASE + link(path.startsWith('/') ? path : '/' + path).replace(/^\.\//, '');
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
    render();
  }

  async function render() {
    const { path, query } = parsePath();
    applyLinkParams(query);
    cleanups.forEach((f) => { try { f(); } catch { /* niente */ } });
    cleanups = [];
    for (const r of routes) {
      const m = r.re.exec(path);
      if (m) return r.handler(m.slice(1), query, path);
    }
    go('/', { replace: true });
  }

  // I link interni cambiano pagina senza ricaricare; file, api.php e link esterni restano normali.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download')) return;
    const url = new URL(a.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(BASE)) return;
    if (/\.\w{2,5}$/.test(url.pathname) || /\/(assets|uploads)\//.test(url.pathname)) return;
    e.preventDefault();
    if (url.pathname + url.search === location.pathname + location.search) return;
    history.pushState(null, '', url.pathname + url.search);
    render();
  });

  /** Mostra una pagina pubblica: intestazione + contenuto + piè di pagina. */
  function page(current, html, { overHero = false, mount, title } = {}) {
    const first = !$('#hdr');
    const c = boot.content;
    const label = title ?? [...NAV, ['Area clienti', '/area-clienti'], ['Privacy', '/privacy'], ['Cookie', '/cookie']]
      .find(([, p]) => p !== '/' && p === current)?.[0];
    document.title = label ? `${label} · ${c.companyName}` : `${c.companyName} · ${c.tagline}`;
    scaffold = { current, overHero, site: true };
    menuOpen = false;
    swOpen = false;
    $('#mmenu')?.remove();
    document.body.style.overflow = '';
    document.body.classList.remove('admin-mode');
    const app = $('#app');
    app.innerHTML = `<div class="progress-top" id="ptop"></div><header class="header" id="hdr">${headerHtml()}</header>
      <div class="page" id="page">${html}${footerHtml()}</div>`;
    scrollTo(0, 0);
    lastY = 0;
    headerHidden = false;
    updateHeader();
    const pg = $('#page');
    requestAnimationFrame(() => requestAnimationFrame(() => pg.classList.add('shown')));
    if (mount) mount(pg);
    watchReveals(pg);
    updateParallax();
    renderSwitcher();
    renderWhatsApp();
    if (first) hideSplash();
  }

  /** Su telefono e tablet: pulsante fisso per scrivere su WhatsApp (non in Contatti e Area clienti, che hanno già recapiti e chat). */
  function renderWhatsApp() {
    const n = phoneDigits(boot.content.contacts?.whatsapp || '').replace('+', '');
    const off = scaffold.current === '/contatti' || scaffold.current.startsWith('/area-clienti');
    if ($('#wa')) { $('#wa').hidden = off; return; }
    if (!n) return;
    const text = `Buongiorno, vi scrivo dal sito di ${boot.content.companyName}.`;
    const a = document.createElement('a');
    a.id = 'wa';
    a.className = 'wa';
    a.href = `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'Scrivici su WhatsApp');
    a.innerHTML = `${ms('chat')}<span>WhatsApp</span>`;
    a.hidden = off;
    document.body.appendChild(a);
  }

  function hideSplash() {
    const s = $('#splash');
    if (!s) return;
    const wait = Math.max(0, 1100 - (performance.now() - startedAt));
    setTimeout(() => { s.classList.add('hide'); setTimeout(() => s.remove(), 900); }, wait);
  }

  addEventListener('scroll', () => {
    if (!scaffold.site) return;
    updateHeader();
    updateParallax();
  }, { passive: true });
  addEventListener('resize', () => updateParallax());
  document.addEventListener('click', (e) => {
    if (e.target.closest('#hdr .burger')) toggleMenu();
  });

  function start() {
    // I vecchi link con # (es. …/#/progetti/abc) portano alla pagina giusta.
    if (location.hash.startsWith('#/')) history.replaceState(null, '', BASE + location.hash.slice(2));
    applyLinkParams(new URLSearchParams(location.search));
    applyTheme(false);
    addEventListener('popstate', render);
    render();
  }

  /** Riflette nei dati pubblici una modifica fatta dal gestionale. */
  function setPublic(key, value) {
    const filters = { projects: (p) => p.published !== false, services: (s) => s.active !== false, testimonials: (t) => t.published !== false };
    boot[key] = filters[key] ? value.filter(filters[key]) : value;
    if (key === 'look') applyTheme(true);
  }

  return {
    boot, THEMES, themeById, currentTheme, defaultTheme, offeredThemes, applyTheme, selectTheme, swatch,
    esc, ms, $, $$, pad2, clamp, phoneDigits, mapsUrl, isPhone, screenH, lines, fmtDate, untilSplashEnds,
    api, ph, parallax, rt, reveal, watchReveals, countUp, updateParallax, toast, lightbox, logo, logoMark,
    route, page, onCleanup, start, render, setPublic, hideSplash, go, link, slug, projectSlug, projectLink, BASE,
    set scaffoldSite(v) { scaffold.site = v; },
    get switcherVisible() { return switcherVisible(); },
  };
})();
