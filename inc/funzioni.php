<?php
/*
 * Funzioni comuni: risposte JSON, dati pubblici del sito, caricamento foto.
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/mail.php';

function rispondi(array $dati, int $codice = 200): never
{
    http_response_code($codice);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($dati, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    invia_coda_email();
    exit;
}

/** Corpo JSON della richiesta. */
function corpo(): array
{
    static $c = null;
    if ($c !== null) return $c;
    $c = json_decode(file_get_contents('php://input') ?: '[]', true);
    return $c = is_array($c) ? $c : [];
}

function campo(string $k, $predefinito = '')
{
    return corpo()[$k] ?? $predefinito;
}

/** Tutto ciò che il sito pubblico deve sapere all'avvio. */
function dati_avvio(): array
{
    inizializza();
    $projects = array_values(array_filter(kv_get('projects', []), fn($p) => $p['published'] ?? true));
    $services = array_values(array_filter(kv_get('services', []), fn($s) => $s['active'] ?? true));
    $testimonials = array_values(array_filter(kv_get('testimonials', []), fn($t) => $t['published'] ?? true));
    $c = cliente_corrente();
    return [
        'csrf' => csrf(),
        'content' => kv_get('content', []),
        'projects' => $projects,
        'services' => $services,
        'testimonials' => $testimonials,
        'look' => kv_get('look', ['defaultTheme' => 'carta', 'hidden' => [], 'switcher' => 'tutti']),
        'client' => $c ? cliente_pubblico($c) : null,
        'admin' => is_admin(),
        'adminSetup' => !admin_ha_password(),
    ];
}

// --------------------------------------------------------- indirizzi delle pagine

/** Parola per l'indirizzo: "Casa Bianca sul mare" → "casa-bianca-sul-mare". Uguale a ARCH.slug in core.js. */
function slug(string $s): string
{
    $s = strtr(mb_strtolower(trim($s)), [
        'à' => 'a', 'á' => 'a', 'â' => 'a', 'ä' => 'a', 'è' => 'e', 'é' => 'e', 'ê' => 'e', 'ë' => 'e',
        'ì' => 'i', 'í' => 'i', 'î' => 'i', 'ï' => 'i', 'ò' => 'o', 'ó' => 'o', 'ô' => 'o', 'ö' => 'o',
        'ù' => 'u', 'ú' => 'u', 'û' => 'u', 'ü' => 'u', 'ç' => 'c', 'ñ' => 'n',
    ]);
    $s = trim(preg_replace('/[^a-z0-9]+/', '-', $s), '-');
    return $s !== '' ? $s : 'progetto';
}

/** id del progetto → parola dell'indirizzo (con l'id in coda se due titoli coincidono). */
function slug_progetti(array $progetti): array
{
    $out = [];
    $visti = [];
    foreach ($progetti as $p) {
        $s = slug($p['title'] ?? '');
        if (isset($visti[$s])) $s .= '-' . $p['id'];
        $visti[$s] = true;
        $out[$p['id']] = $s;
    }
    return $out;
}

