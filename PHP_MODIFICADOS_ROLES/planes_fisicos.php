<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

ini_set('display_errors', '0');
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

require 'db.php';
require 'config.php'; // $claveJWT, $PEXELS_API_KEY, $WIKIMEDIA_USER_AGENT, ...

// ===== Debug imágenes stock (activar/desactivar) =====
if (!defined('PF_STOCK_DEBUG')) {
  define('PF_STOCK_DEBUG', true); // false en producción
}
function pf_dbg($msg) {
  if (!PF_STOCK_DEBUG) return;
  if (is_array($msg) || is_object($msg)) $msg = json_encode($msg, JSON_UNESCAPED_UNICODE);
  @error_log($msg);
}

/** ===== Inputs comunes ===== **/
$method     = $_SERVER['REQUEST_METHOD'];
$action     = $_GET['action'] ?? null;
$id_usuario = isset($_GET['id_usuario']) ? intval($_GET['id_usuario']) : null;
$id_plan    = isset($_GET['id_plan']) ? intval($_GET['id_plan']) : null;
$dataRaw    = file_get_contents("php://input");
$data       = json_decode($dataRaw, true);

/** ===================== Z) SERVIR MEDIA (antes del JWT) ===================== **/
if ($method === 'GET' && $action === 'media') {
    $path = urldecode($_GET['path'] ?? '');

    $allowed = [
        '/api/uploads/planes_fisicos/' => realpath(__DIR__ . '/uploads/planes_fisicos'),
        '/api/uploads/stock_cache/'    => realpath(__DIR__ . '/uploads/stock_cache'),
        '/api/uploads/planes_fisicos/__previews__/' => realpath(__DIR__ . '/uploads/planes_fisicos/__previews__'),
    ];

    foreach ($allowed as $prefix => $base) {
        if (!$base) continue;
        if (strpos($path, $prefix) === 0) {
            $rel = substr($path, strlen($prefix));
            $abs = realpath($base . '/' . $rel);

            if ($abs && strpos($abs, $base) === 0 && is_file($abs)) {
                if (function_exists('header_remove')) @header_remove('Content-Type');
                $finfo = finfo_open(FILEINFO_MIME_TYPE);
                $mime  = finfo_file($finfo, $abs) ?: 'image/jpeg';
                finfo_close($finfo);

                header('Access-Control-Allow-Origin: *');
                header('Cross-Origin-Resource-Policy: cross-origin');
                header('X-Content-Type-Options: nosniff');
                header('Cache-Control: public, max-age=86400, immutable');
                header('Content-Type: ' . $mime);

                while (ob_get_level()) { ob_end_clean(); }
                readfile($abs);
                exit;
            }
        }
    }
    http_response_code(404);
    exit;
}

/** ===================== JWT ===================== **/
function validarToken($claveJWT) {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!preg_match('/Bearer\s(\S+)/', $authHeader, $m)) {
        echo json_encode(["success"=>false, "error" => "Token no proporcionado"]); exit;
    }
    $token = $m[1];
    $partes = explode('.', $token);
    if (count($partes) !== 3) { echo json_encode(["success"=>false, "error" => "Token mal formado"]); exit; }
    [$bH, $bP, $bF] = $partes;
    $firmaEsperada = base64_encode(hash_hmac('sha256', "$bH.$bP", $claveJWT, true));
    if (!hash_equals($firmaEsperada, $bF)) { echo json_encode(["success"=>false, "error" => "Firma inválida"]); exit; }
    $payload = json_decode(base64_decode($bP), true);
    if (($payload['exp'] ?? 0) < time()) { echo json_encode(["success"=>false, "error" => "Token expirado"]); exit; }
    return $payload;
}
$payload = validarToken($claveJWT);

/** ===================== HELPERS ===================== **/
function safe_json_decode($str) { $d=json_decode($str,true); return (json_last_error()===JSON_ERROR_NONE)?$d:null; }
function pf_is_list($arr){ if(!is_array($arr))return false; $i=0; foreach($arr as $k=>$_){ if($k!==$i++) return false; } return true; }
function pf_normstr($s){ $s=strtolower($s??''); $s=@iconv('UTF-8','ASCII//TRANSLIT',$s); return preg_replace('/[^a-z]/','',$s); }
function pf_sanitize_filename($s){
    $s=@iconv('UTF-8','ASCII//TRANSLIT',$s);
    $s=preg_replace('/[^A-Za-z0-9_\-]/','_',$s);
    $s = trim($s,'_') ?: 'media';
    // 🔎 Debug: log del nombre que se usará
    error_log("[PF][SANITIZE_FILENAME] nombre esperado = {$s}");
    return $s;
}
/** === Rutas de previews locales (para imágenes tipo Back_Squat.png) === */
if (!defined('PF_UPLOADS_PREVIEWS_DIR')) {
  define('PF_UPLOADS_PREVIEWS_DIR', rtrim(__DIR__ . '/uploads/planes_fisicos/__previews__/', '/') . '/');
}
if (!defined('PF_UPLOADS_PREVIEWS_REL')) {
  define('PF_UPLOADS_PREVIEWS_REL', '/api/uploads/planes_fisicos/__previews__/');
}

/** ====== Helpers de previews locales (mapear "12 KB Swings 24/16kg" → kb_swings.webp, etc.) ====== */
function pf_clean_exercise_label($s) {
    $s = (string)$s;
    $s = preg_replace('/\([^)]*\)/', ' ', $s);
    $s = preg_replace('/\b\d+\s*x\s*\d+\b/i', ' ', $s); // 3x10
    $s = preg_replace('/\d+(\s*\/\s*\d+)?\s*(kg|lb|m|min|km)\b/i', ' ', $s); // 24/16kg, 200 m
    $s = preg_replace('/\s+/', ' ', trim($s));
    return $s;
}
/** Devuelve basenames candidatos tal y como existen en tu librería */
function pf_canonical_preview_candidates($rawNombre) {
    $s = strtolower(pf_clean_exercise_label($rawNombre));

    $map = [
        // Fuerza/barra
        '/\b(back\s*squat|sentadilla\s*trasera)\b/'         => ['back_squat'],
        '/\b(front\s*squat|sentadilla\s*frontal)\b/'        => ['front_squat'],
        '/\boverhead\s*squat\b/'                            => ['overhead_squat'],
        '/\bbench\s*press|press\s*banca\b/'                 => ['bench_press','press_banca'],
        '/\bstrict\s*press|press\s*militar\b/'              => ['strict_press','press_militar'],
        '/\bpush\s*press\b/'                                => ['push_press'],
        '/\bbarbell\s*row|remo\s*con\s*barra\b/'            => ['barbell_row'],
        '/\bromanian\s*deadlift\b|\bpeso\s*muerto\b/'       => ['romanian_deadlift','deadlift'],
        '/\bdeadlift\b/'                                    => ['deadlift'],

        // Olímpicos
        '/\bclean\s*and\s*jerk\b/'                          => ['clean_and_jerk'],
        '/\bpower\s*clean\b/'                               => ['power_clean'],
        '/\bhang\s*clean\b/'                                => ['hang_clean'],
        '/\bpower\s*snatch\b/'                              => ['power_snatch'],
        '/\bhang\s*snatch\b/'                               => ['hang_snatch'],
        '/\bsnatch\b/'                                      => ['snatch'],

        // Gimnásticos / funcionales
        '/\bpull[-\s_]*ups?\b|\bdominadas\b/'               => ['pull_ups'],
        '/\bpush[-\s_]*ups?\b|\bflexiones\b/'               => ['push_ups','push_up'],
        '/\bbox\s*jumps?\b/'                                => ['box_jumps'],
        '/\bburpees?\b/'                                    => ['burpees'],
        '/\brope\s*climb\b/'                                => ['rope_climb'],
        '/\bwall\s*balls?\b/'                               => ['wall_balls'],
        '/\b(zancadas|lunges?)\b/'                          => ['zancadas','lunges'],

        // KB / carries / trineo
        '/\b(kb|kettlebell)\s*swings?\b/'                   => ['kb_swings','kettlebell_swings'],
        '/\bfarmer\s*(carry|walk)\b/'                       => ['farmer_carry'],
        '/\bsled\s*(drag|push)\b/'                          => ['sled_drag'],

        // Cardio
        '/\b(row|remo)\b/'                                  => ['row'],
        '/\b(run|carrera|sprint)\b/'                        => ['run'],
    ];

    $cands = [];
    foreach ($map as $rx => $names) {
        if (preg_match($rx, $s)) {
            foreach ($names as $bn) $cands[] = $bn;
        }
    }

    if (!$cands) {
        $tmp = @iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$s);
        $tmp = preg_replace('/[^A-Za-z0-9]+/',' ', $tmp);
        $parts = preg_split('/\s+/', trim($tmp));
        $title = implode('_', array_map(fn($w)=>$w ? strtoupper($w[0]).strtolower(substr($w,1)) : '', $parts));
        $cands[] = strtolower($title);
        if ($title) $cands[] = $title;
    }

    // Variantes extra útiles
    if (preg_match('/\bpress\b/', $s) && preg_match('/\bbanca\b/', $s)) array_unshift($cands, 'press_banca');
    if (preg_match('/\bmilitar\b/', $s)) array_unshift($cands, 'press_militar');

    return array_values(array_unique($cands));
}
/**
 * Busca hasta $max previews locales para un ejercicio.
 * Intenta: base_1..base_$max y luego base "plana" (sin sufijo) en los formatos dados.
 * Devuelve una lista de hits con path relativo y media_url listos para el front.
 */
function pf_try_local_preview_variants_multi($nombre, $max = 4, $exts = ['png','jpg','jpeg','webp']) {
    @mkdir(PF_UPLOADS_PREVIEWS_DIR, 0775, true);

    $bases = pf_canonical_preview_candidates($nombre);
    $b2 = str_replace(' ', '_', trim((string)$nombre));
    if ($b2) array_unshift($bases, strtolower($b2));

    error_log("[PF][LOCAL_MULTI] raw='{$nombre}' max={$max} candidates=" . json_encode($bases, JSON_UNESCAPED_UNICODE));

    $hits = [];
    foreach ($bases as $base) {
        // variantes: base_1..base_N y luego base "plana"
        $variants = [];
        for ($i = 1; $i <= max(1, $max); $i++) $variants[] = "{$base}_{$i}";
        $variants[] = $base;

        foreach ($variants as $v) {
            foreach ($exts as $ext) {
                $file = $v . '.' . $ext;
                $abs  = PF_UPLOADS_PREVIEWS_DIR . $file;
                $exists = is_file($abs);
                error_log("[PF][LOCAL_MULTI] probe file='{$file}' abs='{$abs}' exists=" . ($exists ? '1' : '0'));

                if ($exists) {
                    $rel = PF_UPLOADS_PREVIEWS_REL . $file;
                    $media_url = '/api/planes_fisicos.php?action=media&path=' . rawurlencode($rel);
                    $hits[] = ['path'=>$rel, 'media_url'=>$media_url, 'file'=>$file];
                    if (count($hits) >= $max) break 3;
                }
            }
        }
    }

    if (!$hits) {
        error_log("[PF][LOCAL_MULTI] MISS for raw='{$nombre}'");
        return [];
    }
    error_log("[PF][LOCAL_MULTI] HITS=" . json_encode(array_column($hits, 'file'), JSON_UNESCAPED_UNICODE));
    return $hits;
}


