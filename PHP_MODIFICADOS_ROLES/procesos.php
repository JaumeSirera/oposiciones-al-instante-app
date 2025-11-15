<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

require 'db.php';
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$data = json_decode(file_get_contents("php://input"), true);

function validarToken($claveJWT) {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    if (!preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        echo json_encode(["error" => "Token no proporcionado"]);
        exit;
    }

    $token = $matches[1];
    $partes = explode('.', $token);
    if (count($partes) !== 3) {
        echo json_encode(["error" => "Token mal formado"]);
        exit;
    }

    $base64Header = $partes[0];
    $base64Payload = $partes[1];
    $base64Firma = $partes[2];
    $firmaEsperada = base64_encode(hash_hmac('sha256', "$base64Header.$base64Payload", $claveJWT, true));

    if (!hash_equals($firmaEsperada, $base64Firma)) {
        echo json_encode(["error" => "Firma inválida"]);
        exit;
    }

    $payload = json_decode(base64_decode($base64Payload), true);
    if ($payload['exp'] < time()) {
        echo json_encode(["error" => "Token expirado"]);
        exit;
    }

    return $payload;
}

// GET todos o uno por ID
if ($method === 'GET') {
    if ($id) {
        $stmt = $conn->prepare("SELECT * FROM procesos WHERE id = ?");
        $stmt->bind_param("i", $id);
    } else {
        // Obtener id_usuario del query string para filtrar por rol
        $id_usuario = isset($_GET['id_usuario']) ? intval($_GET['id_usuario']) : null;
        
        $query = "SELECT p.*, u.nivel FROM procesos p LEFT JOIN accounts u ON p.id_usuario = u.id WHERE 1=1";
        $params = [];
        $types = '';
        
        // Si hay id_usuario, aplicar filtro por rol
        if ($id_usuario) {
            $stmtUser = $conn->prepare("SELECT nivel FROM accounts WHERE id = ?");
            $stmtUser->bind_param("i", $id_usuario);
            $stmtUser->execute();
            $userResult = $stmtUser->get_result();
            $usuario = $userResult->fetch_assoc();
            
            if ($usuario) {
                $nivel = $usuario['nivel'];
                
                if ($nivel === 'admin') {
                    // Admin ve procesos públicos + sus propios procesos
                    $query .= " AND (p.es_publico = 1 OR p.id_usuario = ?)";
                    $types .= 'i';
                    $params[] = $id_usuario;
                } elseif ($nivel !== 'SA') {
                    // Usuarios normales solo ven procesos públicos
                    $query .= " AND p.es_publico = 1";
                }
                // SA ve todos los procesos (no añadimos condición)
            }
        }
        
        if (isset($_GET['q'])) {
            $query .= " AND p.descripcion LIKE ?";
            $types .= 's';
            $params[] = '%' . $_GET['q'] . '%';
        }

        if (isset($_GET['estado'])) {
            $query .= " AND p.estado = ?";
            $types .= 's';
            $params[] = $_GET['estado'];
        }

        if (isset($_GET['desde'])) {
            $query .= " AND p.fecha_inicio >= ?";
            $types .= 's';
            $params[] = $_GET['desde'];
        }

        if (isset($_GET['hasta'])) {
            $query .= " AND p.fecha_inicio <= ?";
            $types .= 's';
            $params[] = $_GET['hasta'];
        }

        $query .= " ORDER BY p.descripcion ASC";

        $stmt = $conn->prepare($query);

        if (!empty($params)) {
            $stmt->bind_param($types, ...$params);
        }
    }

    $stmt->execute();
    $result = $stmt->get_result();
    $procesos = [];
    while ($row = $result->fetch_assoc()) {
        $procesos[] = $row;
    }
    echo json_encode($procesos);
    exit;
}

