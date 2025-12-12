<?php
// /api/generar_preguntas.php (con división de texto largo, SSE y trazabilidad)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
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

function es_publico_segun_rol(string $rol): int {
  if ($rol === 'sa') return 1;
  if ($rol === 'admin') return 0;
  return 0;
}

function extract_json_array(string $content): ?array {
  $content = preg_replace('/^```[a-zA-Z]*\s*/', '', trim($content));
  $content = preg_replace('/\s*```$/', '', $content);
  $content = trim($content);
  
  $arr = json_decode($content, true);
  if (is_array($arr)) return $arr;
  
  $first = strpos($content, '[');
  $last  = strrpos($content, ']');
  if ($first !== false && $last !== false && $last > $first) {
    $slice = substr($content, $first, $last - $first + 1);
    $arr2 = json_decode($slice, true);
    if (is_array($arr2)) return $arr2;
  }
  
  return null;
}

function es_respuesta_valida($s): bool {
  $s = trim($s ?? '');
  if ($s === '') return false;
  if (preg_match('/[a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛäëïöüÄËÏÖÜçÇ]/u', $s)) {
    return true;
  }
  return false;
}

/**
 * Divide texto largo en fragmentos manejables
 */
function dividir_texto_en_fragmentos(string $texto, int $max_chars = 5000): array {
  $texto = trim($texto);
  if (mb_strlen($texto) <= $max_chars) {
    return [$texto];
  }
  
  $fragmentos = [];
  $parrafos = preg_split('/\n{2,}/', $texto);
  $fragmento_actual = '';
  
  foreach ($parrafos as $parrafo) {
    $parrafo = trim($parrafo);
    if (empty($parrafo)) continue;
    
    if (mb_strlen($fragmento_actual) + mb_strlen($parrafo) + 2 <= $max_chars) {
      $fragmento_actual .= ($fragmento_actual ? "\n\n" : '') . $parrafo;
    } else {
      if (!empty($fragmento_actual)) {
        $fragmentos[] = $fragmento_actual;
      }
      
      if (mb_strlen($parrafo) > $max_chars) {
        $oraciones = preg_split('/(?<=[.!?])\s+/', $parrafo);
        $sub_fragmento = '';
        foreach ($oraciones as $oracion) {
          if (mb_strlen($sub_fragmento) + mb_strlen($oracion) + 1 <= $max_chars) {
            $sub_fragmento .= ($sub_fragmento ? ' ' : '') . $oracion;
          } else {
            if (!empty($sub_fragmento)) {
              $fragmentos[] = $sub_fragmento;
            }
            $sub_fragmento = $oracion;
          }
        }
        $fragmento_actual = $sub_fragmento;
      } else {
        $fragmento_actual = $parrafo;
      }
    }
  }
  
  if (!empty($fragmento_actual)) {
    $fragmentos[] = $fragmento_actual;
  }
  
  return $fragmentos;
}

/**
 * Envía evento SSE
 */
function enviar_sse($type, $data) {
  $event = array_merge(['type' => $type], $data);
  echo "data: " . json_encode($event, JSON_UNESCAPED_UNICODE) . "\n\n";
  @ob_flush();
  @flush();
}

/**
 * Construye el prompt para generar preguntas
 */
function construir_prompt_preguntas(int $n, int $id_proceso, string $seccion, string $tema, string $texto = ''): string {
  if ($texto !== '') {
    return "Genera EXACTAMENTE $n preguntas tipo test de oposición en ESPAÑOL del siguiente texto.

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
    return "Genera EXACTAMENTE $n preguntas tipo test de oposición en ESPAÑOL para:
- Proceso ID: $id_proceso
- Sección: $seccion
- Tema: $tema

IMPORTANTE: Devuelve SOLO un array JSON válido, sin texto antes ni después, sin markdown.

Formato exacto requerido:
[{\"pregunta\":\"texto de la pregunta\",\"opciones\":{\"A\":\"opción A\",\"B\":\"opción B\",\"C\":\"opción C\",\"D\":\"opción D\"},\"correcta\":\"A\"}]";
  }
}

/**
 * Llama a Google Gemini para generar preguntas
 */
function llamar_gemini(string $apiKey, string $prompt): array {
  $model = "gemini-2.5-flash";
  
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
    CURLOPT_TIMEOUT => 120
  ]);
  
  $res = curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $latencyMs = (int)round((microtime(true)-$t0)*1000);
  curl_close($ch);

  log_gemini_raw_preguntas([
    'ts'=>date('c'),'http_code'=>$httpCode,'latency_ms'=>$latencyMs,
    'model'=>$model, 'provider'=>'gemini'
  ]);

  if ($res === false || $httpCode === 429 || $httpCode !== 200) {
    return ['error' => true, 'code' => $httpCode, 'quota_exceeded' => ($httpCode === 429)];
  }

  $j = json_decode($res, true);
  $content = $j['candidates'][0]['content']['parts'][0]['text'] ?? '';
  
  $items = extract_json_array($content);
  if (!is_array($items)) {
    return ['error' => true, 'parse_error' => true];
  }
  
  return ['error' => false, 'items' => $items];
}