/** Busca un preview local existente (devuelve ruta relativa /api/uploads/...) */
function pf_try_local_preview_variants($nombre, $exts = ['png','jpg','jpeg','webp']) {
    @mkdir(PF_UPLOADS_PREVIEWS_DIR, 0775, true);

    $bases = pf_canonical_preview_candidates($nombre);
    $b2 = str_replace(' ', '_', trim((string)$nombre));
    if ($b2) array_unshift($bases, strtolower($b2));

    // 👇 LOG 1: qué nombre llega y qué basenames se van a probar
    error_log("[PF][LOCAL_PREVIEW] raw='{$nombre}' candidates=" . json_encode($bases) . " exts=" . json_encode($exts));

    foreach ($bases as $base) {
        foreach ($exts as $ext) {
            $file = $base . '.' . $ext;
            $abs  = PF_UPLOADS_PREVIEWS_DIR . $file;

            // 👇 LOG 2: cada fichero probado y si existe
            $exists = is_file($abs) ? '1' : '0';
            error_log("[PF][LOCAL_PREVIEW] probe file='{$file}' abs='{$abs}' exists={$exists}");

            if ($exists === '1') {
                $rel = PF_UPLOADS_PREVIEWS_REL . $file;

                // 👇 LOG 3: hit definitivo (este es el que usaría el front)
                error_log("[PF][LOCAL_PREVIEW] HIT rel='{$rel}'");

                return $rel;
            }
        }
    }

    // 👇 LOG 4: no se encontró nada; deja constancia
    error_log("[PF][LOCAL_PREVIEW] MISS for raw='{$nombre}'");
    return null;
}

/* ==== Base64 helper (placeholder) ==== */
function pf_save_base64_png($b64, $destPath){
    @mkdir(dirname($destPath), 0775, true);
    if (strpos($b64,'base64,')!==false) $b64 = substr($b64, strpos($b64,'base64,')+7);
    $b64 = preg_replace('/\s+/', '', $b64);
    $pad = strlen($b64)%4; if($pad) $b64 .= str_repeat('=',4-$pad);
    $bin = base64_decode($b64, true);
    if ($bin === false) $bin = base64_decode($b64);
    return file_put_contents($destPath, $bin) !== false;
}

/* ==== HTTP helpers ==== */
function pf_http_get_json($url, $headers = [], $ua = null, $timeout = 20) {
    $ch = curl_init($url);
    $h = array_merge(['Accept: application/json'], $headers);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_HTTPHEADER => $h,
    ]);
    if ($ua) curl_setopt($ch, CURLOPT_USERAGENT, $ua);
    $res = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($res === false) { error_log("HTTP JSON error ".curl_error($ch)); curl_close($ch); return [null,$http]; }
    curl_close($ch);
    $dec = json_decode($res,true);
    if (json_last_error() !== JSON_ERROR_NONE) { error_log("JSON parse error ".json_last_error_msg()); return [null,$http]; }
    return [$dec,$http];
}
function pf_http_get_binary($url, $headers = [], $ua = null, $timeout = 30) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_HTTPHEADER => $headers,
    ]);
    if ($ua) curl_setopt($ch, CURLOPT_USERAGENT, $ua);
    $bin = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($bin === false || $http < 200 || $http >= 300) {
        error_log("HTTP BIN $http ".($bin===false?curl_error($ch):'')); curl_close($ch);
        return [null,$http];
    }
    curl_close($ch);
    return [$bin,$http];
}
function pf_http_download_to($url, $dest, $headers = []) {
    @mkdir(dirname($dest), 0775, true);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => $headers
    ]);
    $bin  = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $ct   = curl_getinfo($ch, CURLOPT_CONTENT_TYPE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($bin === false || $http < 200 || $http >= 300) {
        error_log("[PF][STOCK] download fail $http $err $url");
        return false;
    }
    $ext = '.jpg';
    if (stripos($ct, 'png') !== false) $ext = '.png';
    if (!preg_match('/\.(jpg|jpeg|png)$/i', $dest)) $dest .= $ext;

    $ok = @file_put_contents($dest, $bin);
    if (!$ok) return false;
    return $dest;
}

/* ==== Guardado de binario (logs) ==== */
function pf_save_binary_image($bin, $destPath){
    @mkdir(dirname($destPath), 0775, true);
    $ok  = file_put_contents($destPath, $bin);
    if ($ok === false)  { error_log("[PF] file_put_contents failed for $destPath"); return false; }
    $size = filesize($destPath);
    error_log("[PF] IMG saved $destPath ($size bytes)");
    return true;
}

/** === Placeholder VÁLIDO (PNG 1x1) === */
function pf_placeholder_b64() {
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAgMBg1b0cM0AAAAASUVORK5CYII=';
}

/* ---------- helpers de términos (sing/plural/sinónimos) ---------- */
function pf_term_variants($t){
    $t = strtolower(trim($t));
    $v = [$t];
    if ($t !== '' && substr($t, -1) !== 's') $v[] = $t.'s'; // plural simple
    $v[] = str_replace(' ', '-', $t);
    $v[] = str_replace(' ', '',  $t);
    if (substr($t, -1) !== 's') {
        $v[] = str_replace(' ', '-', $t.'s');
        $v[] = str_replace(' ', '',  $t.'s');
    }
    if (preg_match('/\bbox\s+jump(s)?\b/', $t)) { // sinónimos útiles
        $v[] = 'plyo box';
        $v[] = 'plyometric box';
        $v[] = 'jump box';
    }
    return array_values(array_unique($v));
}
function pf_hay_has_term($hay, $term){
    $hay = strtolower($hay ?? '');
    foreach (pf_term_variants($term) as $cand) {
        if ($cand !== '' && strpos($hay, $cand) !== false) return true;
    }
    if (preg_match('/\bbox\s+jumps?\b/', $term) && preg_match('/\bbox\s+jumps?\b/', $hay)) return true;
    return false;
}

/* ==== Pexels (binario) ==== */
function pf_pexels_fetch_image($query){
    global $PEXELS_API_KEY;
    if (!$PEXELS_API_KEY || $PEXELS_API_KEY === 'YOUR_PEXELS_KEY_HERE') return null;

    $url = "https://api.pexels.com/v1/search?per_page=1&orientation=landscape&query=".urlencode($query);
    list($json,$http) = pf_http_get_json($url, ["Authorization: ".$PEXELS_API_KEY], null, 20);
    if (!$json || empty($json['photos'][0])) { return null; }
    $p = $json['photos'][0];
    $imgUrl = $p['src']['large'] ?? $p['src']['medium'] ?? $p['src']['original'] ?? null;
    if (!$imgUrl) return null;

    list($bin,$h) = pf_http_get_binary($imgUrl, [], null, 30);
    if (!$bin) return null;

    $photog = $p['photographer'] ?? '';
    $plink  = $p['url'] ?? '';
    $credit = trim("Photo by {$photog} on Pexels");
    return ['bin'=>$bin, 'ext'=>'jpg', 'credit'=>$credit, 'source'=>'pexels', 'page'=>$plink];
}

/* ==== Wikimedia Commons (binario) ==== */
function pf_wikimedia_fetch_image($query){
    global $WIKIMEDIA_USER_AGENT;

    $api = "https://commons.wikimedia.org/w/api.php"
         . "?action=query&format=json&prop=imageinfo&iiprop=url|mime"
         . "&generator=search&gsrnamespace=6&gsrlimit=1"
         . "&gsrsearch=".urlencode($query);
    list($json,$http) = pf_http_get_json($api, [], $WIKIMEDIA_USER_AGENT ?: 'PHP', 25);
    if (!$json || empty($json['query']['pages'])) return null;

    $pages = $json['query']['pages'];
    $first = reset($pages);
    $info  = $first['imageinfo'][0] ?? null;
    $imgUrl = $info['url'] ?? null;
    if (!$imgUrl) return null;

    list($bin,$h) = pf_http_get_binary($imgUrl, [], $WIKIMEDIA_USER_AGENT ?: 'PHP', 30);
    if (!$bin) return null;

    $mime = $info['mime'] ?? 'image/jpeg';
    $ext = (strpos($mime,'png')!==false) ? 'png' : 'jpg';
    $credit = 'Image from Wikimedia Commons';
    return ['bin'=>$bin, 'ext'=>$ext, 'credit'=>$credit, 'source'=>'wikimedia', 'page'=> (isset($first['title']) ? "https://commons.wikimedia.org/wiki/".$first['title'] : '')];
}

/* ---------- Unsplash (preview) mejor rankeado ---------- */
function pf_stock_unsplash_best($query) {
    global $UNSPLASH_ACCESS_KEY;
    if (empty($UNSPLASH_ACCESS_KEY)) return null;

    $url = 'https://api.unsplash.com/search/photos?' . http_build_query([
        'query'          => $query,
        'per_page'       => 30,
        'orientation'    => 'landscape',
        'order_by'       => 'relevant',
        'content_filter' => 'high'
    ]);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => [
            'Accept-Version: v1',
            'Authorization: Client-ID ' . $UNSPLASH_ACCESS_KEY
        ],
    ]);
    $res  = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http < 200 || $http >= 300 || !$res) {
        error_log("[PF][STOCK] Unsplash HTTP $http: " . substr((string)$res,0,200));
        return null;
    }
    $dec = json_decode($res, true);
    if (empty($dec['results'])) return null;

    $mainTerms = ['squat','deadlift','bench','press','snatch','clean','row','rowing',
                  'pull-up','pull up','push-up','push up','push ups',
                  'kettlebell','kb','kettlebell swing','kb swings',
                  'burpee','box jump','rope climb','carry','sled','run','running','sprint',
                  'wall ball','lunge','lunges','hyrox','crossfit','functional','wod','hybrid'];
    $qLower = strtolower($query);
    $expected = [];
    foreach ($mainTerms as $t) { if (pf_hay_has_term($qLower, $t)) $expected[] = $t; }
    if (empty($expected)) $expected = ['crossfit','hyrox','functional','training'];

    $best = null; $bestScore = -999;
    foreach ($dec['results'] as $ph) {
        $score = 0;

        $hay = strtolower(($ph['alt_description'] ?? '') . ' ' . ($ph['description'] ?? ''));
        $tags = [];
        if (!empty($ph['tags'])) foreach ($ph['tags'] as $t) {
            if (!empty($t['title'])) $tags[] = strtolower($t['title']);
        }
        $hay .= ' ' . implode(' ', $tags);

        foreach ($expected as $t) if (pf_hay_has_term($hay, $t)) $score += 6;
        foreach (['crossfit','functional','hyrox','hybrid','wod','training','gym','barbell','track','concept2','kettlebell'] as $ctx)
            if (strpos($hay, $ctx) !== false) $score += 2;

        $hasMain=false; foreach($expected as $t){ if (pf_hay_has_term($hay,$t)){ $hasMain=true; break; } }
        if (!$hasMain) $score -= 8;

        if ($score > $bestScore) { $bestScore = $score; $best = $ph; }
    }
    if (!$best) $best = $dec['results'][0];

    return [
        'preview_url' => $best['urls']['regular'] ?? $best['urls']['small'] ?? null,
        'author'      => $best['user']['name'] ?? 'Unsplash author',
        'page_url'    => ($best['links']['html'] ?? '') . '?utm_source=oposiciones-test&utm_medium=referral',
        'id'          => $best['id'] ?? md5($query),
        'mime'        => 'image/jpeg'
    ];
}

