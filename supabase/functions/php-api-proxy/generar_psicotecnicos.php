<?php
// /api/generar_psicotecnicos.php - Versión con Google Gemini y visibilidad por roles
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=utf-8");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit(); }

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require 'db.php';
require_once 'config.php';

// ---------- LOGS ----------
function log_psico($msg){
  @file_put_contents(__DIR__.'/log_psicotecnicos.txt', date('Y-m-d H:i:s').' | '.$msg.PHP_EOL, FILE_APPEND);
}
function log_gemini_raw_psico($arr){
  @file_put_contents(__DIR__.'/error_gemini_psico.log', json_encode($arr, JSON_UNESCAPED_UNICODE).PHP_EOL, FILE_APPEND);
}
function bad($m,$c=400){ http_response_code($c); echo json_encode(['ok'=>false,'error'=>$m],JSON_UNESCAPED_UNICODE); exit; }

// ---------- HELPERS ----------
function gemini_key_or_fail(): string {
  // Try to get from header first (from edge function)
  $k = $_SERVER['HTTP_X_GOOGLE_API_KEY'] ?? '';
  
  // Fall back to environment variable
  if (empty($k)) $k = getenv('GOOGLE_API_KEY');
  
  // Fall back to config.php constant
  if (empty($k) && defined('GOOGLE_API_KEY')) $k = GOOGLE_API_KEY;
  
  if (!$k) {
    log_psico("❌ No se encontró GOOGLE_API_KEY en ninguna fuente");
    bad('Falta GOOGLE_API_KEY (entorno o config.php)', 500);
  }
  
  log_psico("✅ GOOGLE_API_KEY encontrada (longitud: ".strlen($k).")");
  return $k;
}

/**
 * Obtiene el rol del usuario desde la BD
 */
function obtener_rol_usuario_psico($conn, $id_usuario): string {
  $stmt = $conn->prepare("SELECT nivel FROM accounts WHERE id = ?");
  if (!$stmt) {
    log_psico("Error preparando consulta rol: ".$conn->error);
    return 'user';
  }
  $stmt->bind_param("i", $id_usuario);
  $stmt->execute();
  $result = $stmt->get_result();
  $row = $result->fetch_assoc();
  $stmt->close();
  
  $rol = isset($row['nivel']) ? strtolower(trim($row['nivel'])) : 'user';
  log_psico("Usuario $id_usuario tiene rol: $rol");
  return $rol;
}

/**
 * Determina si las preguntas deben ser públicas según el rol
 */
function es_publico_segun_rol_psico(string $rol): int {
  // SA genera preguntas públicas (visibles para todos)
  if ($rol === 'sa') return 1;
  
  // admin genera preguntas privadas (solo visibles para él)
  if ($rol === 'admin') return 0;
  
  // Por defecto, privado
  return 0;
}

/** Quita fences ``` (incl. ```json) y devuelve el primer array JSON válido si existe */
function extract_json_array_psico(string $content): ?array {
  $content = preg_replace('/^\s*```[a-zA-Z]*\s*/', '', $content ?? '');
  $content = preg_replace('/\s*```\s*$/', '', $content ?? '');

  $arr = json_decode($content, true);
  if (is_array($arr)) return $arr;

  $first = strpos($content, '[');
  $last  = strrpos($content, ']');
  if ($first !== false && $last !== false && $last > $first) {
    $slice = substr($content, $first, $last - $first + 1);
    $arr2 = json_decode($slice, true);
    if (is_array($arr2)) return $arr2;
  }

  if (preg_match('/\[\s*{.*}\s*\]/s', $content, $m)) {
    $arr3 = json_decode($m[0], true);
    if (is_array($arr3)) return $arr3;
  }
  return null;
}

/** Heurística para detectar contenido "factual/temario" NO psicotécnico */
function parece_factual(string $text): bool {
  $textLow = mb_strtolower($text, 'UTF-8');
  $bad = [
    'ley ', 'real decreto', 'constitución', 'artículo ', 'según la ley', 'segun la ley',
    'definición', 'definicion', 'tema ', 'temario', 'historia', 'autor', 'fecha',
    'norma', 'reglamento', 'estatuto', 'jurídic', 'juridic', 'penal', 'civil',
    'acuerdo', 'boe', 'decreto', 'orden ministerial'
  ];
  foreach ($bad as $needle) {
    if (mb_strpos($textLow, $needle) !== false) return true;
  }
  if (preg_match('/\b(18|19|20|21)\d{2}\b/', $textLow)) return true;
  return false;
}

