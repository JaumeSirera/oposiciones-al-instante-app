<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require 'db.php';

$id_usuario = isset($_GET['id_usuario']) ? intval($_GET['id_usuario']) : 0;

if (!$id_usuario) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'id_usuario es requerido']);
    exit;
}

// Obtener el nivel del usuario
$stmt = $conn->prepare("SELECT nivel FROM usuarios WHERE id = ?");
$stmt->bind_param("i", $id_usuario);
$stmt->execute();
$result = $stmt->get_result();
$usuario = $result->fetch_assoc();

if (!$usuario) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Usuario no encontrado']);
    exit;
}

$nivel = $usuario['nivel'];

try {
    // Construir la consulta según el nivel del usuario
    if ($nivel === 'SA') {
        // SA ve todos los procesos activos
        $stmt = $conn->prepare("
            SELECT id, descripcion, es_publico, id_usuario, estado 
            FROM procesos 
            WHERE estado = 'activo'
            ORDER BY descripcion ASC
        ");
        $stmt->execute();
    } elseif ($nivel === 'admin') {
        // Admin ve procesos públicos activos + sus propios procesos
        $stmt = $conn->prepare("
            SELECT id, descripcion, es_publico, id_usuario, estado 
            FROM procesos 
            WHERE estado = 'activo' AND (es_publico = 1 OR id_usuario = ?)
            ORDER BY descripcion ASC
        ");
        $stmt->bind_param("i", $id_usuario);
        $stmt->execute();
    } else {
        // Usuarios normales solo ven procesos públicos activos
        $stmt = $conn->prepare("
            SELECT id, descripcion, es_publico, id_usuario, estado 
            FROM procesos 
            WHERE estado = 'activo' AND es_publico = 1
            ORDER BY descripcion ASC
        ");
        $stmt->execute();
    }
    
    $result = $stmt->get_result();
    $procesos = [];
    
    while ($row = $result->fetch_assoc()) {
        $procesos[] = [
            'id' => (int)$row['id'],
            'descripcion' => $row['descripcion'],
            'es_publico' => (bool)$row['es_publico'],
            'id_usuario' => (int)$row['id_usuario']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'procesos' => $procesos
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al obtener procesos: ' . $e->getMessage()]);
}
?>