/* ---------- Freepik: lista simple (fotos) ---------- */
function pf_stock_freepik_list($query, $limit = 4) {
    global $FREEPIK_API_KEY;
    if (empty($FREEPIK_API_KEY) || $FREEPIK_API_KEY === 'TU_API_KEY_FREEPIK_AQUI') return [];

    $url = 'https://api.freepik.com/v1/resources?' . http_build_query([
        'query'        => $query,
        'content_type' => 'photo',
        'limit'        => min(30, $limit * 4),
        'order'        => 'best',
    ]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_HTTPHEADER     => [
            'x-freepik-api-key: ' . $FREEPIK_API_KEY,
            'Accept: application/json'
        ],
    ]);
    $res  = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($http < 200 || $http >= 300 || !$res) {
        error_log("[PF][FREEPIK] HTTP $http $err");
        return [];
    }

    $dec = json_decode($res, true);
    $items = [];
    if (!empty($dec['data']) && is_array($dec['data']))      $items = $dec['data'];
    elseif (!empty($dec['resources']) && is_array($dec['resources'])) $items = $dec['resources'];
    if (!$items) return [];

    $out = [];
    foreach ($items as $r) {
        if (count($out) >= $limit) break;

        $img = null;
        if (!empty($r['images']['preview']['url']))             $img = $r['images']['preview']['url'];
        elseif (!empty($r['preview']['url']))                   $img = $r['preview']['url'];
        elseif (!empty($r['thumbnails'][0]['url']))             $img = $r['thumbnails'][0]['url'];
        elseif (!empty($r['image']['url']))                     $img = $r['image']['url'];

        $page = $r['url'] ?? ($r['links']['self'] ?? null);
        if (!$img) continue;

        $out[] = [
            'preview_url' => $img,
            'author'      => 'Freepik',
            'page_url'    => $page,
            'id'          => (string)($r['id'] ?? md5($query . microtime(true))),
            'mime'        => 'image/jpeg',
            'source'      => 'Freepik'
        ];
    }
    return $out;
}

/* ---------- Unsplash: lista con scoring (mejorado + logs) ---------- */
function pf_stock_unsplash_list($query, $limit = 4) {
    global $UNSPLASH_ACCESS_KEY;
    if (empty($UNSPLASH_ACCESS_KEY)) {
        pf_dbg("[PF][UNSPLASH] Sin ACCESS_KEY → se omite Unsplash");
        return [];
    }

    $per = min(30, max(10, $limit * 6));
    $url = 'https://api.unsplash.com/search/photos?' . http_build_query([
        'query'          => $query,
        'per_page'       => $per,
        'orientation'    => 'landscape',
        'order_by'       => 'relevant',
        'content_filter' => 'high'
    ]);
    pf_dbg("[PF][UNSPLASH][REQ] query='{$query}' per={$per}");

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => [
            'Accept-Version: v1',
            'Authorization: Client-ID ' . $UNSPLASH_ACCESS_KEY
        ],
    ]);
    $res  = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($http < 200 || $http >= 300 || !$res) {
        pf_dbg("[PF][UNSPLASH][ERR] HTTP={$http}");
        return [];
    }

    $dec = json_decode($res, true);
    $num = count($dec['results'] ?? []);
    pf_dbg("[PF][UNSPLASH][OK] results={$num}");
    if ($num === 0) return [];

    $mainTerms = [
        'squat','deadlift','bench','press','snatch','clean','row','rowing','pull-up','push-up',
        'kettlebell','burpee','box jump','rope climb','carry','sled','run','running','sprint',
        'wall ball','lunge','hyrox','crossfit','functional','wod','hybrid'
    ];
    $ql  = strtolower($query);
    $expected = [];
    foreach ($mainTerms as $t) if (pf_hay_has_term($ql,$t)) $expected[]=$t;
    if (!$expected) $expected = ['crossfit','hyrox','functional','wod','training','gym','fitness'];

    $scored=[];
    foreach ($dec['results'] as $ph) {
        $tags = [];
        if (!empty($ph['tags'])) {
            foreach ($ph['tags'] as $t) { $tags[] = strtolower($t['title'] ?? ''); }
        }
        $hay = strtolower(($ph['alt_description'] ?? '').' '.($ph['description'] ?? '').' '.implode(' ', $tags));

        $score = 0;
        foreach ($expected as $t) if (pf_hay_has_term($hay, $t)) $score += 6;

        foreach (['crossfit','functional','hyrox','hybrid','wod','training','gym','barbell','track','kettlebell','plyo','fitness'] as $ctx)
            if (strpos($hay,$ctx)!==false) $score += 2;

        if (preg_match('/\b(bmx|motor|motorbike|motocross|bike|skate|skater|snow|parkour)\b/', $hay)) $score -= 8;
        if (preg_match('/\b(render|3d|cgi|illustration|ai-generated|mockup)\b/', $hay)) $score -= 6;

        $hasMain=false; foreach($expected as $t){ if (pf_hay_has_term($hay,$t)) { $hasMain=true; break; } }
        if(!$hasMain) $score -= 5;

        $scored[] = [
            'score'      => $score,
            'preview_url'=> $ph['urls']['regular'] ?? $ph['urls']['small'] ?? null,
            'author'     => $ph['user']['name'] ?? 'Unsplash',
            'page_url'   => ($ph['links']['html'] ?? '') . '?utm_source=oposiciones-test&utm_medium=referral',
            'id'         => $ph['id'] ?? md5($query),
            'mime'       => 'image/jpeg',
            'source'     => 'Unsplash',
            '__dbg_hasMain' => $hasMain ? 1 : 0,
        ];
    }

    usort($scored, fn($a,$b)=>$b['score']<=>$a['score']);

    $peek = array_slice($scored, 0, 6);
    foreach ($peek as $i => $it) {
        pf_dbg(sprintf("[PF][UNSPLASH][TOP%02d] id=%s score=%d hasMain=%d author=%s",
          $i+1, $it['id'], $it['score'], $it['__dbg_hasMain'], $it['author']
        ));
    }

    $out=[];
    foreach ($scored as $it) {
        if (count($out) >= $limit) break;
        if (!empty($it['preview_url'])) $out[]=$it;
    }
    return $out;
}

/* ---------- Pexels (preview) ---------- */
function pf_stock_pexels_best($query) {
    global $PEXELS_API_KEY;
    if (empty($PEXELS_API_KEY)) return null;

    $url = 'https://api.pexels.com/v1/search?' . http_build_query([
        'query'    => $query,
        'per_page' => 30
    ]);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => ['Authorization: ' . $PEXELS_API_KEY],
    ]);
    $res  = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http < 200 || $http >= 300 || !$res) {
        error_log("[PF][STOCK] Pexels HTTP $http: " . substr((string)$res,0,200));
        return null;
    }
    $dec = json_decode($res, true);
    if (empty($dec['photos'])) return null;

    $ph = $dec['photos'][0];
    return [
        'preview_url' => $ph['src']['large'] ?? $ph['src']['medium'] ?? null,
        'author'      => $ph['photographer'] ?? 'Pexels',
        'page_url'    => $ph['url'] ?? null,
        'id'          => (string)($ph['id'] ?? md5($query)),
        'mime'        => 'image/jpeg'
    ];
}

/* ---------- Pexels: lista simple ---------- */
function pf_stock_pexels_list($query, $limit = 4) {
    global $PEXELS_API_KEY;
    if (empty($PEXELS_API_KEY)) return [];
    $url = 'https://api.pexels.com/v1/search?' . http_build_query(['query'=>$query,'per_page'=>min(30,$limit*4)]);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => ['Authorization: ' . $PEXELS_API_KEY],
    ]);
    $res  = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($http < 200 || $http >= 300 || !$res) return [];
    $dec = json_decode($res, true);
    if (empty($dec['photos'])) return [];
    $out=[];
    foreach ($dec['photos'] as $p) {
        if (count($out) >= $limit) break;
        $u = $p['src']['large'] ?? $p['src']['medium'] ?? null;
        if ($u) $out[] = [
            'preview_url'=>$u,
            'author'=>$p['photographer'] ?? 'Pexels',
            'page_url'=>$p['url'] ?? null,
            'id'=>(string)($p['id'] ?? md5($query)),
            'mime'=>'image/jpeg',
            'source'=>'Pexels'
        ];
    }
    return $out;
}

/* ---------- Wikimedia (preview) ---------- */
function pf_stock_wikimedia_best($query) {
    $q = $query . ' gym exercise';
    $url = 'https://commons.wikimedia.org/w/api.php?' . http_build_query([
        'action' => 'query', 'prop' => 'imageinfo', 'format' => 'json',
        'generator' => 'search', 'gsrsearch' => $q, 'gsrlimit' => 10,
        'iiprop' => 'url|extmetadata', 'iiurlwidth' => 1280
    ]);
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
    $res  = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($http < 200 || $http >= 300 || !$res) return null;
    $dec = json_decode($res, true);
    if (empty($dec['query']['pages'])) return null;

    foreach ($dec['query']['pages'] as $p) {
        $ii = $p['imageinfo'][0] ?? null;
        if (!$ii) continue;
        return [
            'preview_url' => $ii['thumburl'] ?? $ii['url'] ?? null,
            'author'      => ($ii['extmetadata']['Artist']['value'] ?? 'Wikimedia Commons'),
            'page_url'    => $ii['descriptionshorturl'] ?? null,
            'id'          => (string)($p['pageid'] ?? md5($query)),
            'mime'        => 'image/jpeg'
        ];
    }
    return null;
}

/* ---------- Wikimedia: lista simple ---------- */
function pf_stock_wikimedia_list($query, $limit = 4) {
    $q = $query . ' gym exercise';
    $url = 'https://commons.wikimedia.org/w/api.php?' . http_build_query([
        'action'=>'query','prop'=>'imageinfo','format'=>'json',
        'generator'=>'search','gsrsearch'=>$q,'gsrlimit'=>max(10,$limit*5),
        'iiprop'=>'url|extmetadata','iiurlwidth'=>1280
    ]);
    $ch = curl_init($url);
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15]);
    $res=curl_exec($ch); $http=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
    if ($http<200||$http>=300||!$res) return [];
    $dec=json_decode($res,true);
    if (empty($dec['query']['pages'])) return [];
    $out=[];
    foreach ($dec['query']['pages'] as $p) {
        if (count($out) >= $limit) break;
        $ii = $p['imageinfo'][0] ?? null;
        if (!$ii) continue;
        $out[] = [
            'preview_url'=>$ii['thumburl'] ?? $ii['url'] ?? null,
            'author'=> strip_tags($ii['extmetadata']['Artist']['value'] ?? 'Wikimedia Commons'),
            'page_url'=>$ii['descriptionshorturl'] ?? null,
            'id'=> (string)($p['pageid'] ?? md5($query)),
            'mime'=>'image/jpeg',
            'source'=>'Wikimedia'
        ];
    }
    return $out;
}

