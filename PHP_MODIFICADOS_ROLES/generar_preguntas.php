<?php
// /api/generar_preguntas.php (con visibilidad por roles y trazabilidad de fuente)
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

// -------- LOGS ----------
function log_debug_preg($msg) {
  @file_put_contents(__DIR__.'/log_preguntas.txt', date('Y-m-d H:i:s').' | '.$msg.PHP_EOL, FILE_APPEND);
}
function log_gemini_raw_preguntas($arr) {
  @file_put_contents(__DIR__.'/error_gemini_preguntas.log', json_encode($arr, JSON_UNESCAPED_UNICODE).PHP_EOL, FILE_APPEND);
}

// -------- HELPERS ----------
function google_key_or_fail(): string {
  $k = getenv('GOOGLE_API_KEY');
  if (empty($k) && defined('GOOGLE_API_KEY')) $k = GOOGLE_API_KEY;
  if (!$k) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>'Falta GOOGLE_API_KEY (entorno o config.php)'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  return $k;
}

/**
 * Obtiene el rol del usuario desde la BD
 */
function obtener_rol_usuario($conn, $id_usuario): string {
  $stmt = $conn->prepare("SELECT nivel FROM accounts WHERE id = ?");
  if (!$stmt) {
    log_debug_preg("Error preparando consulta rol: ".$conn->error);
    return 'user';
  }
  $stmt->bind_param("i", $id_usuario);
  $stmt->execute();
  $result = $stmt->get_result();
  $row = $result->fetch_assoc();
  $stmt->close();
  
  $rol = isset($row['nivel']) ? strtolower(trim($row['nivel'])) : 'user';
  log_debug_preg("Usuario $id_usuario tiene rol: $rol");
  return $rol;
}

/**
 * Determina si las preguntas deben ser públicas según el rol
 */
function es_publico_segun_rol(string $rol): int {
  // SA genera preguntas públicas (visibles para todos)
  if ($rol === 'sa') return 1;
  
  // admin genera preguntas privadas (solo visibles para él)
  if ($rol === 'admin') return 0;
  
  // Por defecto, privado
  return 0;
}

/**
 * Limpia y extrae JSON array
 */
function extract_json_array(string $content): ?array {
  // 1. Limpiar backticks y markdown
  $content = preg_replace('/^```[a-zA-Z]*\s*/', '', trim($content));
  $content = preg_replace('/\s*```$/', '', $content);
  $content = trim($content);
  
  // 2. Intento directo
  $arr = json_decode($content, true);
  if (is_array($arr)) return $arr;
  
  // 3. Buscar array entre corchetes
  $first = strpos($content, '[');
  $last  = strrpos($content, ']');
  if ($first !== false && $last !== false && $last > $first) {
    $slice = substr($content, $first, $last - $first + 1);
    $arr2 = json_decode($slice, true);
    if (is_array($arr2)) return $arr2;
  }
  
  return null;
}

/**
 * Llama a Google Gemini con JSON schema
 * Incluye trazabilidad de fuente cuando se genera desde texto
 */