/** Normaliza strings básicos (quita acentos, pasa a minúsculas simples) */
function _norm_str_basic(string $s): string {
  $s = mb_strtolower($s, 'UTF-8');
  $repl = [
    'á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u','ñ'=>'n',
    'ç'=>'c'
  ];
  $s = strtr($s, $repl);
  $s = preg_replace('/\s+/', '_', $s);
  $s = preg_replace('/[^a-z0-9_]/', '', $s);
  return $s;
}

/** Sanitiza tipo a uno de: serie_numerica | verbal | atencion_calculo | espacial_texto */
function sanitize_tipo($raw): ?string {
  if (!isset($raw)) return null;
  $s = _norm_str_basic((string)$raw);
  $map = [
    'serie' => 'serie_numerica',
    'serienumerica' => 'serie_numerica',
    'serie_numerica' => 'serie_numerica',
    'numerica' => 'serie_numerica',
    'verbal' => 'verbal',
    'analogias' => 'verbal',
    'sinonimos' => 'verbal',
    'antonimos' => 'verbal',
    'atencion' => 'atencion_calculo',
    'calculo' => 'atencion_calculo',
    'atencion_calculo' => 'atencion_calculo',
    'espacial' => 'espacial_texto',
    'espacial_texto' => 'espacial_texto',
    'orientacion' => 'espacial_texto',
    'rejilla' => 'espacial_texto'
  ];
  return $map[$s] ?? null;
}

/** Sanitiza habilidad a: razonamiento | atencion | calculo | espacial | fluidez_verbal | logica */
function sanitize_habilidad($raw): ?string {
  if (!isset($raw)) return null;
  $s = _norm_str_basic((string)$raw);
  $map = [
    'razonamiento' => 'razonamiento',
    'atencion' => 'atencion',
    'calculo' => 'calculo',
    'espacial' => 'espacial',
    'fluidez' => 'fluidez_verbal',
    'fluidezverbal' => 'fluidez_verbal',
    'fluidez_verbal' => 'fluidez_verbal',
    'logica' => 'logica'
  ];
  return $map[$s] ?? null;
}

/** Sanitiza dificultad [1..5], null si no válida */
function sanitize_dificultad($raw): ?int {
  if ($raw === null || $raw === '') return null;
  $n = (int)$raw;
  if ($n < 1 || $n > 5) return null;
  return $n;
}

/** Normaliza y valida un ítem psico. Devuelve ['pregunta','opciones','correcta','tipo','habilidad','dificultad'] */
function normalizar_item_psico($it): ?array {
  if (!is_array($it)) return null;

  $preg = trim((string)($it['pregunta'] ?? ''));
  $ops  = $it['opciones'] ?? null;
  $corr = strtoupper(trim((string)($it['correcta'] ?? '')));

  if ($preg === '' || !is_array($ops)) return null;

  // Normalizar opciones A-D
  $normOps = ['A'=>null,'B'=>null,'C'=>null,'D'=>null];
  foreach ($ops as $k=>$v) {
    $kUp = strtoupper((string)$k);
    if (in_array($kUp, ['A','B','C','D'], true)) {
      $normOps[$kUp] = trim((string)$v);
    } elseif (in_array((string)$k, ['1','2','3','4'], true)) {
      $map = ['1'=>'A','2'=>'B','3'=>'C','4'=>'D'];
      $normOps[$map[(string)$k]] = trim((string)$v);
    }
  }
  if (in_array(null, $normOps, true)) return null;

  // Mapear correcta por texto si viene como texto
  if (!in_array($corr, ['A','B','C','D'], true)) {
    foreach ($normOps as $letter=>$optText) {
      if (trim($optText) === trim($it['correcta'] ?? '')) { $corr = $letter; break; }
    }
  }
  if (!in_array($corr, ['A','B','C','D'], true)) return null;

  // Longitud según tu schema (pregunta: varchar(1024))
  $preg = mb_substr($preg, 0, 1024, 'UTF-8');
  foreach ($normOps as $k=>$v) { $normOps[$k] = mb_substr($v, 0, 300, 'UTF-8'); }

  // Meta opcional
  $tipo = sanitize_tipo($it['tipo'] ?? null);
  $hab  = sanitize_habilidad($it['habilidad'] ?? null);
  $dif  = sanitize_dificultad($it['dificultad'] ?? null);

  return ['pregunta'=>$preg, 'opciones'=>$normOps, 'correcta'=>$corr, 'tipo'=>$tipo, 'habilidad'=>$hab, 'dificultad'=>$dif];
}

