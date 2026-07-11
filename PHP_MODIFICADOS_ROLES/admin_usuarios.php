<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
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
        if (!preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) return null;
        $token = $matches[1];
        $partes = explode('.', $token);
        if (count($partes) !== 3) return null;
        $firmaEsperada = base64_encode(hash_hmac('sha256', "$partes[0].$partes[1]", $claveJWT, true));
        if (!hash_equals($firmaEsperada, $partes[2])) return null;
        $payload = json_decode(base64_decode($partes[1]), true);
        if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) return null;
        return $payload;
    } catch (Exception $e) {
        return null;
    }
}

$payload = validarToken($claveJWT);
if (!$payload) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

$nivel = $payload['nivel'] ?? 'user';
if ($nivel !== 'SA') {
    http_response_code(403);
    echo json_encode(['error' => 'Acceso denegado. Solo Super Admin.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? intval($_GET['id']) : null;
$input = json_decode(file_get_contents('php://input'), true) ?: [];

try {
    // LIST all users
    if ($method === 'GET' && !$id) {
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        if ($search !== '') {
            $like = "%$search%";
            $stmt = $conn->prepare("SELECT id, username, email, nivel FROM accounts WHERE username LIKE ? OR email LIKE ? ORDER BY id DESC LIMIT 500");
            $stmt->bind_param("ss", $like, $like);
        } else {
            $stmt = $conn->prepare("SELECT id, username, email, nivel FROM accounts ORDER BY id DESC LIMIT 500");
        }
        $stmt->execute();
        $res = $stmt->get_result();
        $out = [];
        while ($row = $res->fetch_assoc()) $out[] = $row;
        echo json_encode($out, JSON_UNESCAPED_UNICODE);
        exit;
    }

    // GET one user
    if ($method === 'GET' && $id) {
        $stmt = $conn->prepare("SELECT id, username, email, nivel FROM accounts WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        echo json_encode($row ?: null, JSON_UNESCAPED_UNICODE);
        exit;
    }

    // CREATE
    if ($method === 'POST') {
        $username = trim($input['username'] ?? '');
        $email    = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';
        $nuevoNivel = $input['nivel'] ?? 'user';

        if ($username === '' || $email === '' || $password === '') {
            http_response_code(400);
            echo json_encode(['error' => 'username, email y password son obligatorios']);
            exit;
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'Email inválido']);
            exit;
        }
        if (strlen($password) < 6) {
            http_response_code(400);
            echo json_encode(['error' => 'La contraseña debe tener al menos 6 caracteres']);
            exit;
        }
        // Comprobar duplicados
        $chk = $conn->prepare("SELECT id FROM accounts WHERE email = ? OR username = ? LIMIT 1");
        $chk->bind_param("ss", $email, $username);
        $chk->execute();
        if ($chk->get_result()->fetch_assoc()) {
            http_response_code(409);
            echo json_encode(['error' => 'Ya existe un usuario con ese email o username']);
            exit;
        }
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $conn->prepare("INSERT INTO accounts (username, email, password, nivel) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("ssss", $username, $email, $hash, $nuevoNivel);
        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al crear', 'details' => $stmt->error]);
            exit;
        }
        echo json_encode(['success' => true, 'id' => $stmt->insert_id]);
        exit;
    }

    // UPDATE
    if ($method === 'PUT') {
        $updateId = intval($input['id'] ?? $id ?? 0);
        if (!$updateId) {
            http_response_code(400);
            echo json_encode(['error' => 'ID requerido']);
            exit;
        }
        $fields = [];
        $types = '';
        $vals = [];
        if (isset($input['username']) && trim($input['username']) !== '') {
            $fields[] = 'username = ?'; $types .= 's'; $vals[] = trim($input['username']);
        }
        if (isset($input['email']) && trim($input['email']) !== '') {
            if (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
                http_response_code(400); echo json_encode(['error' => 'Email inválido']); exit;
            }
            $fields[] = 'email = ?'; $types .= 's'; $vals[] = trim($input['email']);
        }
        if (isset($input['nivel']) && trim($input['nivel']) !== '') {
            $fields[] = 'nivel = ?'; $types .= 's'; $vals[] = trim($input['nivel']);
        }
        if (isset($input['password']) && $input['password'] !== '') {
            if (strlen($input['password']) < 6) {
                http_response_code(400); echo json_encode(['error' => 'La contraseña debe tener al menos 6 caracteres']); exit;
            }
            $fields[] = 'password = ?'; $types .= 's'; $vals[] = password_hash($input['password'], PASSWORD_BCRYPT);
        }
        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['error' => 'Nada que actualizar']);
            exit;
        }
        $types .= 'i'; $vals[] = $updateId;
        $sql = "UPDATE accounts SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$vals);
        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al actualizar', 'details' => $stmt->error]);
            exit;
        }
        echo json_encode(['success' => true]);
        exit;
    }

    // DELETE
    if ($method === 'DELETE') {
        $deleteId = $id ?: intval($input['id'] ?? 0);
        if (!$deleteId) {
            http_response_code(400);
            echo json_encode(['error' => 'ID requerido']);
            exit;
        }
        // Evitar que SA se borre a sí mismo
        if ($deleteId === intval($payload['id'] ?? 0)) {
            http_response_code(400);
            echo json_encode(['error' => 'No puedes borrar tu propio usuario']);
            exit;
        }
        $stmt = $conn->prepare("DELETE FROM accounts WHERE id = ?");
        $stmt->bind_param("i", $deleteId);
        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al borrar', 'details' => $stmt->error]);
            exit;
        }
        echo json_encode(['success' => true]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);

} catch (Exception $e) {
    error_log("admin_usuarios.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error interno']);
}
?>
