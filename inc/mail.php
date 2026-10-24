<?php
/*
 * Avvisi via email, inviati dalla casella dello studio (SMTP).
 * Si attivano compilando la sezione 'email' di inc/config.local.php; finché
 * è vuota il sito funziona uguale e semplicemente non manda email.
 * Le email partono dopo che il browser ha già ricevuto la risposta, così
 * chi usa il sito non aspetta il server di posta.
 */

function email_config(): array
{
    return config()['email'] ?? [];
}

function email_attiva(): bool
{
    $e = email_config();
    return !empty($e['host']) && !empty($e['utente']) && !empty($e['password']) && !empty($e['mittente']);
}

/** Dove arrivano gli avvisi per il titolare. */
function email_titolare(): string
{
    $e = email_config();
    return trim($e['avvisi'] ?? '') ?: trim($e['mittente'] ?? '');
}

$GLOBALS['arch_coda_email'] = [];

/** Mette in coda un'email: parte appena la risposta al browser è stata inviata. */
function email_in_coda(string $a, string $oggetto, array $righe, ?array $pulsante = null, string $rispondiA = ''): void
{
    if (!email_attiva() || !filter_var($a, FILTER_VALIDATE_EMAIL)) return;
    $GLOBALS['arch_coda_email'][] = [$a, $oggetto, $righe, $pulsante, $rispondiA];
}

/** Chiamata da rispondi(): chiude la risposta al browser e poi spedisce. */
function invia_coda_email(): void
{
    if (!$GLOBALS['arch_coda_email']) return;
    if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
    elseif (function_exists('litespeed_finish_request')) litespeed_finish_request();
    foreach ($GLOBALS['arch_coda_email'] as [$a, $oggetto, $righe, $pulsante, $rispondiA]) {
        invia_email($a, $oggetto, $righe, $pulsante, $rispondiA);
    }
    $GLOBALS['arch_coda_email'] = [];
}

/** Email semplice e leggibile ovunque: titolo, paragrafi, un pulsante. */
function invia_email(string $a, string $oggetto, array $righe, ?array $pulsante = null, string $rispondiA = ''): bool
{
    $e = email_config();
    $c = kv_get('content', []);
    $nome = trim($e['nome'] ?? '') ?: ($c['companyName'] ?? 'Lumen Architettura');
    $h = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');

    $testo = implode("\n\n", $righe) . ($pulsante ? "\n\n{$pulsante[0]}: {$pulsante[1]}" : '') . "\n\n— $nome";
    $html = '<!DOCTYPE html><html><body style="margin:0;background:#F3F1EC;font-family:Arial,Helvetica,sans-serif;color:#1F1F1D">'
        . '<div style="max-width:560px;margin:0 auto;padding:28px 20px">'
        . '<div style="font-family:Georgia,serif;font-size:22px;font-weight:bold;margin-bottom:20px">' . $h($nome) . '</div>'
        . '<div style="background:#FBFAF7;border-radius:16px;padding:26px 24px;font-size:15px;line-height:1.6">'
        . implode('', array_map(fn($r) => '<p style="margin:0 0 14px;white-space:pre-line">' . $h($r) . '</p>', $righe))
        . ($pulsante ? '<p style="margin:22px 0 0"><a href="' . $h($pulsante[1]) . '" style="display:inline-block;background:#A9573A;color:#fff;'
            . 'text-decoration:none;padding:12px 22px;border-radius:30px;font-weight:bold">' . $h($pulsante[0]) . '</a></p>' : '')
        . '</div><p style="font-size:12px;color:#6E6A62;margin-top:18px">Email automatica inviata dal sito di ' . $h($nome) . '.</p>'
        . '</div></body></html>';

    $confine = 'arch-' . bin2hex(random_bytes(8));
    $enc = fn($s) => '=?UTF-8?B?' . base64_encode($s) . '?=';
    $mittente = $e['mittente'];
    $dominio = substr(strrchr($mittente, '@'), 1) ?: 'localhost';
    $intestazioni = [
        'Date: ' . date('r'),
        'From: ' . $enc($nome) . " <$mittente>",
        "To: <$a>",
        'Subject: ' . $enc($oggetto),
        'Message-ID: <' . bin2hex(random_bytes(12)) . "@$dominio>",
        'MIME-Version: 1.0',
        "Content-Type: multipart/alternative; boundary=\"$confine\"",
    ];
    if (filter_var($rispondiA, FILTER_VALIDATE_EMAIL)) $intestazioni[] = "Reply-To: <$rispondiA>";
    $corpo = implode("\r\n", $intestazioni) . "\r\n\r\n"
        . "--$confine\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($testo))
        . "--$confine\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html))
        . "--$confine--\r\n";

    try {
        smtp_invia($e, $mittente, $a, $corpo);
        return true;
    } catch (Throwable $x) {
        $GLOBALS['arch_email_errore'] = $x->getMessage();
        error_log('[ARCH email] ' . $x->getMessage());
        return false;
    }
}