/* ==== Query de stock a partir del ejercicio (mejorada CrossFit/Hyrox) ==== */
function pf_stock_query_from_exercise($raw, $bloqueTipo = '') {
    // 1) Normalizar
    $s = iconv('UTF-8','ASCII//TRANSLIT', $raw ?? '');
    $s = strtolower($s);
    $s = preg_replace('/\([^)]*\)/', ' ', $s);                 // (técnica)
    $s = preg_replace('/\b\d+\s*x\s*\d+\b/u', ' ', $s);        // 3x10
    $s = preg_replace('/\b\d+([.,]\d+)?\s*(kg|lb|m|min|km)\b/u', ' ', $s);
    $s = preg_replace('/\b(1rm|%|rpe|amrap|emom|for\s*time|ladder|intervals?)\b/u', ' ', $s);
    $s = str_replace(['&','+'], ' and ', $s);
    $s = preg_replace('/[^a-z\s]/', ' ', $s);
    $s = preg_replace('/\s+/', ' ', trim($s));

    // 2) Mapeo ES/EN / alias (con contexto "crossfit/functional/hyrox/hybrid/wod/fitness")
    $map = [
        // Oly
        'snatch'            => 'olympic weightlifting snatch barbell crossfit functional hybrid wod fitness',
        'power snatch'      => 'power snatch barbell crossfit functional hybrid wod fitness',
        'hang snatch'       => 'hang snatch barbell crossfit functional hybrid wod fitness',
        'clean and jerk'    => 'olympic weightlifting clean and jerk barbell crossfit functional hybrid wod fitness',
        'clean jerk'        => 'olympic weightlifting clean and jerk barbell crossfit functional hybrid wod fitness',
        'power clean'       => 'power clean barbell crossfit functional hybrid wod fitness',
        'hang clean'        => 'hang clean barbell crossfit functional hybrid wod fitness',
		'Sandbag Carry'		=> 'sandbag carry crossfit functional hyrox hybrid wod training gym fitness technique',       
		// Fuerza
        'back squat'        => 'barbell back squat crossfit functional hybrid strength fitness',
        'front squat'       => 'barbell front squat crossfit functional hybrid strength fitness',
        'overhead squat'    => 'barbell overhead squat crossfit functional hybrid strength fitness',
        'deadlift'          => 'deadlift barbell crossfit',
        'romanian deadlift' => 'deadlift barbell crossfit',
        'bench press'       => 'bench press barbell crossfit strength fitness',
        'strict press'      => 'overhead press strict press barbell crossfit strength fitness',
        'push press'        => 'barbell push press crossfit strength fitness',
        'barbell row'       => 'bent over barbell row crossfit strength fitness',
        // Gimnásticos / funcionales
        'pull ups'          => 'pull-up exercise crossfit rig gymnastics fitness',
        'pull up'           => 'pull-up exercise crossfit rig gymnastics fitness',
        'dominadas'         => 'pull-up exercise crossfit rig gymnastics fitness',
        'ring row'          => 'ring row gymnastics rings crossfit fitness',
        'rope climb'        => 'rope climb crossfit rig fitness',
        'box jumps'         => 'box jump plyo box crossfit fitness',
        'box jump'          => 'box jump plyo box crossfit fitness',
        'burpees'           => 'burpee crossfit fitness',
        'burpee'            => 'burpee crossfit fitness',
        'push ups'          => 'flexiones push up crossfit',
        'push up'           => 'flexiones crossfit',
        'flexiones'         => 'push-up exercise crossfit fitness',
        'wall balls'        => 'wall ball shot medicine ball crossfit fitness',
        'wall ball'         => 'wall ball shot medicine ball crossfit fitness',
        'kettlebell swings' => 'kettlebell swing crossfit fitness',
        'kettlebell swing'  => 'kettlebell swing crossfit fitness',
        'farmer carry'      => 'farmer carry farmer walk crossfit sandbag fitness',
        'sled drag'         => 'sled drag push crossfit fitness',
        // Cardio (Cross-training/Hyrox)
        'row'               => 'rowing machine erg concept2 crossfit hyrox fitness',
        'remo'              => 'rowing machine erg concept2 crossfit hyrox fitness',
        'run'               => 'running 200m 400m track sprint crossfit hyrox fitness',
        'carrera'           => 'running 200m 400m track sprint crossfit hyrox fitness',
        // ES directos
        'sentadilla trasera'=> 'barbell back squat crossfit strength fitness',
        'sentadilla frontal'=> 'barbell front squat crossfit strength fitness',
        'peso muerto'       => 'barbell deadlift crossfit strength fitness',
        'press banca'       => 'bench press barbell crossfit strength fitness',
        'press militar'     => 'overhead press barbell crossfit strength fitness',
        'zancadas'          => 'lunge exercise crossfit fitness',
        'remo con barra'    => 'bent over barbell row crossfit strength fitness',
    ];

    foreach ($map as $key => $q) {
        if (strpos($s, $key) !== false) {
            $extra = (stripos($bloqueTipo, 'conditioning') !== false) ? ' wod' : '';
            return trim($q . $extra);
        }
    }

    // 3) Fallback: nombre limpio + contexto específico
    $tags = ['crossfit','functional','hyrox','hybrid','wod','training','gym','fitness'];
    if ($bloqueTipo) $tags[] = 'technique';
    return trim($s . ' ' . implode(' ', $tags));
}

/* ==== Selector binario Pexels -> Wikimedia -> Placeholder ==== */
function pf_fetch_exercise_image_binary($ejNombre, $bloqueTipo, $tipoPrueba) {
    $q = pf_stock_query_from_exercise($ejNombre, $bloqueTipo);

    // 1) Pexels
    $px = pf_pexels_fetch_image($q);
    if ($px && !empty($px['bin'])) return $px;

    // 2) Wikimedia
    $wm = pf_wikimedia_fetch_image($q);
    if ($wm && !empty($wm['bin'])) return $wm;

    // 3) Placeholder
    $b64 = pf_placeholder_b64();
    $bin = base64_decode($b64);
    return ['bin'=>$bin, 'ext'=>'png', 'credit'=>'placeholder', 'source'=>'placeholder', 'page'=>null];
}
/* ====== (IA TEXTO) ====== */
function pf_call_openai($prompt, $apiKey) {
    // Ahora usamos Google Gemini en lugar de OpenAI
    if (!$apiKey) {
        error_log("[PF][Gemini] Sin API key configurada");
        return null;
    }

    error_log("[PF][Gemini] Prompt (primeros 400 caracteres): " . substr($prompt, 0, 400));

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' . urlencode($apiKey);

    $payload = [
        "contents" => [
            [
                "role" => "user",
                "parts" => [
                    ["text" => $prompt]
                ]
            ]
        ]
        // generationConfig eliminado - responseMimeType no es soportado en esta versión de la API
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);

    $res = curl_exec($ch);
    if ($res === false) {
        error_log("[PF][Gemini] cURL error: " . curl_error($ch));
        curl_close($ch);
        return null;
    }

    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    error_log("[PF][Gemini] HTTP $http, raw (primeros 800 chars): " . substr($res, 0, 800));

    if ($http < 200 || $http >= 300) {
        error_log("[PF][Gemini] HTTP error body: " . $res);
        return null;
    }

    $dec = json_decode($res, true);
    if (isset($dec['error'])) {
        error_log("[PF][Gemini] API error: " . json_encode($dec['error']));
        return null;
    }

    $text = $dec['candidates'][0]['content']['parts'][0]['text'] ?? null;
    if (!$text) {
        error_log("[PF][Gemini] Sin texto en candidates[0].content.parts[0].text");
        return null;
    }

    error_log("[PF][Gemini] Texto devuelto (primeros 400 chars): " . substr($text, 0, 400));

    $json = json_decode($text, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("[PF][Gemini] JSON parse error: " . json_last_error_msg());
        return null;
    }

    return $json;
}

/** === Prompt de semana === **/
function pf_prompt_semana($row, $weekN, $startISO, $endISO, $promptExtra='', $seed='') {
    $tipo   = $row['tipo_prueba'] ?? 'fuerza y acondicionamiento';
    $dias   = $row['dias_semana'] ?? '[]';
    $horas  = $row['horas_semana'] ?? null;

    $diasTxt = '';
    $dec = json_decode($dias, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($dec) && count($dec)) {
        $diasTxt = implode(', ', array_map(fn($d)=>ucfirst($d), $dec));
    }
    $dispon = $horas ? (trim($horas) . ' h/semana') : 'no especificado';
    $semilla = $seed ?: substr(sha1(($row['id'] ?? 'x')."-".$weekN."-".microtime(true)), 0, 8);

    $schema = <<<JSON
{
  "semana": $weekN,
  "titulo": "Semana $weekN",
  "fecha_inicio": "$startISO",
  "fecha_fin": "$endISO",
  "resumen": "Texto breve (2-4 frases) del foco semanal.",
  "glosario": [
    { "termino": "AMRAP", "significado": "Haz tantas rondas como puedas en el tiempo indicado." },
    { "termino": "EMOM", "significado": "Ejercicios que empiezan cada minuto, el tiempo restante es descanso." },
    { "termino": "For time", "significado": "Completa el trabajo lo más rápido posible manteniendo buena técnica." }
  ],
  "sesiones": [
    {
      "dia": "Lunes",
      "bloques": [
        {
          "tipo": "A - Strength/Skill",
          "descripcion": "Qué se trabaja",
          "explicacion_neofita": "Explicación sencilla para principiantes del bloque.",
          "ejercicios": [
            {
              "nombre": "Back Squat",
              "series": 5,
              "reps": "3-5",
              "carga": { "rx": "80-85% 1RM", "scaled": "60-70% 1RM", "beginner": "40-50% 1RM" },
              "rpe": "7-8",
              "tempo": "30X1",
              "descanso": "90\"",
              "notas": "Profundidad paralela y control",
              "escalado": { "rx": "—", "scaled": "Goblet squat 22.5kg", "beginner": "Air squat lento" },
              "explicacion_neofita": "Consejo sencillo para hacer este ejercicio si eres novato."
            }
          ]
        },
        {
          "tipo": "B - Conditioning (AMRAP/For time/Intervals)",
          "formato": "AMRAP 12'",
          "tc": "12'",
          "rondas": null,
          "descanso_entre_series": null,
          "rpe_objetivo": "7",
          "descripcion": "Trabajo metabólico",
          "explicacion_neofita": "Explica el formato y cómo regular el esfuerzo.",
          "ejercicios": [
            { "nombre": "200 m Run", "series": 1, "reps": "200m", "explicacion_neofita": "Corre suave; si cansa mucho, camina parte." },
            { "nombre": "KB Swings 24/16kg", "series": 1, "reps": "12", "explicacion_neofita": "Usa peso ligero y prioriza la técnica." },
            { "nombre": "Push Ups", "series": 1, "reps": "10", "explicacion_neofita": "Si es difícil, apoya rodillas o haz en banco." }
          ],
          "escalado": {
            "rx": "24/16kg, push-ups estrictas",
            "scaled": "20/12kg, push-ups con rodillas",
            "beginner": "KB 12/8kg, inclinadas en banco"
          },
          "notas": "Constante pero sostenible"
        }
      ],
      "finisher": {
        "opcionales": [
          { "nombre": "Core Hollow Rocks", "series": 3, "reps": "20" },
          { "nombre": "Mobility cadera", "series": 1, "reps": "5-8'" }
        ]
      }
    }
  ]
}
JSON;

    $diversidad = <<<TXT
Diversidad y no repetición:
- 6 sesiones: Lunes–Sábado (en ese orden).
- Alterna patrones (sentadilla/empuje/tirón/bisagra/olímpico/carries).
- Varía formatos sin repetir dos días seguidos.
- Back Squat y Deadlift como mucho 1 día/semana cada uno.
- 1–2 movimientos funcionales de bombero.
TXT;

    $prompt = <<<PROMPT
Genera SOLO JSON válido para una semana de entrenamiento estilo WOD (Lunes a Sábado) con niveles RX/Scaled/Beginner y/o RPE.

⚠️ REQUISITO OBLIGATORIO CRÍTICO ⚠️
TODOS Y CADA UNO de los ejercicios en TODOS los días (Lunes, Martes, Miércoles, Jueves, Viernes, Sábado) DEBEN incluir SIEMPRE:
- "series": número (ejemplo: 3, 5, 1)
- "reps": string con repeticiones (ejemplo: "10", "8-12", "200m", "60s", "max")

Ejemplos OBLIGATORIOS para cada tipo de ejercicio:
{ "nombre": "Push Ups", "series": 3, "reps": "10-12" }
{ "nombre": "Box Jumps", "series": 3, "reps": "12" }
{ "nombre": "KB Swings 24/16kg", "series": 1, "reps": "24" }
{ "nombre": "Run", "series": 1, "reps": "200m" }
{ "nombre": "Burpees", "series": 1, "reps": "15" }
{ "nombre": "Row", "series": 1, "reps": "250m" }

NUNCA omitas series/reps. Esto aplica a CADA ejercicio de CADA día sin excepción.

Contexto:
- Objetivo/Prueba: {$tipo}
- Días preferentes: {$diasTxt}
- Disponibilidad: {$dispon}
- Fechas semana {$weekN}: {$startISO} → {$endISO}
- Semilla: {$semilla}
- Idioma: español.

Estructura exacta:
{$schema}

Reglas OBLIGATORIAS:
1. TODOS los ejercicios DEBEN tener "series" (número) y "reps" (string) en TODOS los días
2. En CADA BLOQUE y en CADA EJERCICIO añade "explicacion_neofita"
3. Añade "glosario" semanal con 3-6 términos
4. Volúmenes realistas; evitar fallo prematuro
5. Nada fuera del JSON

{$diversidad}

{$promptExtra}

RECORDATORIO FINAL: Verifica que CADA ejercicio de CADA día (Lunes a Sábado) tenga "series" y "reps" antes de enviar el JSON.
PROMPT;

    return $prompt;
}

