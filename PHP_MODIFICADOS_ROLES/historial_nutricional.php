<?php
/**
 * API para gestionar el historial de análisis nutricionales
 * Acciones: guardar, listar, detalle, eliminar, listar_todos (SA)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'conexion.php';
require_once 'auth.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Verificar autenticación
$payload = verificarToken();
if (!$payload) {
    echo json_encode(['success' => false, 'error' => 'No autorizado']);
    exit;
}

$userId = $payload['id'] ?? null;
$nivel = $payload['nivel'] ?? '';

/**
 * GUARDAR ANÁLISIS NUTRICIONAL
 */
if ($method === 'POST' && $action === 'guardar') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $id_usuario = $input['id_usuario'] ?? null;
    $dish_name = $input['dish_name'] ?? '';
    $image_base64 = $input['image_base64'] ?? null;
    $ingredients = $input['ingredients'] ?? [];
    $totals = $input['totals'] ?? [];
    $health_score = $input['health_score'] ?? 0;
    $recommendations = $input['recommendations'] ?? [];
    
    if (!$id_usuario || !$dish_name) {
        echo json_encode(['success' => false, 'error' => 'Faltan datos obligatorios']);
        exit;
    }
    
    // Convertir arrays a JSON
    $ingredients_json = json_encode($ingredients, JSON_UNESCAPED_UNICODE);
    $totals_json = json_encode($totals, JSON_UNESCAPED_UNICODE);
    $recommendations_json = json_encode($recommendations, JSON_UNESCAPED_UNICODE);
    
    $query = "INSERT INTO historial_nutricional (id_usuario, dish_name, image_base64, ingredients, totals, health_score, recommendations, fecha_analisis) 
              VALUES (?, ?, ?, ?, ?, ?, ?, NOW())";
    
    $stmt = $conexion->prepare($query);
    $stmt->bind_param("issssis", $id_usuario, $dish_name, $image_base64, $ingredients_json, $totals_json, $health_score, $recommendations_json);
    
    if ($stmt->execute()) {
        $id_analisis = $conexion->insert_id;
        echo json_encode([
            'success' => true, 
            'id' => $id_analisis,
            'message' => 'Análisis guardado correctamente'
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Error al guardar: ' . $stmt->error]);
    }
    $stmt->close();
    exit;
}

/**
 * LISTAR ANÁLISIS DEL USUARIO
 */
if ($method === 'GET' && $action === 'listar') {
    $id_usuario = $_GET['id_usuario'] ?? null;
    
    if (!$id_usuario) {
        echo json_encode(['success' => false, 'error' => 'Falta id_usuario']);
        exit;
    }
    
    $query = "SELECT id, id_usuario, dish_name, totals, health_score, fecha_analisis 
              FROM historial_nutricional 
              WHERE id_usuario = ? 
              ORDER BY fecha_analisis DESC";
    
    $stmt = $conexion->prepare($query);
    $stmt->bind_param("i", $id_usuario);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $historial = [];
    while ($row = $result->fetch_assoc()) {
        $row['totals'] = json_decode($row['totals'], true);
        $historial[] = $row;
    }
    
    echo json_encode(['success' => true, 'historial' => $historial]);
    $stmt->close();
    exit;
}

/**
 * LISTAR TODOS (SOLO SA)
 */
if ($method === 'GET' && $action === 'listar_todos') {
    if ($nivel !== 'SA') {
        echo json_encode(['success' => false, 'error' => 'No autorizado. Solo SA puede ver todos los análisis.']);
        exit;
    }
    
    $query = "SELECT hn.id, hn.id_usuario, hn.dish_name, hn.totals, hn.health_score, hn.fecha_analisis,
                     a.username, a.email
              FROM historial_nutricional hn
              LEFT JOIN accounts a ON hn.id_usuario = a.id
              ORDER BY hn.fecha_analisis DESC
              LIMIT 100";
    
    $result = $conexion->query($query);
    
    $historial = [];
    while ($row = $result->fetch_assoc()) {
        $row['totals'] = json_decode($row['totals'], true);
        $historial[] = $row;
    }
    
    echo json_encode(['success' => true, 'historial' => $historial]);
    exit;
}

/**
 * OBTENER DETALLE DE UN ANÁLISIS
 */
if ($method === 'GET' && $action === 'detalle') {
    $id = $_GET['id'] ?? null;
    
    if (!$id) {
        echo json_encode(['success' => false, 'error' => 'Falta id del análisis']);
        exit;
    }
    
    $query = "SELECT * FROM historial_nutricional WHERE id = ?";
    $stmt = $conexion->prepare($query);
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($row = $result->fetch_assoc()) {
        // Verificar que el usuario tiene acceso
        if ($row['id_usuario'] != $userId && $nivel !== 'SA') {
            echo json_encode(['success' => false, 'error' => 'No autorizado']);
            exit;
        }
        
        $row['ingredients'] = json_decode($row['ingredients'], true);
        $row['totals'] = json_decode($row['totals'], true);
        $row['recommendations'] = json_decode($row['recommendations'], true);
        
        echo json_encode(['success' => true, 'analisis' => $row]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Análisis no encontrado']);
    }
    $stmt->close();
    exit;
}

/**
 * ELIMINAR ANÁLISIS
 */
if ($method === 'DELETE' || ($method === 'POST' && $action === 'eliminar')) {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? $_GET['id'] ?? null;
    
    if (!$id) {
        echo json_encode(['success' => false, 'error' => 'Falta id del análisis']);
        exit;
    }
    
    // Verificar que el análisis pertenece al usuario (o es SA)
    $checkQuery = "SELECT id_usuario FROM historial_nutricional WHERE id = ?";
    $checkStmt = $conexion->prepare($checkQuery);
    $checkStmt->bind_param("i", $id);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    
    if ($checkRow = $checkResult->fetch_assoc()) {
        if ($checkRow['id_usuario'] != $userId && $nivel !== 'SA') {
            echo json_encode(['success' => false, 'error' => 'No autorizado para eliminar este análisis']);
            exit;
        }
    } else {
        echo json_encode(['success' => false, 'error' => 'Análisis no encontrado']);
        exit;
    }
    $checkStmt->close();
    
    $query = "DELETE FROM historial_nutricional WHERE id = ?";
    $stmt = $conexion->prepare($query);
    $stmt->bind_param("i", $id);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Análisis eliminado correctamente']);
    } else {
        echo json_encode(['success' => false, 'error' => 'Error al eliminar: ' . $stmt->error]);
    }
    $stmt->close();
    exit;
}

echo json_encode(['success' => false, 'error' => 'Acción no válida']);
