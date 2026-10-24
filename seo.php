<?php
/*
 * Per i motori di ricerca: /sitemap.xml (l'elenco delle pagine, progetti
 * compresi) e /robots.txt. .htaccess manda qui entrambi gli indirizzi.
 */
require_once __DIR__ . '/inc/funzioni.php';

inizializza();
$sito = indirizzo_sito();

if (($_GET['f'] ?? '') === 'robots') {
    header('Content-Type: text/plain; charset=utf-8');
    $b = percorso_base();
    echo "User-agent: *\nDisallow: {$b}admin\nDisallow: {$b}area-clienti\nDisallow: {$b}api.php\n\nSitemap: {$sito}sitemap.xml\n";
    exit;
}

$progetti = array_values(array_filter(kv_get('projects', []), fn($p) => $p['published'] ?? true));
$pagine = ['', 'progetti', 'servizi', 'studio', 'contatti'];
foreach (slug_progetti($progetti) as $s) $pagine[] = 'progetti/' . $s;

header('Content-Type: application/xml; charset=utf-8');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($pagine as $p) {
    echo '  <url><loc>' . htmlspecialchars($sito . $p, ENT_XML1) . '</loc></url>' . "\n";
}
echo "</urlset>\n";
