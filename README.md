# Lumen Architettura – sito, area clienti e gestionale

Sito di uno studio di architettura e interni con portfolio dei progetti, pagina dei servizi, area clienti riservata e gestionale. Scritto in **HTML, CSS, JavaScript e PHP** (nessun framework, nessuna compilazione), con database **MySQL**: pensato per l'hosting **Hostinger**. Responsive per telefono, tablet, PC e TV.

Nasce dalla stessa struttura del sito M.I.R.O. Costruzioni (stessa logica in tutto), adattata al lavoro di un architetto: i "cantieri" diventano **commesse** (i progetti seguiti per i clienti), le richieste di preventivo diventano richieste di **primo incontro**, i clienti approvano **concept, tavole e render** dalla loro area.

Le funzioni (area clienti, avanzamento, approvazioni, messaggi, gestionale con le stesse pagine) sono quelle di M.I.R.O.; il sito pubblico invece ha **foto e impaginazione proprie**: home essenziale con prima schermata divisa in due (testo e foto), sezioni numerate su righe sottili, portfolio a scacchiera con le categorie in colonna, scheda tecnica fissa accanto al racconto del progetto, galleria a colonne, valori con le lettere di LUMEN, tappe in orizzontale.

Stile sobrio e luminoso: titoli in Fraunces (ultima riga in corsivo colorato), testo in DM Sans, angoli netti su foto e schede, toni carta e terracotta, dissolvenze allo scorrimento. Il nome (Lumen Architettura) e il logo (due archi su una linea di terra) sono **di prova** e si sostituiscono dal gestionale.

| Pagina | Percorso | Cosa contiene |
|---|---|---|
| Home | `/` | Prima schermata con le foto dei progetti in evidenza che si alternano, lo studio in breve con i numeri, tre progetti in evidenza |
| Progetti | `/progetti` | Tutto il portfolio, con filtri discreti per categoria (Residenziale, Interni, Ristrutturazione…) |
| Progetto | `/progetti/<nome>` (es. `/progetti/casa-tra-gli-ulivi`) | Scheda, racconto, "il nostro incarico", confronto prima/dopo da trascinare, galleria a tutto schermo, "Vorrei un progetto simile", progetto successivo |
| Servizi | `/servizi` | Progettazione, interior design, ristrutturazioni, restauro, pratiche, direzione lavori, render: per ognuno descrizione, foto e progetti collegati |
| Studio | `/studio` | Storia, le parole del nome (L·U·M·E·N), tappe, persone, iscrizioni e premi, parole dei clienti |
| Contatti | `/contatti` | Recapiti e richiesta in 4 passi (tipo di intervento, comune, superficie, **budget**, tempi, foto e planimetrie): arriva nel gestionale in "Richieste" |
| Area clienti | `/area-clienti` | Accesso riservato ai clienti: fasi del progetto, avanzamento, aggiornamenti con render e foto, elaborati da approvare, documenti, messaggi |
| Privacy, Cookie | `/privacy`, `/cookie` | Informative, modificabili dal gestionale |
| Gestionale | `/admin` | Gestione di tutto il sito, dei clienti e delle commesse |

Su telefono e tablet un pulsante **WhatsApp** fisso in basso a destra apre la chat con il numero indicato nei contatti, con un primo messaggio già scritto (non compare in Contatti e Area clienti).

## Pubblicazione su Hostinger