function generar_lote_preguntas(string $apiKey, int $n, int $id_proceso, string $seccion, string $tema, string $texto = '', string $documento = ''): array {
  $model = "gemini-2.5-flash";
  
  if ($texto !== '') {
    // Prompt con trazabilidad de fuente
    $prompt = "Genera EXACTAMENTE $n preguntas tipo test de oposición en ESPAÑOL del siguiente texto.

IMPORTANTE: Para CADA pregunta, indica la referencia exacta de donde extrajiste la información:
- Si el texto tiene páginas numeradas, indica el número de página
- Indica la posición aproximada en el texto (inicio, medio, final)
- Cita brevemente la frase o sección relevante (máximo 100 caracteres)

TEXTO:
$texto

Devuelve SOLO un array JSON válido sin texto adicional con el siguiente formato:
[{
  \"pregunta\": \"texto de la pregunta\",
  \"opciones\": {\"A\": \"opción A\", \"B\": \"opción B\", \"C\": \"opción C\", \"D\": \"opción D\"},
  \"correcta\": \"A\",
  \"fuente\": {
    \"pagina\": \"número de página o null si no aplica\",
    \"ubicacion\": \"inicio|medio|final\",
    \"cita\": \"fragmento breve del texto original\"
  }
}]";
  } else {
    $prompt = "Genera EXACTAMENTE $n preguntas tipo test de oposición en ESPAÑOL para:
- Proceso ID: $id_proceso
- Sección: $seccion
- Tema: $tema

IMPORTANTE: Devuelve SOLO un array JSON válido, sin texto antes ni después, sin markdown.

Formato exacto requerido:
[{\"pregunta\":\"texto de la pregunta\",\"opciones\":{\"A\":\"opción A\",\"B\":\"opción B\",\"C\":\"opción C\",\"D\":\"opción D\"},\"correcta\":\"A\"}]";
  }

  $payload = [
    "contents" => [
      ["parts" => [["text" => $prompt]]]
    ],
    "generationConfig" => [
      "temperature" => 0.35,
      "maxOutputTokens" => 4000,
      "responseMimeType" => "application/json"
    ]
  ];

  $t0 = microtime(true);
  $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";
  
  $ch = curl_init($url);
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

  if ($res === false) {
    $err = curl_error($ch);
    log_gemini_raw_preguntas([
      'ts'=>date('c'),'http_code'=>$httpCode,'latency_ms'=>$latencyMs,
      'model'=>$model, 'batch'=>$n, 'curl_error'=>$err
    ]);
    throw new Exception("Error llamando a Google Gemini: $err");
  }

  $j = json_decode($res, true);
  $content = $j['candidates'][0]['content']['parts'][0]['text'] ?? '';
  $finish  = $j['candidates'][0]['finishReason'] ?? '';
  
  log_gemini_raw_preguntas([
    'ts'=>date('c'),'http_code'=>$httpCode,'latency_ms'=>$latencyMs,
    'model'=>$model, 'batch'=>$n,
    'finish_reason'=>$finish,
    'content_length'=>strlen($content),
    'content_preview'=>substr($content, 0, 500),
    'full_response'=>$res
  ]);

  $items = extract_json_array($content);
  if (!is_array($items)) {
    log_debug_preg("❌ No se pudo parsear JSON. Content: ".substr($content, 0, 1000));
    throw new Exception('Respuesta inválida de Gemini (no JSON parseable).');
  }
  return $items;
}

// -------- INPUT ----------
$data = json_decode(file_get_contents("php://input"), true) ?: [];

$texto         = trim($data['texto'] ?? '');
$id_proceso    = intval($data['id_proceso'] ?? 0);
$tema          = trim($data['tema'] ?? '');
$seccion       = trim($data['seccion'] ?? '');
$id_usuario    = intval($data['id_usuario'] ?? 0);
$num_preguntas = intval($data['num_preguntas'] ?? 5);
$documento     = trim($data['documento'] ?? ''); // Nombre del documento subido (opcional)

// -------- VALIDACIONES ----------
if (!$id_proceso || !$tema || !$seccion || !$id_usuario) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'Faltan datos requeridos'], JSON_UNESCAPED_UNICODE);
  exit;
}
if ($texto !== '' && mb_strlen($texto) > 7000) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'Texto demasiado largo'], JSON_UNESCAPED_UNICODE);
  exit;
}
if ($num_preguntas < 1) $num_preguntas = 1;
if ($num_preguntas > 100) $num_preguntas = 100;

$GOOGLE_API_KEY = google_key_or_fail();

// -------- OBTENER ROL Y DETERMINAR VISIBILIDAD ----------
$rol_usuario = obtener_rol_usuario($conn, $id_usuario);
$es_publico = es_publico_segun_rol($rol_usuario);

