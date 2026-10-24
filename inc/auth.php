<?php
/*
 * Sessioni e accessi: il titolare (gestionale) e i clienti (area clienti)
 * hanno accessi separati nella stessa sessione del browser.
 */

const DURATA_RICORDAMI = 30 * 24 * 3600;

function avvia_sessione(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = ($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    ini_set('session.gc_maxlifetime', (string) DURATA_RICORDAMI);
    session_name('ARCHSESS');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => percorso_base(),
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(24));
    // Accessi "ricordami" scaduti.
    foreach (['admin', 'cliente'] as $k) {
        if (isset($_SESSION[$k . '_fino']) && $_SESSION[$k . '_fino'] < time()) {
            unset($_SESSION[$k], $_SESSION[$k . '_fino']);
        }
    }
}

/** Cartella del sito sul server (es. "/" o "/studio/"): il cookie vale solo lì. */
function percorso_base(): string
{
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    return $dir . '/';
}

/** Mantiene l'accesso per 30 giorni (o fino alla chiusura del browser). */
function ricorda(string $chi, bool $ricorda): void
{
    session_regenerate_id(true);
    $_SESSION[$chi . '_fino'] = time() + ($ricorda ? DURATA_RICORDAMI : 8 * 3600);
    if ($ricorda) {
        $p = session_get_cookie_params();
        setcookie(session_name(), session_id(), [
            'expires' => time() + DURATA_RICORDAMI,
            'path' => $p['path'],
            'secure' => $p['secure'],
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
}

function csrf(): string
{
    return $_SESSION['csrf'];
}

function controlla_csrf(): void
{
    $t = $_SERVER['HTTP_X_CSRF'] ?? ($_POST['csrf'] ?? '');
    if (!hash_equals($_SESSION['csrf'] ?? '', (string) $t)) {
        rispondi(['errore' => 'Sessione scaduta: ricarica la pagina.'], 419);
    }
}

// ----------------------------------------------------- tentativi di accesso

/** Blocca chi sbaglia troppe volte di fila (8 tentativi in 15 minuti). */
function controlla_tentativi(string $tipo, string $messaggio = 'Troppi tentativi sbagliati: riprova tra qualche minuto.'): void
{
    $chiave = $tipo . ':' . ($_SERVER['REMOTE_ADDR'] ?? '');
    db()->prepare('DELETE FROM ' . t('tentativi') . ' WHERE quando < ?')->execute([time() - 900]);
    $s = db()->prepare('SELECT COUNT(*) FROM ' . t('tentativi') . ' WHERE chiave = ?');
    $s->execute([$chiave]);
    if ((int) $s->fetchColumn() >= 8) {
        rispondi(['errore' => $messaggio], 429);
    }
}

function segna_tentativo(string $tipo): void
{
    db()->prepare('INSERT INTO ' . t('tentativi') . ' (chiave, quando) VALUES (?, ?)')
        ->execute([$tipo . ':' . ($_SERVER['REMOTE_ADDR'] ?? ''), time()]);
    usleep(400000); // rallenta i tentativi automatici
}

// ------------------------------------------------------------- titolare

function admin_ha_password(): bool
{
    return !empty(kv_get('admin')['hash']);
}

function is_admin(): bool
{
    return !empty($_SESSION['admin']);
}

function richiedi_admin(): void
{
    if (!is_admin()) rispondi(['errore' => 'Accesso al gestionale scaduto: entra di nuovo.'], 401);
}

// ---------------------------------------------------------------- clienti

/** Il cliente collegato (solo se l'account è ancora attivo). */
function cliente_corrente(): ?array
{
    $r = cliente_da_id($_SESSION['cliente'] ?? null);
    if (!$r || !$r['attivo']) return null;
    return $r;
}

function richiedi_cliente(): array
{
    $c = cliente_corrente();
    if (!$c) rispondi(['errore' => 'Accesso scaduto: entra di nuovo.'], 401);
    return $c;
}

/**
 * Verifica la password di un cliente. Accetta anche le password della versione
 * precedente del sito (sha256 con sale, dai backup) e le converte.
 */
function verifica_password_cliente(array $riga, string $pw): bool
{
    $hash = $riga['password'];
    if (str_starts_with($hash, 'legacy:')) {
        [, $sale, $vecchio] = explode(':', $hash, 3);
        if (!hash_equals($vecchio, hash('sha256', $sale . '::' . $pw))) return false;
        db()->prepare('UPDATE ' . t('clienti') . ' SET password = ? WHERE id = ?')
            ->execute([password_hash($pw, PASSWORD_DEFAULT), $riga['id']]);
        return true;
    }
    return $hash !== '' && password_verify($pw, $hash);
}