/**
 * Llama a OpenAI como fallback
 */
function llamar_openai(string $prompt): array {
  $openai_key = defined('OPENAI_API_KEY') ? OPENAI_API_KEY : '';
  if (empty($openai_key)) {
    log_debug_preg("OpenAI API key no configurada");
    return ['error' => true, 'no_key' => true];
  }
  
  $payload = [
    "model" => "gpt-4o-mini",
    "messages" => [
      ["role" => "system", "content" => "Eres un experto en oposiciones españolas. Genera preguntas tipo test con exactamente 4 opciones (A, B, C, D)."],
      ["role" => "user", "content" => $prompt]
    ],
    "temperature" => 0.35,
    "max_tokens" => 4000,
    "response_format" => ["type" => "json_object"]
  ];
  
  $t0 = microtime(true);
  $ch = curl_init('https://api.openai.com/v1/chat/completions');
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
      'Content-Type: application/json',
      'Authorization: Bearer ' . $openai_key
    ],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT => 120,
    CURLOPT_CONNECTTIMEOUT => 30
  ]);
  
  $res = curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $latencyMs = (int)round((microtime(true)-$t0)*1000);
  $curlError = curl_error($ch);
  curl_close($ch);
  
  log_gemini_raw_preguntas([
    'ts'=>date('c'),'http_code'=>$httpCode,'latency_ms'=>$latencyMs,
    'provider'=>'openai', 'curl_error'=>$curlError
  ]);
  
  if ($res === false || $httpCode !== 200) {
    log_debug_preg("OpenAI falló: HTTP $httpCode, error: $curlError");
    return ['error' => true, 'code' => $httpCode];
  }
  
  $j = json_decode($res, true);
  $content = $j['choices'][0]['message']['content'] ?? '';
  
  $items = extract_json_array($content);
  if (!is_array($items)) {
    // OpenAI a veces devuelve {"preguntas": [...]}
    $parsed = json_decode($content, true);
    if (isset($parsed['preguntas']) && is_array($parsed['preguntas'])) {
      $items = $parsed['preguntas'];
    } else {
      return ['error' => true, 'parse_error' => true];
    }
  }
  
  return ['error' => false, 'items' => $items];
}

/**
 * Genera preguntas con fallback automático Gemini -> OpenAI
 */
function generar_lote_preguntas(string $apiKey, int $n, int $id_proceso, string $seccion, string $tema, string $texto = '', string $documento = ''): array {
  $prompt = construir_prompt_preguntas($n, $id_proceso, $seccion, $tema, $texto);
  
  // Intentar con Gemini primero
  log_debug_preg("Intentando con Gemini para $n preguntas...");
  $result = llamar_gemini($apiKey, $prompt);
  
  if (!$result['error']) {
    log_debug_preg("✓ Gemini OK: " . count($result['items']) . " preguntas");
    return $result['items'];
  }
  
  // Si Gemini falla (429 cuota o error), intentar OpenAI
  $reason = $result['quota_exceeded'] ?? false ? 'cuota excedida' : 'error';
  log_debug_preg("Gemini falló ($reason), intentando OpenAI...");
  
  $result = llamar_openai($prompt);
  
  if (!$result['error']) {
    log_debug_preg("✓ OpenAI OK: " . count($result['items']) . " preguntas");
    return $result['items'];
  }
  
  // Ambos fallaron
  if ($result['no_key'] ?? false) {
    throw new Exception('Gemini no disponible y OpenAI no está configurado. Intenta más tarde.');
  }
  
  throw new Exception('Error generando preguntas. Ambos proveedores fallaron. Intenta más tarde.');
}

