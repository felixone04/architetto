/* =====================================================================
   Google Calendar (calendario principale dell'account che fa l'accesso),
   tramite Google Identity Services e le API REST. Il token vive solo in
   memoria: dopo circa un'ora si ricollega con un clic.
   ===================================================================== */
'use strict';

const GCAL = (() => {
  const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
  const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary';
  let token = null;
  let expires = 0;
  let calendarName = null;

  const connected = () => !!token && Date.now() < expires - 60000;

  // Lo script di Google si carica insieme al gestionale (questo file): il sito pubblico non contatta Google.
  if (!document.getElementById('gsi')) {
    const s = document.createElement('script');
    s.id = 'gsi';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    document.head.appendChild(s);
  }

  async function waitGis() {
    for (let i = 0; i < 50; i++) {
      if (window.google?.accounts?.oauth2) return window.google.accounts.oauth2;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('Impossibile caricare Google Identity Services. Controlla la connessione o eventuali blocchi dello script accounts.google.com.');
  }

  /** Va chiamata direttamente dal clic di un pulsante (altrimenti il browser blocca il popup). */
  async function connect(clientId) {
    if (!String(clientId || '').trim()) throw new Error('Manca il Client ID Google: inseriscilo in Impostazioni.');
    const oauth2 = await waitGis();
    const res = await new Promise((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: SCOPE,
        callback: (r) => (r.error ? reject(new Error(r.error_description || r.error)) : resolve(r)),
        error_callback: (e) => reject(new Error(
          e.type === 'popup_closed' ? 'Finestra di accesso chiusa prima del completamento.'
            : e.type === 'popup_failed_to_open' ? 'Il browser ha bloccato la finestra di accesso Google.'
              : `Accesso Google non riuscito (${e.type}).`)),
      });
      client.requestAccessToken({ prompt: '' });
    });
    token = res.access_token;
    expires = Date.now() + (res.expires_in || 3600) * 1000;
    try {
      const r = await get('/events', { maxResults: '1', timeMin: new Date().toISOString() });
      calendarName = r.summary || null;
    } catch { /* il nome è solo informativo */ }
  }

  function disconnect() {
    token = null;
    calendarName = null;
  }

  async function handle(res) {
    if (res.status === 401) { token = null; throw new Error('Sessione Google scaduta: ricollega il calendario.'); }
    if (res.status >= 400) {
      let msg = `Errore Google Calendar (${res.status}).`;
      try { msg = (await res.json()).error?.message || msg; } catch { /* niente */ }
      if (res.status === 403) msg += ' Verifica di aver abilitato "Google Calendar API" nel progetto Google Cloud.';
      throw new Error(msg);
    }
    const t = await res.text();
    return t ? JSON.parse(t) : {};
  }
  function ensure() {
    if (!connected()) { token = null; throw new Error('Sessione Google scaduta: ricollega il calendario.'); }
  }
  const headers = () => ({ Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' });
  async function get(path, q) {
    ensure();
    return handle(await fetch(BASE + path + '?' + new URLSearchParams(q), { headers: headers() }));
  }

  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function body(a) {
    const s = new Date(a.start);
    const day = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    // Fine esclusiva calcolata sul calendario (sicura con l'ora legale).
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    return {
      summary: a.title, location: a.location, description: a.notes,
      start: a.allDay ? { date: ymd(day) } : { dateTime: new Date(a.start).toISOString() },
      end: a.allDay ? { date: ymd(next) } : { dateTime: new Date(a.end).toISOString() },
    };
  }

  async function listEvents(from, to) {
    const out = [];
    let pageToken = null;
    do {
      const q = { timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250' };
      if (pageToken) q.pageToken = pageToken;
      const r = await get('/events', q);
      calendarName ??= r.summary || null;
      for (const e of r.items || []) {
        if (e.status === 'cancelled' || !e.start || !e.end) continue;
        const allDay = !!e.start.date;
        const start = allDay ? new Date(e.start.date + 'T00:00:00') : new Date(e.start.dateTime);
        let end;
        if (allDay) {
          const d = new Date(e.end.date + 'T00:00:00');
          end = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
        } else end = new Date(e.end.dateTime);
        if (end < start) end = start;
        out.push({ id: 'google:' + e.id, title: e.summary || '(senza titolo)', start: start.toISOString(), end: end.toISOString(), allDay,
          location: e.location || '', notes: e.description || '', googleEventId: e.id, requestId: null });
      }
      pageToken = r.nextPageToken || null;
    } while (pageToken);
    return out;
  }

  async function insert(a) {
    ensure();
    return (await handle(await fetch(BASE + '/events', { method: 'POST', headers: headers(), body: JSON.stringify(body(a)) }))).id;
  }
  async function update(a) {
    ensure();
    await handle(await fetch(BASE + '/events/' + encodeURIComponent(a.googleEventId), { method: 'PATCH', headers: headers(), body: JSON.stringify(body(a)) }));
  }
  async function remove(id) {
    ensure();
    const r = await fetch(BASE + '/events/' + encodeURIComponent(id), { method: 'DELETE', headers: headers() });
    if (r.status === 404 || r.status === 410) return;
    await handle(r);
  }

  return { connect, disconnect, connected, listEvents, insert, update, remove, get calendarName() { return calendarName; } };
})();