/** Genera texto de inspiración con vocabulario del tema pero sin conocimiento factual */
function generar_texto_inspiracion(string $apiKey, string $seccion_ctx, string $tema_ctx): string {
  $prompt = <<<PROMPT
Genera un texto breve (100-150 palabras) con vocabulario y términos relacionados con "$seccion_ctx" y "$tema_ctx", pero SIN incluir conocimientos factuales.

IMPORTANTE:
- USA vocabulario técnico del tema (nombres de equipos, herramientas, conceptos generales)
- Crea situaciones cotidianas con esos términos: inventarios, turnos, conteos, organizaciones
- Incluye números, nombres de personas, situaciones de trabajo
- NO incluyas: leyes, definiciones técnicas, procedimientos específicos, fechas históricas

Ejemplos del estilo deseado:
- "El equipo de Juan debe revisar 15 sistemas. Cada sistema tiene 3 componentes..."
- "María organiza el inventario: cuenta 24 elementos del tipo A y 18 del tipo B..."
- "En el turno de hoy hay 8 guardias. Se dividen en 2 grupos para revisar 12 zonas..."

Responde SOLO con el texto, sin explicaciones.
PROMPT;

  $payload = [
    "contents" => [
      [
        "role" => "user",
        "parts" => [["text" => $prompt]]
      ]
    ],
    "generationConfig" => [
      "temperature" => 0.7,
      "maxOutputTokens" => 200
    ]
  ];

  // Use the same model as working generator
  $ch = curl_init("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey");
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT => 30
  ]);
  
  $res = curl_exec($ch);
  curl_close($ch);

  if ($res === false) {
    log_psico("⚠️ No se pudo generar texto de inspiración, usando vacío");
    return '';
  }

  $j = json_decode($res, true);
  $texto = trim($j['candidates'][0]['content']['parts'][0]['text'] ?? '');
  
  log_psico("✅ Texto inspiración generado: " . mb_substr($texto, 0, 100));
  return $texto;
}