/**
 * Inserta una pregunta en la BD
 */
function insertar_pregunta($conn, $it, $id_usuario, $id_proceso, $tema, $seccion, $es_publico, $documento, $tiene_columnas_fuente, $tiene_columna_publico, $texto_origen) {
  global $map;
  
  $preg = trim($it['pregunta'] ?? '');
  $ops  = $it['opciones'] ?? [];
  $corr = strtoupper(trim($it['correcta'] ?? ''));
  $corr_txt = isset($ops[$corr]) ? trim($ops[$corr]) : '';

  $fuente = $it['fuente'] ?? null;
  $pagina_fuente = null;
  $ubicacion_fuente = null;
  $cita_fuente = null;
  
  if ($fuente && $texto_origen !== '') {
    $pagina_fuente = isset($fuente['pagina']) && $fuente['pagina'] !== 'null' ? trim($fuente['pagina']) : null;
    $ubicacion_fuente = isset($fuente['ubicacion']) ? trim($fuente['ubicacion']) : null;
    $cita_fuente = isset($fuente['cita']) ? trim($fuente['cita']) : null;
  }

  if ($preg==='' || !is_array($ops) || count($ops) < 3 || $corr_txt==='') {
    return false;
  }
  
  if (!es_respuesta_valida($corr_txt)) {
    return false;
  }

  // INSERT con todas las combinaciones posibles de columnas
  if ($tiene_columnas_fuente && $texto_origen !== '' && $tiene_columna_publico) {
    $stmt = $conn->prepare("INSERT INTO preguntas (id_usuario, id_proceso, tema, seccion, pregunta, correcta, valoracion, es_publico, documento, pagina, ubicacion, cita) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)");
    if (!$stmt) throw new Exception("Prepare: ".$conn->error);
    $stmt->bind_param("iissssississs", $id_usuario, $id_proceso, $tema, $seccion, $preg, $corr_txt, $es_publico, $documento, $pagina_fuente, $ubicacion_fuente, $cita_fuente);
  } elseif ($tiene_columnas_fuente && $texto_origen !== '' && !$tiene_columna_publico) {
    $stmt = $conn->prepare("INSERT INTO preguntas (id_usuario, id_proceso, tema, seccion, pregunta, correcta, valoracion, documento, pagina, ubicacion, cita) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)");
    if (!$stmt) throw new Exception("Prepare: ".$conn->error);
    $stmt->bind_param("iissssssss", $id_usuario, $id_proceso, $tema, $seccion, $preg, $corr_txt, $documento, $pagina_fuente, $ubicacion_fuente, $cita_fuente);
  } elseif ($tiene_columna_publico) {
    $stmt = $conn->prepare("INSERT INTO preguntas (id_usuario, id_proceso, tema, seccion, pregunta, correcta, valoracion, es_publico) VALUES (?, ?, ?, ?, ?, ?, 0, ?)");
    if (!$stmt) throw new Exception("Prepare: ".$conn->error);
    $stmt->bind_param("iissssi", $id_usuario, $id_proceso, $tema, $seccion, $preg, $corr_txt, $es_publico);
  } else {
    $stmt = $conn->prepare("INSERT INTO preguntas (id_usuario, id_proceso, tema, seccion, pregunta, correcta, valoracion) VALUES (?, ?, ?, ?, ?, ?, 0)");
    if (!$stmt) throw new Exception("Prepare: ".$conn->error);
    $stmt->bind_param("iissss", $id_usuario, $id_proceso, $tema, $seccion, $preg, $corr_txt);
  }
  
  $stmt->execute();
  if ($stmt->error) throw new Exception("Execute: ".$stmt->error);
  $id_preg = $conn->insert_id;
  $stmt->close();

  // Validar y filtrar respuestas
  $respuestas_validas = [];
  foreach ($ops as $letra => $textoResp) {
    $idx = $map[strtoupper($letra)] ?? 0;
    if ($idx < 1 || $idx > 4) continue;
    
    $textoRespTrimmed = trim($textoResp);
    if (es_respuesta_valida($textoRespTrimmed)) {
      $respuestas_validas[$letra] = ['idx' => $idx, 'texto' => $textoRespTrimmed];
    }
  }
  
  if (count($respuestas_validas) < 2) {
    $conn->query("DELETE FROM preguntas WHERE id = $id_preg");
    return false;
  }
  
  foreach ($respuestas_validas as $letra => $data) {
    $stmt2 = $conn->prepare("INSERT INTO respuestas (id_pregunta, indice, respuesta) VALUES (?, ?, ?)");
    if (!$stmt2) throw new Exception("Prepare resp: ".$conn->error);
    $idx_str = (string)$data['idx'];
    $stmt2->bind_param("iss", $id_preg, $idx_str, $data['texto']);
    $stmt2->execute();
    if ($stmt2->error) throw new Exception("Execute resp: ".$stmt2->error);
    $stmt2->close();
  }

  return true;
}