1. **Database** – hPanel → *Database* → *Database MySQL*: crea un database e un utente (es. `u123456789_studio`) e annota nome, utente e password.
2. **File** – hPanel → *File Manager* (o FTP): carica in `public_html` `index.php`, `api.php`, `seo.php`, `.htaccess`, `manifest.json` e le cartelle `assets/`, `inc/`, `data/`, `uploads/`. Il file `.htaccess` è nascosto: assicurati che venga copiato, perché fa funzionare gli indirizzi delle pagine (`/progetti/…`).
3. **Credenziali** – in `public_html/inc/` copia `config.local.example.php` come **`config.local.php`** e inserisci i dati del database. Questo file resta solo sul server e non va su GitHub.
4. **PHP** – hPanel → *Avanzate* → *Configurazione PHP*: versione **8.1 o superiore** (estensioni `pdo_mysql` e `gd` attive, lo sono di default). Per caricare tavole e render pesanti alza `upload_max_filesize` e `post_max_size` (es. 25M): il limite del sito è 20 MB per file (`inc/config.php`). Per file più grandi (modelli BIM, video) si usa un link a Google Drive o Dropbox.
5. **Dominio e HTTPS** – collega il dominio in hPanel e attiva il certificato SSL gratuito: `.htaccess` porta automaticamente tutto su `https://`.
6. Apri `https://tuodominio.it/admin`: al **primo accesso** scegli la password del gestionale. Le tabelle (prefisso `arch_`) e i contenuti di esempio si creano da soli alla prima visita.
7. **Google** – da [Google Search Console](https://search.google.com/search-console) aggiungi il dominio e invia la mappa del sito `https://tuodominio.it/sitemap.xml`.
8. **Email** (quando avrai la casella dello studio) – compila la sezione `email` di `inc/config.local.php`: vedi sotto.

Per aggiornare il sito basta ricaricare i file modificati (senza toccare `inc/config.local.php`, `uploads/` e `data/`).

## Google e link condivisi

- Ogni pagina ha un **indirizzo vero** (`/progetti/casa-tra-gli-ulivi`, preso dal titolo del progetto) con titolo e descrizione propri. I vecchi link con `#/` portano comunque alla pagina giusta.
- `/sitemap.xml` elenca tutte le pagine e i progetti pubblicati, `/robots.txt` tiene fuori dai motori di ricerca gestionale e area clienti.
- La pagina contiene la scheda dello studio per Google (dati strutturati *ProfessionalService*: nome, indirizzo, telefono, social).
- Condividendo un link su WhatsApp, Facebook o LinkedIn compaiono **foto, titolo e descrizione** della pagina (per un progetto: la sua copertina).

## Avvisi via email

Le email partono dalla casella dello studio appena se ne inseriscono i dati in `inc/config.local.php` (server di invio, porta, utente, password, mittente: il file di esempio ha i dati dei fornitori più comuni). Finché la sezione è vuota il sito funziona normalmente, senza email.

- **A te**: nuova richiesta dal sito (con intervento, budget, tempi e il pulsante per aprirla), nuovo messaggio di un cliente, elaborato approvato.
- **Al cliente**: nuovo aggiornamento del progetto, nuovi documenti, nuovo messaggio, richiesta di approvazione. Si possono spegnere da Gestionale → Impostazioni → "Avvisa i clienti via email".
- Da Impostazioni, con l'email configurata, il pulsante "Invia un'email di prova" verifica che tutto funzioni.

## Privacy

- Caratteri e icone sono serviti dal sito stesso (`assets/fonts`), lo script di Google si carica solo nel gestionale per il Calendario: il sito pubblico non manda dati dei visitatori a terzi e usa un solo cookie tecnico, quindi **non serve il banner dei cookie**.
- Le pagine **Privacy** e **Cookie** partono da un testo di base compilato con i dati dello studio; si modificano da Gestionale → Identità e contatti → "Privacy e cookie". Il testo di base va **fatto verificare dal proprio consulente**.
- Le foto di esempio arrivano da Unsplash: sostituendole con foto caricate dal gestionale anche loro restano sul sito.

## Anteprima su GitHub Pages

**https://felixone04.github.io/architetto/** mostra il sito con i contenuti di esempio, per vederne la grafica prima che sia su Hostinger. GitHub Pages non esegue PHP: a ogni push su `master` la GitHub Action `.github/workflows/anteprima.yml` lancia `php demo/build.php` e pubblica una copia statica, in cui `demo/demo.js` fa le veci di `api.php` dentro il browser.

- Tutte le pagine, le animazioni e il pulsante "Colori" sono quelli veri.
- Gestionale e area clienti si possono provare, ma i dati restano **solo nel browser di chi li modifica** (al primo accesso a `/admin` si sceglie una password qualsiasi).
- Nell'anteprima i documenti caricati possono essere al massimo di 1 MB.

La cartella `demo/` serve solo all'anteprima: su Hostinger non va caricata (non fa danni se c'è).

## Area clienti

Un canale privato tra lo studio e ogni cliente (privato o azienda).