/** Llama a Google Gemini para devolver EXACTAMENTE $n psicotécnicos (array JSON) */
function generar_lote_psico(string $apiKey, int $n, int $id_proceso, string $seccion_ctx, string $tema_ctx, string $texto = ''): array {
  $systemPrompt = <<<SYS
Eres un generador de PRUEBAS PSICOTÉCNICAS para oposiciones en español.

CONTEXTO DE LAS PREGUNTAS:
- Usa vocabulario y términos del tema/sección proporcionado para ambientar las preguntas
- Las preguntas deben ser psicotécnicas (evalúan razonamiento, atención, cálculo, lógica, memoria)
- NO preguntes conocimientos factuales, definiciones técnicas, leyes, procedimientos específicos o fechas

ESTILO DE PREGUNTAS:
- Series numéricas con contexto: "Un equipo revisa 2, 4, 8, 16 sistemas. ¿Cuántos revisará después?"
- Cálculo con vocabulario: "Juan cuenta 15 elementos del tipo A y 23 del tipo B. ¿Cuántos en total?"
- Verbal con términos: "¿Qué palabra es sinónimo de INSPECCIONAR?" (usando vocabulario del tema)
- Atención: "En un inventario hay: sistema-A, herramienta-B, sistema-C. ¿Cuántos sistemas hay?"
- Espacial en texto: "La zona 1 está al norte de la zona 2. La zona 3 al este de la 1. ¿Dónde está la 3 respecto a la 2?"

Responde ÚNICAMENTE con un array JSON válido (sin texto adicional, sin markdown, sin backticks).
Cada elemento DEBE incluir: "pregunta", "opciones" (A,B,C,D), "correcta" (A-D).
Opcionalmente: "tipo", "habilidad", "dificultad" (1-5), pero NUNCA explicaciones.
Equilibra la distribución de respuestas correctas entre A-D.
SYS;

  if ($texto !== '') {
    $userPrompt = <<<USR
Genera EXACTAMENTE $n preguntas PSICOTÉCNICAS ambientadas en el contexto de: Proceso=$id_proceso, Sección="$seccion_ctx", Tema="$tema_ctx".

USA EL VOCABULARIO del texto inspiracional para crear situaciones psicotécnicas:
- Series numéricas con elementos del contexto
- Cálculos con inventarios, turnos, conteos de equipos/zonas
- Preguntas verbales usando sinónimos/antónimos de términos del contexto
- Problemas de atención contando elementos mencionados en el texto
- Orientación espacial con zonas/áreas/sistemas mencionados

TEXTO INSPIRACIONAL:
---
$texto
---

Tipos: serie_numerica (30-40%), verbal (20-30%), atencion_calculo (20-30%), espacial_texto (15-25%).
RECUERDA: Son preguntas PSICOTÉCNICAS (razonamiento/cálculo/lógica), NO conocimiento técnico.

Formato JSON:
[{"pregunta":"...","opciones":{"A":"...","B":"...","C":"...","D":"..."},"correcta":"A","tipo":"...","habilidad":"...","dificultad":3}]
USR;
  } else {
    $userPrompt = <<<USR
Genera EXACTAMENTE $n preguntas PSICOTÉCNICAS ambientadas en: Proceso=$id_proceso, Sección="$seccion_ctx", Tema="$tema_ctx".

Crea preguntas psicotécnicas usando vocabulario del contexto:
- Series: "En un inventario de sistemas hay 2, 4, 8, 16 unidades. ¿Cuántas habrá después?"
- Cálculo: "Juan cuenta 15 equipos del tipo A y 23 del tipo B. ¿Total?"
- Verbal: "Sinónimo de REVISAR en el contexto de inspección"
- Atención: "Lista: equipo-1, herramienta-2, equipo-3, sistema-4. ¿Cuántos equipos?"
- Espacial: "La zona A está al norte de B. C está al este de A. ¿Posición de C respecto a B?"

Tipos: serie_numerica (30-40%), verbal (20-30%), atencion_calculo (20-30%), espacial_texto (15-25%).
IMPORTANTE: Preguntas PSICOTÉCNICAS con vocabulario del contexto, NO conocimiento técnico factual.

Formato JSON:
[{"pregunta":"...","opciones":{"A":"...","B":"...","C":"...","D":"..."},"correcta":"A","tipo":"...","habilidad":"...","dificultad":3}]
USR;
  }

  $payload = [
    "contents" => [
      [
        "role" => "user",
        "parts" => [
          ["text" => $systemPrompt . "\n\n" . $userPrompt]
        ]
      ]
    ],
    "generationConfig" => [
      "temperature" => 0.35,
      "maxOutputTokens" => 6000,
      "responseMimeType" => "application/json"
    ]
  ];

  $t0 = microtime(true);
  // Use the same model as generar_preguntas (works correctly)
  $ch = curl_init("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey");
  log_psico("🤖 Llamando a Gemini 2.5 Flash");
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT => 90
  ]);
  
  $res = curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $latencyMs = (int)round((microtime(true)-$t0)*1000);
  $curlError = curl_error($ch);
  curl_close($ch);

  if ($res === false || $curlError) {
    log_gemini_raw_psico([
      'ts'=>date('c'),'http_code'=>$httpCode,'latency_ms'=>$latencyMs,
      'model'=>'gemini-2.5-flash','batch'=>$n,
      'summary'=>['has_texto'=>$texto!=='' ,'id_proceso'=>$id_proceso,'seccion'=>$seccion_ctx,'tema'=>$tema_ctx],
      'curl_error'=>$curlError
    ]);
    throw new Exception("Error llamando a Gemini: $curlError");
  }
  
  log_psico("📥 Respuesta HTTP $httpCode recibida en {$latencyMs}ms");

  $j = json_decode($res, true);
  
  // Log raw response for debugging
  log_psico("📋 Raw response preview: " . mb_substr($res, 0, 500));
  
  // Check for API errors first
  if (isset($j['error'])) {
    $errorMsg = $j['error']['message'] ?? 'Error desconocido de Gemini';
    $errorCode = $j['error']['code'] ?? 'unknown';
    log_psico("❌ Gemini API Error: [$errorCode] $errorMsg");
    log_gemini_raw_psico([
      'ts'=>date('c'),'http_code'=>$httpCode,'latency_ms'=>$latencyMs,
      'model'=>'gemini-2.5-flash','batch'=>$n,
      'error'=>$errorMsg, 'error_code'=>$errorCode,
      'raw'=>$res
    ]);
    throw new Exception("Error de Gemini API ($errorCode): $errorMsg");
  }
  
  // Log response structure
  log_psico("📊 Response structure: candidates=" . (isset($j['candidates']) ? 'YES' : 'NO') . 
    ", count=" . count($j['candidates'] ?? []) .
    ", has_content=" . (isset($j['candidates'][0]['content']) ? 'YES' : 'NO'));
  
  log_gemini_raw_psico([
    'ts'=>date('c'),'http_code'=>$httpCode,'latency_ms'=>$latencyMs,
    'model'=>'gemini-2.5-flash','batch'=>$n,
    'summary'=>['has_texto'=>$texto!=='' ,'id_proceso'=>$id_proceso,'seccion'=>$seccion_ctx,'tema'=>$tema_ctx],
    'response_structure'=>[
      'has_candidates'=>isset($j['candidates']),
      'candidates_count'=>count($j['candidates'] ?? []),
      'has_content'=>isset($j['candidates'][0]['content']),
      'has_parts'=>isset($j['candidates'][0]['content']['parts']),
      'parts_count'=>count($j['candidates'][0]['content']['parts'] ?? []),
      'content_length'=>strlen($j['candidates'][0]['content']['parts'][0]['text'] ?? ''),
      'content_preview'=>mb_substr($j['candidates'][0]['content']['parts'][0]['text'] ?? '', 0, 200),
      'finish_reason'=>$j['candidates'][0]['finishReason'] ?? 'unknown',
      'prompt_feedback'=>$j['promptFeedback'] ?? null
    ],
    'raw'=>mb_substr($res, 0, 2000) // Only log first 2000 chars
  ]);
  
  log_psico("📊 Candidates: ".(count($j['candidates'] ?? 0)).", Content length: ".strlen($j['candidates'][0]['content']['parts'][0]['text'] ?? ''));

  $content = $j['candidates'][0]['content']['parts'][0]['text'] ?? '';
  $finishReason = $j['candidates'][0]['finishReason'] ?? '';
  
  log_psico("📝 Content length: " . strlen($content) . ", Finish reason: $finishReason");
  
  // Check for safety blocks or other issues
  if ($content === '') {
    log_psico("⚠️ Empty content detected!");
    
    // Log full response for debugging empty responses
    log_psico("Full response dump: " . json_encode($j, JSON_UNESCAPED_UNICODE));
    
    if ($finishReason === 'SAFETY') {
      throw new Exception('Gemini bloqueó la respuesta por seguridad. Intenta con un texto diferente.');
    } elseif ($finishReason === 'MAX_TOKENS') {
      throw new Exception('Respuesta truncada. Reduciendo tamaño del lote...');
    } elseif ($finishReason === 'RECITATION') {
      throw new Exception('Contenido bloqueado por recitación. Intenta con un texto diferente.');
    } else {
      $debugInfo = json_encode([
        'finish_reason' => $finishReason,
        'has_candidates' => isset($j['candidates']),
        'candidates_count' => count($j['candidates'] ?? []),
        'prompt_feedback' => $j['promptFeedback'] ?? null
      ]);
      throw new Exception("Respuesta vacía de Gemini. Debug: $debugInfo");
    }
  }

  $items = extract_json_array_psico($content);
  if (!is_array($items)) {
    log_psico("⚠️ No se pudo parsear JSON de Gemini. Content: " . mb_substr($content, 0, 500));
    throw new Exception('Respuesta inválida de Gemini (no JSON parseable).');
  }
  
  return $items;
}