/** Dialogo minimo con il server SMTP (SSL sulla 465 o STARTTLS sulla 587). */
function smtp_invia(array $e, string $da, string $a, string $messaggio): void
{
    $sic = strtolower($e['sicurezza'] ?? 'ssl');
    $porta = (int) ($e['porta'] ?? ($sic === 'tls' ? 587 : 465));
    $s = @stream_socket_client(($sic === 'ssl' ? 'ssl://' : 'tcp://') . $e['host'] . ':' . $porta, $errno, $errstr, 15);
    if (!$s) throw new RuntimeException("Connessione a {$e['host']}:$porta non riuscita ($errstr)");
    stream_set_timeout($s, 15);
    $leggi = function () use ($s) {
        $r = '';
        while (($l = fgets($s, 1024)) !== false) {
            $r .= $l;
            if (strlen($l) < 4 || $l[3] === ' ') break;
        }
        return $r;
    };
    $cmd = function (string $c, int $atteso) use ($s, $leggi) {
        if ($c !== '') fwrite($s, $c . "\r\n");
        $r = $leggi();
        if ((int) substr($r, 0, 3) !== $atteso) throw new RuntimeException('SMTP: ' . trim($r) . ($c && !str_starts_with($c, 'AUTH') ? " (dopo $c)" : ''));
        return $r;
    };
    $host = $_SERVER['SERVER_NAME'] ?? 'localhost';
    $cmd('', 220);
    $cmd("EHLO $host", 250);
    if ($sic === 'tls') {
        $cmd('STARTTLS', 220);
        if (!stream_socket_enable_crypto($s, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new RuntimeException('STARTTLS non riuscito');
        $cmd("EHLO $host", 250);
    }
    $cmd('AUTH LOGIN', 334);
    $cmd(base64_encode($e['utente']), 334);
    $cmd(base64_encode($e['password']), 235);
    $cmd("MAIL FROM:<$da>", 250);
    $cmd("RCPT TO:<$a>", 250);
    $cmd('DATA', 354);
    // Le righe che iniziano con un punto vanno raddoppiate (regola del protocollo).
    $cmd(preg_replace('/^\./m', '..', $messaggio) . "\r\n.", 250);
    fwrite($s, "QUIT\r\n");
    fclose($s);
}

// ------------------------------------------------------------ avvisi del sito

function avvisa_nuova_richiesta(array $r): void
{
    $dettagli = array_filter([
        $r['type'] ? 'Intervento: ' . $r['type'] : '',
        $r['city'] ? 'Comune: ' . $r['city'] : '',
        $r['area'] ? 'Superficie: ' . $r['area'] . ' m²' : '',
        ($r['budget'] ?? '') ? 'Budget: ' . $r['budget'] : '',
        $r['timing'] ? 'Quando: ' . $r['timing'] : '',
        $r['projectRef'] ? 'Dal progetto: ' . $r['projectRef'] : '',
        $r['photos'] ? count($r['photos']) . ' foto allegate' : '',
    ]);
    email_in_coda(email_titolare(), 'Nuova richiesta dal sito: ' . $r['name'], array_values(array_filter([
        "{$r['name']} ha compilato il modulo del sito.",
        "Telefono: {$r['phone']}\nEmail: {$r['email']}" . ($dettagli ? "\n" . implode("\n", $dettagli) : ''),
        $r['message'] ? "Messaggio:\n" . $r['message'] : '',
    ])), ['Apri le richieste', indirizzo_sito() . 'admin/richieste'], $r['email']);
}

/** Il cliente ha scritto o approvato un documento: avviso allo studio. */
function avvisa_titolare(array $w, string $oggetto, string $testo): void
{
    email_in_coda(email_titolare(), $oggetto, [$testo, 'Progetto: ' . ($w['title'] ?? '')],
        ['Apri la commessa', indirizzo_sito() . 'admin/commesse?id=' . rawurlencode($w['id'])]);
}

/** Novità nella commessa: avviso al cliente (se gli avvisi sono attivi nelle Impostazioni). */
function avvisa_cliente(array $w, string $oggetto, string $testo): void
{
    if ((kv_get('settings', [])['notifyClients'] ?? true) === false) return;
    $c = cliente_da_id($w['clientId'] ?? '');
    if (!$c || !$c['attivo']) return;
    $nome = explode(' ', trim(json_decode($c['dati'], true)['name'] ?? ''))[0];
    email_in_coda($c['email'], $oggetto, ["Ciao $nome,", $testo, 'Progetto: ' . ($w['title'] ?? '')],
        ['Apri la tua area clienti', indirizzo_sito() . 'area-clienti/' . rawurlencode($w['id'])], email_titolare());
}
