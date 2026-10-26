/* =====================================================================
   Anteprima statica (GitHub Pages): fa le veci di api.php dentro il
   browser. I dati partono dai contenuti di esempio (window.__SEED__) e si
   salvano nel localStorage di chi visita: ognuno ha la sua copia, nessuno
   vede le modifiche degli altri. Il sito vero (Hostinger) usa api.php.
   ===================================================================== */
'use strict';

(() => {
  const KEY = 'arch-anteprima-v3';
  const seed = window.__SEED__;
  const now = () => new Date().toISOString();
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clone = (x) => structuredClone(x);

  // ------------------------------------------------------------ dati

  function fresh() {
    const files = (w) => (w.files || []).map((f) => {
      const data = f.data || f.url || '';
      const link = !data.startsWith('data:');
      return { id: f.id || newId(), name: f.name || 'documento', mime: f.mime || '', size: f.size || 0, url: data, link, note: f.note || '', uploadedAt: f.uploadedAt || now(),
        approvalRequested: !!f.approvalRequested, approvedAt: f.approvedAt || null };
    });
    return {
      content: clone(seed.content), projects: clone(seed.projects), services: clone(seed.services), testimonials: clone(seed.testimonials),
      look: { defaultTheme: 'carta', hidden: [], switcher: 'tutti' },
      settings: { googleClientId: '', googleWasConnected: false },
      requests: [], appointments: [],
      clients: [{ ...publicClient(seed.demoClient), createdAt: now(), password: seed.demoPassword }],
      worksites: seed.demoWorksites.map((w) => ({ ...clone(w), files: files(w), messages: clone(w.messages || []) })),
      adminPassword: null, admin: false, clientId: null,
    };
  }

  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch { S = fresh(); }
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {
      throw fail('Spazio del browser esaurito: in anteprima foto e documenti restano nel browser. Elimina qualche file o ripristina i contenuti di esempio.', 507);
    }
  };

  function publicClient(c) {
    return { id: c.id, name: c.name || '', email: (c.email || '').trim().toLowerCase(), phone: c.phone || '', notes: c.notes || '',
      active: c.active !== false, createdAt: c.createdAt || null, lastLogin: c.lastLogin || null };
  }
  const client = (id) => S.clients.find((c) => c.id === id);
  const worksite = (id) => S.worksites.find((w) => w.id === id);
  const currentClient = () => { const c = client(S.clientId); return c && c.active ? c : null; };

  function boot() {
    const c = currentClient();
    return {
      csrf: 'anteprima', content: S.content,
      projects: S.projects.filter((p) => p.published !== false),
      services: S.services.filter((s) => s.active !== false),
      testimonials: S.testimonials.filter((t) => t.published !== false),
      look: S.look, client: c ? publicClient(c) : null, admin: S.admin, adminSetup: !S.adminPassword,
    };
  }

  function allData(backup) {
    const d = {
      version: 2, content: S.content, projects: S.projects, services: S.services, testimonials: S.testimonials,
      requests: [...S.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), appointments: S.appointments, look: S.look,
      clients: S.clients.map(publicClient), worksites: S.worksites,
    };
    if (!backup) { d.settings = S.settings; d.mail = { active: false, to: '' }; }
    return clone(d);
  }

  // ------------------------------------------------------------ file

  const readAsDataUrl = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(fail('Impossibile leggere il file.'));
    r.readAsDataURL(file);
  });

  /** Foto ridimensionata (lato lungo 1600 px) per stare nello spazio del browser. */
  async function photo(file) {
    const src = await readAsDataUrl(file);
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(fail('Il file non è una foto valida.', 422)); img.src = src; });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * k);
    cv.height = Math.round(img.naturalHeight * k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.82);
  }

  // ------------------------------------------------------------ risposte

  function fail(msg, status = 422) {
    const e = new Error(msg);
    e.status = status;
    return e;
  }
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const needClient = () => { const c = currentClient(); if (!c) throw fail('Accesso scaduto: entra di nuovo.', 401); return c; };
  const clientWorksite = (id) => {
    const c = needClient();
    const w = worksite(id);
    if (!w || w.clientId !== c.id) throw fail('Commessa non trovata.', 404);
    return w;
  };
  const adminWorksite = (id) => { const w = worksite(id); if (!w) throw fail('Commessa non trovata.', 404); return w; };
  const message = (w, text, fromClient) => {
    text = String(text || '').trim();
    if (!text) throw fail('Scrivi un messaggio.');
    w.messages.push({ id: newId(), fromClient, text: text.slice(0, 4000), date: now(), read: false });
  };

  const DOCS = { 'admin.content': 'content', 'admin.projects': 'projects', 'admin.services': 'services',
    'admin.testimonials': 'testimonials', 'admin.look': 'look', 'admin.settings': 'settings' };

  async function handle(a, b, form) {
    switch (a) {
      case 'boot': return boot();
      case 'contact': {
        // Il modulo a passi arriva come FormData (con le foto), quello vecchio come JSON.
        const v = form ? Object.fromEntries([...form.entries()].filter(([, x]) => typeof x === 'string')) : b;
        const t = (k) => String(v[k] || '').trim();
        if (t('website')) return { ok: true };
        if (!t('name') || !t('phone') || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t('email')) || !v.privacy) throw fail('Controlla i campi obbligatori.');
        const photos = form ? await Promise.all(form.getAll('photos[]').slice(0, 6).map(readAsDataUrl)) : [];
        S.requests.push({ id: newId(), createdAt: now(), name: t('name'), phone: t('phone'), email: t('email'), city: t('city'), type: t('type'),
          timing: t('timing'), area: t('area'), budget: t('budget'), message: t('message'), projectRef: t('projectRef'), photos, status: 'nuova', appointmentId: null, notes: '' });
        return { ok: true };
      }

      // -------------------------------------------------- area clienti
      case 'client.login': {
        const c = S.clients.find((x) => x.email === String(b.email || '').trim().toLowerCase());
        if (!c || c.password !== b.password) throw fail('Email o password non corrette.', 401);
        if (!c.active) throw fail("Questo accesso è stato sospeso: contatta lo studio.", 403);
        c.lastLogin = now();
        S.clientId = c.id;
        return { client: publicClient(c), csrf: 'anteprima' };
      }
      case 'client.logout': S.clientId = null; return { ok: true };
      case 'client.worksites': { const c = needClient(); return { worksites: clone(S.worksites.filter((w) => w.clientId === c.id)) }; }
      case 'client.message': { const w = clientWorksite(b.worksiteId); message(w, b.text, true); return { worksite: clone(w) }; }
      case 'client.read': clientWorksite(b.worksiteId).messages.forEach((m) => { if (!m.fromClient) m.read = true; }); return { ok: true };
      case 'client.approve': {
        const w = clientWorksite(b.worksiteId);
        const f = w.files.find((x) => x.id === b.id && x.approvalRequested);
        if (!f) throw fail('Documento non trovato.', 404);
        f.approvedAt ||= now();
        return { worksite: clone(w) };
      }
      case 'client.password': {
        const c = needClient();
        if (c.password !== b.old) throw fail('La password attuale non è corretta.');
        if (String(b.new || '').length < 8) throw fail('La nuova password deve avere almeno 8 caratteri.');
        c.password = b.new;
        return { ok: true };
      }

      // -------------------------------------------------- accesso al gestionale
      case 'admin.setup':
        if (S.adminPassword) throw fail('La password esiste già.', 409);
        if (String(b.password || '').length < 8) throw fail('La password deve avere almeno 8 caratteri.');
        S.adminPassword = b.password;
        S.admin = true;
        return { ok: true, csrf: 'anteprima' };
      case 'admin.login':
        if (!S.adminPassword || b.password !== S.adminPassword) throw fail('Password non corretta.', 401);
        S.admin = true;
        return { ok: true, csrf: 'anteprima' };
      case 'admin.logout': S.admin = false; return { ok: true };
    }

    if (!a.startsWith('admin.')) throw fail('Azione sconosciuta.', 404);
    if (!S.admin) throw fail('Accesso scaduto: entra di nuovo.', 401);

    if (DOCS[a]) {
      if (!b.value || typeof b.value !== 'object') throw fail('Dati non validi.');
      S[DOCS[a]] = clone(b.value);
      return { ok: true };
    }

    switch (a) {
      case 'admin.all': return allData(false);
      case 'admin.password':
        if (b.old !== S.adminPassword) throw fail('Password attuale non corretta.');
        if (String(b.new || '').length < 8) throw fail('Almeno 8 caratteri.');
        S.adminPassword = b.new;
        return { ok: true };
      case 'admin.image': return { urls: await Promise.all(form.getAll('files[]').map(photo)) };

      case 'admin.request': {
        const i = S.requests.findIndex((r) => r.id === b.value.id);
        if (i >= 0) S.requests[i] = clone(b.value); else S.requests.push(clone(b.value));
        return { ok: true };
      }
      case 'admin.request.delete': S.requests = S.requests.filter((r) => r.id !== b.id); return { ok: true };
      case 'admin.appointment': {
        const i = S.appointments.findIndex((x) => x.id === b.value.id);
        if (i >= 0) S.appointments[i] = clone(b.value); else S.appointments.push(clone(b.value));
        return { ok: true };
      }
      case 'admin.appointment.delete': S.appointments = S.appointments.filter((x) => x.id !== b.id); return { ok: true };

      case 'admin.client': {
        const v = b.value || {};
        const email = String(v.email || '').trim().toLowerCase();
        if (!String(v.name || '').trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw fail('Nome ed email sono obbligatori.');
        if (S.clients.some((c) => c.email === email && c.id !== v.id)) throw fail('Email già usata da un altro cliente.', 409);
        let c = v.id && client(v.id);
        const pw = String(b.password || '');
        if (!c && pw.length < 8) throw fail('La password deve avere almeno 8 caratteri.');
        if (!c) { c = { id: v.id || newId(), createdAt: now(), lastLogin: null, password: pw }; S.clients.push(c); }
        Object.assign(c, { name: v.name.trim(), email, phone: v.phone || '', notes: v.notes || '', active: v.active !== false });
        if (pw) c.password = pw;
        return { client: publicClient(c) };
      }
      case 'admin.client.delete':
        S.worksites = S.worksites.filter((w) => w.clientId !== b.id);
        S.clients = S.clients.filter((c) => c.id !== b.id);
        return { ok: true };

      case 'admin.worksite': {
        const v = b.value || {};
        if (!v.id || !client(v.clientId)) throw fail('Scegli il cliente della commessa.');
        const old = worksite(v.id);
        const w = { ...clone(v), files: old?.files || [], messages: old?.messages || [] };
        if (old) S.worksites[S.worksites.indexOf(old)] = w; else S.worksites.push(w);
        return { worksite: clone(w) };
      }
      case 'admin.worksite.delete': S.worksites = S.worksites.filter((w) => w.id !== b.id); return { ok: true };
      case 'admin.file.upload': {
        const w = adminWorksite(form.get('worksiteId'));
        const skipped = [];
        for (const f of form.getAll('files[]')) {
          if (f.size > 1024 * 1024) { skipped.push(f.name); continue; } // l'anteprima tiene tutto nel browser
          w.files.push({ id: newId(), name: f.name, mime: f.type, size: f.size, url: await readAsDataUrl(f), link: false, note: '', uploadedAt: now() });
        }
        return { worksite: clone(w), skipped };
      }
      case 'admin.file.link': {
        const w = adminWorksite(b.worksiteId);
        const url = String(b.url || '').trim();
        if (!/^https?:\/\//i.test(url)) throw fail('Inserisci un link che inizi con https://');
        w.files.push({ id: newId(), name: String(b.name || '').trim() || 'Documento', mime: '', size: 0, url, link: true, note: '', uploadedAt: now() });
        return { worksite: clone(w) };
      }
      case 'admin.file.note': {
        const w = adminWorksite(b.worksiteId);
        const f = w.files.find((x) => x.id === b.id);
        if (f) f.note = String(b.note || '').trim();
        return { worksite: clone(w) };
      }
      case 'admin.file.approval': {
        const w = adminWorksite(b.worksiteId);
        const f = w.files.find((x) => x.id === b.id);
        if (f) Object.assign(f, b.on ? { approvalRequested: true } : { approvalRequested: false, approvedAt: null });
        return { worksite: clone(w) };
      }
      case 'admin.mailtest': throw fail("Nell'anteprima le email non partono: si attivano sul sito vero, con la casella dello studio.");
      case 'admin.file.delete': { const w = adminWorksite(b.worksiteId); w.files = w.files.filter((x) => x.id !== b.id); return { worksite: clone(w) }; }
      case 'admin.message': { const w = adminWorksite(b.worksiteId); message(w, b.text, false); return { worksite: clone(w) }; }
      case 'admin.read': adminWorksite(b.worksiteId).messages.forEach((m) => { if (m.fromClient) m.read = true; }); return { ok: true };

      case 'admin.restore': {
        const j = b.value;
        if (!j || typeof j.content !== 'object') throw fail('Il testo incollato non è una copia di sicurezza valida.');
        ['content', 'projects', 'services', 'testimonials', 'look', 'requests', 'appointments', 'worksites'].forEach((k) => { if (Array.isArray(j[k]) || (j[k] && typeof j[k] === 'object')) S[k] = clone(j[k]); });
        if (Array.isArray(j.clients)) S.clients = j.clients.map((c) => ({ ...publicClient(c), password: c.password || '' }));
        return allData(false);
      }
      case 'admin.reset':
        Object.assign(S, { content: clone(seed.content), projects: clone(seed.projects), services: clone(seed.services), testimonials: clone(seed.testimonials) });
        return allData(false);
    }
    throw fail('Azione sconosciuta.', 404);
  }

  // ------------------------------------------------------------ aggancio

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith('api.php')) return realFetch(input, init);
    const a = new URLSearchParams(url.split('?')[1] || '').get('a') || '';
    const form = init.body instanceof FormData ? init.body : null;
    let body = {};
    if (typeof init.body === 'string') { try { body = JSON.parse(init.body); } catch { /* corpo vuoto */ } }
    try {
      const data = await handle(a, body, form);
      save();
      return json(data);
    } catch (e) {
      return json({ errore: e.message }, e.status || 500);
    }
  };

  // La copia di sicurezza è un link da scaricare: qui la prepara il browser.
  document.addEventListener('click', (e) => {
    const l = e.target.closest?.('a[href^="api.php?a=admin.backup"]');
    if (!l) return;
    e.preventDefault();
    const blob = new Blob([JSON.stringify({ ...allData(true), clients: S.clients.map((c) => ({ ...publicClient(c), password: c.password })) }, null, 2)], { type: 'application/json' });
    const tmp = document.createElement('a');
    tmp.href = URL.createObjectURL(blob);
    tmp.download = `studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    tmp.click();
    setTimeout(() => URL.revokeObjectURL(tmp.href), 1000);
  }, true);

  window.__BOOT__ = boot();
})();
