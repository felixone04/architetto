/* =====================================================================
   Area clienti: accesso, i miei progetti, scheda della commessa (avanzamento,
   fasi, aggiornamenti, documenti, messaggi). Gli account si creano solo dal
   gestionale.
   ===================================================================== */
'use strict';

(() => {
  const { boot, esc, ms, $, $$, ph, rt, reveal, api, toast, fmtDate } = ARCH;
  const STATUS = { preparazione: 'In avvio', inCorso: 'In corso', sospeso: 'In pausa', completato: 'Concluso' };
  let worksites = null;

  const sizeLabel = (b) => (!b ? '' : b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1) + ' MB');
  function fileIcon(name) {
    const ext = String(name).split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'picture_as_pdf';
    if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) return 'image';
    if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return 'description';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'table_chart';
    if (['dwg', 'dxf', 'ifc', 'rvt', 'skp', 'pln', '3dm'].includes(ext)) return 'architecture';
    return 'draft';
  }
  ARCH.fileIcon = fileIcon;
  ARCH.sizeLabel = sizeLabel;
  ARCH.WORKSITE_STATUS = STATUS;

  /** Una nuvoletta della conversazione (usata anche nel gestionale). */
  ARCH.bubble = (m, mine, otherName = boot.content.companyName) => {
    const when = new Date(m.date).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', ' alle');
    return `<div class="bub ${mine ? 'me' : ''}">${mine ? '' : `<div class="who">${esc(otherName)}</div>`}<div class="tx">${esc(m.text)}</div>
      <div class="wh">${esc(when)}</div></div>`;
  };

  async function load() {
    try {
      worksites = (await api('client.worksites')).worksites;
    } catch (e) {
      if (e.status === 401) { boot.client = null; worksites = null; return false; }
      toast(e.message, true);
      worksites = [];
    }
    return true;
  }

  ARCH.route('/area-clienti', async () => {
    if (!boot.client) return loginPage();
    if (!(await load())) return loginPage();
    dashboard();
  });
  ARCH.route('/area-clienti/:id', async ([id]) => {
    if (!boot.client) return loginPage();
    if (!(await load())) return loginPage();
    const w = worksites.find((x) => x.id === id);
    w ? worksiteView(w) : dashboard();
  });

  // ===================================================================== ACCESSO

  function loginPage() {
    const form = `<form class="box" id="login" style="padding:clamp(1.5rem, calc(1.5rem + (100vw - 22.5rem) * .0129), 2.5rem)">
      <div style="display:grid;gap:.875rem">${ARCH.field('email', 'Email', { type: 'email', auto: 'email' })}
      <label class="field">${'<input name="password" type="password" placeholder=" " autocomplete="current-password">'}<span>Password</span>
        <button type="button" class="eye" aria-label="Mostra">${ms('visibility')}</button></label></div>
      <label class="check mt-s"><input type="checkbox" name="remember" checked><span>Ricordami su questo dispositivo</span></label>
      <p class="formerr" id="lerr"></p>
      <button class="btn big mt-s" type="submit">Entra${ms('lock_open')}</button></form>`;
    const note = `<div><h3 class="serif" style="font-size:1.625rem">Non hai le credenziali?</h3>
      <p class="muted mt-s">L'accesso è riservato a chi ha un incarico in corso con lo studio: quando avviamo il progetto ti mandiamo email e password.
      Se le hai perse, chiamaci o scrivici.</p><div class="mt-s">${ARCH.hl('Contattaci', 'contatti', { arrow: true, style: 'color:var(--accent-deep);font-weight:600' })}</div></div>`;
    ARCH.page('/area-clienti', ARCH.pageHeader({ kicker: 'Area clienti', title: 'Il tuo\nprogetto.',
      text: 'Segui il progetto da vicino: fasi, render e tavole da approvare, documenti da scaricare e un filo diretto con lo studio.' })
      + `<section class="section t0"><div class="wrap">${reveal(`<div class="lgrid">${form}${note}</div>`)}</div></section>`, {
      mount(root) {
        const f = $('#login', root);
        $('.eye', f).onclick = () => {
          const i = f.elements.password;
          i.type = i.type === 'password' ? 'text' : 'password';
          $('.eye', f).innerHTML = ms(i.type === 'password' ? 'visibility' : 'visibility_off');
        };
        f.addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = f.elements.email.value.trim();
          const password = f.elements.password.value;
          const err = $('#lerr', f);
          if (!email || !password) { err.textContent = 'Inserisci email e password.'; return; }
          const b = $('button[type=submit]', f);
          b.classList.add('loading');
          b.innerHTML = 'Entra<span class="spin"></span>';
          try {
            const r = await api('client.login', { email, password, remember: f.elements.remember.checked });
            boot.client = r.client;
            ARCH.render();
          } catch (x) {
            err.textContent = x.message;
            b.classList.remove('loading');
            b.innerHTML = 'Entra' + ms('lock_open');
          }
        });
      },
    });
  }

  // ================================================================ I MIEI PROGETTI

  function progressBar(value, big = false) {
    return `<div class="pbar ${big ? 'big' : ''}" data-value="${value}"><div class="tr"><div class="fi"></div></div>${big ? '' : '<span class="pct">0%</span>'}</div>`;
  }

  function accountActions() {
    return `<div class="row-wrap" style="gap:1.5rem"><button class="hl" id="chpw" style="color:var(--muted);font-weight:600;font-size:.906rem"><span>Cambia password</span></button>
      <button class="hl" id="logout" style="color:var(--muted);font-weight:600;font-size:.906rem"><span>Esci</span></button></div>`;
  }
  function mountAccount(root) {
    $('#chpw', root)?.addEventListener('click', passwordDialog);
    $('#logout', root)?.addEventListener('click', async () => {
      try { await api('client.logout', {}); } catch { /* comunque fuori */ }
      boot.client = null;
      worksites = null;
      ARCH.go('area-clienti');
      ARCH.render();
    });
  }

  function dashboard() {
    const name = boot.client.name.trim();
    const list = worksites || [];
    const cards = list.map((w, i) => {
      const unread = w.messages.filter((m) => !m.fromClient && !m.read).length;
      return reveal(`<a class="wcard" href="area-clienti/${encodeURIComponent(w.id)}"><div class="img">${ph(w.cover)}
        ${unread ? `<span class="pill acc">${unread === 1 ? '1 messaggio nuovo' : unread + ' messaggi nuovi'}</span>` : ''}</div>
        <div class="bd"><div class="t">${esc(w.title)}</div><div class="m">${esc([w.address, STATUS[w.status]].filter(Boolean).join(' · '))}</div>
        ${progressBar(w.progress)}</div></a>`, 100 * (i % 2));
    }).join('');
    ARCH.page('/area-clienti', ARCH.pageHeader({ kicker: 'Area clienti', title: `Ciao,\n${name}.`,
      text: list.length ? 'Ecco i tuoi progetti: tocca una scheda per vedere a che punto siamo.' : 'Qui troverai i tuoi progetti appena li avviamo.',
      bottom: accountActions() })
      + (list.length ? `<section class="section t0"><div class="wrap wcards">${cards}</div></section>` : ''), { mount: mountAccount });
  }

  // ================================================================== PROGETTO

  function chatHtml(w) {
    const msgs = [...w.messages].sort((a, b) => a.date.localeCompare(b.date));
    return (msgs.length ? '' : '<p class="muted" style="margin-bottom:1rem">Scrivici qui per domande, appuntamenti o modifiche: ti rispondiamo nel giro di poco.</p>')
      + msgs.map((m) => ARCH.bubble(m, m.fromClient)).join('')
      + `<form class="send"><textarea rows="1" placeholder="Scrivi un messaggio…" aria-label="Messaggio"></textarea>
        <button class="round-send" type="submit" aria-label="Invia messaggio">${ms('send')}</button></form>`;
  }

  function worksiteView(w) {
    const wide = innerWidth >= 980;
    const block = (title, html, last = false) => `<section class="section t0"${last ? '' : ' style="padding-bottom:clamp(2.5rem, calc(2.5rem + (100vw - 22.5rem) * .0242), 4.375rem)"'}>
      <div class="wrap">${reveal(ARCH.kicker(title))}<div style="margin-top:1.125rem">${html}</div></div></section>`;
    const facts = [['Stato', STATUS[w.status]], ['Avvio', w.start], ['Consegna prevista', w.end]].filter(([, v]) => v)
      .map(([k, v]) => `<span>${esc(k)}<b>${esc(v)}</b></span>`).join('');
    const progress = `<div class="progress-card"><div class="pc"><span class="n" data-count="${w.progress}%">${w.progress}%</span>
      <span class="f">${esc(w.phase ? 'Fase attuale: ' + w.phase : STATUS[w.status])}</span></div>
      <div class="mt-m">${progressBar(w.progress, true)}</div><div class="facts-inline mt-m">${facts}</div></div>`;
    const steps = `<div class="steps">${(w.steps || []).map((s, i, a) => reveal(`<div class="st ${s.done ? 'done' : ''}">
      <div class="rail"><span class="dotc">${s.done ? ms('check') : ''}</span>${i < a.length - 1 ? '<span class="ln"></span>' : ''}</div>
      <div class="body"><h4>${esc(s.title)}</h4>${s.date ? `<small>${esc(s.date)}</small>` : ''}</div></div>`, 60 * i)).join('')}</div>`;
    const updates = [...(w.updates || [])].sort((a, b) => b.date.localeCompare(a.date));
    const files = [...w.files].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    const html = ARCH.pageHeader({ kicker: w.address || 'Il tuo progetto', title: w.title, text: w.description,
      bottom: ARCH.hl('I tuoi progetti', 'area-clienti', { style: 'color:var(--muted);font-weight:600;font-size:.906rem' }) })
      + `<section class="section t0" style="padding-bottom:clamp(2.5rem, calc(2.5rem + (100vw - 22.5rem) * .0242), 4.375rem)"><div class="wrap">${reveal(progress)}</div></section>`
      + ((w.steps || []).length || w.cover
        ? `<section class="section t0" style="padding-bottom:clamp(2.5rem, calc(2.5rem + (100vw - 22.5rem) * .0242), 4.375rem)"><div class="wrap wsplit">
          <div>${reveal(ARCH.kicker('Le fasi'))}<div style="margin-top:1.125rem">${steps}</div></div>
          ${w.cover && wide ? `<div class="wimg">${reveal(ph(w.cover, { cls: 'rounded', attrs: 'style="aspect-ratio:4/3"' }))}</div>` : ''}</div></section>` : '')
      + block('Aggiornamenti', updates.length ? updates.map((u, ui) => reveal(`<div class="ucard"><div class="d">${esc(fmtDate(u.date))}</div>
          <h4>${esc(u.title)}</h4>${u.text ? `<p>${esc(u.text)}</p>` : ''}
          ${u.photos?.length ? `<div class="photos">${u.photos.map((p, pi) => ph(p, { attrs: `data-up="${ui}:${pi}"` })).join('')}</div>` : ''}</div>`)).join('')
        : '<p class="muted">Ancora nessun aggiornamento: arriveranno qui con render, foto e note.</p>')
      + block('Documenti', `<div id="docs">${docsHtml(w)}</div>`)
      + block('Messaggi', `<div class="chat" id="chat">${chatHtml(w)}</div>`, true);
    ARCH.page('/area-clienti', html, {
      mount(root) {
        // Aprendo il progetto i messaggi dello studio risultano letti.
        if (w.messages.some((m) => !m.fromClient && !m.read)) {
          api('client.read', { worksiteId: w.id }).catch(() => {});
          w.messages.forEach((m) => { if (!m.fromClient) m.read = true; });
        }
        root.addEventListener('click', async (e) => {
          const ap = e.target.closest('[data-approve]');
          if (ap) {
            const f = w.files.find((x) => x.id === ap.dataset.approve);
            if (!(await confirmDialog('Approvi il documento?', `Confermi di aver visto «${f.name}» e di approvarlo? Registreremo data e ora dell'approvazione.`, 'Approvo'))) return;
            try {
              const r = await api('client.approve', { worksiteId: w.id, id: f.id });
              Object.assign(w, r.worksite);
              $('#docs', root).innerHTML = docsHtml(w, false);
              toast('Documento approvato: grazie!');
            } catch (x) { toast(x.message, true); }
            return;
          }
          const p = e.target.closest('[data-up]');
          if (!p) return;
          const [ui, pi] = p.dataset.up.split(':').map(Number);
          const u = updates[ui];
          ARCH.lightbox(u.photos.map((url) => ({ url, caption: u.title })), pi);
        });
        bindChat(root, w);
      },
    });
  }

  /** Documenti da scaricare; quelli da approvare hanno il pulsante "Approvo". */
  function docsHtml(w, animate = true) {
    const files = [...w.files].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    if (!files.length) return '<p class="muted">Nessun documento per ora.</p>';
    return files.map((f) => {
      const row = `<a class="frow" href="${esc(f.url)}" ${f.link ? 'target="_blank" rel="noopener"' : 'download'}>
        <span class="fi-ic">${ms(fileIcon(f.name))}</span><span style="flex:1;min-width:0"><div class="nm">${esc(f.name)}</div>
        ${f.note ? `<div class="nt">${esc(f.note)}</div>` : ''}<div class="mt">${esc([fmtDate(f.uploadedAt), sizeLabel(f.size)].filter(Boolean).join(' · '))}</div></span>
        <span class="dl">${ms(f.link ? 'open_in_new' : 'download')}</span></a>`;
      const appr = !f.approvalRequested ? ''
        : f.approvedAt ? `<div class="appr ok">${ms('verified')}<span>Approvato da te il ${esc(fmtDate(f.approvedAt, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}</span></div>`
          : `<div class="appr">${ms('draw')}<span>Ti chiediamo di guardare e approvare questo elaborato.</span>
            <button class="btn" type="button" data-approve="${esc(f.id)}">Approvo${ms('check')}</button></div>`;
      const html = `<div class="fbox">${row}${appr}</div>`;
      return animate ? reveal(html) : html;
    }).join('');
  }

  /** Conferma con lo stile del sito. */
  function confirmDialog(title, text, ok) {
    return new Promise((resolve) => {
      const bg = document.createElement('div');
      bg.className = 'modal-bg';
      bg.innerHTML = `<div class="modal" role="dialog" aria-label="${esc(title)}"><h3>${esc(title)}</h3><p class="muted" style="margin-top:.5rem">${esc(text)}</p>
        <div class="row-wrap mt-m" style="justify-content:flex-end"><button class="btn outline" data-no type="button">Annulla</button>
        <button class="btn" data-yes type="button">${esc(ok)}${ms('check')}</button></div></div>`;
      const close = (v) => { bg.remove(); resolve(v); };
      bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-no]')) close(false); else if (e.target.closest('[data-yes]')) close(true); });
      document.body.appendChild(bg);
    });
  }

  function bindChat(root, w) {
    const chat = $('#chat', root);
    const ta = $('textarea', chat);
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; });
    $('form', chat).addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text) return;
      ta.value = '';
      try {
        const r = await api('client.message', { worksiteId: w.id, text });
        Object.assign(w, r.worksite);
        chat.innerHTML = chatHtml(w);
        bindChat(root, w);
        $('textarea', chat).focus();
      } catch (x) {
        ta.value = text;
        toast(x.message, true);
      }
    });
  }

  // ------------------------------------------------------------ cambio password
  function passwordDialog() {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<form class="modal" role="dialog" aria-label="Cambia password"><h3>Cambia password</h3>
      <div style="display:grid;gap:.75rem">${'<label class="field"><input name="old" type="password" placeholder=" " autocomplete="current-password"><span>Password attuale</span></label>'}
      ${'<label class="field"><input name="new" type="password" placeholder=" " autocomplete="new-password"><span>Nuova password (min. 8 caratteri)</span></label>'}
      ${'<label class="field"><input name="again" type="password" placeholder=" " autocomplete="new-password"><span>Ripeti la nuova</span></label>'}</div>
      <p class="formerr mt-s" id="pwerr"></p>
      <div class="acts"><button type="button" class="hl" id="cancel" style="color:var(--muted);font-weight:600"><span>Annulla</span></button>
      <button class="btn" type="submit">Salva${ms('check')}</button></div></form>`;
    document.body.appendChild(bg);
    const f = $('form', bg);
    const close = () => bg.remove();
    $('#cancel', f).onclick = close;
    bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
    f.elements.old.focus();
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#pwerr', f);
      const n = f.elements.new.value;
      if (n.length < 8) { err.textContent = 'La nuova password deve avere almeno 8 caratteri.'; return; }
      if (n !== f.elements.again.value) { err.textContent = 'Le due password non coincidono.'; return; }
      try {
        await api('client.password', { old: f.elements.old.value, new: n });
        close();
        toast('Password cambiata.');
      } catch (x) {
        err.textContent = x.message;
      }
    });
  }
})();