/** === Historial para diversidad === **/
function pf_flatten_movs_from_weeks($weeks){
    $movs=[]; $formatos=[]; $bloquesA=[];
    foreach($weeks as $w){
        if (empty($w) || empty($w['sesiones'])) continue;
        foreach($w['sesiones'] as $s){
            if (empty($s['bloques'])) continue;
            foreach($s['bloques'] as $bi=>$b){
                $form = $b['formato'] ?? null; if ($form) $formatos[] = strtolower($form);
                if ($bi===0 && isset($b['ejercicios'][0]['nombre'])) $bloquesA[] = strtolower($b['ejercicios'][0]['nombre']);
                if (!empty($b['ejercicios'])) foreach ($b['ejercicios'] as $e){
                    if (!empty($e['nombre'])) $movs[] = strtolower($e['nombre']);
                }
            }
        }
    }
    return [array_values(array_unique($movs)), array_values(array_unique($formatos)), array_values(array_unique($bloquesA))];
}

function pf_build_diversity_extra($conn,$pid,$weekN){
    [$plan_dec] = ultimo_plan_ia_fisico($conn,$pid);
    $planArr = [];
    if ($plan_dec) $planArr = $plan_dec['plan'] ?? (pf_is_list($plan_dec) ? $plan_dec : []);
    $recent=[];
    for($i=max(0,$weekN-4); $i<$weekN-1; $i++){ if (!empty($planArr[$i])) $recent[]=$planArr[$i]; }
    [$movs,$formats,$bloquesA] = pf_flatten_movs_from_weeks($recent);

    $alt_patterns = [
        'fuerza'=>['Front Squat','Overhead Squat','Zercher Squat','Bulgarian Split Squat','Lunges con carga'],
        'empuje'=>['Push Press','Strict Press','Dumbbell Press','Landmine Press','HSPU (progresiones)'],
        'traccion'=>['Ring Rows','Barbell Row','Chest-to-bar','Rope Climb','Towel Pull-ups'],
        'bisagra'=>['Romanian Deadlift','KB Deadlift','Good Mornings','Sandbag Ground-to-Shoulder'],
        'olimpicos'=>['Power Clean','Hang Clean','Power Snatch','Hang Snatch','Clean & Jerk (técnica)'],
        'carries'=>['Farmer Carry','Front Rack Carry','Sandbag Carry','Sled Drag/Push'],
    ];
    $json = json_encode([
        'usados_ejercicios'=>$movs,
        'usados_formatos'=>$formats,
        'usados_primer_bloque'=>$bloquesA,
        'alternativas'=>$alt_patterns
    ], JSON_UNESCAPED_UNICODE);

    return "Diversidad (historial reciente):\n".$json;
}

/** === Fallback rápido === **/
function pf_week_fallback_fast($row, $weekN, $startISO, $endISO, $forceDay=null) {
    $seed = crc32(($row['id'] ?? 'x')."-".$weekN."-".($forceDay ?? 'all'));
    mt_srand($seed);

    $dias = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    $formats = ["AMRAP 10'", "AMRAP 12'", "EMOM 12'", "For time", "Intervals 4x4'", "Ladder 10-1"];
    $strengthGroups = [
        ['Back Squat','Front Squat','Overhead Squat'],
        ['Deadlift','Romanian Deadlift'],
        ['Bench Press','Strict Press','Push Press'],
        ['Clean (técnica)','Power Clean','Hang Clean'],
        ['Snatch (técnica)','Power Snatch','Hang Snatch'],
        ['Pull-ups estrictas','Ring Row','Barbell Row'],
        ['Sandbag Carry','Farmer Carry','Sled Drag']
    ];

    $targetDays = $forceDay ? [$forceDay] : $dias;
    $sesiones = [];
    foreach ($targetDays as $d) {
        $grp    = $strengthGroups[mt_rand(0, count($strengthGroups)-1)];
        $main   = $grp[mt_rand(0, count($grp)-1)];
        $format = $formats[mt_rand(0, count($formats)-1)];
        $tc     = preg_match('/^(AMRAP|EMOM)/', $format) ? explode(' ',$format)[1] : (mt_rand(0,1) ? "12'" : "15'");

        $sesiones[] = [
            'dia' => $d,
            'bloques' => [
                [
                    'tipo' => 'A - Strength/Skill',
                    'descripcion' => 'Fuerza/Skill principal',
                    'explicacion_neofita' => 'Bloque de fuerza: usa carga que permita buena técnica. Principiantes: aprende el gesto con poco peso.',
                    'ejercicios' => [[
                        'nombre' => $main,
                        'series' => mt_rand(4,6),
                        'reps'   => (mt_rand(0,1) ? '3-5' : '5-7'),
                        'carga'  => ['rx'=>'70-85% 1RM','scaled'=>'50-65% 1RM','beginner'=>'30-45% 1RM'],
                        'rpe'    => (string)mt_rand(6,8),
                        'tempo'  => (mt_rand(0,1) ? '30X1' : '20X1'),
                        'descanso'=>'90"',
                        'notas'  => 'Técnica sólida',
                        'escalado'=>['rx'=>'—','scaled'=>'Variante KB/DB','beginner'=>'Patrón sin carga'],
                        'explicacion_neofita' => 'Barra vacía o mancuernas ligeras; control y sin dolor.'
                    ]]
                ],
                [
                    'tipo' => 'B - Conditioning',
                    'formato' => $format,
                    'tc' => $tc,
                    'rondas' => null,
                    'descanso_entre_series' => null,
                    'rpe_objetivo' => (string)mt_rand(6,8),
                    'descripcion' => 'Trabajo metabólico',
                    'explicacion_neofita' => 'Ritmo cómodo; reduce reps o descansa si te agotas.',
                    'ejercicios' => [
                        ['nombre' => (mt_rand(0,1)? '200 m Run':'300 m Row'), 'explicacion_neofita'=>'Corre/rema suave; camina si hace falta.'],
                        ['nombre' => (mt_rand(0,1)? 'Kettlebell Swings 24/16kg':'Wall Balls 9/6kg'), 'explicacion_neofita'=>'Usa poco peso/altura; cuida la espalda.'],
                        ['nombre' => (mt_rand(0,1)? 'Burpees':'Box Jumps'), 'explicacion_neofita'=>'Burpees con step o cajón bajo.']
                    ],
                    'escalado' => ['rx'=>'—','scaled'=>'Reducir carga/altura','beginner'=>'Versiones asistidas'],
                    'notas' => 'Ritmo sostenible'
                ]
            ],
            'finisher' => [ 'opcionales' => [
                ['nombre'=>'Core work','reps'=>'3x20'],
                ['nombre'=>'Movilidad','reps'=>"5-8'"]
            ] ]
        ];
    }

    $glosario = [
        ['termino'=>'AMRAP', 'significado'=>'Haz tantas rondas como puedas en el tiempo marcado.'],
        ['termino'=>'EMOM', 'significado'=>'Empieza una serie cada minuto; el resto del minuto descansas.'],
        ['termino'=>'For time', 'significado'=>'Completa todo lo antes posible con buena técnica.'],
        ['termino'=>'RPE', 'significado'=>'Esfuerzo percibido 1–10; 7 = duro pero sostenible.'],
        ['termino'=>'Tempo', 'significado'=>'Ritmo del movimiento (p. ej., 30X1).']
    ];

    return [
        'semana' => $weekN,
        'titulo' => "Semana $weekN",
        'fecha_inicio' => $startISO,
        'fecha_fin' => $endISO,
        'resumen' => 'Foco variado con rotación de patrones.',
        'glosario' => $glosario,
        'sesiones' => $sesiones
    ];
}

/** === Fechas semana N === **/
function pf_week_dates($planRow, $weekN) {
    $fi = new DateTime($planRow['fecha_inicio']);
    $ffPlan = new DateTime($planRow['fecha_fin']);
    $start = (clone $fi)->modify('+' . (($weekN-1)*7) . ' days');
    $end   = (clone $start)->modify('+6 days');
    if ($end > $ffPlan) $end = $ffPlan;
    return [$start->format('Y-m-d'), $end->format('Y-m-d')];
}

/** === Normalizador semana === */
function pf_normalize_week($week, $row, $weekN, $startISO, $endISO) {
    if (!is_array($week)) $week=[];
    $week['semana'] = $week['semana'] ?? $weekN;
    $week['titulo'] = $week['titulo'] ?? ("Semana ".$weekN);
    $week['fecha_inicio'] = $week['fecha_inicio'] ?? $startISO;
    $week['fecha_fin']    = $week['fecha_fin'] ?? $endISO;
    if (!isset($week['glosario']) || !is_array($week['glosario'])) $week['glosario'] = [];

    $needDays = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    $map = [];
    if (isset($week['sesiones']) && is_array($week['sesiones'])) {
        foreach ($week['sesiones'] as $s) { $map[pf_normstr($s['dia'] ?? '')] = $s; }
    }

    $sesiones = [];
    foreach ($needDays as $d) {
        $k = pf_normstr($d);
        if (isset($map[$k]) && is_array($map[$k])) { $s = $map[$k]; $s['dia']=$d; }
        else { $fallback = pf_week_fallback_fast($row,$weekN,$startISO,$endISO,$d); $s=$fallback['sesiones'][0]; }

        if (!isset($s['bloques']) || !is_array($s['bloques'])) $s['bloques'] = [];
        foreach ($s['bloques'] as &$b) {
            if (empty($b['explicacion_neofita'])) $b['explicacion_neofita'] = 'Empieza suave, cuida la técnica y descansa si lo necesitas.';
            if (!isset($b['ejercicios']) || !is_array($b['ejercicios'])) $b['ejercicios'] = [];
            foreach ($b['ejercicios'] as &$e) {
                if (empty($e['explicacion_neofita'])) $e['explicacion_neofita'] = 'Usa menos peso/altura o apoya rodillas; prioriza el control.';
            }
            unset($e);
        }
        unset($b);

        $sesiones[] = $s;
    }
    $week['sesiones'] = $sesiones;
    return $week;
}

