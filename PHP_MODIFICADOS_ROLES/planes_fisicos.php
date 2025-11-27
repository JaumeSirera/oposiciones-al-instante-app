<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require 'db.php';

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['action'])) {
        echo json_encode(['success' => false, 'error' => 'Acción no especificada']);
        exit;
    }

    $action = $data['action'];

    // Verificar si existe un plan duplicado
    if ($action === 'verificar_duplicado') {
        if (!isset($data['id_usuario']) || !isset($data['titulo']) || !isset($data['tipo_prueba']) || !isset($data['fecha_inicio'])) {
            echo json_encode(['success' => false, 'error' => 'Faltan parámetros requeridos']);
            exit;
        }

        $id_usuario = intval($data['id_usuario']);
        $titulo = $data['titulo'];
        $tipo_prueba = $data['tipo_prueba'];
        $fecha_inicio = $data['fecha_inicio'];

        $sql = "SELECT id_plan FROM planes_fisicos_ia 
                WHERE id_usuario = ? AND titulo = ? AND tipo_prueba = ? AND fecha_inicio = ? 
                ORDER BY id DESC LIMIT 1";
        
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception("Error preparando consulta: " . $conn->error);
        }

        $stmt->bind_param("isss", $id_usuario, $titulo, $tipo_prueba, $fecha_inicio);
        
        if (!$stmt->execute()) {
            throw new Exception("Error ejecutando consulta: " . $stmt->error);
        }

        $result = $stmt->get_result();
        $plan = $result->fetch_assoc();

        if ($plan) {
            echo json_encode(['success' => true, 'id_plan' => $plan['id_plan']]);
        } else {
            echo json_encode(['success' => true, 'id_plan' => null]);
        }

        $stmt->close();
        $conn->close();
        exit;
    }

    // Actualizar un plan existente
    if ($action === 'actualizar') {
        if (!isset($data['id_plan']) || !isset($data['id_usuario'])) {
            echo json_encode(['success' => false, 'error' => 'Faltan parámetros requeridos']);
            exit;
        }

        $id_plan = intval($data['id_plan']);
        $id_usuario = intval($data['id_usuario']);
        $titulo = $data['titulo'] ?? '';
        $descripcion = $data['descripcion'] ?? '';
        $tipo_prueba = $data['tipo_prueba'] ?? '';
        $fecha_inicio = $data['fecha_inicio'] ?? null;
        $fecha_fin = $data['fecha_fin'] ?? null;
        $plan_json = $data['plan_json'] ?? '';
        $resumen = $data['resumen'] ?? '';
        $notificaciones_email = isset($data['notificaciones_email']) ? intval($data['notificaciones_email']) : 0;
        $hora_notificacion = $data['hora_notificacion'] ?? null;

        // Actualizar solo el registro más reciente con ese id_plan
        $sql = "UPDATE planes_fisicos_ia 
                SET titulo = ?, descripcion = ?, tipo_prueba = ?, fecha_inicio = ?, fecha_fin = ?, 
                    plan_json = ?, resumen = ?, notificaciones_email = ?, hora_notificacion = ?
                WHERE id_plan = ? AND id_usuario = ?
                ORDER BY id DESC LIMIT 1";
        
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception("Error preparando consulta: " . $conn->error);
        }

        $stmt->bind_param(
            "sssssssisii",
            $titulo,
            $descripcion,
            $tipo_prueba,
            $fecha_inicio,
            $fecha_fin,
            $plan_json,
            $resumen,
            $notificaciones_email,
            $hora_notificacion,
            $id_plan,
            $id_usuario
        );
        
        if (!$stmt->execute()) {
            throw new Exception("Error ejecutando actualización: " . $stmt->error);
        }

        echo json_encode([
            'success' => true,
            'id_plan' => $id_plan,
            'message' => 'Plan actualizado exitosamente'
        ]);

        $stmt->close();
        $conn->close();
        exit;
    }

    // Crear un nuevo plan
    if ($action === 'crear') {
        if (!isset($data['id_usuario'])) {
            echo json_encode(['success' => false, 'error' => 'id_usuario es requerido']);
            exit;
        }

        $id_usuario = intval($data['id_usuario']);
        $titulo = $data['titulo'] ?? '';
        $descripcion = $data['descripcion'] ?? '';
        $tipo_prueba = $data['tipo_prueba'] ?? '';
        $fecha_inicio = $data['fecha_inicio'] ?? null;
        $fecha_fin = $data['fecha_fin'] ?? null;
        $plan_json = $data['plan_json'] ?? '';
        $resumen = $data['resumen'] ?? '';
        $notificaciones_email = isset($data['notificaciones_email']) ? intval($data['notificaciones_email']) : 0;
        $hora_notificacion = $data['hora_notificacion'] ?? null;

        $sql = "INSERT INTO planes_fisicos_ia (id_usuario, titulo, descripcion, tipo_prueba, fecha_inicio, fecha_fin, plan_json, resumen, notificaciones_email, hora_notificacion) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception("Error preparando consulta: " . $conn->error);
        }

        $stmt->bind_param(
            "isssssssss",
            $id_usuario,
            $titulo,
            $descripcion,
            $tipo_prueba,
            $fecha_inicio,
            $fecha_fin,
            $plan_json,
            $resumen,
            $notificaciones_email,
            $hora_notificacion
        );
        
        if (!$stmt->execute()) {
            throw new Exception("Error ejecutando inserción: " . $stmt->error);
        }

        $id_plan = $stmt->insert_id;

        echo json_encode([
            'success' => true,
            'id_plan' => $id_plan,
            'message' => 'Plan creado exitosamente'
        ]);

        $stmt->close();
        $conn->close();
        exit;
    }

    echo json_encode(['success' => false, 'error' => 'Acción no válida']);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
    exit;
}