// ----------- INPUT -----------
$in = json_decode(file_get_contents('php://input'), true) ?: [];
$id_proceso    = intval($in['id_proceso'] ?? 0);
$tema          = trim($in['tema'] ?? '');
$seccion       = trim($in['seccion'] ?? '');
$id_usuario    = intval($in['id_usuario'] ?? 0);
$num_preguntas = max(1, intval($in['num_preguntas'] ?? 10));

// límites
if ($num_preguntas > 100) $num_preguntas = 100;
if (!$id_proceso || !$tema || !$seccion || !$id_usuario) bad('Faltan id_proceso, tema, seccion o id_usuario');

// ---------- OBTENER ROL Y DETERMINAR VISIBILIDAD ----------
$rol_usuario = obtener_rol_usuario_psico($conn, $id_usuario);
$es_publico = es_publico_segun_rol_psico($rol_usuario);

log_psico("Usuario $id_usuario (rol: $rol_usuario) generará preguntas psico ".($es_publico ? "PÚBLICAS" : "PRIVADAS"));

// ---------- VERIFICAR SI EXISTE COLUMNA es_publico ----------
$tiene_columna_publico = false;
$check_col = $conn->query("SHOW COLUMNS FROM preguntas LIKE 'es_publico'");
if ($check_col && $check_col->num_rows > 0) {
  $tiene_columna_publico = true;
  log_psico("✓ Columna 'es_publico' existe en tabla preguntas");
} else {
  log_psico("⚠️ Columna 'es_publico' NO existe. Debes ejecutar: ALTER TABLE preguntas ADD COLUMN es_publico TINYINT DEFAULT 0");
}

