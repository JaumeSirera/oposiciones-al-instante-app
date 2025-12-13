<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require 'db.php';

// Obtener datos JSON
$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data) {
    echo json_encode(['ok' => false, 'error' => 'Datos JSON inválidos']);
    exit;
}

$id_proceso = intval($data['id_proceso'] ?? 0);
$seccion = trim($data['seccion'] ?? '');
$tema = trim($data['tema'] ?? '');
$id_usuario = intval($data['id_usuario'] ?? 0);
$preguntas = $data['preguntas'] ?? [];

if ($id_proceso <= 0 || empty($seccion) || empty($tema) || $id_usuario <= 0 || empty($preguntas)) {
    echo json_encode(['ok' => false, 'error' => 'Faltan datos requeridos']);
    exit;
}

// Función para obtener rol del usuario
function obtener_rol_usuario($conn, $id_usuario) {
    $stmt = $conn->prepare("SELECT rol FROM accounts WHERE id = ?");
    if (!$stmt) return 'user';
    $stmt->bind_param("i", $id_usuario);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    return $row['rol'] ?? 'user';
}

// Verificar si existe columna es_publico
function columna_existe($conn, $tabla, $columna) {
    $result = $conn->query("SHOW COLUMNS FROM `$tabla` LIKE '$columna'");
    return $result && $result->num_rows > 0;
}

try {
    $rol = obtener_rol_usuario($conn, $id_usuario);
    $es_publico = ($rol === 'sa') ? 1 : 0;
    
    $tiene_es_publico = columna_existe($conn, 'preguntas', 'es_publico');
    $tiene_id_usuario_creador = columna_existe($conn, 'preguntas', 'id_usuario_creador');
    
    $conn->begin_transaction();
    
    $guardadas = 0;
    
    foreach ($preguntas as $pregunta) {
        $texto_pregunta = trim($pregunta['pregunta'] ?? '');
        $respuestas = $pregunta['respuestas'] ?? [];
        $correcta_indice = $pregunta['correcta_indice'] ?? 'A';
        
        if (empty($texto_pregunta) || count($respuestas) < 2) {
            continue;
        }
        
        // Encontrar respuesta correcta
        $respuesta_correcta = '';
        foreach ($respuestas as $r) {
            if (strtoupper($r['indice']) === strtoupper($correcta_indice)) {
                $respuesta_correcta = $r['respuesta'];
                break;
            }
        }
        
        // Campos de trazabilidad
        $documento_val = isset($pregunta['documento']) ? trim($pregunta['documento']) : null;
        $pagina_val = isset($pregunta['pagina']) ? trim($pregunta['pagina']) : null;
        $ubicacion_val = isset($pregunta['ubicacion']) ? trim($pregunta['ubicacion']) : null;
        $cita_val = isset($pregunta['cita']) ? trim($pregunta['cita']) : null;
        
        // Construir SQL dinámico
        $campos = ['id_proceso', 'seccion', 'tema', 'pregunta', 'correcta'];
        $valores = [$id_proceso, $seccion, $tema, $texto_pregunta, $respuesta_correcta];
        $tipos = 'issss';
        
        if ($tiene_es_publico) {
            $campos[] = 'es_publico';
            $valores[] = $es_publico;
            $tipos .= 'i';
        }
        
        if ($tiene_id_usuario_creador) {
            $campos[] = 'id_usuario_creador';
            $valores[] = $id_usuario;
            $tipos .= 'i';
        }
        
        // Añadir campos de trazabilidad si existen y tienen valor
        $tiene_documento = columna_existe($conn, 'preguntas', 'documento');
        $tiene_pagina = columna_existe($conn, 'preguntas', 'pagina');
        $tiene_ubicacion = columna_existe($conn, 'preguntas', 'ubicacion');
        $tiene_cita = columna_existe($conn, 'preguntas', 'cita');
        
        if ($tiene_documento && $documento_val) {
            $campos[] = 'documento';
            $valores[] = $documento_val;
            $tipos .= 's';
        }
        
        if ($tiene_pagina && $pagina_val) {
            $campos[] = 'pagina';
            $valores[] = $pagina_val;
            $tipos .= 's';
        }
        
        if ($tiene_ubicacion && $ubicacion_val) {
            $campos[] = 'ubicacion';
            $valores[] = $ubicacion_val;
            $tipos .= 's';
        }
        
        if ($tiene_cita && $cita_val) {
            $campos[] = 'cita';
            $valores[] = $cita_val;
            $tipos .= 's';
        }
        
        $placeholders = implode(', ', array_fill(0, count($campos), '?'));
        $campos_sql = implode(', ', $campos);
        
        $sql = "INSERT INTO preguntas ($campos_sql) VALUES ($placeholders)";
        $stmt = $conn->prepare($sql);
        
        if (!$stmt) {
            error_log("[guardar_preguntas] Error preparando SQL: " . $conn->error);
            continue;
        }
        
        $stmt->bind_param($tipos, ...$valores);
        
        if (!$stmt->execute()) {
            error_log("[guardar_preguntas] Error insertando pregunta: " . $stmt->error);
            $stmt->close();
            continue;
        }
        
        $id_pregunta = $conn->insert_id;
        $stmt->close();
        
        // Insertar respuestas
        foreach ($respuestas as $r) {
            $indice = $r['indice'];
            $texto_respuesta = $r['respuesta'];
            
            $stmt_r = $conn->prepare("INSERT INTO respuestas (id_pregunta, indice, respuesta) VALUES (?, ?, ?)");
            if ($stmt_r) {
                $stmt_r->bind_param("iss", $id_pregunta, $indice, $texto_respuesta);
                $stmt_r->execute();
                $stmt_r->close();
            }
        }
        
        $guardadas++;
    }
    
    $conn->commit();
    
    echo json_encode([
        'ok' => true,
        'success' => true,
        'guardadas' => $guardadas,
        'rol' => $rol
    ]);
    
} catch (Exception $e) {
    $conn->rollback();
    error_log("[guardar_preguntas] Error: " . $e->getMessage());
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
