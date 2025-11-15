<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'config.php';

// Leer el cuerpo de la solicitud
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!isset($data['descripcion']) || !isset($data['id_usuario'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Faltan datos requeridos']);
    exit();
}

$descripcion = $data['descripcion'];
$id_usuario = $data['id_usuario'];

// Obtener el nivel del usuario
$stmt = $pdo->prepare("SELECT nivel FROM usuarios WHERE id = ?");
$stmt->execute([$id_usuario]);
$usuario = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$usuario) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Usuario no encontrado']);
    exit();
}

// Determinar si el proceso es público según el nivel del usuario
// SA crea procesos públicos, admin crea procesos privados
$es_publico = ($usuario['nivel'] === 'SA') ? 1 : 0;

try {
    $stmt = $pdo->prepare("
        INSERT INTO procesos (descripcion, id_usuario, es_publico) 
        VALUES (?, ?, ?)
    ");
    
    $stmt->execute([$descripcion, $id_usuario, $es_publico]);
    $id_proceso = $pdo->lastInsertId();
    
    echo json_encode([
        'ok' => true,
        'id_proceso' => (int)$id_proceso,
        'descripcion' => $descripcion,
        'es_publico' => $es_publico
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Error al crear proceso: ' . $e->getMessage()]);
}
