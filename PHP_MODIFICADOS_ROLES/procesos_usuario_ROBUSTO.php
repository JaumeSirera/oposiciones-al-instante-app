<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

require 'db.php';
require 'config.php';

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

// Validar token y obtener nivel del usuario
$payload = validarToken($claveJWT);
if (!$payload) {
    http_response_code(401);
    echo json_encode([]);
    exit;
}

$id_usuario = isset($_GET['id_usuario']) ? intval($_GET['id_usuario']) : 0;
if (!$id_usuario) {
    echo json_encode([]);
    exit;
}

$nivel = $payload['nivel'] ?? 'user';

try {
    // Verificar si existen las columnas nuevas
    $columnas_check = $conn->query("SHOW COLUMNS FROM procesos LIKE 'es_publico'");
    $tiene_es_publico = $columnas_check && $columnas_check->num_rows > 0;
    
    $columnas_check2 = $conn->query("SHOW COLUMNS FROM procesos LIKE 'id_usuario'");
    $tiene_id_usuario = $columnas_check2 && $columnas_check2->num_rows > 0;
    
    // Construir la consulta según las columnas disponibles y el rol
    if (!$tiene_es_publico || !$tiene_id_usuario) {
        // Sin columnas nuevas: devolver todos los procesos activos
        $stmt = $conn->prepare("
            SELECT id, descripcion, foto, fecha_inicio, fecha_fin, estado
            FROM procesos 
            WHERE estado = 'activo'
            ORDER BY descripcion ASC
        ");
        $stmt->execute();
    } else {
        // Con columnas nuevas: aplicar filtros por rol
        if ($nivel === 'SA') {
            // SA ve todos los procesos activos
            $stmt = $conn->prepare("
                SELECT id, descripcion, foto, fecha_inicio, fecha_fin, estado, es_publico
                FROM procesos 
                WHERE estado = 'activo'
                ORDER BY descripcion ASC
            ");
            $stmt->execute();
        } elseif ($nivel === 'admin') {
            // Admin ve procesos públicos activos + sus propios procesos
            $stmt = $conn->prepare("
                SELECT id, descripcion, foto, fecha_inicio, fecha_fin, estado, es_publico
                FROM procesos 
                WHERE estado = 'activo' AND (es_publico = 1 OR id_usuario = ?)
                ORDER BY descripcion ASC
            ");
            $stmt->bind_param("i", $id_usuario);
            $stmt->execute();
        } else {
            // Usuarios normales solo ven procesos públicos activos
            $stmt = $conn->prepare("
                SELECT id, descripcion, foto, fecha_inicio, fecha_fin, estado, es_publico
                FROM procesos 
                WHERE estado = 'activo' AND es_publico = 1
                ORDER BY descripcion ASC
            ");
            $stmt->execute();
        }
    }
    
    $result = $stmt->get_result();
    $procesos = [];
    
    while ($row = $result->fetch_assoc()) {
        $procesos[] = $row;
    }
    
    echo json_encode($procesos, JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    error_log("Error en procesos_usuario.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error al obtener procesos']);
}
?>