// POST: crear proceso (puede ser sin token para conceptos personalizados)
if ($method === 'POST') {
    // Si viene con descripcion e id_usuario en el body, es un concepto personalizado
    if (isset($data['descripcion']) && isset($data['id_usuario'])) {
        $descripcion = $data['descripcion'];
        $id_usuario = $data['id_usuario'];
        
        // Obtener el nivel del usuario
        $stmt = $conn->prepare("SELECT nivel FROM accounts WHERE id = ?");
        $stmt->bind_param("i", $id_usuario);
        $stmt->execute();
        $result = $stmt->get_result();
        $usuario = $result->fetch_assoc();
        
        if (!$usuario) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'Usuario no encontrado']);
            exit;
        }
        
        // Determinar si el proceso es público según el nivel del usuario
        // SA crea procesos públicos, admin crea procesos privados
        $es_publico = ($usuario['nivel'] === 'SA') ? 1 : 0;
        
        // Verificar si ya existe el proceso para este usuario
        $stmtCheck = $conn->prepare("SELECT id FROM procesos WHERE descripcion = ? AND id_usuario = ?");
        $stmtCheck->bind_param("si", $descripcion, $id_usuario);
        $stmtCheck->execute();
        $existingResult = $stmtCheck->get_result();
        
        if ($existingResult->num_rows > 0) {
            // Ya existe, devolver el ID existente
            $existing = $existingResult->fetch_assoc();
            echo json_encode([
                'ok' => true,
                'id_proceso' => (int)$existing['id'],
                'descripcion' => $descripcion,
                'es_publico' => $es_publico,
                'ya_existia' => true
            ]);
            exit;
        }
        
        // Insertar nuevo proceso
        $stmtInsert = $conn->prepare("INSERT INTO procesos (descripcion, id_usuario, es_publico, estado) VALUES (?, ?, ?, 'activo')");
        $stmtInsert->bind_param("sii", $descripcion, $id_usuario, $es_publico);
        $stmtInsert->execute();
        
        echo json_encode([
            'ok' => true,
            'id_proceso' => (int)$conn->insert_id,
            'descripcion' => $descripcion,
            'es_publico' => $es_publico
        ]);
        exit;
    }
    
    // Si no, validar token para creación de proceso normal
    $payload = validarToken($claveJWT);
    if ($payload['nivel'] !== 'admin' && $payload['nivel'] !== 'SA') {
        http_response_code(403);
        echo json_encode(['error' => 'Acceso denegado. Solo administradores.']);
        exit;
    }
    
    $es_publico = ($payload['nivel'] === 'SA') ? 1 : 0;
    $stmt = $conn->prepare("INSERT INTO procesos (descripcion, estado, fecha_inicio, fecha_fin, id_usuario, es_publico) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssii", $data['descripcion'], $data['estado'], $data['fecha_inicio'], $data['fecha_fin'], $payload['id'], $es_publico);
    $stmt->execute();
    echo json_encode(['success' => true, 'id' => $stmt->insert_id]);
    exit;
}

// Validar token y permisos para PUT, DELETE
$payload = validarToken($claveJWT);
if ($payload['nivel'] !== 'admin' && $payload['nivel'] !== 'SA') {
    http_response_code(403);
    echo json_encode(['error' => 'Acceso denegado. Solo administradores.']);
    exit;
}

// PUT: actualizar proceso
if ($method === 'PUT' && $id) {
    $stmt = $conn->prepare("UPDATE procesos SET descripcion = ?, estado = ?, fecha_inicio = ?, fecha_fin = ? WHERE id = ?");
    $stmt->bind_param("ssssi", $data['descripcion'], $data['estado'], $data['fecha_inicio'], $data['fecha_fin'], $id);
    $stmt->execute();
    echo json_encode(['success' => true]);
    exit;
}

// DELETE: eliminar proceso
if ($method === 'DELETE' && $id) {
    $stmt = $conn->prepare("DELETE FROM procesos WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    echo json_encode(['success' => true]);
    exit;
}

echo json_encode(['error' => 'Método no soportado']);
