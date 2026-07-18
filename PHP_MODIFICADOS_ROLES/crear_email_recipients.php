<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Método no permitido']); exit();
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

$email_history_id = isset($data['email_history_id']) ? intval($data['email_history_id']) : 0;
$recipients = isset($data['recipients']) && is_array($data['recipients']) ? $data['recipients'] : [];

if ($email_history_id <= 0) {
    echo json_encode(['success' => false, 'error' => 'email_history_id inválido']); exit();
}
if (count($recipients) === 0) {
    echo json_encode(['success' => false, 'error' => 'No hay destinatarios']); exit();
}

try {
    $conn->begin_transaction();
    $stmt = $conn->prepare("INSERT INTO email_recipients (email_history_id, email, nombre, status) VALUES (?, ?, ?, 'pending')");
    if (!$stmt) throw new Exception($conn->error);

    $created = [];
    foreach ($recipients as $r) {
        $email = isset($r['email']) ? trim($r['email']) : '';
        $nombre = isset($r['nombre']) ? trim($r['nombre']) : null;
        if ($email === '' || strpos($email, '@') === false) continue;
        $stmt->bind_param('iss', $email_history_id, $email, $nombre);
        if (!$stmt->execute()) throw new Exception($stmt->error);
        $created[] = ['id' => $conn->insert_id, 'email' => $email, 'nombre' => $nombre];
    }
    $stmt->close();
    $conn->commit();

    echo json_encode(['success' => true, 'recipients' => $created, 'count' => count($created)]);
} catch (Exception $e) {
    $conn->rollback();
    error_log('crear_email_recipients: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
$conn->close();
?>