/** Indirizzo completo del sito, es. https://www.distefanoarchitetto.it/ */
function indirizzo_sito(): string
{
    if (defined('ARCH_ORIGINE')) return ARCH_ORIGINE . ARCH_BASE;
    $https = ($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . percorso_base();
}

/** Indirizzo assoluto di una foto (le foto caricate hanno un percorso relativo). */
function url_assoluto(string $u): string
{
    if ($u === '' || str_starts_with($u, 'data:')) return '';
    if (preg_match('#^(https?:)?//#i', $u)) return $u;
    return indirizzo_sito() . ltrim($u, '/');
}

/**
 * Titolo, descrizione e foto della pagina richiesta: servono a Google e
 * all'anteprima dei link condivisi (WhatsApp, Facebook…).
 */
function meta_pagina(string $percorso, array $dati): array
{
    $c = $dati['content'];
    $nome = $c['companyName'] ?? 'Di Stefano Architetto';
    $riga = fn($s) => trim(preg_replace('/\s+/', ' ', (string) $s));
    $cover = fn($p) => trim($p['cover'] ?? '') ?: ($p['photos'][0]['url'] ?? '');
    $evidenza = array_values(array_filter($dati['projects'], fn($p) => !empty($p['featured'])))[0] ?? ($dati['projects'][0] ?? null);
    $m = [
        'title' => $nome . ' · ' . ($c['tagline'] ?? ''),
        'description' => $riga($c['heroSubtitle'] ?? ''),
        'image' => $evidenza ? $cover($evidenza) : ($c['aboutImage'] ?? ''),
        'noindex' => false,
        'status' => 200,
    ];
    $parti = explode('/', $percorso);
    $sezioni = [
        'progetti' => ['Progetti', $c['projectsText'] ?? ''],
        'servizi' => ['Servizi', $c['servicesText'] ?? ''],
        'studio' => ['Lo studio', $c['aboutIntro'] ?? ''],
        'contatti' => ['Contatti', $c['contactText'] ?? ''],
        'privacy' => ['Privacy', 'Informativa sul trattamento dei dati personali.'],
        'cookie' => ['Cookie', 'Informativa sui cookie del sito.'],
        'area-clienti' => ['Area clienti', 'Accesso riservato ai clienti.'],
        'admin' => ['Area riservata', ''],
    ];
    if ($percorso === '') return $m;
    if (!isset($sezioni[$parti[0]])) return ['noindex' => true, 'status' => 404, 'title' => 'Pagina non trovata · ' . $nome] + $m;
    [$t, $d] = $sezioni[$parti[0]];
    $m['title'] = $t . ' · ' . $nome;
    if ($d !== '') $m['description'] = $riga($d);
    if ($parti[0] === 'studio' && !empty($c['aboutImage'])) $m['image'] = $c['aboutImage'];
    if (in_array($parti[0], ['area-clienti', 'admin'], true)) $m['noindex'] = true;
    if ($parti[0] === 'progetti' && isset($parti[1])) {
        $slug = array_search($parti[1], slug_progetti($dati['projects']), true);
        $p = null;
        foreach ($dati['projects'] as $x) if ($x['id'] === $slug || $x['id'] === $parti[1]) $p = $x;
        if (!$p) return ['noindex' => true, 'status' => 404] + $m;
        $m['title'] = $p['title'] . ' · ' . $nome;
        $m['description'] = $riga($p['summary'] ?? '') ?: $m['description'];
        $m['image'] = $cover($p) ?: $m['image'];
    }
    return $m;
}

/** Scheda dello studio per Google (dati strutturati schema.org). */
function scheda_studio(array $c): array
{
    $k = $c['contacts'] ?? [];
    $s = [
        '@context' => 'https://schema.org',
        '@type' => 'ProfessionalService',
        'name' => $c['companyName'] ?? '',
        'description' => $c['tagline'] ?? '',
        'url' => indirizzo_sito(),
        'logo' => url_assoluto(trim($c['logo'] ?? '') ?: 'assets/img/Icon-512.png'),
        'image' => url_assoluto($c['aboutImage'] ?? ''),
        'telephone' => $k['phone'] ?? '',
        'email' => $k['email'] ?? '',
        'address' => ['@type' => 'PostalAddress', 'streetAddress' => $k['address'] ?? '', 'addressCountry' => 'IT'],
        'vatID' => trim(str_ireplace('P.IVA', '', $k['vat'] ?? '')),
        'sameAs' => array_values(array_filter([$k['instagram'] ?? '', $k['facebook'] ?? '', $k['linkedin'] ?? ''])),
    ];
    return array_filter($s, fn($v) => $v !== '' && $v !== []);
}

// --------------------------------------------------------------- foto

/**
 * Salva una foto caricata dal gestionale in uploads/img, ridimensionata al lato
 * lungo massimo. Restituisce l'indirizzo relativo da usare nel sito.
 */
function salva_foto(array $file): string
{
    if (($file['error'] ?? 1) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Caricamento non riuscito (file troppo grande?).');
    }
    $info = @getimagesize($file['tmp_name']);
    $tipi = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp', IMAGETYPE_GIF => 'gif'];
    if (!$info || !isset($tipi[$info[2]])) {
        throw new RuntimeException('Il file non è una foto (JPG, PNG, WebP o GIF).');
    }
    $est = $tipi[$info[2]];
    $nome = date('Ym') . '-' . bin2hex(random_bytes(8)) . '.' . $est;
    $dest = __DIR__ . '/../uploads/img/' . $nome;
    $max = (int) config()['foto_max_px'];
    [$w, $h] = $info;
    if (function_exists('imagecreatetruecolor') && max($w, $h) > $max && $est !== 'gif') {
        $src = match ($est) {
            'jpg' => imagecreatefromjpeg($file['tmp_name']),
            'png' => imagecreatefrompng($file['tmp_name']),
            'webp' => imagecreatefromwebp($file['tmp_name']),
        };
        $k = $max / max($w, $h);
        $nw = (int) round($w * $k);
        $nh = (int) round($h * $k);
        $dst = imagecreatetruecolor($nw, $nh);
        if ($est !== 'jpg') {
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
        }
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
        match ($est) {
            'jpg' => imagejpeg($dst, $dest, 82),
            'png' => imagepng($dst, $dest, 7),
            'webp' => imagewebp($dst, $dest, 82),
        };
    } else {
        move_uploaded_file($file['tmp_name'], $dest);
    }
    return 'uploads/img/' . $nome;
}

/**
 * Foto allegata dal modulo del sito (la manda chiunque): si ricodifica sempre
 * in JPEG, così resta solo l'immagine, e si salva nella cartella protetta
 * uploads/files. La vede solo il gestionale (api.php?a=admin.rfoto).
 */
function salva_foto_richiesta(array $file): ?string
{
    if (($file['error'] ?? 1) !== UPLOAD_ERR_OK || $file['size'] > 12 * 1024 * 1024) return null;
    $info = @getimagesize($file['tmp_name']);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true) || !function_exists('imagecreatetruecolor')) return null;
    $src = match ($info[2]) {
        IMAGETYPE_JPEG => @imagecreatefromjpeg($file['tmp_name']),
        IMAGETYPE_PNG => @imagecreatefrompng($file['tmp_name']),
        IMAGETYPE_WEBP => @imagecreatefromwebp($file['tmp_name']),
    };
    if (!$src) return null;
    [$w, $h] = $info;
    $k = min(1, 1600 / max($w, $h));
    $dst = imagecreatetruecolor((int) round($w * $k), (int) round($h * $k));
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
    imagecopyresampled($dst, $src, 0, 0, 0, 0, imagesx($dst), imagesy($dst), $w, $h);
    $nome = 'rq-' . date('Ym') . '-' . bin2hex(random_bytes(10)) . '.jpg';
    imagejpeg($dst, cartella_documenti() . '/' . $nome, 82);
    return $nome;
}

/** Normalizza l'elenco $_FILES['x'] (anche multiplo) in una lista di file. */
function file_caricati(string $campo): array
{
    $f = $_FILES[$campo] ?? null;
    if (!$f) return [];
    if (!is_array($f['name'])) return [$f];
    $out = [];
    foreach ($f['name'] as $i => $n) {
        $out[] = ['name' => $n, 'type' => $f['type'][$i], 'tmp_name' => $f['tmp_name'][$i],
            'error' => $f['error'][$i], 'size' => $f['size'][$i]];
    }
    return $out;
}