// -------- INPUT ----------
$data = json_decode(file_get_contents("php://input"), true) ?: [];

$texto         = trim($data['texto'] ?? '');
$id_proceso    = intval($data['id_proceso'] ?? 0);
$tema          = trim($data['tema'] ?? '');
$seccion       = trim($data['seccion'] ?? '');
$id_usuario    = intval($data['id_usuario'] ?? 0);
$num_preguntas = intval($data['num_preguntas'] ?? 5);
$documento     = trim($data['documento'] ?? '');
$use_streaming = isset($data['use_streaming']) && $data['use_streaming'] === true;

// -------- VALIDACIONES ----------
if (!$id_proceso || !$tema || !$seccion || !$id_usuario) {
  header("Content-Type: application/json; charset=utf-8");
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'Faltan datos requeridos'], JSON_UNESCAPED_UNICODE);
  exit;
}
if ($num_preguntas < 1) $num_preguntas = 1;
if ($num_preguntas > 100) $num_preguntas = 100;

$GOOGLE_API_KEY = google_key_or_fail();

// -------- OBTENER ROL Y DETERMINAR VISIBILIDAD ----------
$rol_usuario = obtener_rol_usuario($conn, $id_usuario);
$es_publico = es_publico_segun_rol($rol_usuario);

log_debug_preg("Usuario $id_usuario (rol: $rol_usuario) generará preguntas ".($es_publico ? "PÚBLICAS" : "PRIVADAS"));

// -------- VERIFICAR COLUMNAS ----------
$tiene_columna_publico = false;
$tiene_columnas_fuente = false;

$check_col = $conn->query("SHOW COLUMNS FROM preguntas LIKE 'es_publico'");
if ($check_col && $check_col->num_rows > 0) $tiene_columna_publico = true;

$check_fuente = $conn->query("SHOW COLUMNS FROM preguntas LIKE 'documento'");
if ($check_fuente && $check_fuente->num_rows > 0) $tiene_columnas_fuente = true;

$map = ['A'=>1,'B'=>2,'C'=>3,'D'=>4];

