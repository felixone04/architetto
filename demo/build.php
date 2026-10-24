<?php
/*
 * Crea l'anteprima statica del sito per GitHub Pages:
 *     php demo/build.php [cartella] [percorso] [indirizzo]
 *     php demo/build.php _site /architetto/ https://felixone04.github.io
 * La pagina è index.php con i contenuti di esempio; demo/demo.js fa le veci
 * di api.php nel browser. Su Hostinger questa cartella non serve.
 */
define('ARCH_ANTEPRIMA', true);

$radice = dirname(__DIR__);
$uscita = $argv[1] ?? $radice . '/_site';
define('ARCH_BASE', '/' . trim($argv[2] ?? '/', '/') . (trim($argv[2] ?? '/', '/') === '' ? '' : '/'));
define('ARCH_ORIGINE', rtrim($argv[3] ?? 'http://localhost', '/'));

function copia(string $da, string $a): void
{
    if (is_dir($da)) {
        @mkdir($a, 0777, true);
        foreach (scandir($da) as $f) {
            if ($f !== '.' && $f !== '..') copia("$da/$f", "$a/$f");
        }
    } else {
        copy($da, $a);
    }
}

@mkdir($uscita, 0777, true);
ob_start();
require $radice . '/index.php';
$html = ob_get_clean();
file_put_contents("$uscita/index.html", $html);
// GitHub Pages risponde con 404.html agli indirizzi che non trova (/progetti/…):
// è la stessa pagina, e il sito mostra quella giusta.
file_put_contents("$uscita/404.html", $html);

copia("$radice/assets", "$uscita/assets");
@mkdir("$uscita/demo");
copia("$radice/demo/demo.js", "$uscita/demo/demo.js");
copy("$radice/manifest.json", "$uscita/manifest.json");
touch("$uscita/.nojekyll");

echo "Anteprima creata in $uscita (percorso " . ARCH_BASE . ")\n";
