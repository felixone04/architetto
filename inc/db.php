<?php
/*
 * Database: connessione, tabelle (create da sole al primo avvio) e piccoli
 * aiuti per leggere e scrivere.
 *
 * I contenuti del sito (testi, progetti, servizi, colori…) sono documenti JSON
 * nella tabella "kv", con le stesse chiavi del backup. Richieste, appuntamenti,
 * clienti, commesse, documenti e messaggi hanno tabelle proprie, perché li
 * scrivono più persone (visitatori, clienti, titolare).
 */

function config(): array
{
    static $c = null;
    return $c ??= require __DIR__ . '/config.php';
}

/** Nome completo di una tabella (con il prefisso). */
function t(string $nome): string
{
    return config()['db']['prefisso'] . $nome;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = config()['db'];
    if ($c['driver'] === 'sqlite') {
        $pdo = new PDO('sqlite:' . $c['sqlite']);
        $pdo->exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    } else {
        if ($c['nome'] === '') {
            throw new RuntimeException(
                'Database non configurato: crea inc/config.local.php con i dati di Hostinger.'
            );
        }
        $pdo = new PDO(
            "mysql:host={$c['host']};dbname={$c['nome']};charset=utf8mb4",
            $c['utente'],
            $c['password']
        );
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    crea_tabelle($pdo);
    return $pdo;
}

function crea_tabelle(PDO $pdo): void
{
    $testo = config()['db']['driver'] === 'sqlite' ? 'TEXT' : 'LONGTEXT';
    $tabelle = [
        'kv' => "k VARCHAR(64) PRIMARY KEY, v $testo NOT NULL",
        'richieste' => "id VARCHAR(40) PRIMARY KEY, creata VARCHAR(32) NOT NULL, dati $testo NOT NULL",
        'appuntamenti' => "id VARCHAR(80) PRIMARY KEY, dati $testo NOT NULL",
        'clienti' => "id VARCHAR(40) PRIMARY KEY, email VARCHAR(190) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL, attivo INT NOT NULL DEFAULT 1, dati $testo NOT NULL",
        'commesse' => "id VARCHAR(40) PRIMARY KEY, cliente VARCHAR(40) NOT NULL, dati $testo NOT NULL",
        'documenti' => "id VARCHAR(40) PRIMARY KEY, commessa VARCHAR(40) NOT NULL, nome VARCHAR(255) NOT NULL,
            tipo VARCHAR(120) NOT NULL DEFAULT '', peso INT NOT NULL DEFAULT 0, file VARCHAR(500) NOT NULL,
            link INT NOT NULL DEFAULT 0, nota TEXT, caricato VARCHAR(32) NOT NULL",
        'messaggi' => "id VARCHAR(40) PRIMARY KEY, commessa VARCHAR(40) NOT NULL, dal_cliente INT NOT NULL,
            testo TEXT NOT NULL, data VARCHAR(32) NOT NULL, letto INT NOT NULL DEFAULT 0",
        'tentativi' => "chiave VARCHAR(120) NOT NULL, quando INT NOT NULL",
        // Documenti per cui si chiede l'approvazione del cliente (data vuota = in attesa)
        'approvazioni' => "documento VARCHAR(40) PRIMARY KEY, data VARCHAR(32), ip VARCHAR(64) NOT NULL DEFAULT ''",
    ];
    foreach ($tabelle as $nome => $colonne) {
        $pdo->exec('CREATE TABLE IF NOT EXISTS ' . t($nome) . " ($colonne)");
    }
}

/** Legge un documento JSON salvato con una chiave. */
function kv_get(string $k, $predefinito = null)
{
    $s = db()->prepare('SELECT v FROM ' . t('kv') . ' WHERE k = ?');
    $s->execute([$k]);
    $v = $s->fetchColumn();
    if ($v === false) return $predefinito;
    $d = json_decode($v, true);
    return $d ?? $predefinito;
}

function kv_set(string $k, $valore): void
{
    db()->prepare('REPLACE INTO ' . t('kv') . ' (k, v) VALUES (?, ?)')
        ->execute([$k, json_encode($valore, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
}

/** Id univoco breve. */
function nuovo_id(): string
{
    return base_convert((string) (int) (microtime(true) * 1000), 10, 36) . bin2hex(random_bytes(4));
}

function adesso(): string
{
    return date('c');
}

// ------------------------------------------------------------- primo avvio

/**
 * Al primo avvio carica i contenuti di esempio (inc/seed.json) e il cliente di
 * prova con la sua commessa (un progetto in corso).
 */
function inizializza(): void
{
    if (kv_get('content') !== null) return;
    $seed = json_decode(file_get_contents(__DIR__ . '/seed.json'), true);
    carica_contenuti_esempio($seed);
    kv_set('look', ['defaultTheme' => 'carta', 'hidden' => [], 'switcher' => 'tutti']);

    // Cliente di prova: si elimina dal gestionale.
    $c = $seed['demoClient'];
    $c['createdAt'] = adesso();
    salva_cliente($c, password_hash($seed['demoPassword'], PASSWORD_DEFAULT));
    foreach ($seed['demoWorksites'] as $w) {
        importa_commessa($w);
    }
}

function carica_contenuti_esempio(?array $seed = null): void
{
    $seed ??= json_decode(file_get_contents(__DIR__ . '/seed.json'), true);
    foreach (['content', 'projects', 'services', 'testimonials'] as $k) {
        kv_set($k, $seed[$k]);
    }
}

// ----------------------------------------------------------------- clienti

/** Cliente nel formato usato dal sito (senza password). */
function cliente_pubblico(array $riga): array
{
    $d = json_decode($riga['dati'], true) ?: [];
    return [
        'id' => $riga['id'],
        'name' => $d['name'] ?? '',
        'email' => $riga['email'],
        'phone' => $d['phone'] ?? '',
        'notes' => $d['notes'] ?? '',
        'active' => (bool) $riga['attivo'],
        'createdAt' => $d['createdAt'] ?? null,
        'lastLogin' => $d['lastLogin'] ?? null,
    ];
}

function cliente_da_id(?string $id): ?array
{
    if (!$id) return null;
    $s = db()->prepare('SELECT * FROM ' . t('clienti') . ' WHERE id = ?');
    $s->execute([$id]);
    return $s->fetch() ?: null;
}

function cliente_da_email(string $email): ?array
{
    $s = db()->prepare('SELECT * FROM ' . t('clienti') . ' WHERE email = ?');
    $s->execute([normalizza_email($email)]);
    return $s->fetch() ?: null;
}

function normalizza_email(string $e): string
{
    return mb_strtolower(trim($e));
}

/** Crea o aggiorna un cliente. $password è già cifrata (null = non cambiarla). */
function salva_cliente(array $c, ?string $password = null): void
{
    $dati = json_encode([
        'name' => trim($c['name'] ?? ''),
        'phone' => trim($c['phone'] ?? ''),
        'notes' => trim($c['notes'] ?? ''),
        'createdAt' => $c['createdAt'] ?? adesso(),
        'lastLogin' => $c['lastLogin'] ?? null,
    ], JSON_UNESCAPED_UNICODE);
    $esiste = cliente_da_id($c['id']);
    if ($esiste) {
        $s = db()->prepare('UPDATE ' . t('clienti') . ' SET email = ?, attivo = ?, dati = ?'
            . ($password ? ', password = ?' : '') . ' WHERE id = ?');
        $p = [normalizza_email($c['email']), !empty($c['active']) ? 1 : 0, $dati];
        if ($password) $p[] = $password;
        $p[] = $c['id'];
        $s->execute($p);
    } else {
        db()->prepare('INSERT INTO ' . t('clienti') . ' (id, email, password, attivo, dati) VALUES (?, ?, ?, ?, ?)')
            ->execute([$c['id'], normalizza_email($c['email']), $password ?? '', ($c['active'] ?? true) ? 1 : 0, $dati]);
    }
}

// ---------------------------------------------------------------- commesse

/**
 * Commessa nel formato usato dal sito: dati + documenti + messaggi.
 * $perCliente nasconde l'indirizzo interno dei file.
 */
function commessa_completa(array $riga): array
{
    $w = json_decode($riga['dati'], true) ?: [];
    $w['id'] = $riga['id'];
    $w['clientId'] = $riga['cliente'];
    $s = db()->prepare('SELECT d.*, a.documento AS approvazione, a.data AS approvato FROM ' . t('documenti') . ' d
        LEFT JOIN ' . t('approvazioni') . ' a ON a.documento = d.id WHERE d.commessa = ? ORDER BY d.caricato');
    $s->execute([$riga['id']]);
    $w['files'] = array_map(fn($f) => [
        'approvalRequested' => $f['approvazione'] !== null,
        'approvedAt' => $f['approvato'] ?: null,
        'id' => $f['id'],
        'name' => $f['nome'],
        'mime' => $f['tipo'],
        'size' => (int) $f['peso'],
        'url' => $f['link'] ? $f['file'] : 'api.php?a=file&id=' . rawurlencode($f['id']),
        'link' => (bool) $f['link'],
        'note' => $f['nota'] ?? '',
        'uploadedAt' => $f['caricato'],
    ], $s->fetchAll());
    $s = db()->prepare('SELECT * FROM ' . t('messaggi') . ' WHERE commessa = ? ORDER BY data');
    $s->execute([$riga['id']]);
    $w['messages'] = array_map(fn($m) => [
        'id' => $m['id'],
        'fromClient' => (bool) $m['dal_cliente'],
        'text' => $m['testo'],
        'date' => $m['data'],
        'read' => (bool) $m['letto'],
    ], $s->fetchAll());
    return $w;
}

function commessa_da_id(?string $id): ?array
{
    if (!$id) return null;
    $s = db()->prepare('SELECT * FROM ' . t('commesse') . ' WHERE id = ?');
    $s->execute([$id]);
    return $s->fetch() ?: null;
}

/** Salva i dati della commessa (non documenti e messaggi, che hanno tabelle loro). */
function salva_commessa(array $w): void
{
    $id = $w['id'];
    $cliente = $w['clientId'];
    unset($w['id'], $w['clientId'], $w['files'], $w['messages']);
    $dati = json_encode($w, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (commessa_da_id($id)) {
        db()->prepare('UPDATE ' . t('commesse') . ' SET cliente = ?, dati = ? WHERE id = ?')->execute([$cliente, $dati, $id]);
    } else {
        db()->prepare('INSERT INTO ' . t('commesse') . ' (id, cliente, dati) VALUES (?, ?, ?)')->execute([$id, $cliente, $dati]);
    }
}

function elimina_commessa(string $id): void
{
    $s = db()->prepare('SELECT id, file, link FROM ' . t('documenti') . ' WHERE commessa = ?');
    $s->execute([$id]);
    foreach ($s->fetchAll() as $f) {
        if (!$f['link']) @unlink(cartella_documenti() . '/' . basename($f['file']));
        db()->prepare('DELETE FROM ' . t('approvazioni') . ' WHERE documento = ?')->execute([$f['id']]);
    }
    foreach (['documenti' => 'commessa', 'messaggi' => 'commessa', 'commesse' => 'id'] as $tab => $col) {
        db()->prepare('DELETE FROM ' . t($tab) . " WHERE $col = ?")->execute([$id]);
    }
}

/**
 * Importa una commessa in formato backup: i documenti incorporati (data URL)
 * diventano file sul server.
 */
function importa_commessa(array $w): void
{
    $files = $w['files'] ?? [];
    $messages = $w['messages'] ?? [];
    salva_commessa($w);
    foreach ($files as $f) {
        $dati = $f['data'] ?? ($f['url'] ?? '');
        if (str_starts_with($dati, 'data:')) {
            $contenuto = base64_decode(substr($dati, strpos($dati, ',') + 1));
            $nomeFile = salva_documento($contenuto);
            $link = 0;
        } else {
            $nomeFile = $dati;
            $link = 1;
        }
        $id = $f['id'] ?? nuovo_id();
        db()->prepare('INSERT INTO ' . t('documenti') . ' (id, commessa, nome, tipo, peso, file, link, nota, caricato) VALUES (?,?,?,?,?,?,?,?,?)')
            ->execute([$id, $w['id'], $f['name'] ?? 'documento', $f['mime'] ?? '',
                (int) ($f['size'] ?? 0), $nomeFile, $link, $f['note'] ?? '', $f['uploadedAt'] ?? adesso()]);
        if (!empty($f['approvalRequested'])) {
            db()->prepare('REPLACE INTO ' . t('approvazioni') . ' (documento, data, ip) VALUES (?, ?, ?)')->execute([$id, $f['approvedAt'] ?? null, '']);
        }
    }
    foreach ($messages as $m) {
        db()->prepare('INSERT INTO ' . t('messaggi') . ' (id, commessa, dal_cliente, testo, data, letto) VALUES (?,?,?,?,?,?)')
            ->execute([$m['id'] ?? nuovo_id(), $w['id'], !empty($m['fromClient']) ? 1 : 0, $m['text'] ?? '',
                $m['date'] ?? adesso(), !empty($m['read']) ? 1 : 0]);
    }
}

// ----------------------------------------------------------------- file

function cartella_documenti(): string
{
    return __DIR__ . '/../uploads/files';
}

/** Salva il contenuto di un documento con un nome casuale; restituisce il nome. */
function salva_documento(string $contenuto): string
{
    $nome = date('Ym') . '-' . bin2hex(random_bytes(12)) . '.bin';
    file_put_contents(cartella_documenti() . '/' . $nome, $contenuto);
    return $nome;
}