// -------- MODO STREAMING PARA TEXTOS LARGOS ----------
if ($use_streaming && $texto !== '' && mb_strlen($texto) > 5000) {
  header("Content-Type: text/event-stream");
  header("Cache-Control: no-cache");
  header("Connection: keep-alive");
  header("X-Accel-Buffering: no");
  
  $fragmentos = dividir_texto_en_fragmentos($texto, 5000);
  $total_fragmentos = count($fragmentos);
  $preguntas_por_fragmento = max(3, intval(ceil($num_preguntas / $total_fragmentos)));
  
  log_debug_preg("STREAMING: Texto dividido en $total_fragmentos fragmentos, ~$preguntas_por_fragmento preguntas/fragmento");
  
  enviar_sse('progress', [
    'message' => "Procesando texto en $total_fragmentos fragmentos...",
    'current' => 0,
    'total' => $total_fragmentos
  ]);
  
  $total_insertadas = 0;
  $fragmentos_procesados = 0;
  
  $conn->begin_transaction();
  
  $fragmentos_fallidos = [];
  
  try {
    foreach ($fragmentos as $idx => $fragmento) {
      $fragmento_num = $idx + 1;
      
      enviar_sse('progress', [
        'message' => "Generando preguntas del fragmento $fragmento_num de $total_fragmentos...",
        'current' => $fragmento_num,
        'total' => $total_fragmentos
      ]);
      
      // Intentar hasta 2 veces por fragmento
      $reintentos = 2;
      $exito = false;
      
      for ($intento = 1; $intento <= $reintentos && !$exito; $intento++) {
        try {
          $items = generar_lote_preguntas($GOOGLE_API_KEY, $preguntas_por_fragmento, $id_proceso, $seccion, $tema, $fragmento, $documento);
          
          foreach ($items as $it) {
            if (insertar_pregunta($conn, $it, $id_usuario, $id_proceso, $tema, $seccion, $es_publico, $documento, $tiene_columnas_fuente, $tiene_columna_publico, $fragmento)) {
              $total_insertadas++;
            }
          }
          
          $fragmentos_procesados++;
          $exito = true;
          
          enviar_sse('chunk_complete', [
            'current' => $fragmento_num,
            'total' => $total_fragmentos,
            'totalGenerated' => $total_insertadas
          ]);
          
        } catch (Exception $e) {
          log_debug_preg("Intento $intento fragmento $fragmento_num falló: " . $e->getMessage());
          
          if ($intento < $reintentos) {
            enviar_sse('progress', [
              'message' => "Reintentando fragmento $fragmento_num...",
              'current' => $fragmento_num,
              'total' => $total_fragmentos
            ]);
            usleep(1000000); // Esperar 1 segundo antes de reintentar
          } else {
            // Después de todos los reintentos, continuar con el siguiente fragmento
            $fragmentos_fallidos[] = $fragmento_num;
            enviar_sse('chunk_warning', [
              'message' => "Fragmento $fragmento_num omitido tras $reintentos intentos",
              'current' => $fragmento_num,
              'total' => $total_fragmentos
            ]);
          }
        }
      }
      
      if ($fragmento_num < $total_fragmentos) {
        usleep(500000);
      }
    }
    
    // Hacer commit si se generó al menos una pregunta
    if ($total_insertadas > 0) {
      $conn->commit();
      log_debug_preg("✅ Streaming completado: $total_insertadas preguntas en $fragmentos_procesados fragmentos (fallidos: ".count($fragmentos_fallidos).")");
      
      $mensaje_warning = '';
      if (count($fragmentos_fallidos) > 0) {
        $mensaje_warning = "Algunos fragmentos no pudieron procesarse: " . implode(', ', $fragmentos_fallidos);
      }
      
      enviar_sse('complete', [
        'ok' => true,
        'generadas' => $total_insertadas,
        'chunks_procesados' => $fragmentos_procesados,
        'total_chunks' => $total_fragmentos,
        'chunks_fallidos' => count($fragmentos_fallidos),
        'es_publico' => $es_publico,
        'rol' => $rol_usuario,
        'warning' => $mensaje_warning
      ]);
    } else {
      $conn->rollback();
      log_debug_preg("❌ ROLLBACK: No se pudo generar ninguna pregunta");
      enviar_sse('error', ['error' => 'No se pudo generar ninguna pregunta. Intenta con un texto diferente.']);
    }
    
  } catch (Exception $e) {
    $conn->rollback();
    log_debug_preg("❌ ROLLBACK streaming: " . $e->getMessage());
    enviar_sse('error', ['error' => $e->getMessage()]);
  }
  
  exit;
}

// -------- MODO NORMAL (textos cortos o sin texto) ----------
header("Content-Type: application/json; charset=utf-8");

