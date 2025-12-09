<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=utf-8");
error_reporting(E_ERROR | E_PARSE);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

require 'db.php';

/* ------------------ helpers ------------------ */
function limpiar($s) {
    $s = $s ?? '';
    $s = preg_replace('/\s+/u', ' ', trim($s));
    return $s;
}
function param($k, $def=null) {
    return $_GET[$k] ?? $_POST[$k] ?? $def;
}

/* ------------------ input ------------------ */
$proceso_id   = intval(param('proceso_id', 0));
$seccionesRaw = param('secciones', '');
$temasRaw     = param('temas', '');
$numPreguntas = intval(param('numPreguntas', 50));
$dificultad   = param('dificultad', ''); // nuevo
$tipo         = param('tipo', ''); // nuevo
$habilidad    = param('habilidad', ''); // nuevo

if ($numPreguntas < 1)  $numPreguntas = 1;
if ($numPreguntas > 200) $numPreguntas = 200;

if (!$proceso_id) {
    echo json_encode([]);
    exit;
}

/* Normaliza secciones/temas (opcionales) */
$nulWords = ['','*','all','todos','todas','todas las secciones','todas las secciones','todas los temas','todos los temas'];
$secciones_arr = array_values(array_filter(array_map('trim', explode(',', (string)$seccionesRaw)), function($v) use($nulWords){
    return !in_array(mb_strtolower($v,'UTF-8'), $nulWords, true);
}));
$temas_arr = array_values(array_filter(array_map('trim', explode(',', (string)$temasRaw)), function($v) use($nulWords){
    return !in_array(mb_strtolower($v,'UTF-8'), $nulWords, true);
}));

/* ------------------ query builder ------------------ */
function fetch_preguntas($conn, $proceso_id, $secciones, $temas, $limit, $dificultad = '', $tipo = '', $habilidad = '') {
    $sql   = "SELECT id, pregunta, correcta FROM preguntas WHERE id_proceso = ?";
    $types = 'i';
    $bind  = [$proceso_id];

    if (count($secciones) > 0) {
        $sql   .= " AND seccion IN (" . implode(',', array_fill(0, count($secciones), '?')) . ")";
        $types .= str_repeat('s', count($secciones));
        $bind   = array_merge($bind, $secciones);
    }
    if (count($temas) > 0) {
        $sql   .= " AND tema IN (" . implode(',', array_fill(0, count($temas), '?')) . ")";
        $types .= str_repeat('s', count($temas));
        $bind   = array_merge($bind, $temas);
    }

    // Filtro de dificultad
    if ($dificultad !== '' && $dificultad !== 'todas') {
        // Mapeo: facil=1, media=2, dificil=3
        // Si dificultad es 0 o NULL, se trata como difícil (3)
        if ($dificultad === 'facil') {
            $sql   .= " AND dificultad = ?";
            $types .= 'i';
            $bind[] = 1;
        } elseif ($dificultad === 'media') {
            $sql   .= " AND dificultad = ?";
            $types .= 'i';
            $bind[] = 2;
        } elseif ($dificultad === 'dificil') {
            // dificil incluye: dificultad = 3 OR dificultad IS NULL OR dificultad = 0
            $sql   .= " AND (dificultad = 3 OR dificultad IS NULL OR dificultad = 0)";
        }
    }

    // Filtro de tipo (para psicotécnicos)
    if ($tipo !== '' && $tipo !== 'todos') {
        $sql   .= " AND tipo = ?";
        $types .= 's';
        $bind[] = $tipo;
    }

    // Filtro de habilidad (para psicotécnicos)
    if ($habilidad !== '' && $habilidad !== 'todas') {
        $sql   .= " AND habilidad = ?";
        $types .= 's';
        $bind[] = $habilidad;
    }

    $sql   .= " ORDER BY RAND() LIMIT ?";
    $types .= 'i';
    $bind[] = $limit;

    $stmt = $conn->prepare($sql);
    if (!$stmt) return [];
    $stmt->bind_param($types, ...$bind);
    $stmt->execute();
    $res = $stmt->get_result();

    $rows = [];
    while ($row = $res->fetch_assoc()) {
        $rows[] = $row;
    }
    $stmt->close();
    return $rows;
}

/* 1) Intenta con los filtros dados (si existen) */
$pregRows = fetch_preguntas($conn, $proceso_id, $secciones_arr, $temas_arr, $numPreguntas, $dificultad, $tipo, $habilidad);

/* 2) Si no hay resultados y había filtros, relaja progresivamente */
if (count($pregRows) === 0) {
    // Intenta sin filtros de dificultad/tipo/habilidad pero manteniendo secciones/temas
    if ($dificultad !== '' || $tipo !== '' || $habilidad !== '') {
        $pregRows = fetch_preguntas($conn, $proceso_id, $secciones_arr, $temas_arr, $numPreguntas, '', '', '');
    }
    
    // Si aún no hay resultados y había filtros de sección/tema, relaja completamente
    if (count($pregRows) === 0 && (count($secciones_arr) > 0 || count($temas_arr) > 0)) {
        $pregRows = fetch_preguntas($conn, $proceso_id, [], [], $numPreguntas, '', '', '');
    }
}