log_debug_preg("Usuario $id_usuario (rol: $rol_usuario) generará preguntas ".($es_publico ? "PÚBLICAS" : "PRIVADAS"));

// -------- VERIFICAR SI EXISTEN COLUMNAS ----------
$tiene_columna_publico = false;
$tiene_columnas_fuente = false;

$check_col = $conn->query("SHOW COLUMNS FROM preguntas LIKE 'es_publico'");
if ($check_col && $check_col->num_rows > 0) {
  $tiene_columna_publico = true;
  log_debug_preg("✓ Columna 'es_publico' existe en tabla preguntas");
} else {
  log_debug_preg("⚠️ Columna 'es_publico' NO existe. Debes ejecutar: ALTER TABLE preguntas ADD COLUMN es_publico TINYINT DEFAULT 0");
}

// Verificar columnas de trazabilidad de fuente
$check_fuente = $conn->query("SHOW COLUMNS FROM preguntas LIKE 'documento'");
if ($check_fuente && $check_fuente->num_rows > 0) {
  $tiene_columnas_fuente = true;
  log_debug_preg("✓ Columnas de fuente existen en tabla preguntas");
} else {
  log_debug_preg("⚠️ Columnas de fuente NO existen. Para habilitar trazabilidad ejecutar: ALTER TABLE preguntas ADD COLUMN documento VARCHAR(255), ADD COLUMN pagina VARCHAR(50), ADD COLUMN ubicacion VARCHAR(50), ADD COLUMN cita TEXT");
}

// -------- GENERACIÓN EN LOTES ----------
$BATCH_MAX = 12;
$pendientes = $num_preguntas;
$map = ['A'=>1,'B'=>2,'C'=>3,'D'=>4];
$total_insertadas = 0;

try {
  $db_name = $conn->query("SELECT DATABASE()")->fetch_row()[0];
  log_debug_preg("BD: $db_name | proceso=$id_proceso seccion=$seccion tema=$tema user=$id_usuario rol=$rol_usuario publico=$es_publico documento=$documento | solicitadas=$num_preguntas");
} catch (Throwable $e) {
  log_debug_preg("Error BD: ".$e->getMessage());
}