// Si hay texto largo pero no se pidió streaming, dividir igualmente
if ($texto !== '' && mb_strlen($texto) > 6000) {
  $fragmentos = dividir_texto_en_fragmentos($texto, 5000);
  $total_fragmentos = count($fragmentos);
  $preguntas_por_fragmento = max(3, intval(ceil($num_preguntas / $total_fragmentos)));
  
  log_debug_preg("NORMAL: Texto dividido en $total_fragmentos fragmentos, ~$preguntas_por_fragmento preguntas/fragmento");
  
  $total_insertadas = 0;
  
  $conn->begin_transaction();
  
  $fragmentos_fallidos = [];
  
  try {
    foreach ($fragmentos as $idx => $fragmento) {
      $fragmento_num = $idx + 1;
      
      // Intentar hasta 2 veces por fragmento
      $reintentos = 2;
      $exito = false;
      
      for ($intento = 1; $intento <= $reintentos && !$exito; $intento++) {
        try {
          $items = generar_lote_preguntas($GOOGLE_API_KEY, $preguntas_por_fragmento, $id_proceso, $seccion, $tema, $fragmento, $documento);
          
          foreach ($items as $it) {
            if (insertar_pregunta($conn, $it, $id_usuario, $id_proceso, $tema, $seccion, $es_publico, $documento, $tiene_columnas_fuente, $tiene_columna_publico, $fragmento)) {
              $total_insertadas++;
            }
            
            if ($total_insertadas >= $num_preguntas) break 3;
          }
          
          $exito = true;
          
        } catch (Exception $e) {
          log_debug_preg("Intento $intento fragmento $fragmento_num falló: " . $e->getMessage());
          if ($intento < $reintentos) {
            usleep(1000000); // Esperar 1 segundo antes de reintentar
          } else {
            $fragmentos_fallidos[] = $fragmento_num;
          }
        }
      }
      
      if ($idx < $total_fragmentos - 1) {
        usleep(500000);
      }
    }
    
    if ($total_insertadas > 0) {
      $conn->commit();
      log_debug_preg("✅ Commit OK: $total_insertadas preguntas de $total_fragmentos fragmentos (fallidos: ".count($fragmentos_fallidos).")");
      echo json_encode([
        'ok'=>true,
        'generadas'=>$total_insertadas,
        'preguntas'=>$total_insertadas,
        'es_publico'=>$es_publico,
        'rol'=>$rol_usuario,
        'fragmentos'=>$total_fragmentos,
        'fragmentos_fallidos'=>count($fragmentos_fallidos)
      ], JSON_UNESCAPED_UNICODE);
    } else {
      $conn->rollback();
      log_debug_preg("❌ ROLLBACK: No se pudo generar ninguna pregunta");
      http_response_code(500);
      echo json_encode(['ok'=>false,'error'=>'No se pudo generar ninguna pregunta. Intenta con un texto diferente o más corto.'], JSON_UNESCAPED_UNICODE);
    }
    
  } catch (Exception $e) {
    $conn->rollback();
    log_debug_preg("❌ ROLLBACK: ".$e->getMessage());
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()], JSON_UNESCAPED_UNICODE);
  }
  
  exit;
}

// -------- MODO NORMAL (textos cortos) ----------
$BATCH_MAX = 12;
$pendientes = $num_preguntas;
$total_insertadas = 0;

try {
  $db_name = $conn->query("SELECT DATABASE()")->fetch_row()[0];
  log_debug_preg("BD: $db_name | proceso=$id_proceso seccion=$seccion tema=$tema user=$id_usuario rol=$rol_usuario publico=$es_publico | solicitadas=$num_preguntas");
} catch (Throwable $e) {
  log_debug_preg("Error BD: ".$e->getMessage());
}

$conn->begin_transaction();
try {
  while ($pendientes > 0) {
    $lote = min($BATCH_MAX, $pendientes);
    $items = generar_lote_preguntas($GOOGLE_API_KEY, $lote, $id_proceso, $seccion, $tema, $texto, $documento);

    foreach ($items as $it) {
      if (insertar_pregunta($conn, $it, $id_usuario, $id_proceso, $tema, $seccion, $es_publico, $documento, $tiene_columnas_fuente, $tiene_columna_publico, $texto)) {
        $total_insertadas++;
      }
      
      if ($total_insertadas >= $num_preguntas) break;
    }

    $pendientes = $num_preguntas - $total_insertadas;
  }

  $conn->commit();
  log_debug_preg("✅ Commit OK: $total_insertadas preguntas ".($es_publico ? "públicas" : "privadas")." para usuario $id_usuario");
  echo json_encode([
    'ok'=>true,
    'generadas'=>$total_insertadas,
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
