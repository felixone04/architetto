<?php
/*
 * Solo per le prove in locale con il server di PHP:
 *     php -S 127.0.0.1:8096 inc/router-locale.php
 * Fa quello che su Hostinger fa .htaccess (indirizzi delle pagine, sitemap, robots).
 */
$p = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$seo = ['/sitemap.xml' => 'sitemap', '/robots.txt' => 'robots'];
if (isset($seo[$p])) {
    $_GET['f'] = $seo[$p];
    $_SERVER['SCRIPT_NAME'] = '/seo.php';
    require __DIR__ . '/../seo.php';
    return true;
}
if ($p !== '/' && is_file(__DIR__ . '/..' . $p)) return false;
$_SERVER['SCRIPT_NAME'] = '/index.php';
require __DIR__ . '/../index.php';
