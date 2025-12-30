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

// Validar token y verificar que sea SA
$payload = validarToken($claveJWT);
if (!$payload) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

$nivel = $payload['nivel'] ?? 'user';

// Solo usuarios SA pueden acceder a esta información
if ($nivel !== 'SA') {
    http_response_code(403);
    echo json_encode(['error' => 'Acceso denegado. Solo usuarios SA pueden acceder a esta función.']);
    exit;
}

try {
    // Obtener todos los usuarios con email válido
    $stmt = $conn->prepare("
        SELECT id, email, username AS nombre 
        FROM accounts 
        WHERE email IS NOT NULL 
          AND email != '' 
          AND email LIKE '%@%'
        ORDER BY email ASC
    ");
    $stmt->execute();
    $result = $stmt->get_result();
    
    $usuarios = [];
    while ($row = $result->fetch_assoc()) {
        $usuarios[] = [
            'id' => $row['id'],
            'email' => $row['email'],
            'nombre' => $row['nombre'] ?? ''
        ];
    }
    
    echo json_encode($usuarios, JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    error_log("Error en obtener_usuarios_email.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error al obtener usuarios']);
}
?>