/** === Última versión IA + ratio avance === **/
function ultimo_plan_ia_fisico($conn, $plan_id) {
    $stmt = $conn->prepare("SELECT plan_json, resumen FROM planes_fisicos_ia WHERE id_plan = ? ORDER BY fecha DESC LIMIT 1");
    if (!$stmt) return [null, null, 0];
    $stmt->bind_param("i", $plan_id);
    $stmt->execute();
    $stmt->bind_result($plan_json, $resumen);
    $num_semanas = 0; $plan_dec = null;
    if ($stmt->fetch()) {
        $plan_dec = safe_json_decode($plan_json);
        if (is_array($plan_dec)) {
            if (isset($plan_dec['plan']) && is_array($plan_dec['plan'])) $num_semanas = count($plan_dec['plan']);
            elseif (pf_is_list($plan_dec)) $num_semanas = count($plan_dec);
        }
    }
    $stmt->close();
    return [$plan_dec, $resumen, $num_semanas];
}
function avance_ratio_fisico($conn, $plan_id, $user_id, $num_semanas) {
    if ($num_semanas <= 0) return [[], 0.0];
    $stmt = $conn->prepare("SELECT avance_json FROM planes_fisicos_avance WHERE id_plan=? AND id_usuario=?");
    if (!$stmt) return [[], 0.0];
    $stmt->bind_param("ii", $plan_id, $user_id);
    $stmt->execute();
    $stmt->bind_result($avance_json);
    $avance = [];
    if ($stmt->fetch() && $avance_json) { $tmp = safe_json_decode($avance_json); if (is_array($tmp)) $avance = $tmp; }
    $stmt->close();

    if (!is_array($avance) || count($avance) !== $num_semanas) $avance = array_fill(0, $num_semanas, false);
    $hechas = 0; foreach ($avance as $v) if ($v) $hechas++;
    $ratio = $num_semanas ? ($hechas / $num_semanas) : 0.0;
    return [$avance, $ratio];
}