// ---------- PREFIJO EXACTO (siempre en tema) ----------
const PISCO_PREFERRED_PREFIX = 'PISCO - ';
const PISCO_ALIAS_PREFIX     = 'PSICO - ';
function ensure_psico_prefijo(string $label): string {
  if (stripos($label, PISCO_PREFERRED_PREFIX) === 0) return $label;
  if (stripos($label, PISCO_ALIAS_PREFIX) === 0) return $label;
  return PISCO_PREFERRED_PREFIX . $label;
}
$tema_db    = ensure_psico_prefijo($tema);
$seccion_db = $seccion;

// ---------- GEMINI ----------
$GEMINI_KEY = gemini_key_or_fail();

// ---------- GENERAR TEXTO DE INSPIRACIÓN ----------
log_psico("🤖 Generando texto de inspiración automático...");
$texto = generar_texto_inspiracion($GEMINI_KEY, $seccion, $tema);

// ---------- DIVISIÓN AUTOMÁTICA DE TEXTO LARGO ----------
const MAX_CHARS_PER_FRAGMENT = 6000;
$texto_fragmentos = [];

if (mb_strlen($texto, 'UTF-8') > MAX_CHARS_PER_FRAGMENT) {
  log_psico("⚠️ Texto excede ".MAX_CHARS_PER_FRAGMENT." caracteres (".mb_strlen($texto, 'UTF-8')." chars). Dividiendo en fragmentos...");
  
  // Dividir por párrafos primero
  $paragraphs = preg_split('/\n\s*\n/', $texto);
  $current_fragment = '';
  
  foreach ($paragraphs as $para) {
    $para = trim($para);
    if (empty($para)) continue;
    
    // Si añadir este párrafo excede el límite, guardar fragmento actual
    if (mb_strlen($current_fragment . "\n\n" . $para, 'UTF-8') > MAX_CHARS_PER_FRAGMENT && !empty($current_fragment)) {
      $texto_fragmentos[] = trim($current_fragment);
      $current_fragment = $para;
    } else {
      $current_fragment .= (empty($current_fragment) ? '' : "\n\n") . $para;
    }
  }
  
  // Añadir último fragmento
  if (!empty($current_fragment)) {
    $texto_fragmentos[] = trim($current_fragment);
  }
  
  log_psico("✅ Texto dividido en ".count($texto_fragmentos)." fragmentos");
} else {
  // Texto no es muy largo, usar como está
  $texto_fragmentos[] = $texto;
}