$conn->begin_transaction();
try {
  while ($pendientes > 0) {
    $lote = min($BATCH_MAX, $pendientes);
    $items = generar_lote_preguntas($GOOGLE_API_KEY, $lote, $id_proceso, $seccion, $tema, $texto, $documento);

    foreach ($items as $it) {
      $preg = trim($it['pregunta'] ?? '');
      $ops  = $it['opciones'] ?? [];
      $corr = strtoupper(trim($it['correcta'] ?? ''));
      $corr_txt = isset($ops[$corr]) ? trim($ops[$corr]) : '';

      // Extraer datos de fuente (solo si hay texto subido y la IA los devuelve)
      $fuente = $it['fuente'] ?? null;
      $pagina_fuente = null;
      $ubicacion_fuente = null;
      $cita_fuente = null;
      
      if ($fuente && $texto !== '') {
        $pagina_fuente = isset($fuente['pagina']) && $fuente['pagina'] !== 'null' ? trim($fuente['pagina']) : null;
        $ubicacion_fuente = isset($fuente['ubicacion']) ? trim($fuente['ubicacion']) : null;
        $cita_fuente = isset($fuente['cita']) ? trim($fuente['cita']) : null;
        log_debug_preg("Fuente extraída: pág=$pagina_fuente, ubic=$ubicacion_fuente, cita=".substr($cita_fuente ?? '', 0, 50));
      }

      if ($preg==='' || !is_array($ops) || count($ops)!==4 || $corr_txt==='') {
        throw new Exception('Ítem inválido de IA');
      }

      // INSERT con todas las combinaciones posibles de columnas
      if ($tiene_columnas_fuente && $texto !== '' && $tiene_columna_publico) {
        // Con fuente + es_publico
        $stmt = $conn->prepare("INSERT INTO preguntas (id_usuario, id_proceso, tema, seccion, pregunta, correcta, valoracion, es_publico, documento, pagina, ubicacion, cita) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)");
        if (!$stmt) throw new Exception("Prepare: ".$conn->error);
        $stmt->bind_param("iissssississs", $id_usuario, $id_proceso, $tema, $seccion, $preg, $corr_txt, $es_publico, $documento, $pagina_fuente, $ubicacion_fuente, $cita_fuente);
      } elseif ($tiene_columnas_fuente && $texto !== '' && !$tiene_columna_publico) {
        // Con fuente, sin es_publico
        $stmt = $conn->prepare("INSERT INTO preguntas (id_usuario, id_proceso, tema, seccion, pregunta, correcta, valoracion, documento, pagina, ubicacion, cita) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)");
        if (!$stmt) throw new Exception("Prepare: ".$conn->error);
        $stmt->bind_param("iissssssss", $id_usuario, $id_proceso, $tema, $seccion, $preg, $corr_txt, $documento, $pagina_fuente, $ubicacion_fuente, $cita_fuente);
      } elseif ($tiene_columna_publico) {
        // Solo es_publico (sin fuente o sin texto)
        $stmt = $conn->prepare("INSERT INTO preguntas (id_usuario, id_proceso, tema, seccion, pregunta, correcta, valoracion, es_publico) VALUES (?, ?, ?, ?, ?, ?, 0, ?)");
        if (!$stmt) throw new Exception("Prepare: ".$conn->error);
        $stmt->bind_param("iissssi", $id_usuario, $id_proceso, $tema, $seccion, $preg, $corr_txt, $es_publico);
      } else {
        // Sin columnas extra (mantener compatibilidad)
        $stmt = $conn->prepare("INSERT INTO preguntas (id_usuario, id_proceso, tema, seccion, pregunta, correcta, valoracion) VALUES (?, ?, ?, ?, ?, ?, 0)");
        if (!$stmt) throw new Exception("Prepare: ".$conn->error);
        $stmt->bind_param("iissss", $id_usuario, $id_proceso, $tema, $seccion, $preg, $corr_txt);
      }
      
      $stmt->execute();
      if ($stmt->error) throw new Exception("Execute: ".$stmt->error);
      $id_preg = $conn->insert_id;
      $stmt->close();

      foreach ($ops as $letra => $textoResp) {
        $idx = $map[strtoupper($letra)] ?? 0;
        if ($idx < 1 || $idx > 4) continue;
        $stmt2 = $conn->prepare("INSERT INTO respuestas (id_pregunta, indice, respuesta) VALUES (?, ?, ?)");
        if (!$stmt2) throw new Exception("Prepare resp: ".$conn->error);
        $idx_str = (string)$idx;
        $stmt2->bind_param("iss", $id_preg, $idx_str, $textoResp);
        $stmt2->execute();
        if ($stmt2->error) throw new Exception("Execute resp: ".$stmt2->error);
        $stmt2->close();
      }

      $total_insertadas++;
      if ($total_insertadas >= $num_preguntas) break;
    }

    $pendientes = $num_preguntas - $total_insertadas;
  }

  $conn->commit();
  log_debug_preg("✅ Commit OK: $total_insertadas preguntas ".($es_publico ? "públicas" : "privadas")." para usuario $id_usuario".($documento ? " desde documento: $documento" : ""));
  echo json_encode([
    'ok'=>true,
    'preguntas'=>$total_insertadas,
    'es_publico'=>$es_publico,
    'rol'=>$rol_usuario,
    'con_trazabilidad'=>($tiene_columnas_fuente && $texto !== '')
  ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
  $conn->rollback();
  log_debug_preg("❌ ROLLBACK: ".$e->getMessage());
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'DB error','msg'=>$e->getMessage()], JSON_UNESCAPED_UNICODE);
}
