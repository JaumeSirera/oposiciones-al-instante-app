<?php
// /api/procesos_por_rol.php - Lista procesos según el rol del usuario
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
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

try {
    $conn = get_db_connection();

    // Obtener id_usuario del query param o body
    $id_usuario = null;
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $id_usuario = isset($_GET['id_usuario']) ? intval($_GET['id_usuario']) : null;
    } else {
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);
        $id_usuario = isset($data['id_usuario']) ? intval($data['id_usuario']) : null;
    }

    if (!$id_usuario) {
        // Si no hay usuario, devolver solo procesos públicos
        $stmt = $conn->prepare("
            SELECT id, descripcion, estado, fecha_inicio, fecha_fin, foto, fecha, es_publico
            FROM procesos 
            WHERE estado = 'activo' AND es_publico = 1
            ORDER BY fecha DESC
        ");
    } else {
        // Obtener rol del usuario
        $rol = obtener_rol_usuario($conn, $id_usuario);

        if ($rol === 'sa') {
            // SA ve todos los procesos
            $stmt = $conn->prepare("
                SELECT id, descripcion, estado, fecha_inicio, fecha_fin, foto, fecha, es_publico, id_usuario_creador
                FROM procesos 
                WHERE estado = 'activo'
                ORDER BY fecha DESC
            ");
        } elseif ($rol === 'admin') {
            // Admin ve procesos públicos + los que él creó
            $stmt = $conn->prepare("
                SELECT id, descripcion, estado, fecha_inicio, fecha_fin, foto, fecha, es_publico, id_usuario_creador
                FROM procesos 
                WHERE estado = 'activo' 
                AND (es_publico = 1 OR id_usuario_creador = ?)
                ORDER BY fecha DESC
            ");
            $stmt->bind_param("i", $id_usuario);
        } else {
            // User solo ve procesos públicos
            $stmt = $conn->prepare("
                SELECT id, descripcion, estado, fecha_inicio, fecha_fin, foto, fecha, es_publico
                FROM procesos 
                WHERE estado = 'activo' AND es_publico = 1
                ORDER BY fecha DESC
            ");
        }
    }

    $stmt->execute();
    $result = $stmt->get_result();
    
    $procesos = [];
    while ($row = $result->fetch_assoc()) {
        $procesos[] = $row;
    }

    echo json_encode($procesos);

    $conn->close();

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage()
    ]);
}