// ---------- META SCHEMA CHECK ----------
function preguntas_has_psico_meta(mysqli $conn): bool {
  static $cache = null;
  if ($cache !== null) return $cache;
  $need = ['tipo','habilidad','dificultad'];
  $ok = 0;
  foreach ($need as $col) {
    $q = $conn->query("SHOW COLUMNS FROM preguntas LIKE '".$conn->real_escape_string($col)."'");
    if ($q && $q->num_rows > 0) $ok++;
  }
  $cache = ($ok === count($need));
  if (!$cache) log_psico("ℹ️ Tabla 'preguntas' sin columnas meta (tipo/habilidad/dificultad). Se insertará sin meta.");
  return $cache;
}
$hasMeta = preguntas_has_psico_meta($conn);

// ---------- BATCHING ----------
$BATCH_MAX   = 12;
$pendientes  = $num_preguntas;
$total_ins   = 0;
$map         = ['A'=>1,'B'=>2,'C'=>3,'D'=>4];

// log BD
try {
  $db_name = $conn->query("SELECT DATABASE()")->fetch_row()[0];
  log_psico("BD:$db_name | proc=$id_proceso tema_ctx='$tema' secc_ctx='$seccion' -> tema_db='$tema_db' secc_db='$seccion_db' | pedir=$num_preguntas | meta=".($hasMeta?'on':'off')." | rol=$rol_usuario publico=$es_publico");
} catch (Throwable $e) {
  log_psico("DB name error: ".$e->getMessage());
}

