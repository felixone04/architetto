/* =====================================================================
   Pagine pubbliche: Home, Progetti, Progetto, Servizi, Studio, Contatti.
   Impaginazione editoriale: sezioni numerate su righe sottili, foto grandi
   affiancate al testo, schede tecniche come in una tavola di progetto.
   ===================================================================== */
'use strict';

(() => {
  const { boot, esc, ms, $, $$, pad2, clamp, ph, parallax, rt, reveal, phoneDigits, mapsUrl, api, toast } = ARCH;
  const C = () => boot.content;

  // ------------------------------------------------------------ dati
  const coverUrl = (p) => (p.cover || '').trim() || (p.photos?.[0]?.url ?? '');
  const featured = () => {
    const f = boot.projects.filter((p) => p.featured);
    return f.length ? f : boot.projects.slice(0, 4);
  };
  const heroProjects = () => featured().filter((p) => coverUrl(p)).slice(0, 6);
  /** Categorie con almeno un progetto, nell'ordine scelto nel gestionale. */
  function usedCategories() {
    const used = new Set(boot.projects.map((p) => (p.category || '').trim()).filter(Boolean));
    const out = (C().categories || []).filter((c) => used.delete(c));
    return [...out, ...used];
  }
  const WORDS = ['', 'Una', 'Due', 'Tre', 'Quattro', 'Cinque', 'Sei', 'Sette', 'Otto'];
  const statusLabel = (s) => (s === 'inCorso' ? 'In corso' : 'Realizzato');

  // ------------------------------------------------------------ pezzi comuni
  const kicker = (t, dark = false) => (t ? `<span class="kicker ${dark ? 'dark' : ''}">${esc(t)}</span>` : '');

  /** Intestazione di sezione: numero ed etichetta su una riga sottile, sotto il titolo e, a destra, il testo. */
  function sh({ kicker: k = '', title, text = '', trailing = '', dark = false, n = '' }) {
    return `<div class="sh ${dark ? 'dark' : ''}">${reveal(`<div class="sh-rule">${n ? `<span class="no">${esc(n)}</span>` : ''}${kicker(k, dark)}</div>`)}
      <div class="sh-grid"><div class="head">${rt(title)}</div>
      ${text || trailing ? `<div class="side">${text ? reveal(`<p>${esc(text)}</p>`, 200) : ''}${trailing ? reveal(trailing, 300) : ''}</div>` : ''}</div></div>`;
  }
  ARCH.sh = sh;

  /** Inizio delle pagine interne: etichetta sulla riga, titolo grande a sinistra, testo in basso a destra. */
  function pageHeader({ kicker: k = '', title, text = '', bottom = '' }) {
    return `<header class="page-header"><div class="wrap">${reveal(`<div class="ph-rule">${kicker(k)}</div>`)}
      <div class="ph-grid"><div>${rt(title, { tag: 'h1', delay: 80 })}</div>
      ${text || bottom ? `<div class="ph-side">${text ? reveal(`<p class="lead">${esc(text)}</p>`, 300) : ''}${bottom ? reveal(`<div class="bottom">${bottom}</div>`, 400) : ''}</div>` : ''}</div></div></header>`;
  }
  ARCH.pageHeader = pageHeader;

  /** Filtri discreti: parole in fila (o in colonna con cls "vert"), quella scelta sottolineata. */
  const quietFilters = (options, selected, attr = 'data-f', cls = '') =>
    `<div class="qfilters ${cls}" role="tablist">${options.map((o, i) => `<button class="hl ${i === selected ? 'active' : ''}" ${attr}="${i}" role="tab"
      aria-selected="${i === selected}"><span>${esc(o)}</span></button>`).join('')}</div>`;
  ARCH.quietFilters = quietFilters;

  const hl = (text, href, { arrow = false, cls = '', style = '' } = {}) =>
    `<a class="hl ${cls}" href="${esc(href)}" style="${style}"><span>${esc(text)}${arrow ? ms('arrow_forward') : ''}</span></a>`;
  ARCH.hl = hl;

  const btn = (text, href, { kind = '', big = false, icon = 'arrow_forward' } = {}) =>
    `<a class="btn ${kind} ${big ? 'big' : ''}" href="${esc(href)}">${esc(text)}${ms(icon)}</a>`;
  ARCH.btn = btn;

  // ------------------------------------------------------------ scheda progetto
  /** Foto, poi una riga con numero, titolo e categoria, come la didascalia di una tavola. */
  function projectCard(p, { n = 0, summary = false, tall = false } = {}) {
    const meta = [p.category, p.year].filter((x) => (x || '').trim()).join(' · ');
    return `<a class="pcard zoom ${tall ? 'tall' : ''}" href="${ARCH.projectLink(p)}" aria-label="Progetto ${esc(p.title)}">
      <div class="img">${ph(coverUrl(p), { alt: p.title })}${p.status === 'inCorso' ? '<span class="pill acc">In corso</span>' : ''}
        <span class="go">${ms('arrow_outward')}</span></div>
      <div class="row"><span class="no">${pad2(n)}</span><span class="t">${esc(p.title)}</span><span class="m">${esc(meta)}</span></div>
      ${p.location ? `<div class="loc">${esc(p.location)}</div>` : ''}${summary && p.summary ? `<div class="s">${esc(p.summary)}</div>` : ''}</a>`;
  }
  /** Due colonne sfalsate: schede alte e basse si alternano a scacchiera. */
  function projectGrid(list, opts) {
    return `<div class="pgrid">${list.map((p, i) => reveal(projectCard(p, { ...opts, n: i + 1, tall: i % 4 === 0 || i % 4 === 3 }), 100 * (i % 2))).join('')}</div>`;
  }

  // ================================================================ HOME

  /** Prima schermata divisa in due: testo su carta a sinistra, foto dei progetti in evidenza a destra. */
  function hero() {
    const c = C();
    const slides = heroProjects();
    return `<section class="hero" id="hero"><div class="hero-in">
      <div class="h-txt"><div class="h-top">${reveal(kicker(c.heroKicker))}
        ${rt(c.heroTitle, { tag: 'h1', delay: 100 })}
        ${reveal(`<p class="sub">${esc(c.heroSubtitle)}</p>`, 450)}
        ${reveal(`<div class="cta">${btn('Guarda i progetti', 'progetti', { big: true })}${btn('Prenota un incontro', 'contatti', { kind: 'outline', big: true, icon: 'calendar_month' })}</div>`, 600)}</div>
        ${slides.length ? reveal('<div class="info"><span class="cnt"></span><a class="lab"></a><div class="dots"></div></div>', 700) : ''}</div>
      <div class="h-img"><div class="slides">${slides.map((p, i) => `<div class="slide ${i === 0 ? 'on' : ''}">${ph(coverUrl(p), { dark: true, eager: i === 0, alt: p.title })}</div>`).join('')}</div></div>
      </div></section>`;
  }

  function mountHero(root) {
    const el = $('#hero', root);
    if (!el) return;
    const slides = heroProjects();
    const SLIDE = 6500;
    let i = 0;
    const draw = () => {
      $$('.slide', el).forEach((s, n) => s.classList.toggle('on', n === i));
      const p = slides[i];
      const lab = $('.lab', el);
      const cnt = $('.cnt', el);
      if (cnt) cnt.innerHTML = `<b>${pad2(i + 1)}</b> / ${pad2(slides.length)}`;
      if (lab && p) {
        lab.style.opacity = '0';
        setTimeout(() => {
          lab.href = ARCH.projectLink(p);
          lab.innerHTML = `<span class="t">${esc(p.title)}</span><span class="l">${esc(p.location)}</span>${ms('arrow_outward')}`;
          lab.style.opacity = '1';
        }, i === 0 && !draw.done ? 0 : 300);
      }
      draw.done = true;
      const dots = $('.dots', el);
      if (dots) dots.innerHTML = slides.map((_, n) => `<span class="dot ${n === i ? 'on' : ''}" data-n="${n}" style="--dur:${SLIDE}ms"><i></i></span>`).join('');
    };
    let timer = setInterval(() => { i = (i + 1) % slides.length; draw(); }, SLIDE);
    el.addEventListener('click', (e) => {
      const d = e.target.closest('.dot');
      if (!d) return;
      i = +d.dataset.n;
      draw();
      clearInterval(timer);
      timer = setInterval(() => { i = (i + 1) % slides.length; draw(); }, SLIDE);
    });
    draw();
    // Scorrendo, la foto scende più lentamente della pagina.
    const slidesEl = $('.slides', el);
    const onScroll = () => {
      const y = Math.min(scrollY, ARCH.screenH());
      slidesEl.style.transform = `translate3d(0, ${(y * 0.18).toFixed(1)}px, 0)`;
    };
    addEventListener('scroll', onScroll, { passive: true });
    ARCH.onCleanup(() => { clearInterval(timer); removeEventListener('scroll', onScroll); });
  }

  /** Lo studio in breve: titolo-manifesto, testo e numeri in fila su righe sottili. */
  function intro() {
    const c = C();
    return `<section class="section"><div class="wrap">${sh({ n: '01', kicker: c.introKicker, title: c.introTitle })}
      <div class="intro mt-l"><div class="txt">${reveal(`<p>${esc(c.introText)}</p>`, 150)}${reveal(hl('Conosci lo studio', 'studio', { arrow: true }), 250)}</div>
      <div class="stats">${(c.stats || []).map((s, i) => reveal(`<div class="stat"><div class="n" data-count="${esc(s.title)}">${esc(s.title)}</div>
        <div class="d">${esc(s.text)}</div></div>`, 120 * i)).join('')}</div></div></div></section>`;
  }

  /** I servizi come un indice numerato: passando sopra una riga compare la sua foto. */
  function servicesIndex() {
    const c = C();
    const list = boot.services;
    if (!list.length) return '';
    return `<section class="section t0"><div class="wrap">${sh({ n: '02', kicker: c.servicesKicker, title: c.servicesTitle, text: c.servicesText })}
      <div class="sindex mt-l">${list.map((s, i) => reveal(`<a class="srow" href="servizi?s=${encodeURIComponent(s.id)}">
        <span class="no">${pad2(i + 1)}</span><span class="t">${esc(s.title)}</span>
        <span class="pts">${esc((s.points || []).slice(0, 3).join(' · '))}</span>${ms('arrow_outward')}
        <span class="pv">${ph(s.image)}</span></a>`, 50 * i)).join('')}</div></div></section>`;
  }

  function ticker() {
    const items = C().ticker || [];
    if (!items.length) return '';
    const set = `<div class="set" aria-hidden="true">${items.map((w, i) => `<span class="w ${i % 2 ? 'i' : ''}">${esc(w)}</span><span class="dot"></span>`).join('')}</div>`;
    return `<div class="ticker" aria-label="${esc(items.join(', '))}"><div class="track">${set}${set}${set}${set}</div></div>`;
  }
  ARCH.ticker = ticker;

  /** Progetti in evidenza a zig-zag: foto grande da un lato, racconto breve dall'altro. */
  function recentProjects() {
    const c = C();
    const list = featured().slice(0, 4);
    if (!list.length) return '';
    return `<section class="section t0"><div class="wrap">${sh({ n: '03', kicker: c.projectsKicker, title: c.projectsTitle, text: c.projectsText,
      trailing: btn('Tutto il portfolio', 'progetti', { kind: 'outline' }) })}
      <div class="feats mt-l">${list.map((p, i) => `<article class="feat ${i % 2 ? 'rev' : ''}">
        ${reveal(`<a class="fimg" href="${ARCH.projectLink(p)}" aria-label="${esc(p.title)}">${parallax(coverUrl(p), { extent: 0.18, cls: 'fill' })}</a>`)}
        <div class="ftx">${reveal(`<span class="no">${pad2(i + 1)} — ${pad2(list.length)}</span>`)}
          ${reveal(`<span class="cat">${esc([p.category, p.location].filter(Boolean).join(' · '))}</span>`, 80)}
          ${reveal(`<h3 class="serif"><a href="${ARCH.projectLink(p)}">${esc(p.title)}</a></h3>`, 140)}
          ${p.summary ? reveal(`<p>${esc(p.summary)}</p>`, 200) : ''}
          ${reveal(hl('Scopri il progetto', ARCH.projectLink(p), { arrow: true }), 260)}</div></article>`).join('')}</div></div></section>`;
  }

  function contactLine(icon, label, value, href, ext = false) {
    return `<a class="cline" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}><span class="ic">${ms(icon)}</span>
      <span><span class="lb">${esc(label)}</span><br><span class="vl">${esc(value)}</span></span></a>`;
  }
  ARCH.contactLine = contactLine;

  /** Recapiti: foto da un lato, invito e contatti dall'altro. */
  function contactStrip() {
    const c = C();
    const k = c.contacts || {};
    return `<section class="section"><div class="wrap">${reveal(`<div class="cstrip"><div class="cs-img">${ph(c.contactImage || c.aboutImage)}</div>
      <div class="cs-txt">${kicker('Contatti')}${rt('Parliamo del\ntuo progetto.')}<div class="mt-m">
      ${k.phone ? contactLine('call', 'Telefono', k.phone, 'tel:' + phoneDigits(k.phone)) : ''}
      ${k.email ? contactLine('mail', 'Email', k.email, 'mailto:' + k.email) : ''}
      ${k.address ? contactLine('place', 'Studio', k.address, mapsUrl(k.address), true) : ''}</div>
      <div class="mt-m">${btn('Scrivici dal modulo', 'contatti')}</div></div></div>`)}</div></section>`;
  }

  ARCH.route('/', () => ARCH.page('/', hero() + intro() + servicesIndex() + recentProjects() + ticker() + contactStrip(), { mount: mountHero }));

  // ============================================================ PROGETTI

  ARCH.route('/progetti', (_, q) => {
    const c = C();
    const cats = usedCategories();
    const options = ['Tutti', ...cats];
    let sel = Math.max(0, options.indexOf(q.get('categoria') || ''));
    const pick = () => { const cat = sel === 0 ? null : options[sel]; return boot.projects.filter((p) => !cat || p.category === cat); };
    const grid = () => {
      const list = pick();
      return list.length ? projectGrid(list, { summary: true })
        : '<p class="muted" style="padding:60px 0">Nessun progetto in questa categoria, per ora.</p>';
    };
    const count = () => { const n = pick().length; return `${pad2(n)} ${n === 1 ? 'progetto' : 'progetti'}`; };
    // Categorie in una colonna fissa a sinistra (in fila su telefono), schede a destra.
    ARCH.page('/progetti', pageHeader({ kicker: c.projectsKicker, title: c.projectsTitle, text: c.projectsText })
      + `<section class="section t0"><div class="wrap plist"><aside class="pside">${reveal(`<div class="eyebrow">Categorie</div>
        ${quietFilters(options, sel, 'data-f', 'vert')}<div class="cnt" id="pg-cnt">${count()}</div>`)}</aside>
        <div id="pg-grid">${grid()}</div></div></section>`, {
      mount(root) {
        root.addEventListener('click', (e) => {
          const b = e.target.closest('[data-f]');
          if (!b) return;
          sel = +b.dataset.f;
          $$('[data-f]', root).forEach((x, i) => { x.classList.toggle('active', i === sel); x.setAttribute('aria-selected', i === sel); });
          $('#pg-cnt', root).textContent = count();
          const g = $('#pg-grid', root);
          g.innerHTML = `<div class="fade-swap">${grid()}</div>`;
          ARCH.watchReveals(g);
        });
      },
    });
  });

  // ------------------------------------------------------------ prima/dopo
  function compare(before, after) {
    return reveal(`<div class="compare" style="--t:.5;aspect-ratio:${innerWidth < 600 ? '4/3.4' : '16/9'}">
      ${ph(after)}${ph(before, { cls: 'before' })}
      <span class="lab l">Prima</span><span class="lab r">Dopo</span><span class="bar"></span>
      <span class="knob">${ms('chevron_left')}${ms('chevron_right')}</span></div>`);
  }
  function mountCompare(root) {
    for (const el of $$('.compare', root)) {
      let t = 0.5;
      let touched = false;
      const set = (v) => {
        t = clamp(v, 0, 1);
        el.style.setProperty('--t', t);
        $('.lab.l', el).style.opacity = t > 0.12 ? 1 : 0;
        $('.lab.r', el).style.opacity = t < 0.88 ? 1 : 0;
      };
      const at = (e) => { const r = el.getBoundingClientRect(); set((e.clientX - r.left) / r.width); };
      let drag = false;
      el.addEventListener('pointerdown', (e) => { touched = true; drag = true; el.setPointerCapture(e.pointerId); at(e); });
      el.addEventListener('pointermove', (e) => { if (drag) at(e); });
      el.addEventListener('pointerup', () => { drag = false; });
      // Un piccolo movimento d'invito finché nessuno tocca la maniglia.
      const t0 = performance.now() + 2200;
      const hint = (now) => {
        if (touched || !el.isConnected) return;
        const k = (now - t0) / 2600;
        if (k >= 0 && k <= 1) set(0.5 + 0.12 * Math.sin(2 * Math.PI * k));
        if (k <= 1) requestAnimationFrame(hint);
      };
      requestAnimationFrame(hint);
    }
  }
  ARCH.compare = compare;
  ARCH.mountCompare = mountCompare;

  /** Galleria a colonne (come un muro di foto appese): formati alternati, didascalie numerate. */
  function gallery(photos) {
    const ratio = (i) => (i % 3 === 0 ? '4/5' : i % 3 === 1 ? '4/3' : '1/1');
    return `<div class="gal">${photos.map((f, i) => reveal(`<figure class="gtile" data-g="${i}">${ph(f.url, { attrs: `style="aspect-ratio:${ratio(i)}"`, alt: f.caption })}
      ${f.caption ? `<figcaption class="cap"><b>${pad2(i + 1)}</b>${esc(f.caption)}</figcaption>` : ''}</figure>`, (i % 2) * 120)).join('')}</div>`;
  }

  ARCH.route('/progetti/:id', ([id]) => {
    const list = boot.projects;
    const p = list.find((x) => ARCH.projectSlug(x) === id) || list.find((x) => x.id === id);
    if (!p) {
      return ARCH.page('/progetti', pageHeader({ kicker: 'Progetti', title: "Questo progetto\nnon c'è più.",
        bottom: btn('Tutti i progetti', 'progetti', { kind: 'outline' }) }));
    }
    // Un vecchio link con l'id diventa l'indirizzo con il nome del progetto.
    if (id !== ARCH.projectSlug(p)) history.replaceState(null, '', ARCH.BASE + ARCH.projectLink(p));
    const idx = list.indexOf(p);
    const next = list.length > 1 ? list[(idx + 1) % list.length] : null;
    const facts = [['Luogo', p.location], ['Anno', p.year], ['Committente', p.client], ['Superficie', p.area], ['Tempi', p.duration],
      ['Stato', statusLabel(p.status)]].filter(([, v]) => (v || '').trim());
    const story = (p.description || '').split('\n\n').filter((x) => x.trim()).map((x, i) => reveal(`<p class="${i ? '' : 'first'}">${esc(x.trim())}</p>`)).join('');
    // Scheda tecnica a sinistra, ferma mentre si legge il racconto.
    const sheet = `<div class="sheet">${reveal('<div class="eyebrow">Scheda del progetto</div>')}
      ${facts.map(([k, v]) => reveal(`<div class="fact"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`)).join('')}
      ${p.works?.length ? reveal('<div class="eyebrow mt-m">Il nostro incarico</div>') + reveal(`<ul class="works">${p.works.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`) : ''}
      ${reveal(`<div class="mt-m">${btn('Vorrei un progetto simile', 'contatti?progetto=' + encodeURIComponent(ARCH.projectSlug(p)), { kind: 'outline' })}</div>`)}</div>`;
    let n = 0;
    const html = `<header class="pj-head"><div class="wrap">${reveal(`<a class="hl back" href="progetti"><span>${ms('arrow_back')}Tutti i progetti</span></a>`)}
        ${reveal(`<div class="pj-top"><span class="no">${pad2(idx + 1)} / ${pad2(list.length)}</span>${kicker([p.category, p.location].filter(Boolean).join(' · '))}</div>`)}
        <div class="pj-grid">${rt(p.title, { tag: 'h1', delay: 80 })}${p.summary ? reveal(`<p class="lead">${esc(p.summary)}</p>`, 300) : ''}</div></div></header>`
      + `<div class="pj-cover">${parallax(coverUrl(p), { extent: 0.25, cls: 'fill' })}</div>`
      + `<section class="section"><div class="wrap pdetail"><div class="side">${sheet}</div><div class="story">${story}</div></div></section>`
      + (p.photos?.length ? `<section class="section t0"><div class="wrap">${sh({ n: pad2(++n), kicker: 'Fotografie', title: 'Il progetto\nda vicino.' })}
        <div class="mt-l">${gallery(p.photos)}</div></div></section>` : '')
      + (p.before ? `<section class="section t0"><div class="wrap">${sh({ n: pad2(++n), kicker: 'Prima e dopo', title: 'Trascina\nper confrontare.' })}
        <div class="mt-l">${compare(p.before, (p.after || '').trim() || coverUrl(p))}</div></div></section>` : '')
      + (next ? `<section class="section t0"><div class="wrap">${reveal(`<a class="next" href="${ARCH.projectLink(next)}">
        <span class="nx-t"><small>Progetto successivo</small><span class="t">${esc(next.title)}</span>
        <span class="m">${esc([next.category, next.location].filter(Boolean).join(' · '))}</span></span>
        <span class="nx-img">${ph(coverUrl(next))}</span><span class="nx-go">${ms('arrow_forward')}</span></a>`)}</div></section>` : '');
    ARCH.page('/progetti', html, {
      title: p.title,
      mount(root) {
        mountCompare(root);
        root.addEventListener('click', (e) => {
          const g = e.target.closest('[data-g]');
          if (g) ARCH.lightbox(p.photos, +g.dataset.g);
        });
      },
    });
  });

  // ============================================================= SERVIZI

  const servicePhotos = (s) => {
    const photos = [];
    for (const p of boot.projects.filter((x) => (s.categories || []).includes(x.category))) {
      for (const f of (p.photos || []).slice(0, 2)) photos.push({ url: f.url, caption: [p.title, f.caption].filter(Boolean).join(' · ') });
    }
    return photos.slice(0, 4);
  };

  /** Il servizio scelto: foto larga, testo, punti chiave e progetti collegati. */
  function serviceView(s) {
    const projects = boot.projects.filter((p) => (s.categories || []).includes(p.category));
    const shown = servicePhotos(s);
    return `<div class="fade-swap sv">${ph(s.image, { cls: 'sv-img', alt: s.title })}
      <div class="sv-body"><h2 class="serif">${esc(s.title)}</h2><p class="tx">${esc(s.text)}</p>
        ${s.points?.length ? `<ul class="pts">${s.points.map((x) => `<li>${ms('check')}${esc(x)}</li>`).join('')}</ul>` : ''}</div>
      ${projects.length ? `<div class="eyebrow mt-l">Progetti di questo tipo</div><div class="sv-projects">${projects.slice(0, 3).map((p) => `<a class="mini" href="${ARCH.projectLink(p)}">
        ${ph(coverUrl(p))}<span><span class="t">${esc(p.title)}</span><span class="m">${esc(p.location || '')}</span></span>${ms('arrow_outward')}</a>`).join('')}</div>` : ''}
      ${shown.length ? `<div class="thumbs">${shown.map((f, n) => reveal(`<div class="thumb" data-th="${n}">${ph(f.url)}<span class="cap">${esc(f.caption)}</span></div>`, 90 * n)).join('')}</div>` : ''}</div>`;
  }

  ARCH.route('/servizi', (_, q) => {
    const c = C();
    const list = boot.services;
    let sel = Math.max(0, list.findIndex((s) => s.id === q.get('s')));
    // Elenco numerato in colonna (in fila su telefono); il servizio scelto a destra.
    const tabs = `<div class="svtabs" role="tablist">${list.map((s, i) => `<button class="svtab ${i === sel ? 'active' : ''}" data-f="${i}" role="tab" aria-selected="${i === sel}">
      <span class="no">${pad2(i + 1)}</span><span class="t">${esc(s.title)}</span>${ms('arrow_forward')}</button>`).join('')}</div>`;
    ARCH.page('/servizi', pageHeader({ kicker: c.servicesKicker, title: c.servicesTitle, text: c.servicesText })
      + (list.length ? `<section class="section t0"><div class="wrap svc"><aside>${reveal(tabs)}</aside><div id="sv">${serviceView(list[sel])}</div></div></section>` : ''), {
      mount(root) {
        root.addEventListener('click', (e) => {
          const b = e.target.closest('[data-f]');
          if (b) {
            sel = +b.dataset.f;
            $$('[data-f]', root).forEach((x, i) => { x.classList.toggle('active', i === sel); x.setAttribute('aria-selected', i === sel); });
            const v = $('#sv', root);
            v.innerHTML = serviceView(list[sel]);
            ARCH.watchReveals(v);
            if (innerWidth < 980) v.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
          const th = e.target.closest('[data-th]');
          if (th) ARCH.lightbox(servicePhotos(list[sel]), +th.dataset.th);
        });
      },
    });
  });

  // ============================================================== STUDIO

  ARCH.route('/studio', () => {
    const c = C();
    const band = c.aboutImage ? `<div class="st-band">${parallax(c.aboutImage, { extent: 0.2, cls: 'fill' })}</div>` : '';
    const story = `<section class="section"><div class="wrap st-story">
      <div class="txt">${(c.aboutText || '').split('\n\n').filter((x) => x.trim()).map((x, i) => reveal(`<p class="${i ? '' : 'first'}">${esc(x.trim())}</p>`)).join('')}</div>
      <div class="st-side">${c.aboutImage2 ? reveal(ph(c.aboutImage2, { cls: 'st-img' }), 150) : ''}
        ${c.certifications?.length ? reveal(`<div class="eyebrow mt-m">Iscrizioni e riconoscimenti</div><ul class="certs">${c.certifications.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`, 250) : ''}</div>
      </div></section>`;
    // Valori su una riga sola fino a cinque (le lettere di LUMEN), poi tre o quattro per riga.
    const nv = (c.values || []).length;
    const wideCols = nv <= 5 ? Math.max(nv, 1) : nv % 3 === 0 ? 3 : 4;
    const cols = innerWidth >= 1000 ? wideCols : innerWidth >= 540 ? 2 : 1;
    const values = nv ? `<section class="section" style="background:var(--concrete)"><div class="wrap">
      ${sh({ n: '01', kicker: 'Il nome', title: nv === 1 ? 'Una parola\nche ci guida.' : (WORDS[nv] || 'Le') + ' parole\nche ci guidano.' })}
      <div class="values mt-l" style="--n:${wideCols}">${c.values.map((v, i) => reveal(`<div class="vcard"><div class="big">${esc((v.title || ' ')[0].toUpperCase())}</div>
        <h3>${esc(v.title)}</h3><p>${esc(v.text)}</p></div>`, 110 * (i % cols))).join('')}</div></div></section>` : '';
    const timeline = c.timeline?.length ? `<section class="section"><div class="wrap">${sh({ n: '02', kicker: 'La storia', title: "Un progetto\ndopo l'altro." })}
      <div class="tline mt-l" style="--n:${c.timeline.length}">${c.timeline.map((m, i) => reveal(`<div class="tl"><span class="y">${esc(m.year)}</span><span class="pin"></span>
        <h3>${esc(m.title)}</h3><p>${esc(m.text)}</p></div>`, 90 * i)).join('')}</div></div></section>` : '';
    const team = c.team?.length ? `<section class="section t0"><div class="wrap">${sh({ n: '03', kicker: 'Le persone', title: 'Chi disegna\ni tuoi spazi.' })}
      <div class="team mt-l">${c.team.map((m, i) => reveal(`<div class="person">${ph(m.photo, { alt: m.name })}<div><span class="no">${pad2(i + 1)}</span>
        <h3>${esc(m.name)}</h3><p>${esc(m.role)}</p></div></div>`, 100 * (i % 2))).join('')}</div></div></section>` : '';
    const ts = boot.testimonials;
    const quotes = ts.length ? `<section class="section t0"><div class="wrap">${reveal(`<div class="quotebox" id="qb"><span class="qmark serif" aria-hidden="true">“</span>
      ${kicker('Dicono di noi')}<div id="qt"></div>${ts.length > 1 ? `<div class="qdots">${ts.map((_, n) => `<i data-q="${n}"></i>`).join('')}</div>` : ''}</div>`)}</div></section>` : '';
    ARCH.page('/studio', pageHeader({ kicker: c.aboutKicker, title: c.aboutTitle, text: c.aboutIntro }) + band + story + values + timeline + team + quotes, {
      mount(root) {
        const qb = $('#qb', root);
        if (!qb) return;
        let i = 0;
        const draw = () => {
          const t = ts[i % ts.length];
          $('#qt', qb).innerHTML = `<div class="fade-swap"><p class="q">${esc(t.text)}</p><p class="who">${esc([t.name, t.role].filter(Boolean).join(' · '))}</p></div>`;
          $$('[data-q]', qb).forEach((d, n) => d.classList.toggle('on', n === i % ts.length));
        };
        draw();
        const timer = setInterval(() => { i++; draw(); }, 8000);
        qb.addEventListener('click', (e) => { const d = e.target.closest('[data-q]'); if (d) { i = +d.dataset.q; draw(); } });
        ARCH.onCleanup(() => clearInterval(timer));
      },
    });
  });

  // ============================================================ CONTATTI

  /** Recapiti su una scheda scura, con la foto dello studio sotto. */
  function infoBox() {
    const c = C();
    const k = c.contacts || {};
    const items = [
      k.phone && ['call', 'Telefono', k.phone, 'tel:' + phoneDigits(k.phone)],
      k.whatsapp && ['chat', 'WhatsApp', k.whatsapp, 'https://wa.me/' + phoneDigits(k.whatsapp).replace('+', ''), true],
      k.email && ['mail', 'Email', k.email, 'mailto:' + k.email],
      k.pec && ['verified', 'PEC', k.pec, 'mailto:' + k.pec],
      k.address && ['place', 'Studio', k.address, mapsUrl(k.address), true],
    ].filter(Boolean);
    return `<div class="info"><div class="ibox">${kicker('Lo studio', true)}${items.map(([ic, l, v, h, ext], i) => reveal(contactLine(ic, l, v, h, ext), 70 * i)).join('')}
      ${k.hours ? reveal(`<div class="cline" style="cursor:default"><span class="ic">${ms('schedule')}</span><span><span class="lb">Orari</span><br>
        <span class="vl">${esc(k.hours)}</span></span></div>`, 70 * items.length) : ''}</div>
      ${c.aboutImage2 ? reveal(ph(c.aboutImage2, { cls: 'i-img' }), 200) : ''}</div>`;
  }

  const field = (name, label, { type = 'text', area = false, auto = '', cls = '' } = {}) =>
    `<label class="field ${cls}">${area ? `<textarea name="${name}" placeholder=" " rows="4"></textarea>`
      : `<input name="${name}" type="${type}" placeholder=" "${auto ? ` autocomplete="${auto}"` : ''}>`}<span>${esc(label)}</span><small class="err"></small></label>`;
  ARCH.field = field;

  // ------------------------------------------------------------ richiesta di preventivo a passi
  const AREAS = [['fino a 50', 'Fino a 50 m²'], ['50–100', '50–100 m²'], ['100–200', '100–200 m²'], ['oltre 200', 'Oltre 200 m²'], ['', 'Non lo so']];
  const STEPS = ['Il progetto', 'Qualche dettaglio', 'Foto e planimetrie', 'I tuoi contatti'];
  const MAX_PHOTOS = 6;

  /** Foto ridotta nel browser (lato lungo 1600 px): l'invio è leggero anche dal telefono. */
  async function shrink(file) {
    const img = await createImageBitmap(file).catch(() => null);
    if (!img) return null;
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k);
    cv.height = Math.round(img.height * k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.82));
  }

  /** Quattro passi: tipo di intervento, dettagli, foto e planimetrie, contatti. ref = progetto da cui si arriva. */
  function quoteWizard(host, ref = '') {
    const c = C();
    const d = { type: '', city: '', area: null, budget: '', timing: '', message: '', photos: [], name: '', phone: '', email: '', privacy: false };
    let step = 0;
    const chips = (list, cur, attr) => `<div class="row-wrap" style="gap:.5rem">${list.map(([v, l]) =>
      `<button type="button" class="choice ${cur === v ? 'on' : ''}" ${attr}="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
    const body = () => {
      if (step === 0) {
        return `<p class="q">Di cosa si tratta?</p>${ref ? `<p class="ref">${ms('apartment')}Come il progetto «${esc(ref)}»</p>` : ''}
          ${chips((c.requestTypes || []).map((t) => [t, t]), d.type, 'data-type')}<p class="formerr mt-s" id="werr"></p>`;
      }
      if (step === 1) {
        return `<p class="q">Qualche dettaglio</p>${field('city', "Comune dell'immobile")}
          <p class="sub">Superficie indicativa</p>${chips(AREAS, d.area, 'data-area')}
          ${(c.budgets || []).length ? `<p class="sub">Budget indicativo</p>${chips(c.budgets.map((t) => [t, t]), d.budget, 'data-budget')}` : ''}
          ${(c.timings || []).length ? `<p class="sub">Quando vorresti iniziare?</p>${chips(c.timings.map((t) => [t, t]), d.timing, 'data-timing')}` : ''}
          <div class="mt-m">${field('message', 'Raccontaci cosa hai in mente', { area: true })}</div>`;
      }
      if (step === 2) {
        return `<p class="q">Hai foto o una planimetria?</p><p class="muted">Facoltative, fino a ${MAX_PHOTOS}: foto dell'immobile, la planimetria (anche fotografata) o immagini di spazi che ti piacciono. Ci aiutano a capire il progetto già prima del primo incontro.</p>
          <div class="wphotos">${d.photos.map((p, i) => `<div class="wph"><img src="${p.url}" alt="Foto ${i + 1}">
            <button type="button" data-rmp="${i}" aria-label="Togli la foto">${ms('close')}</button></div>`).join('')}
          ${d.photos.length < MAX_PHOTOS ? `<label class="wph add">${ms('add_a_photo')}<span>Aggiungi</span>
            <input type="file" accept="image/*" multiple id="wfile" style="display:none"></label>` : ''}</div>`;
      }
      return `<p class="q">Come ti ricontattiamo?</p><div style="display:grid;gap:.875rem">
          <div class="f2">${field('name', 'Nome e cognome *', { auto: 'name' })}${field('phone', 'Telefono *', { type: 'tel', auto: 'tel' })}</div>
          ${field('email', 'Email *', { type: 'email', auto: 'email' })}
          <input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"></div>
        <label class="check mt-s"><input type="checkbox" name="privacy" ${d.privacy ? 'checked' : ''}><span>Ho letto l'<a class="ul" href="privacy" target="_blank">informativa
          sulla privacy</a> e acconsento al trattamento dei dati per essere ricontattato. *<br><span class="formerr" id="perr"></span></span></label>`;
    };
    const draw = () => {
      host.innerHTML = `<form class="wizard box" novalidate><div class="whead"><span>Passo ${step + 1} di ${STEPS.length} · ${STEPS[step]}</span>
          <div class="wbar"><i style="width:${((step + 1) / STEPS.length) * 100}%"></i></div></div>
        <div class="fade-swap">${body()}</div>
        <div class="wnav">${step ? `<button type="button" class="btn outline" data-back>Indietro</button>` : '<span></span>'}
          <button type="submit" class="btn">${step < STEPS.length - 1 ? 'Avanti' + ms('arrow_forward') : 'Invia la richiesta' + ms('send')}</button></div></form>`;
      const f = $('form', host);
      for (const n of ['city', 'message', 'name', 'phone', 'email']) if (f.elements[n]) f.elements[n].value = d[n];
      const top = host.getBoundingClientRect().top;
      if (top < 0) scrollBy({ top: top - 100, behavior: 'smooth' });
    };
    const pick = (attr, key, el) => {
      d[key] = d[key] === el.getAttribute(attr) ? (key === 'area' ? null : '') : el.getAttribute(attr);
      $$(`[${attr}]`, host).forEach((b) => b.classList.toggle('on', b.getAttribute(attr) === d[key]));
    };
    host.onclick = (e) => {
      const t = e.target;
      if (t.closest('[data-type]')) { pick('data-type', 'type', t.closest('[data-type]')); $('#werr', host).textContent = ''; }
      else if (t.closest('[data-area]')) pick('data-area', 'area', t.closest('[data-area]'));
      else if (t.closest('[data-budget]')) pick('data-budget', 'budget', t.closest('[data-budget]'));
      else if (t.closest('[data-timing]')) pick('data-timing', 'timing', t.closest('[data-timing]'));
      else if (t.closest('[data-back]')) { step--; draw(); }
      else if (t.closest('[data-rmp]')) {
        const [p] = d.photos.splice(+t.closest('[data-rmp]').dataset.rmp, 1);
        URL.revokeObjectURL(p.url);
        draw();
      }
    };
    host.oninput = (e) => {
      const el = e.target;
      if (el.name === 'privacy') d.privacy = el.checked;
      else if (el.name in d && el.type !== 'file') d[el.name] = el.value;
    };
    host.onchange = async (e) => {
      if (e.target.id !== 'wfile') return;
      for (const file of [...e.target.files].slice(0, MAX_PHOTOS - d.photos.length)) {
        const blob = await shrink(file);
        if (blob) d.photos.push({ blob, url: URL.createObjectURL(blob) });
        else toast(`"${file.name}" non è una foto che il browser sa leggere (prova JPG o PNG).`, true);
      }
      draw();
    };
    host.onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      if (step === 0 && (c.requestTypes || []).length && !d.type) { $('#werr', f).textContent = 'Scegli il tipo di intervento per continuare.'; return; }
      if (step < STEPS.length - 1) { step++; draw(); return; }
      const v = (n) => f.elements[n].value.trim();
      const err = (n, m) => { const el = f.elements[n].closest('.field'); el.classList.toggle('bad', !!m); $('.err', el).textContent = m || ''; return !m; };
      let ok = err('name', v('name') ? '' : 'Campo obbligatorio');
      ok = err('phone', !v('phone') ? 'Campo obbligatorio' : phoneDigits(v('phone')).replace('+', '').length < 6 ? 'Numero non valido' : '') && ok;
      ok = err('email', !v('email') ? 'Campo obbligatorio' : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('email')) ? '' : 'Email non valida') && ok;
      $('#perr', f).textContent = d.privacy ? '' : 'Serve il consenso per inviare la richiesta.';
      if (!ok || !d.privacy) return;
      const b = $('button[type=submit]', f);
      b.classList.add('loading');
      b.innerHTML = 'Invio<span class="spin"></span>';
      const fd = new FormData();
      Object.entries({ type: d.type, city: d.city, area: d.area || '', budget: d.budget, timing: d.timing, message: d.message, name: v('name'), phone: v('phone'),
        email: v('email'), privacy: '1', website: f.elements.website.value, projectRef: ref }).forEach(([k, x]) => fd.append(k, x));
      d.photos.forEach((p, i) => fd.append('photos[]', p.blob, `foto-${i + 1}.jpg`));
      try {
        await api('contact', fd);
        await new Promise((r) => setTimeout(r, 600));
        const first = v('name').split(' ')[0];
        host.innerHTML = `<div class="box fade-swap" style="padding:clamp(1.75rem, calc(1.75rem + (100vw - 22.5rem) * .0194), 3.25rem)">
          <div class="thanks-ic">${ms('check')}</div><h2 class="serif" style="margin-top:1.5rem;font-size:clamp(2.125rem, calc(2.125rem + (100vw - 22.5rem) * .0145), 3.25rem)">Richiesta inviata</h2>
          <p class="muted" style="margin-top:.75rem;font-size:1.0625rem">Grazie ${esc(first)}, ti richiamiamo entro due giorni lavorativi.</p>
          <div class="row-wrap mt-l">${btn('Guarda i progetti', 'progetti')}<button class="btn outline" id="again">Nuova richiesta${ms('refresh')}</button></div></div>`;
        d.photos.forEach((p) => URL.revokeObjectURL(p.url));
        $('#again', host).onclick = () => quoteWizard(host);
      } catch (x) {
        toast(x.message, true);
        b.classList.remove('loading');
        b.innerHTML = 'Invia la richiesta' + ms('send');
      }
    };
    draw();
  }

  ARCH.route('/contatti', (_, q) => {
    const c = C();
    const from = boot.projects.find((p) => ARCH.projectSlug(p) === q.get('progetto'));
    ARCH.page('/contatti', pageHeader({ kicker: 'Contatti', title: c.contactTitle, text: c.contactText })
      + `<section class="section t0"><div class="wrap cgrid">${reveal('<div id="fhost"></div>', 100)}${infoBox()}</div></section>`, {
      mount(root) { quoteWizard($('#fhost', root), from?.title || ''); },
    });
  });

  // ============================================================ PRIVACY E COOKIE

  /** Testi di base, compilati con i dati dello studio: dal gestionale si possono riscrivere. */
  function legalDefault(kind, c = C()) {
    const k = c.contacts || {};
    const who = [c.companyName, k.address, k.vat].filter(Boolean).join(', ');
    const mail = [k.email, k.pec && `PEC ${k.pec}`].filter(Boolean).join(' oppure ');
    if (kind === 'cookie') {
      return `## Cookie tecnici
Questo sito usa un solo cookie, tecnico: tiene aperto l'accesso all'area clienti e all'area riservata dopo l'ingresso con email e password. Senza questo cookie l'accesso non funzionerebbe; non serve a profilare né a fare pubblicità, e per questo non richiede il consenso.

## Nessun cookie di terze parti
Il sito non usa strumenti di statistica, pubblicità o social network che installano cookie. I caratteri tipografici sono caricati dal sito stesso.

## Link esterni
Il pulsante WhatsApp e i link ai social portano su siti di altre aziende, che hanno le proprie regole su cookie e privacy.

## Come gestire i cookie
Puoi cancellare i cookie dalle impostazioni del browser in qualsiasi momento: dovrai solo rientrare nell'area clienti.`;
    }
    return `## Titolare del trattamento
${who}. Per qualsiasi domanda sui tuoi dati scrivi a ${mail || "l'indirizzo indicato nella pagina Contatti"}.

## Quali dati raccogliamo
Con il modulo di richiesta: nome, telefono, email, comune, informazioni sul progetto e le foto o planimetrie che decidi di allegare.
Nell'area clienti: i dati dell'account creato dallo studio, i documenti del progetto, i messaggi e le approvazioni.

## Perché li usiamo
Per risponderti e preparare un'offerta (misure precontrattuali richieste da te), per svolgere l'incarico e gestire il rapporto con i clienti (esecuzione del contratto) e per rispettare gli obblighi di legge, anche fiscali.

## Per quanto tempo
Le richieste che non diventano un incarico sono cancellate entro 24 mesi dall'ultimo contatto. I dati legati a un incarico si conservano per la durata del rapporto e per il tempo previsto dalla legge per i documenti contabili e fiscali.

## Chi li vede
Solo i professionisti e i collaboratori dello studio e il fornitore che ospita il sito, nominato responsabile del trattamento. I dati non vengono venduti né diffusi.

## I tuoi diritti
Puoi chiedere di vedere, correggere o cancellare i tuoi dati, limitarne l'uso, opporti al trattamento o riceverli in un formato leggibile, scrivendo ai recapiti sopra. Puoi anche presentare reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).`;
  }

  /** Testo semplice: righe "## " come titoletti, righe vuote come paragrafi. */
  const legalHtml = (text) => text.split(/\n\s*\n|\n(?=## )/).map((b) => b.trim()).filter(Boolean)
    .map((b) => (b.startsWith('## ') ? `<h2>${esc(b.slice(3).split('\n')[0])}</h2>${b.includes('\n') ? `<p>${esc(b.slice(b.indexOf('\n') + 1))}</p>` : ''}`
      : `<p>${esc(b)}</p>`)).join('');

  for (const [path, key, title, kicker] of [['/privacy', 'privacyText', 'Informativa\nsulla privacy.', 'Privacy'], ['/cookie', 'cookieText', 'Informativa\nsui cookie.', 'Cookie']]) {
    ARCH.route(path, () => {
      const text = (C()[key] || '').trim() || legalDefault(key === 'cookieText' ? 'cookie' : 'privacy');
      ARCH.page(path, pageHeader({ kicker, title }) + `<section class="section t0"><div class="wrap">${reveal(`<div class="legal-text">${legalHtml(text)}</div>`)}</div></section>`);
    });
  }
  ARCH.legalDefault = legalDefault;

  // Gestionale: si carica solo quando serve.
  let adminLoading = null;
  ARCH.route('/admin', () => ARCH.loadAdmin().then(() => ARCH_ADMIN.render(null, new URLSearchParams())));
  ARCH.route('/admin/:section', ([s], q) => ARCH.loadAdmin().then(() => ARCH_ADMIN.render(s, q)));
  ARCH.loadAdmin = () => {
    if (window.ARCH_ADMIN?.render) return Promise.resolve();
    adminLoading ??= new Promise((resolve, reject) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = window.ARCH_ADMIN.css;
      document.head.appendChild(l);
      const files = window.ARCH_ADMIN.js;
      const next = (i) => {
        if (i >= files.length) return resolve();
        const s = document.createElement('script');
        s.src = files[i];
        s.onload = () => next(i + 1);
        s.onerror = reject;
        document.body.appendChild(s);
      };
      next(0);
    });
    return adminLoading;
  };

  ARCH.coverUrl = coverUrl;
  ARCH.usedCategories = usedCategories;
  ARCH.statusLabel = statusLabel;
  ARCH.kicker = kicker;
})();
