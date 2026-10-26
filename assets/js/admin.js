/* =====================================================================
   Gestionale (/admin): componenti comuni, struttura, accesso, Panoramica,
   Richieste, Calendario, Impostazioni. Le altre sezioni sono in
   admin-pages.js.
   ===================================================================== */
'use strict';

const ADM = (() => {
  const { boot, esc, ms, $, $$, api, ph } = ARCH;
  const A = { D: null, section: null, query: new URLSearchParams() };

  // ============================================================ COMPONENTI

  A.toast = (msg, err = false) => {
    $('.adm-toast')?.remove();
    const t = document.createElement('div');
    t.className = 'adm-toast' + (err ? ' err' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), err ? 6000 : 3000);
  };

  /** Chiamata al server; se l'accesso è scaduto torna alla schermata di accesso. */
  A.call = async (action, body, opts) => {
    try {
      return await api(action, body, opts);
    } catch (e) {
      if (e.status === 401) {
        boot.admin = false;
        A.D = null;
        A.toast(e.message, true);
        A.go();
      }
      throw e;
    }
  };

  /** Finestra di dialogo. actions: [{ label, kind, onClick(close) }] */
  A.dialog = ({ title, body, actions = [], width = 560 }) => {
    const bg = document.createElement('div');
    bg.className = 'dlg-bg adm';
    bg.style.minHeight = '0';
    bg.innerHTML = `<div class="dlg" role="dialog" style="max-width:${width}px">${title ? `<div class="dh">${esc(title)}</div>` : ''}
      <div class="db">${body}</div><div class="df">${actions.map((a, i) => (a.spacer ? '<span class="sp"></span>' : '')
        + `<button class="b ${a.kind || 'text'}" data-act="${i}">${a.html || esc(a.label)}</button>`).join('')}</div></div>`;
    document.body.appendChild(bg);
    const close = () => { bg.remove(); removeEventListener('keydown', key); };
    const key = (e) => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', key);
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) bg.dataset.down = '1'; });
    bg.addEventListener('mouseup', (e) => { if (e.target === bg && bg.dataset.down) close(); delete bg.dataset.down; });
    $$('[data-act]', bg).forEach((b) => (b.onclick = () => (actions[+b.dataset.act].onClick || close)(close, b)));
    const first = $('input, textarea, select', bg);
    if (first && !first.closest('.imgf')) setTimeout(() => first.focus(), 30);
    return { el: bg, close, $: (s) => $(s, bg) };
  };

  A.confirm = (message, { confirm = 'Elimina', title = 'Conferma', danger = true } = {}) => new Promise((resolve) => {
    A.dialog({ title, body: `<p>${esc(message)}</p>`, width: 460, actions: [
      { label: 'Annulla', onClick: (c) => { c(); resolve(false); } },
      { label: confirm, kind: danger ? 'fill" style="background:#B3382A' : 'fill', onClick: (c) => { c(); resolve(true); } },
    ] });
  });

  A.header = (title, subtitle = '', actions = '') => `<div class="ahead"><div class="tx"><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
    ${actions ? `<div class="acts">${actions}</div>` : ''}</div>`;
  A.panel = (title, sub, body, trailing = '') => `<section class="panel">${title ? `<div class="ph-head"><div class="tx"><h2>${esc(title)}</h2>
    ${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>${trailing}</div>` : ''}${body}</section>`;
  A.empty = (icon, msg) => `<div class="empty">${ms(icon)}${esc(msg)}</div>`;
  A.btn = (label, { kind = 'fill', icon = '', attrs = '', sm = false } = {}) =>
    `<button type="button" class="b ${kind} ${sm ? 'sm' : ''}" ${attrs}>${icon ? ms(icon) : ''}${esc(label)}</button>`;

  /** Campo con etichetta. Per i menu: options = [[valore, etichetta]]. */
  A.field = ({ label, name = '', value = '', type = 'text', area = false, rows = 3, help = '', bind = '', options = null, dense = false, attrs = '' }) => {
    const b = bind ? ` data-bind="${esc(bind)}"` : '';
    const n = name ? ` name="${esc(name)}"` : '';
    let input;
    if (options) input = `<select${n}${b} ${attrs}>${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    else if (area) input = `<textarea${n}${b} rows="${rows}" ${attrs}>${esc(value)}</textarea>`;
    else input = `<input${n}${b} type="${type}" value="${esc(value)}" ${attrs}>`;
    return `<label class="af ${options ? 'sel' : ''} ${dense ? 'dense' : ''}">${input}<span class="l">${esc(label)}</span>
      ${help ? `<small class="help">${esc(help)}</small>` : ''}<small class="err"></small></label>`;
  };
  A.setError = (input, msg) => {
    const f = input.closest('.af');
    f.classList.toggle('bad', !!msg);
    $('.err', f).textContent = msg || '';
    return !msg;
  };

  A.getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  A.setPath = (obj, path, v) => {
    const ks = path.split('.');
    const last = ks.pop();
    const o = ks.reduce((x, k) => x[k], obj);
    o[last] = v;
  };
  /** Collega i campi data-bind="percorso" a un oggetto. */
  A.bind = (root, obj, onChange) => {
    $$('[data-bind]', root).forEach((el) => {
      el.addEventListener('input', () => {
        const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
        A.setPath(obj, el.dataset.bind, v);
        onChange?.(el);
      });
    });
  };

  A.sw = (label, checked, { sub = '', attrs = '', disabled = false } = {}) => `<label class="sw"><span><span class="st">${esc(label)}</span>
    ${sub ? `<br><span class="ss">${esc(sub)}</span>` : ''}</span><input type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} ${attrs}></label>`;
  A.chips = (items, isOn, attr) => `<div class="achips">${items.map((it) => {
    const [v, l] = Array.isArray(it) ? it : [it, it];
    return `<button type="button" class="achip ${isOn(v) ? 'on' : ''}" ${attr}="${esc(v)}">${esc(l)}</button>`;
  }).join('')}</div>`;

  // ------------------------------------------------------------ foto
  /** Carica foto sul server; restituisce gli indirizzi. */
  A.uploadImages = async (files) => {
    const fd = new FormData();
    [...files].forEach((f) => fd.append('files[]', f));
    return (await A.call('admin.image', fd)).urls;
  };
  A.pickFiles = ({ accept = 'image/*', multiple = false } = {}) => new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.multiple = multiple;
    i.onchange = () => resolve(i.files);
    i.click();
  });

  /** Anteprima + indirizzo + caricamento dal dispositivo. */
  A.imgField = (label, value, key, aspect = 1.6) => `<div class="imgf" data-img="${esc(key)}" data-aspect="${aspect}"><div class="lab">${esc(label.toUpperCase())}</div>
    <div class="in"><div class="prev" style="aspect-ratio:${aspect}">${ph(value)}</div><div class="ctl">
    ${A.field({ label: String(value).startsWith('data:') ? 'Foto caricata dal dispositivo' : "Oppure incolla l'indirizzo (URL)", value: String(value).startsWith('data:') ? '' : value, dense: true })}
    <div class="achips" style="margin-top:.625rem"><button type="button" class="b fill sm" data-up>${ms('upload')}Carica foto</button>
    <button type="button" class="b text sm" data-rm ${value ? '' : 'hidden'}>Rimuovi</button></div></div></div></div>`;
  /** onChange(key, url) quando cambia una foto. */
  A.bindImages = (root, onChange) => {
    $$('.imgf', root).forEach((box) => {
      const key = box.dataset.img;
      const input = $('input', box);
      const set = (v) => {
        $('.prev', box).innerHTML = ph(v);
        $('[data-rm]', box).hidden = !v;
        onChange(key, v);
      };
      input.addEventListener('input', () => set(input.value.trim()));
      $('[data-rm]', box).onclick = () => { input.value = ''; set(''); };
      $('[data-up]', box).onclick = async (e) => {
        const b = e.currentTarget;
        const files = await A.pickFiles();
        if (!files?.length) return;
        b.disabled = true;
        b.innerHTML = '<span class="spin"></span>Carico…';
        try {
          const [url] = await A.uploadImages(files);
          input.value = url;
          set(url);
        } catch (x) {
          A.toast("Impossibile caricare l'immagine: " + x.message, true);
        } finally {
          b.disabled = false;
          b.innerHTML = ms('upload') + 'Carica foto';
        }
      };
    });
  };

  // ------------------------------------------------------------ elenchi di parole
  A.stringList = (key, items, addLabel = 'Aggiungi') => `<div class="strl" data-strl="${esc(key)}">
    <div class="achips">${items.map((s, i) => `<span class="achip">${esc(s)}<button type="button" class="ms x" data-del="${i}" aria-label="Togli">close</button></span>`).join('')}</div>
    <div style="display:flex;gap:.625rem;margin-top:.875rem;align-items:center"><div style="flex:1">${A.field({ label: addLabel, dense: true })}</div>
    <button type="button" class="b fill" data-add>${ms('add')}Aggiungi</button></div></div>`;
  /** items è l'array da modificare; onChange() dopo ogni modifica. */
  A.bindStringList = (root, key, items, onChange) => {
    const box = $(`[data-strl="${CSS.escape(key)}"]`, root);
    if (!box) return;
    const redraw = () => {
      const n = document.createElement('div');
      n.innerHTML = A.stringList(key, items, $('.l', box).textContent);
      box.replaceWith(n.firstElementChild);
      A.bindStringList(root, key, items, onChange);
    };
    const add = () => {
      const i = $('input', box);
      const v = i.value.trim();
      if (!v || items.includes(v)) return;
      items.push(v);
      onChange();
      redraw();
      $(`[data-strl="${CSS.escape(key)}"] input`, root)?.focus();
    };
    $('[data-add]', box).onclick = add;
    $('input', box).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    $$('[data-del]', box).forEach((b) => (b.onclick = () => { items.splice(+b.dataset.del, 1); onChange(); redraw(); }));
  };

  // ------------------------------------------------------------ riordino trascinando
  /** Righe .lrow con maniglia .drag: onMove(da, a) a fine trascinamento. */
  A.sortable = (list, onMove) => {
    list.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('.drag');
      if (!handle) return;
      e.preventDefault();
      const row = handle.closest('.lrow');
      const rows = [...list.children];
      const from = rows.indexOf(row);
      const y0 = e.clientY;
      row.classList.add('dragging');
      handle.setPointerCapture(e.pointerId);
      let to = from;
      const move = (ev) => {
        const dy = ev.clientY - y0;
        row.style.transform = `translateY(${dy}px)`;
        const mid = row.getBoundingClientRect().top + row.offsetHeight / 2;
        to = from;
        rows.forEach((r, i) => {
          if (r === row) return;
          const rr = r.getBoundingClientRect();
          const c = rr.top + rr.height / 2 - (r.style.transform ? parseFloat(r.style.transform.slice(11)) || 0 : 0);
          if (i > from && mid > c) to = Math.max(to, i);
          if (i < from && mid < c) to = Math.min(to, i);
        });
        rows.forEach((r, i) => {
          if (r === row) return;
          const shift = (i > from && i <= to) ? -row.offsetHeight : (i < from && i >= to) ? row.offsetHeight : 0;
          r.style.transition = 'transform .15s';
          r.style.transform = shift ? `translateY(${shift}px)` : '';
        });
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        rows.forEach((r) => { r.style.transform = ''; r.style.transition = ''; });
        row.classList.remove('dragging');
        if (to !== from) onMove(from, to);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
  };
  A.moveItem = (arr, from, to) => { arr.splice(to, 0, arr.splice(from, 1)[0]); return arr; };

  /** Menu di azioni sotto un pulsante. items: [[etichetta, funzione]] */
  A.menu = (anchor, items) => {
    $('.menu-pop')?.remove();
    const m = document.createElement('div');
    m.className = 'menu-pop';
    m.innerHTML = items.map(([l], i) => `<button data-i="${i}">${esc(l)}</button>`).join('');
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    m.style.top = Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8) + 'px';
    m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px';
    const off = (e) => { if (!m.contains(e.target)) { m.remove(); removeEventListener('mousedown', off, true); } };
    setTimeout(() => addEventListener('mousedown', off, true));
    $$('button', m).forEach((b) => (b.onclick = () => { m.remove(); removeEventListener('mousedown', off, true); items[+b.dataset.i][1](); }));
  };

  /** Riga di un elenco ordinabile (progetti, servizi). */
  A.listRow = ({ index, image, title, subtitle = '', dimmed = false, extra = '', trailing = '', key }) => `<div class="lrow ${dimmed ? 'dim' : ''}" data-row="${index}" data-key="${esc(key)}">
    <span class="drag ms" title="Trascina per riordinare">drag_indicator</span>
    ${image !== null ? `<div class="thumb-a">${ph(image)}</div>` : ''}
    <div class="bd"><div class="tt"><span>${esc(title)}</span>${extra}</div>${subtitle ? `<div class="ss">${esc(subtitle)}</div>` : ''}
      <div class="narrow-acts">${trailing}</div></div>
    <div class="wide-acts">${trailing}<button class="ib" data-edit title="Modifica">${ms('edit')}</button>
      <button class="ib" data-del title="Elimina">${ms('delete')}</button></div>
    <button class="ib narrow-acts" data-more title="Azioni">${ms('more_vert')}</button></div>`;

  /** Barra di salvataggio per le pagine "a bozza". */
  A.saveBar = () => `<div class="savebar" id="savebar"><div class="in"><span class="dotb"></span><span class="tx">Hai modifiche non salvate</span>
    <button class="b text" id="sb-undo">Annulla modifiche</button><button class="b brand" id="sb-save">${ms('check')}Salva</button></div></div>`;

  /** Pagina a bozza: copia dei dati, Salva/Annulla. build(draft) → html; mount(root, draft, dirty) */
  A.draftPage = ({ title, subtitle, source, build, mount, save }) => {
    let draft = structuredClone(source());
    const draw = (root) => {
      root.innerHTML = `<div class="adm-scroll"><div class="adm-inner">${A.header(title, subtitle)}${build(draft)}</div></div>${A.saveBar()}`;
      const dirty = () => $('#savebar', root).classList.add('on');
      mount?.(root, draft, dirty, () => { draw(root); dirty(); });
      A.bind(root, draft, dirty);
      $('#sb-undo', root).onclick = () => { draft = structuredClone(source()); draw(root); };
      $('#sb-save', root).onclick = async (e) => {
        const b = e.currentTarget;
        b.disabled = true;
        try {
          await save(draft);
          A.toast('Modifiche salvate: il sito è aggiornato.');
          draft = structuredClone(source());
          draw(root);
        } catch (x) {
          A.toast(x.message, true);
          b.disabled = false;
        }
      };
    };
    return { raw: true, mount: draw };
  };

  A.saveContent = async (c) => {
    await A.call('admin.content', { value: c });
    A.D.content = structuredClone(c);
    ARCH.setPublic('content', structuredClone(c));
  };

  /** Indirizzo del sito (con eventuali parametri del link). */
  A.siteLink = (path = '/', q = null) =>
    location.origin + ARCH.BASE + ARCH.link(path).replace(/^\.\//, '') + (q ? '?' + new URLSearchParams(q) : '');
  A.copy = async (text, msg = 'Copiato.') => {
    try { await navigator.clipboard.writeText(text); A.toast(msg); } catch { A.toast('Copia non riuscita: seleziona il testo e copialo a mano.', true); }
  };

  const fmtDT = (iso) => new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' alle');
  const fmtD = (iso, o = { day: 'numeric', month: 'short', year: 'numeric' }) => new Date(iso).toLocaleDateString('it-IT', o);
  A.fmtDT = fmtDT;
  A.fmtD = fmtD;

  // ============================================================ STRUTTURA

  const GROUPS = [
    ['Attività', [['panoramica', 'Panoramica', 'space_dashboard'], ['richieste', 'Richieste', 'mark_email_unread'], ['calendario', 'Calendario', 'calendar_month']]],
    ['Area clienti', [['clienti', 'Clienti', 'group'], ['commesse', 'Commesse', 'architecture']]],
    ['Portfolio', [['progetti', 'Progetti', 'apartment'], ['servizi', 'Servizi', 'design_services'], ['testimonianze', 'Testimonianze', 'format_quote']]],
    ['Sito', [['stile', 'Stile e colori', 'palette'], ['home', 'Pagina Home', 'web'], ['studio', 'Lo studio', 'history_edu'], ['contatti', 'Identità e contatti', 'badge']]],
    ['Sistema', [['impostazioni', 'Impostazioni', 'tune']]],
  ];
  const SECTIONS = GROUPS.flatMap(([, s]) => s);
  A.pages = {};

  A.newRequests = () => (A.D?.requests || []).filter((r) => r.status === 'nuova').length;
  A.unreadClient = () => (A.D?.worksites || []).reduce((n, w) => n + w.messages.filter((m) => m.fromClient && !m.read).length, 0);

  function nav(cur) {
    const badge = (id) => {
      const n = id === 'richieste' ? A.newRequests() : id === 'commesse' ? A.unreadClient() : 0;
      return n ? `<span class="badge">${n}</span>` : '';
    };
    return `<aside class="adm-nav"><div class="brand"><a href="admin">${ARCH.logo({ height: '2.375rem', light: true })}</a></div>
      <div class="groups">${GROUPS.map(([g, items]) => `<div class="gl">${esc(g)}</div>${items.map(([id, l, ic]) =>
        `<a class="item ${id === cur ? 'on' : ''}" href="admin/${id}">${ms(ic)}<span>${esc(l)}</span>${badge(id)}</a>`).join('')}`).join('')}</div>
      <div class="foot"><a href="./" target="_blank">${ms('open_in_new')}Vedi il sito</a><button id="logout">${ms('logout')}Esci</button></div></aside>`;
  }

  A.go = () => render(A.section, A.query);

  async function render(section, query) {
    A.section = section;
    A.query = query || new URLSearchParams();
    ARCH.scaffoldSite = false;
    $('#switcher')?.remove();
    $('#wa')?.remove();
    $('#mmenu')?.remove();
    document.body.style.overflow = '';
    document.body.classList.add('admin-mode');
    ARCH.hideSplash();
    const app = $('#app');
    if (!boot.admin) return login(app);
    if (!A.D) {
      app.innerHTML = '<div class="adm" style="display:grid;place-items:center"><span class="spin" style="width:2rem;height:2rem"></span></div>';
      try { A.D = await A.call('admin.all'); } catch (e) { if (e.status !== 401) app.innerHTML = `<div class="adm">${A.empty('error', e.message)}</div>`; return; }
    }
    const cur = SECTIONS.some(([id]) => id === section) ? section : 'panoramica';
    const label = SECTIONS.find(([id]) => id === cur)[1];
    document.title = `${label} · Gestionale ${boot.content.shortName || ''}`.trim();
    app.innerHTML = `<div class="adm"><div class="adm-shell">${nav(cur)}<div class="adm-main">
      <div class="adm-bar"><button class="ib" id="drawer" style="color:#fff" aria-label="Menu">${ms('menu')}</button><span class="t">${esc(label)}</span>
      <a class="ib" href="./" target="_blank" style="color:#fff" aria-label="Vedi il sito">${ms('open_in_new')}</a></div>
      <div id="am" style="flex:1;display:flex;flex-direction:column"></div></div></div></div>`;
    scrollTo(0, 0);
    $('#drawer').onclick = () => {
      const bg = document.createElement('div');
      bg.className = 'adm-drawer-bg';
      const dr = document.createElement('div');
      dr.className = 'adm-drawer adm';
      dr.style.minHeight = '0';
      dr.innerHTML = nav(cur);
      const close = () => { bg.remove(); dr.remove(); };
      bg.onclick = close;
      dr.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
      $('#logout', dr).onclick = logout;
      document.body.append(bg, dr);
    };
    $('#logout').onclick = logout;
    const page = A.pages[cur](A.query);
    const host = $('#am');
    if (page.raw) page.mount(host);
    else {
      host.innerHTML = `<div class="adm-scroll"><div class="adm-inner">${page.html}</div></div>`;
      page.mount?.(host);
    }
  }

  async function logout() {
    try { await api('admin.logout', {}); } catch { /* comunque fuori */ }
    boot.admin = false;
    A.D = null;
    ARCH.go('admin');
    A.go();
  }

  /** Aggiorna il numerino del menu senza ridisegnare la pagina. */
  A.refreshNav = () => {
    const old = $('.adm-shell > .adm-nav');
    if (!old) return;
    const n = document.createElement('div');
    n.innerHTML = nav(A.section && SECTIONS.some(([id]) => id === A.section) ? A.section : 'panoramica');
    old.replaceWith(n.firstElementChild);
    $('#logout').onclick = logout;
  };

  // ================================================================ ACCESSO

  function login(app) {
    const create = boot.adminSetup;
    const cover = (boot.projects.find((p) => p.featured && ARCH.coverUrl(p)) || boot.projects[0]);
    app.innerHTML = `<div class="adm"><div class="login"><div class="poster">${ph(cover ? ARCH.coverUrl(cover) : boot.content.aboutImage, { dark: true })}<div class="veil"></div>
      <div class="mid">${ARCH.logo({ height: innerWidth >= 900 ? '4rem' : '2.75rem', light: true })}<span>AREA RISERVATA</span></div></div>
      <div class="side"><form id="lf" autocomplete="on"><div class="k">${create ? 'PRIMO ACCESSO' : 'AREA RISERVATA'}</div>
      <h1>${create ? 'Scegli la<br>password.' : 'Bentornato.'}</h1>
      <p class="muted-a">${create ? 'Servirà per entrare nella gestione del sito.' : 'Inserisci la password per gestire il sito.'}</p>
      <div class="stack" style="margin-top:1.75rem">
        <label class="af"><input name="pw" type="password" autocomplete="${create ? 'new-password' : 'current-password'}" autofocus>
          <span class="l">${create ? 'Nuova password (min. 8 caratteri)' : 'Password'}</span><button type="button" class="ib suffix" id="eye">${ms('visibility')}</button></label>
        ${create ? '<label class="af"><input name="pw2" type="password" autocomplete="new-password"><span class="l">Ripeti la password</span></label>' : ''}</div>
      <label class="chk" style="margin-top:.375rem"><input type="checkbox" name="remember" checked>Ricordami su questo dispositivo</label>
      <p class="err" style="color:#B3261E;font-size:.875rem;min-height:1.25rem" id="lerr"></p>
      <button class="b fill" style="width:100%;height:3.75rem;border-radius:0;margin-top:.75rem;letter-spacing:.2em;font-size:.75rem">${create ? 'CREA E ENTRA' : 'ENTRA'}</button>
      <div style="text-align:center;margin-top:.875rem"><a class="b text" href="./">${ms('arrow_back')}Torna al sito</a></div></form></div></div></div>`;
    const f = $('#lf');
    $('#eye').onclick = () => {
      const t = f.pw.type === 'password' ? 'text' : 'password';
      f.pw.type = t;
      if (f.pw2) f.pw2.type = t;
      $('#eye').innerHTML = ms(t === 'password' ? 'visibility' : 'visibility_off');
    };
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#lerr');
      err.textContent = '';
      const pw = f.pw.value;
      if (create) {
        if (pw.length < 8) { err.textContent = 'La password deve avere almeno 8 caratteri.'; return; }
        if (pw !== f.pw2.value) { err.textContent = 'Le due password non coincidono.'; return; }
      }
      const b = $('button.fill', f);
      b.disabled = true;
      try {
        await api(create ? 'admin.setup' : 'admin.login', { password: pw, remember: f.remember.checked });
        boot.admin = true;
        boot.adminSetup = false;
        A.go();
      } catch (x) {
        err.textContent = x.message;
        b.disabled = false;
      }
    });
  }

  // ============================================================== PANORAMICA

  A.STATUS = { nuova: 'Nuova', contattata: 'Contattata', incontro: 'Primo incontro', offerta: 'Offerta inviata', acquisita: 'Incarico acquisito', archiviata: 'Archiviata' };
  A.STATUS_COLOR = { nuova: '#C77A12', contattata: '#3B6FB6', incontro: '#8A5BB0', offerta: '#1F8A8A', acquisita: '#2E7D4F', archiviata: '#7A746B' };
  A.statusPill = (s) => `<span class="pill-s" style="color:${A.STATUS_COLOR[s]};background:${A.STATUS_COLOR[s]}1F">${A.STATUS[s]}</span>`;

  /** Appuntamenti futuri (quelli "tutto il giorno" restano fino a sera). */
  A.upcoming = () => {
    const now = new Date();
    return A.D.appointments.filter((a) => {
      const e = new Date(a.end);
      const end = a.allDay ? new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1) : e;
      return end > now;
    }).sort((a, b) => a.start.localeCompare(b.start));
  };

  A.pages.panoramica = () => {
    const D = A.D;
    const nr = A.newRequests();
    const up = A.upcoming();
    const stat = (label, value, icon, href, hl) => `<a class="card stat-a" href="admin/${href}"><span class="ic" style="color:${hl || '#16191C'};background:${hl || '#16191C'}1A">${ms(icon)}</span>
      <span><div class="v">${value}</div><div class="l">${esc(label)}</div></span></a>`;
    const recent = A.panel('Ultime richieste', '', D.requests.length ? D.requests.slice(0, 5).map((r) => `<a class="li" href="admin/richieste"><span class="bd">
      <div class="t1">${esc(r.name)}</div><div class="t2">${esc([r.type, r.city].filter(Boolean).join(' · ') || 'Richiesta')} · ${esc(fmtD(r.createdAt, { day: 'numeric', month: 'short' }))}</div></span>
      ${A.statusPill(r.status)}</a>`).join('') : A.empty('inbox', 'Ancora nessuna richiesta dal sito.'), '<a class="b text" href="admin/richieste">Vedi tutte</a>');
    const next = A.panel('Prossimi appuntamenti', '', up.length ? up.slice(0, 5).map((a) => `<a class="li" href="admin/calendario"><span class="datebox"><b>${new Date(a.start).getDate()}</b>
      <small>${esc(fmtD(a.start, { month: 'short' }).toUpperCase())}</small></span><span class="bd"><div class="t1" style="font-weight:400">${esc(a.title)}</div>
      <div class="t2">${a.allDay ? 'Tutto il giorno' : new Date(a.start).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div></span></a>`).join('')
      : A.empty('event_available', 'Nessun appuntamento in programma.'), '<a class="b text" href="admin/calendario">Apri calendario</a>');
    return {
      html: A.header('Bentornato', 'La situazione di oggi.') + `<div class="stats-a">
        ${stat('Richieste nuove', nr, 'mark_email_unread', 'richieste', nr ? '#C77A12' : '')}
        ${stat('Prossimi appuntamenti', up.length, 'event', 'calendario')}
        ${stat('Progetti pubblicati', D.projects.filter((p) => p.published !== false).length, 'apartment', 'progetti')}
        ${stat('Commesse in corso', D.worksites.filter((w) => w.status === 'inCorso').length, 'architecture', 'commesse')}</div>
        <div class="two">${recent}${next}</div>`,
    };
  };

  // =============================================================== RICHIESTE

  let reqFilter = null;
  let reqSearch = '';
  A.pages.richieste = () => {
    const card = (r) => {
      const appt = A.D.appointments.find((a) => a.id === r.appointmentId);
      const digits = ARCH.phoneDigits(r.phone);
      const kv = [['Intervento', r.type], ['Località', r.city], ['Superficie', r.area ? r.area + ' m²' : ''], ['Budget', r.budget], ['Tempi', r.timing], ['Dal progetto', r.projectRef]]
        .filter(([, v]) => (v || '').trim()).map(([k, v]) => `<div><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('');
      return `<div class="card rq ${r.status === 'nuova' ? 'open' : ''}" data-id="${esc(r.id)}"><div class="rh"><div class="bd"><div class="nm">${esc(r.name)}${A.statusPill(r.status)}</div>
        <div class="sm">${esc([r.type, r.city].filter(Boolean).join(' · '))}${r.type || r.city ? ' · ' : ''}ricevuta il ${esc(fmtDT(r.createdAt))}</div></div>${ms('expand_more')}</div>
        <div class="rb">${kv ? `<div class="kv">${kv}</div>` : ''}
        <div class="achips" style="margin-top:1.125rem"><a class="b out" href="tel:${digits}">${ms('call')}${esc(r.phone)}</a>
          <a class="b out" href="https://wa.me/${digits.replace('+', '')}" target="_blank" rel="noopener">${ms('chat')}WhatsApp</a>
          <a class="b out" href="mailto:${esc(r.email)}">${ms('mail')}${esc(r.email)}</a></div>
        ${r.message ? `<div style="margin-top:1.125rem;font-weight:600">Messaggio del cliente</div><p style="margin-top:.375rem;white-space:pre-wrap">${esc(r.message)}</p>` : ''}
        ${r.photos?.length ? `<div style="margin-top:1.125rem;font-weight:600">Foto e planimetrie</div>
          <div class="thumbs-a" style="margin-top:.5rem">${r.photos.map((u, i) => `<div class="t" data-rph="${i}" style="cursor:zoom-in">${ph(u)}</div>`).join('')}</div>` : ''}
        <div style="margin-top:1.125rem">${A.field({ label: 'Appunti interni (non visibili al cliente)', area: true, rows: 2, value: r.notes, attrs: 'data-notes' })}</div>
        <div class="achips" style="margin-top:1.25rem;align-items:center"><div style="width:13.75rem">${A.field({ label: 'Stato', value: r.status, options: Object.entries(A.STATUS), attrs: 'data-status' })}</div>
          ${appt ? `<a class="b out" href="admin/calendario">${ms('event_available')}Incontro: ${esc(fmtDT(appt.start))}</a>`
            : `<button class="b fill" data-appt>${ms('event')}Fissa un incontro</button>`}
          <button class="b text danger" data-delr>${ms('delete')}Elimina</button></div></div></div>`;
    };
    const draw = (root) => {
      const D = A.D;
      const k = reqSearch.trim().toLowerCase();
      const list = D.requests.filter((r) => !reqFilter || r.status === reqFilter)
        .filter((r) => !k || [r.name, r.phone, r.email, r.city, r.type, r.projectRef].some((x) => (x || '').toLowerCase().includes(k)));
      $('#rqlist', root).innerHTML = list.length ? list.map(card).join('')
        : `<div class="card">${A.empty('inbox', 'Nessuna richiesta qui. Quando un cliente compilerà il modulo contatti la vedrai comparire.')}</div>`;
      $('#rqchips', root).innerHTML = A.chips([['', `Tutte (${D.requests.length})`], ...Object.entries(A.STATUS).map(([s, l]) => [s, `${l} (${D.requests.filter((r) => r.status === s).length})`])],
        (v) => (v || null) === reqFilter, 'data-st');
    };
    const saveReq = async (r) => { await A.call('admin.request', { value: r }); A.refreshNav(); };
    return {
      html: A.header('Richieste', "Chi ha compilato il modulo contatti: richiama, fissa il primo incontro o il sopralluogo e segui l'offerta.")
        + `<div class="search">${ms('search')}<input id="rqs" placeholder="Cerca per nome, telefono, località…" value="${esc(reqSearch)}"></div>
        <div id="rqchips" style="margin:.875rem 0 1.125rem"></div><div id="rqlist"></div>`,
      mount(root) {
        draw(root);
        $('#rqs', root).addEventListener('input', (e) => { reqSearch = e.target.value; draw(root); });
        root.addEventListener('click', async (e) => {
          const st = e.target.closest('[data-st]');
          if (st) { reqFilter = st.dataset.st || null; draw(root); return; }
          const card = e.target.closest('.rq');
          if (!card) return;
          const r = A.D.requests.find((x) => x.id === card.dataset.id);
          const rph = e.target.closest('[data-rph]');
          if (rph) { ARCH.lightbox(r.photos.map((url) => ({ url, caption: '' })), +rph.dataset.rph); return; }
          if (e.target.closest('.rh')) { card.classList.toggle('open'); return; }
          if (e.target.closest('[data-appt]')) { A.appointmentDialog({ request: r, onDone: () => draw(root) }); return; }
          if (e.target.closest('[data-delr]')) {
            if (!(await A.confirm(`Eliminare definitivamente la richiesta di ${r.name}?`))) return;
            await A.call('admin.request.delete', { id: r.id });
            A.D.requests = A.D.requests.filter((x) => x.id !== r.id);
            A.refreshNav();
            draw(root);
          }
        });
        root.addEventListener('change', async (e) => {
          const card = e.target.closest('.rq');
          if (!card || !e.target.matches('[data-status]')) return;
          const r = A.D.requests.find((x) => x.id === card.dataset.id);
          r.status = e.target.value;
          await saveReq(r);
          draw(root);
          $(`.rq[data-id="${CSS.escape(r.id)}"]`, root)?.classList.add('open');
        });
        root.addEventListener('focusout', async (e) => {
          if (!e.target.matches('[data-notes]')) return;
          const r = A.D.requests.find((x) => x.id === e.target.closest('.rq').dataset.id);
          if (r.notes === e.target.value) return;
          r.notes = e.target.value;
          await saveReq(r);
          A.toast('Appunti salvati.');
        });
      },
    };
  };

  // ============================================================== CALENDARIO

  const WEEK = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const dayOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const cal = { month: null, selected: null, google: [], loading: false, error: null, req: 0 };

  A.settings = () => A.D.settings || (A.D.settings = { googleClientId: '', googleWasConnected: false });
  A.saveSettings = () => A.call('admin.settings', { value: A.settings() });

  /** Salva l'appuntamento (e su Google se collegato). Restituisce un avviso o null. */
  A.saveAppointment = async (a) => {
    let warning = null;
    if (GCAL.connected()) {
      try {
        if (!a.googleEventId) a.googleEventId = await GCAL.insert(a);
        else await GCAL.update(a);
      } catch (e) { warning = e.message; }
    } else if (A.settings().googleWasConnected) {
      warning = 'Appuntamento salvato solo qui: ricollega Google Calendar per sincronizzarlo.';
    }
    await A.call('admin.appointment', { value: a });
    const i = A.D.appointments.findIndex((x) => x.id === a.id);
    if (i >= 0) A.D.appointments[i] = a; else A.D.appointments.push(a);
    return warning;
  };
  A.deleteAppointment = async (a) => {
    let warning = null;
    if (a.googleEventId && GCAL.connected()) {
      try { await GCAL.remove(a.googleEventId); } catch (e) { warning = 'Impossibile eliminarlo anche da Google Calendar: ' + e.message; }
    } else if (a.googleEventId) warning = 'Eliminato qui, ma resta su Google Calendar: ricollegalo per rimuoverlo anche lì.';
    await A.call('admin.appointment.delete', { id: a.id });
    A.D.appointments = A.D.appointments.filter((x) => x.id !== a.id);
    for (const r of A.D.requests.filter((x) => x.appointmentId === a.id)) {
      r.appointmentId = null;
      await A.call('admin.request', { value: r });
    }
    return warning;
  };

  const toLocalInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  /** Crea o modifica un appuntamento; con request nasce dal primo incontro con chi ha scritto. */
  A.appointmentDialog = ({ existing = null, day = null, request = null, onDone }) => {
    const e = existing;
    const q = request;
    const d0 = e ? new Date(e.start) : (day || addDays(new Date(), 1));
    const notes = q ? [`Tel: ${q.phone}`, `Email: ${q.email}`, q.type && `Intervento: ${q.type}`, q.area && `Superficie: ${q.area} m²`, q.budget && `Budget: ${q.budget}`, q.timing && `Tempi: ${q.timing}`,
      q.projectRef && `Progetto di riferimento: ${q.projectRef}`, q.message && `Note: ${q.message}`].filter(Boolean).join('\n') : '';
    const linked = A.D.requests.find((r) => r.id === (e?.requestId || q?.id));
    const d = A.dialog({
      title: e ? 'Modifica appuntamento' : 'Nuovo appuntamento', width: 520,
      body: `${linked ? `<div class="codebox" style="margin-bottom:1rem;display:flex;gap:.625rem;align-items:center">${ms('mark_email_unread')}Collegato alla richiesta di ${esc(linked.name)}</div>` : ''}
        <div class="stack">${A.field({ label: 'Titolo *', name: 'title', value: e ? e.title : q ? `Incontro con ${q.name}${q.type ? ' · ' + q.type : ''}` : '' })}
        ${A.field({ label: 'Data', name: 'date', type: 'date', value: toLocalInput(d0) })}
        ${A.sw('Tutto il giorno', e?.allDay, { attrs: 'name="allDay"' })}
        <div class="frow-a" id="times">${A.field({ label: 'Dalle', name: 'from', type: 'time', value: e && !e.allDay ? hm(new Date(e.start)) : '10:00' })}
          ${A.field({ label: 'Alle', name: 'to', type: 'time', value: e && !e.allDay ? hm(new Date(e.end)) : '11:00' })}</div>
        ${A.field({ label: 'Luogo', name: 'location', value: e ? e.location : q?.city || '' })}
        ${A.field({ label: 'Note', name: 'notes', area: true, rows: 4, value: e ? e.notes : notes })}</div>`,
      actions: [
        ...(e ? [{ label: 'Elimina', kind: 'text danger', onClick: async (close) => {
          if (!(await A.confirm('Eliminare questo appuntamento?'))) return;
          const w = await A.deleteAppointment(e);
          close();
          A.toast(w || 'Appuntamento eliminato.', !!w);
          onDone?.();
        } }] : []),
        { label: 'Annulla' },
        { label: 'Salva', kind: 'fill', onClick: async (close, b) => {
          const f = (n) => $(`[name="${n}"]`, d.el);
          if (!f('title').value.trim()) { A.setError(f('title'), 'Inserisci un titolo'); return; }
          const allDay = f('allDay').checked;
          const [y, m, dd] = f('date').value.split('-').map(Number);
          const at = (t) => { const [h, mi] = t.split(':').map(Number); return new Date(y, m - 1, dd, h, mi); };
          const start = allDay ? new Date(y, m - 1, dd) : at(f('from').value || '10:00');
          const end = allDay ? new Date(y, m - 1, dd) : at(f('to').value || '11:00');
          if (!allDay && end <= start) { A.setError(f('to'), "L'orario di fine deve essere dopo l'inizio."); return; }
          b.disabled = true;
          const a = e ? { ...e } : { id: crypto.randomUUID().replace(/-/g, '').slice(0, 20), googleEventId: null, requestId: q?.id || null };
          Object.assign(a, { title: f('title').value.trim(), allDay, start: start.toISOString(), end: end.toISOString(),
            location: f('location').value.trim(), notes: f('notes').value.trim() });
          try {
            const warn = await A.saveAppointment(a);
            if (q && !e) {
              q.appointmentId = a.id;
              if (q.status === 'nuova' || q.status === 'contattata') q.status = 'incontro';
              await A.call('admin.request', { value: q });
              A.refreshNav();
            }
            close();
            A.toast(warn || (GCAL.connected() ? 'Appuntamento salvato e sincronizzato con Google Calendar.' : 'Appuntamento salvato.'), !!warn);
            onDone?.();
          } catch (x) { A.toast(x.message, true); b.disabled = false; }
        } },
      ],
    });
    const times = $('#times', d.el);
    const ad = $('[name="allDay"]', d.el);
    const sync = () => { times.style.display = ad.checked ? 'none' : ''; };
    ad.addEventListener('change', sync);
    sync();
  };

  A.pages.calendario = () => {
    const now = new Date();
    cal.month ??= new Date(now.getFullYear(), now.getMonth(), 1);
    cal.selected ??= dayOnly(now);
    const gridStart = () => { const f = cal.month; return addDays(f, -((f.getDay() + 6) % 7)); };
    const all = () => {
      const linked = new Set(A.D.appointments.map((a) => a.googleEventId).filter(Boolean));
      return [...A.D.appointments, ...cal.google.filter((g) => !linked.has(g.googleEventId))];
    };
    const on = (list, day) => list.filter((a) => {
      const s = dayOnly(new Date(a.start));
      let e = new Date(a.end);
      if (!a.allDay && e > new Date(a.start) && e.getHours() === 0 && e.getMinutes() === 0) e = new Date(e - 60000);
      return day >= s && day <= dayOnly(e);
    }).sort((a, b) => (a.allDay !== b.allDay ? (a.allDay ? -1 : 1) : a.start.localeCompare(b.start)));
    const isG = (a) => String(a.id).startsWith('google:');

    async function loadGoogle(root) {
      const req = ++cal.req;
      if (!GCAL.connected()) { cal.google = []; draw(root); return; }
      cal.loading = true;
      cal.error = null;
      draw(root);
      try {
        const s = gridStart();
        const list = await GCAL.listEvents(s, addDays(s, 42));
        if (req === cal.req) cal.google = list;
      } catch (e) { if (req === cal.req) cal.error = e.message; }
      if (req === cal.req) { cal.loading = false; draw(root); }
    }

    function gbar() {
      const st = A.settings();
      const unsynced = A.D.appointments.filter((a) => !a.googleEventId).length;
      let c;
      if (!(st.googleClientId || '').trim()) {
        c = `${ms('event_available', '" style="color:#4A78C2')}<span class="tx">Per vedere gli appuntamenti su tutti i dispositivi collega il tuo Google Calendar: serve un breve passaggio di configurazione, una sola volta.</span>
          <a class="b fill" href="admin/impostazioni">Configura</a>`;
      } else if (!GCAL.connected()) {
        c = `${ms('event_busy', '" style="color:#4A78C2')}<span class="tx">${st.googleWasConnected ? 'La sessione con Google è scaduta: ricollega il calendario per sincronizzare.' : 'Google Calendar non è ancora collegato.'}</span>
          <button class="b fill" data-gc>${ms('link')}${st.googleWasConnected ? 'Ricollega Google' : 'Collega Google Calendar'}</button>`;
      } else {
        c = `${ms('event_available', '" style="color:#2E7D4F')}<span class="tx" style="font-weight:500">Collegato a Google Calendar${GCAL.calendarName ? ' · ' + esc(GCAL.calendarName) : ''}</span>
          ${unsynced ? `<button class="achip" data-push>${ms('cloud_upload')}Invia ${unsynced} a Google</button>` : ''}
          <button class="b text" data-refresh ${cal.loading ? 'disabled' : ''}>${ms('refresh')}Aggiorna</button><button class="b text" data-gd>Scollega</button>`;
      }
      return `<div class="card gbar">${c}${cal.error ? `<div style="width:100%;color:#B3382A">${esc(cal.error)}</div>` : ''}</div>`;
    }

    function draw(root) {
      const list = all();
      const mobile = innerWidth < 720;
      const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart(), i));
      const title = cal.month.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
      const cell = (d) => {
        const ev = on(list, d);
        const shown = ev.length > 2 ? 1 : ev.length;
        const cls = [d.getMonth() !== cal.month.getMonth() && 'out', sameDay(d, cal.selected) && 'sel', sameDay(d, new Date()) && 'today'].filter(Boolean).join(' ');
        return `<div class="dcell ${cls}" data-day="${d.getTime()}"><span class="dn">${d.getDate()}</span>${mobile
          ? `<div class="dots">${ev.slice(0, 3).map((a) => `<i class="${isG(a) ? 'g' : ''}"></i>`).join('')}</div>`
          : ev.slice(0, shown).map((a) => `<div class="ev ${isG(a) ? 'g' : ''}">${a.allDay ? '' : hm(new Date(a.start)) + ' '}${esc(a.title)}</div>`).join('')
            + (ev.length > shown ? `<div class="more">+${ev.length - shown} altri</div>` : '')}</div>`;
      };
      const evs = on(list, cal.selected);
      const agenda = A.panel(cal.selected.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase()),
        evs.length ? `${evs.length} ${evs.length === 1 ? 'appuntamento' : 'appuntamenti'}` : 'Nessun appuntamento',
        evs.length ? evs.map((a) => `<div class="agenda-ev ${isG(a) ? 'g' : ''}" data-ev="${esc(a.id)}"><div class="h">${a.allDay ? 'Tutto il giorno' : hm(new Date(a.start)) + ' – ' + hm(new Date(a.end))}</div>
          <div class="t">${esc(a.title)}</div>${a.location ? `<div class="p">${ms('place', '" style="font-size:.875rem')}${esc(a.location)}</div>` : ''}
          <div>${a.requestId ? `<span class="mini-tag">${ms('mark_email_unread')}Da richiesta</span>` : ''}${a.googleEventId
            ? `<span class="mini-tag">${ms('event_available')}Google Calendar</span>` : `<span class="mini-tag">${ms('cloud_off')}Solo qui</span>`}</div></div>`).join('')
          : '<p style="text-align:center;color:rgba(0,0,0,.45);padding:1.25rem 0">Giornata libera</p>',
        `<button class="ib" data-new style="background:#E9E7E2" title="Aggiungi">${ms('add')}</button>`);
      $('#calbody', root).innerHTML = gbar() + `<div class="cal-wrap"><div class="card month"><div class="mh"><span class="t">${esc(title.replace(/^./, (c) => c.toUpperCase()))}</span>
        ${cal.loading ? '<span class="spin"></span>' : ''}<button class="b text" data-today>Oggi</button><button class="ib" data-prev>${ms('chevron_left')}</button>
        <button class="ib" data-next>${ms('chevron_right')}</button></div><div class="wd">${WEEK.map((w) => `<span>${w.toUpperCase()}</span>`).join('')}</div>
        <div class="grid">${days.map(cell).join('')}</div></div><div>${agenda}</div></div>`;
    }

    return {
      html: A.header('Calendario', 'Incontri con i clienti, sopralluoghi, riunioni di cantiere e Google Calendar.', A.btn('Nuovo appuntamento', { icon: 'add', attrs: 'data-new' })) + '<div id="calbody"></div>',
      mount(root) {
        draw(root);
        loadGoogle(root);
        root.addEventListener('click', async (e) => {
          const t = e.target;
          const day = t.closest('[data-day]');
          if (day) { cal.selected = new Date(+day.dataset.day); draw(root); return; }
          if (t.closest('[data-prev]') || t.closest('[data-next]')) {
            cal.month = new Date(cal.month.getFullYear(), cal.month.getMonth() + (t.closest('[data-prev]') ? -1 : 1), 1);
            draw(root);
            loadGoogle(root);
            return;
          }
          if (t.closest('[data-today]')) { const n = new Date(); cal.month = new Date(n.getFullYear(), n.getMonth(), 1); cal.selected = dayOnly(n); draw(root); loadGoogle(root); return; }
          if (t.closest('[data-new]')) { A.appointmentDialog({ day: cal.selected, onDone: () => loadGoogle(root) }); return; }
          const ev = t.closest('[data-ev]');
          if (ev) {
            const a = all().find((x) => x.id === ev.dataset.ev);
            if (a) A.appointmentDialog({ existing: a, onDone: () => loadGoogle(root) });
            return;
          }
          if (t.closest('[data-gc]')) { await A.connectGoogle(); loadGoogle(root); return; }
          if (t.closest('[data-refresh]')) { loadGoogle(root); return; }
          if (t.closest('[data-push]')) { await A.pushGoogle(); loadGoogle(root); return; }
          if (t.closest('[data-gd]')) {
            GCAL.disconnect();
            A.settings().googleWasConnected = false;
            await A.saveSettings();
            cal.google = [];
            cal.error = null;
            draw(root);
          }
        });
      },
    };
  };

  A.connectGoogle = async () => {
    try {
      await GCAL.connect(A.settings().googleClientId);
      A.settings().googleWasConnected = true;
      await A.saveSettings();
    } catch (e) {
      A.toast(e.message, true);
      return false;
    }
    A.toast('Google Calendar collegato' + (GCAL.calendarName ? ` (${GCAL.calendarName})` : '') + '.');
    const n = A.D.appointments.filter((a) => !a.googleEventId).length;
    if (n && await A.confirm(`Hai ${n} appuntamenti salvati solo su questo sito. Vuoi inviarli anche a Google Calendar?`,
      { confirm: 'Invia a Google', title: 'Sincronizza appuntamenti', danger: false })) await A.pushGoogle();
    return true;
  };
  A.pushGoogle = async () => {
    let n = 0;
    try {
      for (const a of A.D.appointments.filter((x) => !x.googleEventId)) {
        a.googleEventId = await GCAL.insert(a);
        // Salvato subito: se un invio successivo fallisce, questo non finirà doppio su Google.
        await A.call('admin.appointment', { value: a });
        n++;
      }
      A.toast(n ? `${n} appuntamenti inviati a Google Calendar.` : 'Era già tutto sincronizzato.');
    } catch (e) { A.toast(e.message, true); }
  };

  // ============================================================ IMPOSTAZIONI

  A.pages.impostazioni = () => {
    const st = A.settings();
    const origin = location.origin;
    const step = (n, html) => `<div style="display:flex;gap:.75rem;margin-bottom:.625rem"><span class="datebox" style="width:1.375rem;height:1.375rem;padding:0;border-radius:50%;
      display:grid;place-items:center;background:rgba(0,0,0,.08);font-size:.75rem">${n}</span><div style="flex:1">${html}</div></div>`;
    const google = A.panel('Google Calendar', 'Gli appuntamenti si salvano nel calendario principale del tuo account Google: li vedi su tutti i dispositivi in cui usi Google Calendar.',
      `${GCAL.connected() ? `<p style="display:flex;gap:.625rem;align-items:center;font-weight:600;margin-bottom:1rem">${ms('check_circle', '" style="color:#2E7D4F')}Collegato${GCAL.calendarName ? ' · ' + esc(GCAL.calendarName) : ''}</p>` : ''}
      ${A.field({ label: 'Client ID Google', value: st.googleClientId, attrs: 'id="gcid" placeholder="1234567890-abc…apps.googleusercontent.com"' })}
      <div class="achips" style="margin-top:.875rem"><button class="b fill" id="gconn">${ms('link')}${GCAL.connected() ? 'Ricollega' : 'Salva e collega Google Calendar'}</button>
        <button class="b out" id="gsave">Solo salva</button>${GCAL.connected() ? '<button class="b text" id="gdisc">Scollega</button>' : ''}</div>
      <details style="margin-top:1rem"><summary style="font-weight:600;cursor:pointer;padding:.5rem 0">Come ottenere il Client ID (una sola volta)</summary><div style="padding-top:.5rem">
        ${step(1, 'Apri console.cloud.google.com con il tuo account Google e crea un progetto (es. “Sito Di Stefano”).')}
        ${step(2, 'Da “API e servizi” → “Libreria” cerca “Google Calendar API” e premi Abilita.')}
        ${step(3, 'Da “Schermata consenso OAuth” scegli tipo Esterno, inserisci nome app e la tua email. Tra gli “Utenti di prova” aggiungi il tuo indirizzo Gmail.')}
        ${step(4, `Da “Credenziali” → “Crea credenziali” → “ID client OAuth” scegli “Applicazione web”. In “Origini JavaScript autorizzate” aggiungi esattamente questo indirizzo:
          <div style="display:flex;align-items:center;gap:.5rem;margin-top:.5rem"><code class="codebox" style="padding:.5rem .75rem">${esc(origin)}</code>
          <button class="ib" id="corig" title="Copia">${ms('content_copy')}</button></div><div class="hint" style="margin-top:.375rem">Quando collegherai il dominio aggiungi anche il suo indirizzo (https://…).</div>`)}
        ${step(5, 'Copia il Client ID (finisce con .apps.googleusercontent.com), incollalo qui sopra e premi “Salva e collega”.')}
        <p class="hint">Il collegamento dura circa un'ora: dopo, dal Calendario basta premere “Ricollega Google”. Gli appuntamenti già sincronizzati restano su Google Calendar.</p></div></details>`);
    const pw = A.panel('Password area riservata', '', `<form id="pwf" style="max-width:26.25rem" class="stack">
      ${A.field({ label: 'Password attuale', name: 'old', type: 'password' })}${A.field({ label: 'Nuova password (almeno 8 caratteri)', name: 'new', type: 'password' })}
      ${A.field({ label: 'Ripeti la nuova password', name: 'again', type: 'password' })}<div><button class="b fill">Cambia password</button></div></form>`);
    const data = A.panel('Dati e copie di sicurezza', 'Testi, progetti, richieste, appuntamenti, clienti e commesse sono salvati nel database del sito.',
      `<div class="achips"><a class="b out" href="api.php?a=admin.backup" download>${ms('download')}Scarica la copia di sicurezza</a>
        <button class="b out" id="restore">${ms('restore')}Ripristina da backup</button>
        <button class="b out danger" id="reset">${ms('refresh')}Ripristina contenuti di esempio</button></div>
      <p class="hint" style="margin-top:.875rem">La copia comprende tutti i dati; i documenti caricati per i clienti restano sul server (cartella uploads/files) e vanno salvati a parte.</p>`);
    const mail = A.D.mail || { active: false, to: '' };
    const email = A.panel('Avvisi via email', 'Ti avvisiamo di nuove richieste e messaggi dei clienti; i clienti ricevono un avviso quando pubblichi aggiornamenti, documenti o messaggi.',
      `${mail.active ? `<p style="display:flex;gap:.625rem;align-items:center;font-weight:600">${ms('check_circle', '" style="color:#2E7D4F')}Attivi · gli avvisi per te arrivano a ${esc(mail.to)}</p>`
        : `<p class="muted-a">Non ancora attivi: quando avrai la casella dello studio, inserisci i suoi dati nella sezione <b>email</b> del file <code>inc/config.local.php</code> sul server (le istruzioni sono nel file). Fino ad allora il sito funziona normalmente, senza email.</p>`}
      ${A.sw('Avvisa i clienti via email', st.notifyClients !== false, { sub: 'Aggiornamenti, documenti, messaggi e richieste di approvazione.', attrs: 'id="notify"' })}
      ${mail.active ? `<div style="margin-top:.5rem"><button class="b out" id="mtest">${ms('send')}Invia un'email di prova</button></div>` : ''}`);
    return {
      html: A.header('Impostazioni', 'Google Calendar, email, password e backup.') + google + email + pw + data,
      mount(root) {
        $('#notify', root).addEventListener('change', async (e) => { st.notifyClients = e.target.checked; await A.saveSettings(); A.toast('Impostazione salvata.'); });
        $('#mtest', root)?.addEventListener('click', async (e) => {
          const b = e.currentTarget;
          b.disabled = true;
          try { const r = await A.call('admin.mailtest', {}); A.toast(`Email di prova inviata a ${r.to}.`); } catch (x) { A.toast(x.message, true); }
          b.disabled = false;
        });
        const gcid = $('#gcid', root);
        const saveId = async () => { st.googleClientId = gcid.value.trim(); await A.saveSettings(); };
        $('#gsave', root).onclick = async () => { await saveId(); A.toast('Client ID salvato.'); };
        $('#gconn', root).onclick = async () => { await saveId(); if (await A.connectGoogle()) A.go(); };
        $('#gdisc', root)?.addEventListener('click', async () => { GCAL.disconnect(); st.googleWasConnected = false; await A.saveSettings(); A.go(); });
        $('#corig', root).onclick = () => A.copy(origin, 'Indirizzo copiato.');
        $('#pwf', root).addEventListener('submit', async (e) => {
          e.preventDefault();
          const f = e.target;
          if (f.new.value.length < 8) { A.setError(f.new, 'Almeno 8 caratteri'); return; }
          if (f.new.value !== f.again.value) { A.setError(f.again, 'Le password non coincidono'); return; }
          try {
            await A.call('admin.password', { old: f.old.value, new: f.new.value });
            f.reset();
            A.toast('Password aggiornata.');
          } catch (x) { A.setError(f.old, x.message); }
        });
        $('#restore', root).onclick = () => {
          const d = A.dialog({ title: 'Ripristina da backup', width: 560,
            body: `<p>Scegli il file della copia di sicurezza (oppure incollane il testo). Sostituirà i dati attuali.</p>
              <div class="achips" style="margin:.875rem 0"><button class="b out" id="rfile">${ms('upload_file')}Scegli il file</button></div>
              ${A.field({ label: 'Backup', area: true, rows: 8, attrs: 'id="rtext"' })}`,
            actions: [{ label: 'Annulla' }, { label: 'Ripristina', kind: 'fill', onClick: async (close, b) => {
              let j;
              try { j = JSON.parse($('#rtext', d.el).value); } catch { A.setError($('#rtext', d.el), 'Il testo incollato non è una copia di sicurezza valida.'); return; }
              b.disabled = true;
              try {
                A.D = await A.call('admin.restore', { value: j });
                ['content', 'projects', 'services', 'testimonials', 'look'].forEach((k) => ARCH.setPublic(k, structuredClone(A.D[k])));
                close();
                A.toast('Dati ripristinati.');
                A.go();
              } catch (x) { A.setError($('#rtext', d.el), x.message); b.disabled = false; }
            } }] });
          $('#rfile', d.el).onclick = async () => {
            const files = await A.pickFiles({ accept: '.json,application/json' });
            if (files?.[0]) $('#rtext', d.el).value = await files[0].text();
          };
        };
        $('#reset', root).onclick = async () => {
          if (!(await A.confirm('Ripristinare testi, progetti, servizi e testimonianze ai contenuti di esempio? Richieste, appuntamenti, clienti e commesse non vengono toccati.',
            { confirm: 'Ripristina', title: 'Contenuti di esempio' }))) return;
          A.D = await A.call('admin.reset', {});
          ['content', 'projects', 'services', 'testimonials'].forEach((k) => ARCH.setPublic(k, structuredClone(A.D[k])));
          A.toast('Contenuti di esempio ripristinati.');
          A.go();
        };
      },
    };
  };

  Object.assign(window.ARCH_ADMIN, { render });
  return A;
})();
