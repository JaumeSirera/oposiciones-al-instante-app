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
require 'config.php';

// Función para validar token (igual que en otros ficheros)
function validarToken($claveJWT) {
    try {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? '';
        
        if (!preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            return null;
        }

        $token = $matches[1];
        $partes = explode('.', $token);
        if (count($partes) !== 3) {
            return null;
        }

        $base64Header = $partes[0];
        $base64Payload = $partes[1];
        $base64Firma = $partes[2];
        $firmaEsperada = base64_encode(hash_hmac('sha256', "$base64Header.$base64Payload", $claveJWT, true));

        if (!hash_equals($firmaEsperada, $base64Firma)) {
            return null;
        }

        $payload = json_decode(base64_decode($base64Payload), true);
        if ($payload['exp'] < time()) {
            return null;
        }

        return $payload;
    } catch (Exception $e) {
        error_log("Error validando token: " . $e->getMessage());
        return null;
    }
}

// Validar token
$payload = validarToken($claveJWT);
if (!$payload) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autorizado']);
    exit;
}

$userId = $payload['id'] ?? null;
$nivel = $payload['nivel'] ?? '';

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

/**
 * GUARDAR ANÁLISIS NUTRICIONAL
 */
if ($method === 'POST' && $action === 'guardar') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $id_usuario = isset($input['id_usuario']) ? $input['id_usuario'] : null;
    $dish_name = isset($input['dish_name']) ? $input['dish_name'] : '';
    $image_base64 = isset($input['image_base64']) ? $input['image_base64'] : null;
    $ingredients = isset($input['ingredients']) ? $input['ingredients'] : [];
    $totals = isset($input['totals']) ? $input['totals'] : [];
    $health_score = isset($input['health_score']) ? $input['health_score'] : 0;
    $recommendations = isset($input['recommendations']) ? $input['recommendations'] : [];
    
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
    
    $stmt = $conn->prepare($query);
    $stmt->bind_param("issssis", $id_usuario, $dish_name, $image_base64, $ingredients_json, $totals_json, $health_score, $recommendations_json);
    
    if ($stmt->execute()) {
        $id_analisis = $conn->insert_id;
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
    $id_usuario = isset($_GET['id_usuario']) ? $_GET['id_usuario'] : null;
    
    if (!$id_usuario) {
        echo json_encode(['success' => false, 'error' => 'Falta id_usuario']);
        exit;
    }
    
    $query = "SELECT id, id_usuario, dish_name, totals, health_score, fecha_analisis 
              FROM historial_nutricional 
              WHERE id_usuario = ? 
              ORDER BY fecha_analisis DESC";
    
    $stmt = $conn->prepare($query);
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
    
    $result = $conn->query($query);
    
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
    $id = isset($_GET['id']) ? $_GET['id'] : null;
    
    if (!$id) {
        echo json_encode(['success' => false, 'error' => 'Falta id del análisis']);
        exit;
    }
    
    $query = "SELECT * FROM historial_nutricional WHERE id = ?";
    $stmt = $conn->prepare($query);
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
    $id = isset($input['id']) ? $input['id'] : (isset($_GET['id']) ? $_GET['id'] : null);
    
    if (!$id) {
        echo json_encode(['success' => false, 'error' => 'Falta id del análisis']);
        exit;
    }
    
    // Verificar que el análisis pertenece al usuario (o es SA)
    $checkQuery = "SELECT id_usuario FROM historial_nutricional WHERE id = ?";
    $checkStmt = $conn->prepare($checkQuery);
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
    $stmt = $conn->prepare($query);
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
