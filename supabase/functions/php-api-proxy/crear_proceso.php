<?php
// /api/crear_proceso.php - Crea procesos personalizados con visibilidad por roles
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { 
    http_response_code(204); 
    exit(); 
}

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';

// Función para obtener el rol del usuario
function obtener_rol_usuario($conn, $id_usuario) {
    $stmt = $conn->prepare("SELECT nivel FROM usuarios WHERE id = ?");
    $stmt->bind_param("i", $id_usuario);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($row = $result->fetch_assoc()) {
        return strtolower($row['nivel']);
    }
    
    return 'user';
}

// Función para determinar si el proceso es público según el rol
function es_publico_segun_rol(string $rol) {
    // SA crea procesos públicos
    if ($rol === 'sa') {
        return 1;
    }
    // Admin crea procesos privados (solo ellos los ven)
    // User también crea procesos privados
    return 0;
}

try {
    // Leer datos JSON
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);

    if (!$data) {
        throw new Exception("No se recibieron datos o el JSON es inválido");
    }

    // Validar campos requeridos
    $required = ['descripcion', 'id_usuario'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            throw new Exception("El campo '$field' es requerido");
        }
    }

    $descripcion = trim($data['descripcion']);
    $id_usuario = intval($data['id_usuario']);

    if (strlen($descripcion) > 500) {
        throw new Exception("La descripción del proceso es demasiado larga (máximo 500 caracteres)");
    }

    $conn = get_db_connection();

    // Obtener rol del usuario
    $rol = obtener_rol_usuario($conn, $id_usuario);
    $es_publico = es_publico_segun_rol($rol);

    // Verificar si ya existe un proceso con el mismo nombre creado por este usuario
    // Solo verificamos duplicados para el mismo usuario (no globalmente)
    $stmt = $conn->prepare("
        SELECT id FROM procesos 
        WHERE descripcion = ? 
        AND id_usuario_creador = ? 
        LIMIT 1
    ");
    $stmt->bind_param("si", $descripcion, $id_usuario);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($row = $result->fetch_assoc()) {
        // Ya existe, devolver el ID existente
        echo json_encode([
            'ok' => true,
            'id_proceso' => intval($row['id']),
            'es_publico' => $es_publico,
            'rol' => $rol,
            'mensaje' => 'Proceso ya existía'
        ]);
        $conn->close();
        exit;
    }

    // Insertar nuevo proceso
    $stmt = $conn->prepare("
        INSERT INTO procesos (
            descripcion, 
            estado, 
            id_usuario_creador, 
            es_publico,
            fecha
        ) VALUES (?, 'activo', ?, ?, NOW())
    ");
    
    $stmt->bind_param("sii", $descripcion, $id_usuario, $es_publico);
    
    if (!$stmt->execute()) {
        throw new Exception("Error al insertar proceso: " . $stmt->error);
    }

    $id_proceso = $conn->insert_id;

    echo json_encode([
        'ok' => true,
        'id_proceso' => $id_proceso,
        'es_publico' => $es_publico,
        'rol' => $rol,
        'mensaje' => 'Proceso creado exitosamente'
    ]);

    $conn->close();

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
