<?php
// /api/genera_test.php
// Genera preguntas aleatorias para un test con correcta_indice determinada desde la base de datos
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json; charset=utf-8");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit(); }

ini_set('display_errors', 0);
error_reporting(0);

require 'db.php';

// Log para debugging
function log_genera_test($msg) {
  @file_put_contents(__DIR__.'/log_genera_test.txt', date('Y-m-d H:i:s').' | '.$msg.PHP_EOL, FILE_APPEND);
}

// Obtener parámetros
$proceso_id = isset($_GET['proceso_id']) ? intval($_GET['proceso_id']) : 0;
$secciones = isset($_GET['secciones']) ? $_GET['secciones'] : '';
$temas = isset($_GET['temas']) ? $_GET['temas'] : '';
$numPreguntas = isset($_GET['numPreguntas']) ? intval($_GET['numPreguntas']) : 10;
$dificultad = isset($_GET['dificultad']) ? $_GET['dificultad'] : '';
$tipo = isset($_GET['tipo']) ? $_GET['tipo'] : '';
$habilidad = isset($_GET['habilidad']) ? $_GET['habilidad'] : '';

log_genera_test("Solicitud: proceso_id=$proceso_id, secciones=$secciones, temas=$temas, num=$numPreguntas");

if (!$proceso_id) {
  http_response_code(400);
  echo json_encode(['error' => 'Falta proceso_id'], JSON_UNESCAPED_UNICODE);
  exit;
}

// Construir query base
$where = "p.id_proceso = ?";
$params = [$proceso_id];
$types = "i";

// Filtrar por secciones si se especifican
if ($secciones && $secciones !== '') {
  $seccionesArr = array_filter(array_map('trim', explode(',', $secciones)));
  if (count($seccionesArr) > 0) {
    $placeholders = implode(',', array_fill(0, count($seccionesArr), '?'));
    $where .= " AND p.seccion IN ($placeholders)";
    foreach ($seccionesArr as $s) {
      $params[] = $s;
      $types .= "s";
    }
  }
}

// Filtrar por temas si se especifican
if ($temas && $temas !== '') {
  $temasArr = array_filter(array_map('trim', explode(',', $temas)));
  if (count($temasArr) > 0) {
    $placeholders = implode(',', array_fill(0, count($temasArr), '?'));
    $where .= " AND p.tema IN ($placeholders)";
    foreach ($temasArr as $t) {
      $params[] = $t;
      $types .= "s";
    }
  }
}

// Limitar número de preguntas
if ($numPreguntas < 1) $numPreguntas = 1;
if ($numPreguntas > 200) $numPreguntas = 200;

// Consulta para obtener preguntas
// IMPORTANTE: Obtener la columna 'correcta' que contiene el TEXTO de la respuesta correcta
$sql = "SELECT p.id, p.pregunta, p.correcta 
        FROM preguntas p 
        WHERE $where 
        ORDER BY RAND() 
        LIMIT ?";

$params[] = $numPreguntas;
$types .= "i";

log_genera_test("SQL: $sql");
log_genera_test("Params: " . json_encode($params));

$stmt = $conn->prepare($sql);
if (!$stmt) {
  log_genera_test("Error prepare: " . $conn->error);
  http_response_code(500);
  echo json_encode(['error' => 'Error en consulta: ' . $conn->error], JSON_UNESCAPED_UNICODE);
  exit;
}

$stmt->bind_param($types, ...$params);
$stmt->execute();
$result = $stmt->get_result();

$preguntas = [];
while ($row = $result->fetch_assoc()) {
  $preguntas[] = [
    'id' => intval($row['id']),
    'pregunta' => $row['pregunta'],
    'correcta_texto' => $row['correcta'] // Guardamos el texto de la correcta para comparar
  ];
}
$stmt->close();

log_genera_test("Preguntas obtenidas: " . count($preguntas));

if (count($preguntas) === 0) {
  echo json_encode([], JSON_UNESCAPED_UNICODE);
  exit;
}

// Obtener las respuestas para cada pregunta
$resultado = [];
foreach ($preguntas as $preg) {
  $id_pregunta = $preg['id'];
  $correcta_texto = trim($preg['correcta_texto']);
  
  // Obtener respuestas de la base de datos
  $stmtResp = $conn->prepare("SELECT indice, respuesta FROM respuestas WHERE id_pregunta = ? ORDER BY indice ASC");
  if (!$stmtResp) {
    log_genera_test("Error preparando respuestas: " . $conn->error);
    continue;
  }
  
  $stmtResp->bind_param("i", $id_pregunta);
  $stmtResp->execute();
  $resResp = $stmtResp->get_result();
  
  $respuestas = [];
  $correcta_indice = null;
  
  while ($resp = $resResp->fetch_assoc()) {
    $indice = $resp['indice'];
    $texto_respuesta = trim($resp['respuesta']);
    
    $respuestas[] = [
      'indice' => $indice,
      'respuesta' => $resp['respuesta']
    ];
    
    // CRÍTICO: Comparar el texto de la respuesta con el texto de la correcta de la BD
    // Usamos comparación case-insensitive y trim para evitar problemas de espacios
    if ($correcta_indice === null) {
      // Comparación exacta primero
      if ($texto_respuesta === $correcta_texto) {
        $correcta_indice = $indice;
        log_genera_test("Pregunta $id_pregunta: Correcta encontrada (exacta) en índice $indice");
      }
      // Si no coincide exactamente, probar comparación case-insensitive
      else if (strcasecmp($texto_respuesta, $correcta_texto) === 0) {
        $correcta_indice = $indice;
        log_genera_test("Pregunta $id_pregunta: Correcta encontrada (case-insensitive) en índice $indice");
      }
      // También probar si uno contiene al otro (por si hay diferencias menores)
      else if (mb_stripos($texto_respuesta, $correcta_texto) !== false || 
               mb_stripos($correcta_texto, $texto_respuesta) !== false) {
        // Solo si son muy similares (longitud similar)
        $len1 = mb_strlen($texto_respuesta);
        $len2 = mb_strlen($correcta_texto);
        if (abs($len1 - $len2) <= 5) { // Tolerancia de 5 caracteres
          $correcta_indice = $indice;
          log_genera_test("Pregunta $id_pregunta: Correcta encontrada (substring) en índice $indice");
        }
      }
    }
  }
  $stmtResp->close();
  
  // Si no encontramos la correcta, logear para debugging
  if ($correcta_indice === null) {
    log_genera_test("⚠️ Pregunta $id_pregunta: NO se encontró la respuesta correcta");
    log_genera_test("   correcta_texto de BD: '$correcta_texto'");
    foreach ($respuestas as $r) {
      log_genera_test("   respuesta indice {$r['indice']}: '{$r['respuesta']}'");
    }
    // Default a índice "1" si no se encuentra (pero esto es un error de datos)
    $correcta_indice = "1";
  }
  
  $resultado[] = [
    'id' => $id_pregunta,
    'pregunta' => $preg['pregunta'],
    'respuestas' => $respuestas,
    'correcta_indice' => (string)$correcta_indice
  ];
}

log_genera_test("Resultado final: " . count($resultado) . " preguntas procesadas");

echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