$conn->begin_transaction();
try {
  $fragment_index = 0;
  $total_fragmentos = count($texto_fragmentos);
  $max_retries = 3;
  
  while ($pendientes > 0) {
    $lote = min($BATCH_MAX, $pendientes);
    
    // Alternar entre fragmentos para mejor diversidad
    $fragmento_actual = ($fragment_index % $total_fragmentos) + 1;
    $texto_actual = $texto_fragmentos[$fragment_index % $total_fragmentos];
    $fragment_index++;
    
    log_psico("📝 Procesando fragmento $fragmento_actual/$total_fragmentos (pedido: $lote preguntas)");

    // Retry logic con backoff exponencial
    $items = null;
    $last_error = null;
    for ($retry = 0; $retry < $max_retries; $retry++) {
      try {
        if ($retry > 0) {
          $wait_seconds = pow(2, $retry);
          log_psico("⏳ Reintento $retry/$max_retries después de $wait_seconds segundos...");
          sleep($wait_seconds);
        }
        
        $items = generar_lote_psico($GEMINI_KEY, $lote, $id_proceso, $seccion, $tema, $texto_actual);
        break; // Success, exit retry loop
      } catch (Exception $e) {
        $last_error = $e->getMessage();
        log_psico("⚠️ Error en intento ".($retry+1).": ".$last_error);
        
        // Si es un error de MAX_TOKENS, reducir el lote
        if (strpos($last_error, 'MAX_TOKENS') !== false && $lote > 3) {
          $lote = max(3, (int)($lote / 2));
          log_psico("📉 Reduciendo tamaño del lote a $lote preguntas");
        }
      }
    }
    
    // Si después de todos los reintentos no tenemos items, lanzar error
    if ($items === null) {
      throw new Exception("Error en el fragmento $fragmento_actual: $last_error");
    }

    foreach ($items as $it) {
      $norm = normalizar_item_psico($it);
      if (!$norm) { log_psico("⚠️ Ítem inválido de IA (schema): ".json_encode($it, JSON_UNESCAPED_UNICODE)); continue; }

      if (parece_factual($norm['pregunta'])) { log_psico("ℹ️ Ítem descartado por factual/temario: ".$norm['pregunta']); continue; }

      $preg = $norm['pregunta'];
      $ops  = $norm['opciones'];
      $corr = strtoupper($norm['correcta']);
      $corr_txt = trim($ops[$corr] ?? '');
      if ($preg==='' || !is_array($ops) || count($ops)!==4 || $corr_txt==='') { log_psico("⚠️ Ítem inválido tras normalizar"); continue; }

      // INSERT con meta Y es_publico
      if ($hasMeta && $tiene_columna_publico) {
        $stmt = $conn->prepare("INSERT INTO preguntas (id_usuario, id_proceso, tema, seccion, pregunta, correcta, valoracion, tipo, habilidad, dificultad, es_publico)
                                VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)");
        if (!$stmt) throw new Exception("Prepare preguntas(meta+publico): ".$conn->error);

        $tipo = $norm['tipo'] ?? null;
        $hab  = $norm['habilidad'] ?? null;
        $dif  = $norm['dificultad'];
        $stmt->bind_param("iissssssii", $id_usuario, $id_proceso, $tema_db, $seccion_db, $preg, $corr_txt, $tipo, $hab, $dif, $es_publico);
      } elseif ($hasMeta && !$tiene_columna_publico) {
        // Con meta pero sin es_publico
        $stmt = $conn->prepare("INSERT INTO preguntas (id_usuario, id_proceso, tema, seccion, pregunta, correcta, valoracion, tipo, habilidad, dificultad)
                                VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)");
        if (!$stmt) throw new Exception("Prepare preguntas(meta): ".$conn->error);

        $tipo = $norm['tipo'] ?? null;
        $hab  = $norm['habilidad'] ?? null;
        $dif  = $norm['dificultad'];
        $stmt->bind_param("iissssssi", $id_usuario, $id_proceso, $tema_db, $seccion_db, $preg, $corr_txt, $tipo, $hab, $dif);
      } elseif (!$hasMeta && $tiene_columna_publico) {
        // Sin meta pero con es_publico
        $stmt = $conn->prepare("INSERT INTO preguntas (id_usuario, id_proceso, tema, seccion, pregunta, correcta, valoracion, es_publico)
                                VALUES (?, ?, ?, ?, ?, ?, 0, ?)");
        if (!$stmt) throw new Exception("Prepare preguntas(publico): ".$conn->error);
        $stmt->bind_param("iissssi", $id_usuario, $id_proceso, $tema_db, $seccion_db, $preg, $corr_txt, $es_publico);
      } else {
        // Sin meta ni es_publico
        $stmt = $conn->prepare("INSERT INTO preguntas (id_usuario, id_proceso, tema, seccion, pregunta, correcta, valoracion)
                                VALUES (?, ?, ?, ?, ?, ?, 0)");
        if (!$stmt) throw new Exception("Prepare preguntas: ".$conn->error);
        $stmt->bind_param("iissss", $id_usuario, $id_proceso, $tema_db, $seccion_db, $preg, $corr_txt);
      }

      $stmt->execute();
      if ($stmt->error) throw new Exception("Execute preguntas: ".$stmt->error);
      $id_preg = $conn->insert_id;
      $stmt->close();

      // respuestas
      foreach ($ops as $letra => $textoR) {
        $idx = $map[strtoupper($letra)] ?? 0;
        if ($idx<1 || $idx>4) continue;
        $stmt2 = $conn->prepare("INSERT INTO respuestas (id_pregunta, indice, respuesta) VALUES (?, ?, ?)");
        if (!$stmt2) throw new Exception("Prepare respuestas: ".$conn->error);
        $idx_str = (string)$idx;
        $stmt2->bind_param("iss", $id_preg, $idx_str, $textoR);
        $stmt2->execute();
        if ($stmt2->error) throw new Exception("Execute respuestas[$idx]: ".$stmt2->error);
        $stmt2->close();
      }

      $total_ins++;
      if ($total_ins >= $num_preguntas) break;
    }
    $pendientes = $num_preguntas - $total_ins;
    if ($lote > 0 && $total_ins === 0 && $pendientes === $num_preguntas) {
      log_psico("⚠️ Ningún ítem utilizable en lote; reintento con mismo pedido.");
    }
  }

  $conn->commit();
  log_psico("✅ OK $total_ins insertadas ".($es_publico ? "públicas" : "privadas")." | user=$id_usuario proc=$id_proceso tema='$tema_db' seccion='$seccion_db'");
  echo json_encode([
    'ok'=>true,
    'preguntas'=>$total_ins,
    'tema'=>$tema_db,
    'seccion'=>$seccion_db,
    'es_publico'=>$es_publico,
    'rol'=>$rol_usuario,
    'fragmentos_totales'=>$total_fragmentos,
    'texto_dividido'=>$total_fragmentos > 1
  ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
  $conn->rollback();
  log_psico("❌ ROLLBACK: ".$e->getMessage());
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'DB error','msg'=>$e->getMessage()], JSON_UNESCAPED_UNICODE);
}