/** ===================== 1) LISTAR ===================== **/
if ($method === 'GET' && $action === 'listar') {
    $uid = $id_usuario ?: intval($payload['user_id'] ?? $payload['id_usuario'] ?? $payload['id'] ?? 0);
    if (!$uid) { echo json_encode(['success'=>false, 'error'=>'Falta id_usuario']); exit; }

    try {
        $stmt = $conn->prepare("SELECT * FROM planes_fisicos WHERE id_usuario = ? ORDER BY fecha_inicio DESC");
        $stmt->bind_param("i", $uid);
        $stmt->execute();
        $res = $stmt->get_result();
        $planes = [];
        while ($row = $res->fetch_assoc()) {
            $plan_id = intval($row['id']);
            $row['tieneIA'] = false; $row['resumen'] = null; $row['ia_avance_ratio'] = 0;

            [$plan_dec, $resumen, $num_semanas] = ultimo_plan_ia_fisico($conn, $plan_id);
            if ($plan_dec) {
                $row['tieneIA'] = true; $row['resumen'] = $resumen;
                [, $ratio] = avance_ratio_fisico($conn, $plan_id, $uid, $num_semanas);
                $row['ia_avance_ratio'] = $ratio;
            }
            $planes[] = $row;
        }
        echo json_encode(['success'=>true, 'planes'=>$planes], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        error_log("listar planes_fisicos error: ".$e->getMessage());
        echo json_encode(['success'=>false, 'error'=>'Error listando planes físicos']);
    }
    exit;
}

/** ===================== 2) CREAR ===================== **/
if ($method === 'POST' && $action === 'crear') {
    $uid = intval($data['id_usuario'] ?? 0);
    $titulo = trim($data['titulo'] ?? '');
    $descripcion = trim($data['descripcion'] ?? '');
    $tipo_prueba = trim($data['tipo_prueba'] ?? ($data['tipo'] ?? ''));
    $fecha_inicio = isset($data['fecha_inicio']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $data['fecha_inicio']) ? $data['fecha_inicio'] : null;
    $fecha_fin    = isset($data['fecha_fin'])    && preg_match('/^\d{4}-\d{2}-\d{2}$/', $data['fecha_fin'])    ? $data['fecha_fin']    : null;

    if (!$uid || !$titulo || !$tipo_prueba || !$fecha_inicio || !$fecha_fin) {
        echo json_encode(['success'=>false, 'error'=>'Todos los campos son obligatorios']); exit;
    }

    $estado = 'activo'; $progreso = 0.00;
    $dias_semana = $data['dias_semana'] ?? null;
    $horas_semana = $data['horas_semana'] ?? null;
    $dias_str = is_array($dias_semana) ? json_encode($dias_semana, JSON_UNESCAPED_UNICODE) : (is_string($dias_semana) ? $dias_semana : null);
    $horas_str = $horas_semana !== null ? strval($horas_semana) : null;

    $stmt = $conn->prepare("INSERT INTO planes_fisicos (id_usuario, titulo, descripcion, tipo_prueba, fecha_inicio, fecha_fin, estado, progreso, dias_semana, horas_semana) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("issssssdss", $uid, $titulo, $descripcion, $tipo_prueba, $fecha_inicio, $fecha_fin, $estado, $progreso, $dias_str, $horas_str);

    if ($stmt->execute()) echo json_encode(['success'=>true, 'id_plan'=>$conn->insert_id]);
    else { error_log("crear plan_fisico error: ".$stmt->error); echo json_encode(['success'=>false, 'error'=>'No se pudo crear el plan físico']); }
    exit;
}

/** ===================== 3) OBTENER DETALLE ===================== **/
if ($method === 'GET' && ($action === 'obtener' || $action === 'detalle') && $id_plan) {
    $res = $conn->query("SELECT * FROM planes_fisicos WHERE id = ".intval($id_plan)." LIMIT 1");
    if (!$res) { echo json_encode(['success'=>false,'error'=>'Error en la consulta']); exit; }
    $plan = $res->fetch_assoc();
    if (!$plan) { echo json_encode(['success'=>false,'error'=>'Plan no encontrado']); exit; }

    [$plan_dec, $resumen, $num_semanas] = ultimo_plan_ia_fisico($conn, $id_plan);
    $respuesta = ['success'=>true, 'plan'=>$plan];

    if ($plan_dec) {
        $respuesta['plan_ia'] = ['plan' => ($plan_dec['plan'] ?? $plan_dec), 'resumen'=>$resumen];
        if ($id_usuario) {
            [$avance, $ratio] = avance_ratio_fisico($conn, $id_plan, $id_usuario, $num_semanas);
            $respuesta['avance'] = $avance;
            $respuesta['ia_avance_ratio'] = $ratio;
        }
    }
    echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);
    exit;
}

/** ===================== 4) GENERAR PLAN IA COMPLETO (rápido) ===================== **/
if ($method === 'POST' && ($action === 'generar' || $action === 'generar_plan_ia')) {
    $pid = intval($data['id_plan'] ?? 0);
    $promptExtra = trim($data['prompt'] ?? '');
    if (!$pid) { echo json_encode(['success'=>false,'error'=>'Falta id_plan']); exit; }

    $resPlan = $conn->query("SELECT * FROM planes_fisicos WHERE id=".$pid." LIMIT 1");
    $row = $resPlan ? $resPlan->fetch_assoc() : null;
    if (!$row) { echo json_encode(['success'=>false,'error'=>'Plan no encontrado']); exit; }

    $fi = new DateTime($row['fecha_inicio']);
    $ff = new DateTime($row['fecha_fin']);
    $dias = max(1, $fi->diff($ff)->days + 1);
    $semanas = max(1, (int)ceil($dias/7));

    $plan = [];
    for ($w=1; $w<=$semanas; $w++) {
        [$startISO, $endISO] = pf_week_dates($row, $w);
        $plan[] = pf_week_fallback_fast($row, $w, $startISO, $endISO);
    }

    $plan_json = json_encode(['plan'=>$plan], JSON_UNESCAPED_UNICODE);
    $resumen = "Plan generado (rápido) en ".$semanas." semanas.";

    $stmt = $conn->prepare("INSERT INTO planes_fisicos_ia (id_plan, plan_json, resumen, fecha) VALUES (?, ?, ?, NOW())");
    $stmt->bind_param("iss", $pid, $plan_json, $resumen);
    $ok = $stmt->execute();

    echo json_encode(['success'=>$ok]);
    exit;
}

/** ===================== 4b) GENERAR SOLO UNA SEMANA ===================== **/
if ($method === 'POST' && $action === 'generar_semana') {
    $pid = intval($data['id_plan'] ?? 0);
    $weekN = intval($data['semana'] ?? 0);
    // Por defecto NO modo rápido, para forzar IA salvo que se pida explícitamente fast=true
    $fast  = isset($data['fast']) ? (bool)$data['fast'] : false;
    $promptExtra = trim($data['prompt'] ?? '');

    error_log("[PF] generar_semana => inicio pid={$pid} semana={$weekN} fast=" . ($fast ? '1' : '0'));

    if (!$pid || $weekN <= 0) { echo json_encode(['success'=>false,'error'=>'Faltan datos (id_plan y semana)']); exit; }

    $resPlan = $conn->query("SELECT * FROM planes_fisicos WHERE id=".$pid." LIMIT 1");
    $row = $resPlan ? $resPlan->fetch_assoc() : null;
    if (!$row) { echo json_encode(['success'=>false,'error'=>'Plan no encontrado']); exit; }

    [$startISO, $endISO] = pf_week_dates($row, $weekN);

    // Obtener API key de varias fuentes posibles (variable global, constantes, entorno)
    global $GOOGLE_API_KEY;
    $apiKey = '';
    if (!empty($GOOGLE_API_KEY)) {
        $apiKey = $GOOGLE_API_KEY;
    } elseif (defined('GOOGLE_API_KEY')) {
        $apiKey = GOOGLE_API_KEY;
    } elseif (defined('OPENAI_API_KEY')) { // por si en config.php sigue este nombre
        $apiKey = OPENAI_API_KEY;
    } else {
        $apiKey = getenv('GOOGLE_API_KEY') ?: '';
    }

    error_log("[PF] generar_semana => apiKey_len=" . strlen($apiKey) . " fast=" . ($fast ? '1' : '0'));

    $seed = substr(sha1($pid.'-'.$weekN.'-'.microtime(true)), 0, 8);

    $week = null; $usedIA = false;
    if (!$fast && $apiKey) {
        $diversidadExtra = pf_build_diversity_extra($conn, $pid, $weekN);
        $prompt = pf_prompt_semana($row, $weekN, $startISO, $endISO, trim($promptExtra . "\n\n" . $diversidadExtra), $seed);

        error_log("[PF] generar_semana => llamando IA week=$weekN fast=".($fast?'1':'0')." seed=$seed");

        $resIA = pf_call_openai($prompt, $apiKey);
        if (!$resIA) {
            error_log("[PF] generar_semana => resIA NULL (fallo IA) week=$weekN");
        } else {
            error_log("[PF] generar_semana => resIA OK keys=".implode(',', array_keys($resIA)));
        }

        if ($resIA && (isset($resIA['sesiones']) || isset($resIA['plan']))) {
            if (isset($resIA['sesiones'])) {
                $week = [
                    'semana' => $resIA['semana'] ?? $weekN,
                    'titulo' => $resIA['titulo'] ?? ("Semana ".$weekN),
                    'fecha_inicio' => $resIA['fecha_inicio'] ?? $startISO,
                    'fecha_fin' => $resIA['fecha_fin'] ?? $endISO,
                    'resumen' => $resIA['resumen'] ?? '',
                    'glosario' => $resIA['glosario'] ?? [],
                    'sesiones' => $resIA['sesiones']
                ];
            } elseif (isset($resIA['plan'][0]['sesiones'])) {
                $w = $resIA['plan'][0];
                $week = [
                    'semana' => $weekN,
                    'titulo' => $w['titulo'] ?? ("Semana ".$weekN),
                    'fecha_inicio' => $w['fecha_inicio'] ?? $startISO,
                    'fecha_fin' => $w['fecha_fin'] ?? $endISO,
                    'resumen' => $w['resumen'] ?? '',
                    'glosario' => $w['glosario'] ?? [],
                    'sesiones' => $w['sesiones']
                ];
            }
            if ($week) { error_log("[PF] generar_semana IA_USED week=$weekN seed=$seed"); $usedIA = true; }
            else { error_log("[PF] generar_semana IA_RESP_INVALID week=$weekN"); }
        } else { error_log("[PF] generar_semana IA_FALLBACK week=$weekN (sin respuesta IA)"); }
    } else { if ($fast) error_log("[PF] generar_semana FAST week=$weekN"); }

    if (!$week) $week = pf_week_fallback_fast($row, $weekN, $startISO, $endISO);

    $week = pf_normalize_week($week, $row, $weekN, $startISO, $endISO);

    [$plan_dec, $oldResumen, $num_semanas] = ultimo_plan_ia_fisico($conn, $pid);
    $planArr = [];
    if ($plan_dec) $planArr = $plan_dec['plan'] ?? (pf_is_list($plan_dec) ? $plan_dec : []);
    for ($i = count($planArr); $i < ($weekN-1); $i++) $planArr[$i] = null;
    $planArr[$weekN-1] = $week;

    $newPlan = ['plan'=>$planArr];
    $resumen = $oldResumen ?: ($week['resumen'] ?? 'Plan IA por semanas');

    $plan_json = json_encode($newPlan, JSON_UNESCAPED_UNICODE);
    $stmt = $conn->prepare("INSERT INTO planes_fisicos_ia (id_plan, plan_json, resumen, fecha) VALUES (?, ?, ?, NOW())");
    $stmt->bind_param("iss", $pid, $plan_json, $resumen);
    $ok = $stmt->execute();

    echo json_encode(['success'=>$ok, 'week'=>$week, 'resumen'=>$resumen, 'used_ia'=>$usedIA], JSON_UNESCAPED_UNICODE);
    exit;
}

/** ===================== 5) ACTUALIZAR ===================== **/
if (($method === 'POST' || $method === 'PUT') && $action === 'actualizar') {
    $pid = intval($_GET['id_plan'] ?? ($data['id_plan'] ?? 0));
    if (!$pid) { echo json_encode(['success'=>false, 'error'=>'Falta id_plan']); exit; }

    $campos = [
        'titulo' => 's',
        'descripcion' => 's',
        'tipo_prueba' => 's',
        'fecha_inicio' => 's',
        'fecha_fin' => 's',
        'estado' => 's',
        'progreso' => 'd',
        'dias_semana' => 's',
        'horas_semana' => 's',
    ];
    $fields=[]; $types=''; $values=[];
    foreach ($campos as $k=>$t) {
        if (array_key_exists($k,$data)) {
            $val = $data[$k];
            if ($k==='dias_semana') $val = is_array($val)?json_encode($val,JSON_UNESCAPED_UNICODE):(is_string($val)?$val:null);
            if ($k==='progreso')    $val = is_numeric($val)?floatval($val):0.0;
            $fields[]="$k=?"; $types.=$t; $values[]=$val;
        }
    }
    if (!count($fields)) { echo json_encode(['success'=>false,'error'=>'Nada que actualizar']); exit; }
    $types.='i'; $values[]=$pid;

    $sql = "UPDATE planes_fisicos SET ".implode(', ',$fields)." WHERE id=?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) { echo json_encode(['success'=>false,'error'=>'Prepare fallido','detail'=>$conn->error]); exit; }
    $stmt->bind_param($types, ...$values);
    $ok = $stmt->execute();
    echo json_encode(['success'=>$ok]);
    exit;
}

/** ===================== 6) AVANCE ===================== **/
if ($method === 'PUT' && $action === 'avance') {
    $pid = intval($data['id_plan'] ?? 0);
    $uid = intval($data['id_usuario'] ?? 0);
    $sem = isset($data['semana']) ? intval($data['semana']) : null;
    $realizado = isset($data['realizado']) ? (bool)$data['realizado'] : false;
    if (!$pid || !$uid || $sem === null) { echo json_encode(['success'=>false,'error'=>'Faltan datos']); exit; }

    [$plan_dec, , $num_sem] = ultimo_plan_ia_fisico($conn, $pid);
    if ($num_sem <= 0) { echo json_encode(['success'=>false,'error'=>'No hay plan IA']); exit; }

    $cur = $conn->prepare("SELECT avance_json FROM planes_fisicos_avance WHERE id_plan=? AND id_usuario=?");
    $cur->bind_param("ii", $pid, $uid); $cur->execute();
    $cur->bind_result($avance_json); $avance=null;
    if ($cur->fetch()) $avance = safe_json_decode($avance_json);
    $cur->close();

    if (!is_array($avance) || count($avance) !== $num_sem) $avance = array_fill(0, $num_sem, false);
    $avance[$sem] = $realizado;
    $nuevo = json_encode($avance);

    $stmt = $conn->prepare(
        "INSERT INTO planes_fisicos_avance (id_plan, id_usuario, avance_json, fecha)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE avance_json=VALUES(avance_json), fecha=NOW()"
    );
    $stmt->bind_param("iis", $pid, $uid, $nuevo);
    $ok = $stmt->execute();
    echo json_encode(['success'=>$ok, 'avance'=>$avance]);
    exit;
}
if ($method === 'POST' && $action === 'avance') {
    $pid = intval($data['id_plan'] ?? 0);
    $uid = intval($data['id_usuario'] ?? 0);
    $avance = $data['avance'] ?? null;
    if (!$pid || !$uid || !is_array($avance)) { echo json_encode(['success'=>false,'error'=>'Faltan datos']); exit; }
    $json = json_encode($avance);
    $stmt = $conn->prepare(
        "INSERT INTO planes_fisicos_avance (id_plan, id_usuario, avance_json, fecha)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE avance_json=VALUES(avance_json), fecha=NOW()"
    );
    $stmt->bind_param("iis", $pid, $uid, $json);
    $ok = $stmt->execute();
    echo json_encode(['success'=>$ok]);
    exit;
}

/** ===================== 7) ELIMINAR ===================== **/
if (($method === 'DELETE' && $action === 'eliminar' && $id_plan) ||
    ($method === 'POST'   && $action === 'eliminar' && isset($data['id_plan']))) {

    $pid = $method === 'DELETE' ? intval($id_plan) : intval($data['id_plan']);
    $conn->query("DELETE FROM planes_fisicos_avance WHERE id_plan = $pid");
    $conn->query("DELETE FROM planes_fisicos_ia     WHERE id_plan = $pid");
    $ok = $conn->query("DELETE FROM planes_fisicos   WHERE id = $pid");
    echo json_encode(['success'=> (bool)$ok]);
    exit;
}

/** ===================== X) GENERAR MEDIA POR SEMANA (Pexels -> Wikimedia) ===================== **/
if ($method === 'POST' && $action === 'generar_media_semana') {
    $pid   = intval($data['id_plan'] ?? 0);
    $weekN = intval($data['semana'] ?? 0);
    $maxImgs = intval($data['max_imgs'] ?? 999);
    if (!$pid || $weekN <= 0) { echo json_encode(['success'=>false,'error'=>'Faltan id_plan/semana']); exit; }

    $resPlan = $conn->query("SELECT * FROM planes_fisicos WHERE id=".$pid." LIMIT 1");
    $planRow = $resPlan ? $resPlan->fetch_assoc() : null;
    if (!$planRow) { echo json_encode(['success'=>false,'error'=>'Plan no encontrado']); exit; }

    [$plan_dec, , ] = ultimo_plan_ia_fisico($conn, $pid);
    if (!$plan_dec) { echo json_encode(['success'=>false,'error'=>'No hay plan IA para este plan']); exit; }

    $planArr = $plan_dec['plan'] ?? (pf_is_list($plan_dec) ? $plan_dec : []);
    $week = $planArr[$weekN-1] ?? null;
    if (!$week || empty($week['sesiones'])) { echo json_encode(['success'=>false,'error'=>'Semana no encontrada']); exit; }

    $baseDir = __DIR__ . "/uploads/planes_fisicos/".intval($pid)."/sem".$weekN;
    $baseUrl = "/api/uploads/planes_fisicos/".intval($pid)."/sem".$weekN;

    $creadas=0; $fallidas=0; $items=[];
    foreach ($week['sesiones'] as $sesion) {
        $dia = $sesion['dia'] ?? 'Dia'; // typo-safe
        $dia = $sesion['dia'] ?? 'Dia';
        $diaSan = pf_sanitize_filename($dia);
        $diaDir = $baseDir . '/' . $diaSan;
        $diaUrl = $baseUrl . '/' . $diaSan;

        if (empty($sesion['bloques']) || !is_array($sesion['bloques'])) continue;
        foreach ($sesion['bloques'] as $bi => $bloque) {
            $bloqueTipo = $bloque['tipo'] ?? 'Bloque';
            if (empty($bloque['ejercicios']) || !is_array($bloque['ejercicios'])) continue;
            foreach ($bloque['ejercicios'] as $ei => $ej) {
                if ($creadas >= $maxImgs) break 3;

                $ejNombre = $ej['nombre'] ?? 'Ejercicio';
                $res = pf_fetch_exercise_image_binary($ejNombre, $bloqueTipo, $planRow['tipo_prueba'] ?? 'Entrenamiento');
                $ext = $res['ext'] ?? 'jpg';
                $fuente = $res['source'] ?? 'placeholder';
                $credit = $res['credit'] ?? '';
                $bin = $res['bin'] ?? null;

                $fname = "b{$bi}-e{$ei}-".pf_sanitize_filename($ejNombre).".".$ext;
                $dest  = $diaDir . '/' . $fname;
                $ok = $bin ? pf_save_binary_image($bin, $dest) : false;
                if (!$ok) { $fallidas++; continue; }

                $url = $diaUrl . '/' . $fname;
                $prompt = "query: ".pf_stock_query_from_exercise($ejNombre,$bloqueTipo).($credit? " | credit: $credit" : '');
                $rec = [
                    'id_plan' => $pid, 'semana' => $weekN, 'dia' => $dia,
                    'bloque_idx' => $bi, 'ejercicio_idx' => $ei, 'tipo' => 'image',
                    'url' => $url, 'prompt' => $prompt, 'fuente' => $fuente
                ];
                pf_store_media_record($conn, $rec);
                $items[] = $rec; $creadas++;
            }
        }
    }
    echo json_encode(['success'=>true, 'creadas'=>$creadas, 'fallidas'=>$fallidas, 'items'=>$items], JSON_UNESCAPED_UNICODE);
    exit;
}

/** ===================== NUEVO) LISTAR MEDIA POR DÍA ===================== **/
if ($method === 'GET' && $action === 'listar_media_dia') {
    $pid   = intval($_GET['id_plan'] ?? 0);
    $weekN = intval($_GET['semana'] ?? 0);
    $dia   = $_GET['dia'] ?? '';
    if (!$pid || !$weekN || !$dia) { echo json_encode(['success'=>false,'error'=>'Faltan id_plan/semana/dia']); exit; }

    $sql="SELECT id,id_plan,semana,dia,bloque_idx,ejercicio_idx,tipo,url,prompt,fuente,fecha
          FROM planes_fisicos_media
          WHERE id_plan=? AND semana=? AND dia=?
          ORDER BY bloque_idx, ejercicio_idx";
    $stmt=$conn->prepare($sql);
    if(!$stmt){ echo json_encode(['success'=>false,'error'=>'Prepare fallido']); exit; }
    $stmt->bind_param("iis",$pid,$weekN,$dia);
    $stmt->execute();
    $res=$stmt->get_result();
    $out=[]; while($row=$res->fetch_assoc()) $out[]=$row;
    echo json_encode(['success'=>true,'media'=>$out], JSON_UNESCAPED_UNICODE);
    exit;
}

/** ===================== NUEVO) GENERAR MEDIA POR DÍA (Pexels -> Wikimedia) ===================== **/
if ($method === 'POST' && $action === 'generar_media_dia') {
    $pid = intval($data['id_plan'] ?? 0);
    $weekN = intval($data['semana'] ?? 0);
    $dia = trim($data['dia'] ?? '');
    $maxImgs = intval($data['max_imgs'] ?? 999);
    if (!$pid || !$weekN || !$dia) { echo json_encode(['success'=>false,'error'=>'Faltan id_plan/semana/dia']); exit; }

    $resPlan = $conn->query("SELECT * FROM planes_fisicos WHERE id=".$pid." LIMIT 1");
    $planRow = $resPlan ? $resPlan->fetch_assoc() : null;
    if (!$planRow) { echo json_encode(['success'=>false,'error'=>'Plan no encontrado']); exit; }

    [$plan_dec, , ] = ultimo_plan_ia_fisico($conn, $pid);
    if (!$plan_dec) { echo json_encode(['success'=>false,'error'=>'No hay plan IA para este plan']); exit; }

    $planArr = $plan_dec['plan'] ?? (pf_is_list($plan_dec) ? $plan_dec : []);
    $week = $planArr[$weekN-1] ?? null;
    if (!$week || empty($week['sesiones'])) { echo json_encode(['success'=>false,'error'=>'Semana no encontrada']); exit; }

    $target = null; $want = pf_normstr($dia);
    foreach($week['sesiones'] as $s){ if(pf_normstr($s['dia']??'') === $want){ $target=$s; break; } }
    if(!$target){ echo json_encode(['success'=>false,'error'=>'Día no encontrado en la semana']); exit; }

    $diaSan = pf_sanitize_filename($target['dia']);
    $baseDir = __DIR__ . "/uploads/planes_fisicos/".intval($pid)."/sem".$weekN."/".$diaSan;
    $baseUrl = "/api/uploads/planes_fisicos/".intval($pid)."/sem".$weekN."/".$diaSan;

    $creadas=0; $fallidas=0; $items=[];
    if(!empty($target['bloques']) && is_array($target['bloques'])){
        foreach($target['bloques'] as $bi=>$bloque){
            $bloqueTipo=$bloque['tipo']??'Bloque';
            if(empty($bloque['ejercicios']) || !is_array($bloque['ejercicios'])) continue;
            foreach($bloque['ejercicios'] as $ei=>$ej){
                if($creadas >= $maxImgs) break 2;
                $ejNombre=$ej['nombre']??'Ejercicio';

                $res = pf_fetch_exercise_image_binary($ejNombre, $bloqueTipo, $planRow['tipo_prueba'] ?? 'Entrenamiento');
                $ext = $res['ext'] ?? 'jpg';
                $fuente = $res['source'] ?? 'placeholder';
                $credit = $res['credit'] ?? '';
                $bin = $res['bin'] ?? null;

                $fname = "b{$bi}-e{$ei}-".pf_sanitize_filename($ejNombre).".".$ext;
                $dest  = $baseDir . '/' . $fname;
                $ok = $bin ? pf_save_binary_image($bin, $dest) : false;
                if (!$ok) { $fallidas++; continue; }

                $url = $baseUrl . '/' . $fname;
                $prompt = "query: ".pf_stock_query_from_exercise($ejNombre,$bloqueTipo).($credit? " | credit: $credit" : '');
                $rec = [
                    'id_plan' => $pid, 'semana' => $weekN, 'dia' => $target['dia'],
                    'bloque_idx' => $bi, 'ejercicio_idx' => $ei, 'tipo' => 'image',
                    'url' => $url, 'prompt' => $prompt, 'fuente' => $fuente
                ];
                pf_store_media_record($conn, $rec);
                $items[] = $rec; $creadas++;
            }
        }
    }

    echo json_encode(['success'=>true, 'creadas'=>$creadas, 'fallidas'=>$fallidas, 'items'=>$items], JSON_UNESCAPED_UNICODE);
    exit;
}

/** === Prompt imagen (texto referencia) & guardado DB === */
function pf_image_prompt_from_exercise($ejNombre, $bloqueTipo, $tipoPrueba) {
    $ej = trim($ejNombre ?: 'Functional training');
    $bloque = trim($bloqueTipo ?: 'Strength');
    $disc = trim($tipoPrueba ?: 'Cross-training / Firefighter');
    return "Educational photo of \"$ej\" ($bloque) for $disc.";
}
function pf_store_media_record($conn, $row) {
    $sql = "INSERT INTO planes_fisicos_media
        (id_plan, semana, dia, bloque_idx, ejercicio_idx, tipo, url, prompt, fuente, fecha)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE url=VALUES(url), prompt=VALUES(prompt), fuente=VALUES(fuente), fecha=NOW()";
    $stmt = $conn->prepare($sql);
    if (!$stmt) return false;
    $stmt->bind_param("iisiiisss",
        $row['id_plan'], $row['semana'], $row['dia'], $row['bloque_idx'], $row['ejercicio_idx'],
        $row['tipo'], $row['url'], $row['prompt'], $row['fuente']
    );
    return $stmt->execute();
}

/** ===================== Y) LISTAR MEDIA (todas o por semana) ===================== **/
if ($method === 'GET' && $action === 'listar_media') {
    $pid   = intval($_GET['id_plan'] ?? 0);
    $weekN = intval($_GET['semana'] ?? 0);
    if (!$pid) { echo json_encode(['success'=>false,'error'=>'Falta id_plan']); exit; }

    $sql = "SELECT id, id_plan, semana, dia, bloque_idx, ejercicio_idx, tipo, url, prompt, fuente, fecha
            FROM planes_fisicos_media
            WHERE id_plan = ?";
    $types = "i"; $vals = [$pid];
    if ($weekN > 0) { $sql .= " AND semana = ?"; $types .= "i"; $vals[] = $weekN; }
    $sql .= " ORDER BY semana, FIELD(dia,'Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'), bloque_idx, ejercicio_idx";

    $stmt = $conn->prepare($sql);
    if (!$stmt) { echo json_encode(['success'=>false,'error'=>'Prepare fallido']); exit; }
    $stmt->bind_param($types, ...$vals);
    $stmt->execute();
    $res = $stmt->get_result();
    $out = [];
    while ($row = $res->fetch_assoc()) $out[] = $row;
    echo json_encode(['success'=>true, 'media'=>$out], JSON_UNESCAPED_UNICODE);
    exit;
}

/* ===================== BUSCAR IMAGEN DE STOCK (local -> varias miniaturas) ===================== */
if ($method === 'POST' && $action === 'buscar_imagen_stock') {
    $ej    = trim($data['ejercicio'] ?? '');
    $tipo  = trim($data['tipo_prueba'] ?? '');
    $raw   = trim($data['q'] ?? $ej);
    $bloq  = trim($data['bloque'] ?? '');
    $limit = max(1, min(8, intval($data['n'] ?? ($data['limit'] ?? 4))));

    $query = pf_stock_query_from_exercise($raw, $bloq);
    pf_dbg("[PF][BUSCAR_IMG] q='{$raw}' bloque='{$bloq}' => query='{$query}'");
    global $UNSPLASH_ACCESS_KEY, $PEXELS_API_KEY;
    pf_dbg("[PF][BUSCAR_IMG] providers: unsplash=".(!empty($UNSPLASH_ACCESS_KEY)?'1':'0')." pexels=".(!empty($PEXELS_API_KEY)?'1':'0'));

		// 0) INTENTO LOCAL (VARIANTES NUMERADAS): back_squat_1.webp, back_squat_2.jpg, ...
		$items = [];
		$localHits = pf_try_local_preview_variants_multi($raw, $limit);
		foreach ($localHits as $hit) {
			$items[] = [
				'path'      => $hit['path'],
				'fuente'    => 'local',
				'credit'    => 'libreria_local',
				'page'      => null,
				'query'     => $query,
				'media_url' => $hit['media_url']
			];
		}
		if (count($items) >= $limit) {
			// ya tenemos suficientes locales → devolver directamente
			$paths_media = array_map(fn($x)=>$x['path'], $items);
			$media_urls  = array_map(fn($x)=>$x['media_url'], $items);
			$first = $items[0];
			echo json_encode([
				'success'=>true,
				'path'=>$first['path'], 'fuente'=>$first['fuente'], 'credit'=>$first['credit'],
				'page'=>$first['page'], 'query'=>$first['query'], 'media_url'=>$first['media_url'],
				'items'=>$items, 'paths_media'=>$paths_media, 'media_urls'=>$media_urls
			], JSON_UNESCAPED_UNICODE);
			exit;
		}


    // 1) recolectar candidatos (Freepik -> Unsplash -> Pexels -> Wikimedia)
    $cands = pf_stock_freepik_list($query, $limit);
    if (count($cands) < $limit) $cands = array_merge($cands, pf_stock_unsplash_list($query, $limit - count($cands)));
    if (count($cands) < $limit) $cands = array_merge($cands, pf_stock_pexels_list($query, $limit - count($cands)));
    if (count($cands) < $limit) $cands = array_merge($cands, pf_stock_wikimedia_list($query, $limit - count($cands)));

    $bySource = [];
    foreach ($cands as $c) {
      $src = $c['source'] ?? '??';
      $bySource[$src] = ($bySource[$src] ?? 0) + 1;
      error_log("[PF][BUSCAR_IMG] candidates_by_source=" . json_encode($bySource));
    }
    pf_dbg("[PF][BUSCAR_IMG] candidates_by_source=".json_encode($bySource, JSON_UNESCAPED_UNICODE));

    // 2) descargar previews a disco
    $prevDir = PF_UPLOADS_PREVIEWS_DIR;
    @mkdir($prevDir, 0775, true);

    foreach ($cands as $i => $ph) {
        if (count($items) >= $limit) break;
        if (empty($ph['preview_url'])) continue;
        $src  = $ph['preview_url'];
        $id   = $ph['id'] ?? md5($query.'-'.$i);
        $hash = substr(sha1('mix-'.$id.'-'.$query), 0, 12);
        $dest = $prevDir . $hash . '.jpg';
        $saved = pf_http_download_to($src, $dest);
        if ($saved) {
            $path      = PF_UPLOADS_PREVIEWS_REL . basename($saved);
            $media_url = '/api/planes_fisicos.php?action=media&path=' . rawurlencode($path);
            $items[] = [
                'path'      => $path,
                'fuente'    => $ph['source'] ?? 'stock',
                'credit'    => $ph['author'] ?? ($ph['source'] ?? 'stock'),
                'page'      => $ph['page_url'] ?? null,
                'query'     => $query,
                'media_url' => $media_url
            ];
            pf_dbg("[PF][BUSCAR_IMG][PICK] #".(count($items))." src=".($ph['source']??'stock')." author=".($ph['author']??'')." page=".($ph['page_url']??'')." file=".basename($saved));
        }
    }

    // 3) fallback: placeholder si quedó vacío
    if (empty($items)) {
        $phPath = $prevDir . substr(sha1('placeholder-'.$query),0,12) . '.png';
        if (!is_file($phPath)) {
            $b64 = pf_placeholder_b64();
            pf_save_base64_png($b64, $phPath);
        }
        $rel = PF_UPLOADS_PREVIEWS_REL . basename($phPath);
        $items[] = [
            'path'      => $rel,
            'fuente'    => 'placeholder',
            'credit'    => 'placeholder',
            'page'      => null,
            'query'     => $query,
            'media_url' => '/api/planes_fisicos.php?action=media&path=' . rawurlencode($rel)
        ];
    }

    $paths_media = array_map(fn($x)=>$x['path'], $items);
    $media_urls  = array_map(fn($x)=>$x['media_url'], $items);
    $first = $items[0];
    echo json_encode([
        'success'     => true,
        'path'        => $first['path'],
        'fuente'      => $first['fuente'],
        'credit'      => $first['credit'],
        'page'        => $first['page'],
        'query'       => $first['query'],
        'media_url'   => $first['media_url'],
        'items'       => $items,
        'paths_media' => $paths_media,
        'media_urls'  => $media_urls
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/** ===================== FALLBACK ===================== **/
echo json_encode(["success"=>false, "error" => "Método o acción no soportados"]);
