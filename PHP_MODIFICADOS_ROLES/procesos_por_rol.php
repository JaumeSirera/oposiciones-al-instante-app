<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'config.php';

$id_usuario = isset($_GET['id_usuario']) ? intval($_GET['id_usuario']) : null;

if (!$id_usuario) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'id_usuario es requerido']);
    exit();
}

// Obtener el nivel del usuario
$stmt = $pdo->prepare("SELECT nivel FROM usuarios WHERE id = ?");
$stmt->execute([$id_usuario]);
$usuario = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$usuario) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Usuario no encontrado']);
    exit();
}

$nivel = $usuario['nivel'];

try {
    // Construir la consulta según el nivel del usuario
    if ($nivel === 'SA') {
        // SA ve todos los procesos
        $stmt = $pdo->prepare("
            SELECT id, descripcion, es_publico, id_usuario 
            FROM procesos 
            ORDER BY descripcion ASC
        ");
        $stmt->execute();
    } elseif ($nivel === 'admin') {
        // Admin ve procesos públicos + sus propios procesos
        $stmt = $pdo->prepare("
            SELECT id, descripcion, es_publico, id_usuario 
            FROM procesos 
            WHERE es_publico = 1 OR id_usuario = ?
            ORDER BY descripcion ASC
        ");
        $stmt->execute([$id_usuario]);
    } else {
        // Usuarios normales solo ven procesos públicos
        $stmt = $pdo->prepare("
            SELECT id, descripcion, es_publico, id_usuario 
            FROM procesos 
            WHERE es_publico = 1
            ORDER BY descripcion ASC
        ");
        $stmt->execute();
    }
    
    $procesos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Convertir es_publico a booleano y formatear
    $procesos = array_map(function($proceso) {
        return [
            'id' => (int)$proceso['id'],
            'descripcion' => $proceso['descripcion'],
            'es_publico' => (bool)$proceso['es_publico'],
            'id_usuario' => (int)$proceso['id_usuario']
        ];
    }, $procesos);
    
    echo json_encode([
        'success' => true,
        'procesos' => $procesos
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al obtener procesos: ' . $e->getMessage()]);
}