/* Construye salida con respuestas y correcta_indice */
$out = [];
foreach ($pregRows as $pregunta) {
    $id = intval($pregunta['id']);

    // Respuestas ordenadas por indice
    $stmt2 = $conn->prepare("SELECT indice, respuesta FROM respuestas WHERE id_pregunta = ? ORDER BY indice");
    if (!$stmt2) continue;
    $stmt2->bind_param('i', $id);
    $stmt2->execute();
    $rres = $stmt2->get_result();

    $respuestas = [];
    while ($r = $rres->fetch_assoc()) {
        $respuestas[] = [
            'indice'    => (string)$r['indice'],
            'respuesta' => limpiar($r['respuesta'])
        ];
    }
    $stmt2->close();

    // Detectar correcta_indice: si la columna 'correcta' es numérica, úsala,
    // si no, iguala por texto limpio.
    $correcta_indice = null;
    $colCorrecta = $pregunta['correcta'];
    
    // DEBUG: Log the correcta value
    error_log("[genera_test] Pregunta ID: $id, correcta raw: " . var_export($colCorrecta, true));
    
    if ($colCorrecta !== null && $colCorrecta !== '' && is_numeric($colCorrecta)) {
        $correcta_indice = (string)intval($colCorrecta);
        error_log("[genera_test] correcta es numérica: $correcta_indice");
    } else {
        $textoCorrecto = limpiar((string)$colCorrecta);
        $textoCorrectoLower = mb_strtolower($textoCorrecto, 'UTF-8');
        
        error_log("[genera_test] Buscando coincidencia para: '$textoCorrecto'");
        
        // 1. Intento: coincidencia exacta (case-insensitive)
        foreach ($respuestas as $resp) {
            $respLimpia = limpiar($resp['respuesta']);
            $respLimpiaLower = mb_strtolower($respLimpia, 'UTF-8');
            error_log("[genera_test] Comparando con indice {$resp['indice']}: '$respLimpia'");
            
            if ($respLimpiaLower === $textoCorrectoLower) {
                $correcta_indice = $resp['indice'];
                error_log("[genera_test] ¡Match exacto encontrado! indice: $correcta_indice");
                break;
            }
        }
        
        // 2. Intento: La respuesta contiene el texto de correcta o viceversa
        if ($correcta_indice === null && strlen($textoCorrecto) > 5) {
            foreach ($respuestas as $resp) {
                $respLimpia = limpiar($resp['respuesta']);
                $respLimpiaLower = mb_strtolower($respLimpia, 'UTF-8');
                
                // Si el texto de correcta está contenido en la respuesta
                if (mb_strpos($respLimpiaLower, $textoCorrectoLower) !== false) {
                    $correcta_indice = $resp['indice'];
                    error_log("[genera_test] Match por contenido (correcta en respuesta): indice $correcta_indice");
                    break;
                }
                // Si la respuesta está contenida en el texto de correcta
                if (mb_strpos($textoCorrectoLower, $respLimpiaLower) !== false) {
                    $correcta_indice = $resp['indice'];
                    error_log("[genera_test] Match por contenido (respuesta en correcta): indice $correcta_indice");
                    break;
                }
            }
        }
        
        // 3. Intento: Similitud por palabras clave (primeras N palabras)
        if ($correcta_indice === null) {
            $palabrasCorrecta = array_slice(explode(' ', $textoCorrectoLower), 0, 4);
            $keywordCorrecta = implode(' ', $palabrasCorrecta);
            
            foreach ($respuestas as $resp) {
                $respLimpia = limpiar($resp['respuesta']);
                $respLimpiaLower = mb_strtolower($respLimpia, 'UTF-8');
                
                if (mb_strpos($respLimpiaLower, $keywordCorrecta) !== false) {
                    $correcta_indice = $resp['indice'];
                    error_log("[genera_test] Match por palabras clave: indice $correcta_indice");
                    break;
                }
            }
        }
        
        // 4. NO HAY FALLBACK a primera respuesta - si no hay match, es un error de datos
        if ($correcta_indice === null) {
            error_log("[genera_test] ERROR: No se encontró coincidencia para correcta='$textoCorrecto' en pregunta ID: $id");
            // Marcar como null para indicar problema de datos
            $correcta_indice = null;
        }
    }

    $out[] = [
        'id'              => $id,
        'pregunta'        => limpiar($pregunta['pregunta']),
        'respuestas'      => $respuestas,
        'correcta_indice' => $correcta_indice
    ];
}

/* Salida 100% retrocompatible: siempre un array */
echo json_encode($out, JSON_UNESCAPED_UNICODE);