- **Nessuno può registrarsi dal sito**: gli account li crea solo lo studio in Gestionale → **Clienti**. Alla creazione il gestionale genera una password e prepara il messaggio da mandare al cliente con indirizzo, email e password.
- Ogni cliente vede **solo i propri progetti**. Da Clienti si può sospendere l'accesso, generare una nuova password o eliminare il cliente con le sue commesse.
- In Gestionale → **Commesse**, per ogni progetto:
  - dati, stato e **avanzamento in percentuale**, fase attuale (es. "Progetto definitivo"), foto di copertina;
  - **fasi** da spuntare man mano (rilievo, concept, definitivo, pratica edilizia, esecutivo, direzione lavori, consegna);
  - **aggiornamenti** con testo, render e foto, visibili subito al cliente;
  - **documenti** da scaricare (tavole PDF, render, computi, DWG…, fino a 20 MB l'uno) oppure link a file più grandi (Google Drive, Dropbox), ognuno con una nota;
  - **approvazione degli elaborati**: dal menu di un documento "Chiedi l'approvazione al cliente"; il cliente preme "Approvo" e restano registrati data, ora e indirizzo IP (non è una firma con valore legale, ma documenta cosa ha visto e accettato: utile per concept, varianti e capitolati);
  - **messaggi**: il cliente scrive dalla sua area, tu rispondi da qui. I messaggi non letti compaiono come numero accanto a "Commesse";
  - **Resoconto PDF**: una pagina A4 con dati, avanzamento, fasi, ultimi aggiornamenti con foto e documenti, da stampare o salvare in PDF.
- Il cliente può cambiare la propria password e restare collegato su quel dispositivo per 30 giorni.
- I documenti stanno in `uploads/files`, che non è raggiungibile direttamente: si scaricano solo da `api.php`, dopo aver controllato che la commessa sia del cliente collegato.

**Cliente di prova** (creato al primo avvio, si elimina da Gestionale → Clienti):
email `demo@lumenarchitettura.it`, password `progetto2026`.

## Il pulsante "Colori"

Otto tavolozze, quattro chiare (Carta – bianco caldo con terracotta –, Calce, Salvia, Cemento – grigio chiaro con schede bianche e scritte grigio scuro –) e quattro scure (Grafite, Cotto, Notte, Ardesia – grigio scuro con scritte bianche –), applicate al volo con una dissolvenza. Da Gestionale → **Stile e colori** scegli la predefinita, quali proporre e chi vede il pulsante (tutti, solo con `/?prova=1`, nessuno); il link `/?tema=grafite` apre il sito già con quei colori.

## Gestionale

Al primo accesso (`/admin`, oppure "Area riservata" in fondo al sito) si crea la password. Sezioni:

- **Panoramica**, **Richieste** (dal modulo a passi: tipo di intervento, comune, superficie, budget, tempi, messaggio, foto e planimetrie ed eventuale progetto di riferimento; con stati Nuova → Contattata → Primo incontro → Offerta inviata → Incarico acquisito, e "Fissa un incontro"), **Calendario** (con Google Calendar)
- **Clienti** e **Commesse** – l'area clienti, vedi sopra
- **Progetti**, **Servizi** (con le categorie di progetti da mostrare), **Testimonianze**
- **Stile e colori**, **Pagina Home**, **Lo studio**, **Identità e contatti** (anche i tipi di intervento, i tempi e le fasce di budget proposti nel modulo)
- **Impostazioni** – Client ID Google, password, backup/ripristino in un file JSON (comprende clienti, commesse e messaggi; i documenti caricati restano nella cartella `uploads/files`)

Sicurezza: password cifrate con `password_hash`, sessioni PHP con token CSRF, blocco temporaneo dopo 8 tentativi di accesso sbagliati in 15 minuti, cartelle `inc/`, `data/` e `uploads/files/` chiuse da `.htaccess`.

## Google Calendar

Gli appuntamenti (primi incontri, sopralluoghi, riunioni di cantiere) si scrivono nel calendario principale dell'account Google con cui si fa l'accesso. Serve una sola volta un Client ID OAuth (Gestionale → Impostazioni spiega i passaggi; tra le origini autorizzate va messo l'indirizzo del dominio). Lo scope richiesto è solo `calendar.events`.

## Prova in locale

Serve PHP 8.1+ con `pdo_sqlite` e `gd`. In locale si può usare SQLite al posto di MySQL:

```bash
ARCH_DB=sqlite php -S 127.0.0.1:8096 inc/router-locale.php
```

(su Windows PowerShell: `$env:ARCH_DB='sqlite'; php -S 127.0.0.1:8096 inc/router-locale.php`) e poi apri `http://127.0.0.1:8096`. `inc/router-locale.php` fa in locale quello che su Hostinger fa `.htaccess`. Il database di prova si crea in `data/studio.sqlite`.

## Struttura

```
index.php                pagina unica: dati iniziali, titolo e anteprima di ogni pagina, script
api.php                  tutte le operazioni (sito, area clienti, gestionale)
seo.php                  sitemap.xml e robots.txt
inc/
  config.php             impostazioni (database, email, limiti foto e documenti)
  config.local.example.php   modello per le credenziali di Hostinger e della casella email
  db.php                 tabelle, contenuti, clienti, commesse, documenti, approvazioni
  auth.php               sessioni, accessi, CSRF, tentativi
  funzioni.php           risposte JSON, foto, indirizzi delle pagine, dati per Google
  mail.php               avvisi via email (SMTP)
  router-locale.php      solo per le prove in locale
  seed.json              contenuti di esempio e cliente di prova
assets/
  fonts/                 Fraunces, DM Sans e icone, serviti dal sito
  css/site.css           sito pubblico e area clienti
  css/admin.css          gestionale
  js/core.js             tavolozze, router, intestazione, animazioni, visore foto
  js/site.js             pagine pubbliche
  js/client.js           area clienti
  js/admin.js            gestionale: componenti, accesso, Panoramica, Richieste, Calendario, Impostazioni
  js/admin-pages.js      gestionale: Clienti, Commesse, Progetti, Servizi, Testimonianze, Stile, testi del sito
  js/gcal.js             Google Calendar
  img/                   icone
uploads/img              foto caricate dal gestionale
uploads/files            documenti delle commesse (protetti)
data/                    database SQLite per le prove in locale
demo/                    anteprima statica per GitHub Pages (build.php, demo.js)
.github/workflows/       pubblicazione dell'anteprima
```

I contenuti di esempio (testi, foto Unsplash, contatti, persone e il cliente di prova) vanno sostituiti dal gestionale.
