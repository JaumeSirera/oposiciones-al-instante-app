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
 * OBTENER PLAN NUTRICIONAL DE UN PLAN FÍSICO
 */
if ($method === 'GET' && $action === 'obtener') {
    $id_plan_fisico = isset($_GET['id_plan_fisico']) ? intval($_GET['id_plan_fisico']) : null;
    
    if (!$id_plan_fisico) {
        echo json_encode(['success' => false, 'error' => 'Falta id_plan_fisico']);
        exit;
    }
    
    // Verificar que el plan físico pertenece al usuario (o es SA)
    $checkQuery = "SELECT id_usuario FROM planes_fisicos WHERE id = ?";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bind_param("i", $id_plan_fisico);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    
    if ($checkResult->num_rows === 0) {
        echo json_encode(['success' => false, 'error' => 'Plan físico no encontrado']);
        exit;
    }
    
    $planFisico = $checkResult->fetch_assoc();
    if ($planFisico['id_usuario'] != $userId && $nivel !== 'SA') {
        echo json_encode(['success' => false, 'error' => 'Sin permiso para ver este plan']);
        exit;
    }
    $checkStmt->close();
    
    // Obtener el plan nutricional
    $query = "SELECT * FROM planes_nutricionales WHERE id_plan_fisico = ? ORDER BY id DESC LIMIT 1";
    $stmt = $conn->prepare($query);
    $stmt->bind_param("i", $id_plan_fisico);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['success' => true, 'plan_nutricional' => null]);
        exit;
    }
    
    $plan = $result->fetch_assoc();
    $plan['plan_semanal'] = json_decode($plan['plan_semanal_json'], true);
    $plan['recomendaciones'] = json_decode($plan['recomendaciones_json'], true);
    unset($plan['plan_semanal_json']);
    unset($plan['recomendaciones_json']);
    
    $stmt->close();
    echo json_encode(['success' => true, 'plan_nutricional' => $plan]);
    exit;
}

/**
 * GUARDAR PLAN NUTRICIONAL GENERADO
 */
if ($method === 'POST' && $action === 'guardar') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $id_plan_fisico = isset($input['id_plan_fisico']) ? intval($input['id_plan_fisico']) : null;
    $objetivo = $input['objetivo'] ?? null;
    $calorias_objetivo = isset($input['calorias_objetivo']) ? intval($input['calorias_objetivo']) : null;
    $proteinas_objetivo = isset($input['proteinas_objetivo']) ? intval($input['proteinas_objetivo']) : null;
    $carbos_objetivo = isset($input['carbos_objetivo']) ? intval($input['carbos_objetivo']) : null;
    $grasas_objetivo = isset($input['grasas_objetivo']) ? intval($input['grasas_objetivo']) : null;
    $plan_semanal = $input['plan_semanal'] ?? null;
    $recomendaciones = $input['recomendaciones'] ?? null;
    
    if (!$id_plan_fisico) {
        echo json_encode(['success' => false, 'error' => 'Falta id_plan_fisico']);
        exit;
    }
    
    // Verificar que el plan físico pertenece al usuario
    $checkQuery = "SELECT id_usuario FROM planes_fisicos WHERE id = ?";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bind_param("i", $id_plan_fisico);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    
    if ($checkResult->num_rows === 0) {
        echo json_encode(['success' => false, 'error' => 'Plan físico no encontrado']);
        exit;
    }
    
    $planFisico = $checkResult->fetch_assoc();
    if ($planFisico['id_usuario'] != $userId && $nivel !== 'SA') {
        echo json_encode(['success' => false, 'error' => 'Sin permiso']);
        exit;
    }
    $checkStmt->close();
    
    $plan_semanal_json = json_encode($plan_semanal, JSON_UNESCAPED_UNICODE);
    $recomendaciones_json = json_encode($recomendaciones, JSON_UNESCAPED_UNICODE);
    
    // Verificar si ya existe un plan nutricional para este plan físico
    $existQuery = "SELECT id FROM planes_nutricionales WHERE id_plan_fisico = ?";
    $existStmt = $conn->prepare($existQuery);
    $existStmt->bind_param("i", $id_plan_fisico);
    $existStmt->execute();
    $existResult = $existStmt->get_result();
    
    if ($existResult->num_rows > 0) {
        // Actualizar el existente
        $existing = $existResult->fetch_assoc();
        $updateQuery = "UPDATE planes_nutricionales SET 
                        objetivo = ?, 
                        calorias_objetivo = ?, 
                        proteinas_objetivo = ?, 
                        carbos_objetivo = ?, 
                        grasas_objetivo = ?,
                        plan_semanal_json = ?,
                        recomendaciones_json = ?
                        WHERE id = ?";
        $updateStmt = $conn->prepare($updateQuery);
        $updateStmt->bind_param("siiisssi", 
            $objetivo, 
            $calorias_objetivo, 
            $proteinas_objetivo, 
            $carbos_objetivo, 
            $grasas_objetivo,
            $plan_semanal_json,
            $recomendaciones_json,
            $existing['id']
        );
        
        if ($updateStmt->execute()) {
            echo json_encode(['success' => true, 'id' => $existing['id'], 'message' => 'Plan nutricional actualizado']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Error al actualizar']);
        }
        $updateStmt->close();
    } else {
        // Insertar nuevo
        $insertQuery = "INSERT INTO planes_nutricionales 
                        (id_plan_fisico, id_usuario, objetivo, calorias_objetivo, proteinas_objetivo, carbos_objetivo, grasas_objetivo, plan_semanal_json, recomendaciones_json) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $insertStmt = $conn->prepare($insertQuery);
        $insertStmt->bind_param("iisiiisss", 
            $id_plan_fisico, 
            $userId, 
            $objetivo, 
            $calorias_objetivo, 
            $proteinas_objetivo, 
            $carbos_objetivo, 
            $grasas_objetivo,
            $plan_semanal_json,
            $recomendaciones_json
        );
        
        if ($insertStmt->execute()) {
            $newId = $conn->insert_id;
            echo json_encode(['success' => true, 'id' => $newId, 'message' => 'Plan nutricional guardado']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Error al guardar']);
        }
        $insertStmt->close();
    }
    $existStmt->close();
    exit;
}

/**
 * ELIMINAR PLAN NUTRICIONAL
 */
if ($method === 'DELETE' && $action === 'eliminar') {
    $id = isset($_GET['id']) ? intval($_GET['id']) : null;
    
    if (!$id) {
        echo json_encode(['success' => false, 'error' => 'Falta id']);
        exit;
    }
    
    // Verificar permisos
    $checkQuery = "SELECT pn.id_usuario FROM planes_nutricionales pn WHERE pn.id = ?";
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bind_param("i", $id);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    
    if ($checkResult->num_rows === 0) {
        echo json_encode(['success' => false, 'error' => 'Plan nutricional no encontrado']);
        exit;
    }
    
    $planData = $checkResult->fetch_assoc();
    if ($planData['id_usuario'] != $userId && $nivel !== 'SA') {
        echo json_encode(['success' => false, 'error' => 'Sin permiso para eliminar']);
        exit;
    }
    $checkStmt->close();
    
    $deleteQuery = "DELETE FROM planes_nutricionales WHERE id = ?";
    $deleteStmt = $conn->prepare($deleteQuery);
    $deleteStmt->bind_param("i", $id);
    
    if ($deleteStmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Plan nutricional eliminado']);
    } else {
        echo json_encode(['success' => false, 'error' => 'Error al eliminar']);
    }
    $deleteStmt->close();
    exit;
}

// Acción no reconocida
echo json_encode(['success' => false, 'error' => 'Acción no válida']);
