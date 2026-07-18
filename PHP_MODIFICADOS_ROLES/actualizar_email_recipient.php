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

$id = isset($data['id']) ? intval($data['id']) : 0;
$status = isset($data['status']) ? trim($data['status']) : '';
$error = isset($data['error']) ? substr(trim($data['error']), 0, 1000) : null;

if ($id <= 0 || !in_array($status, ['pending','sent','failed'], true)) {
    echo json_encode(['success' => false, 'error' => 'Parámetros inválidos']); exit();
}

try {
    if ($status === 'sent') {
        $sql = "UPDATE email_recipients SET status='sent', attempts=attempts+1, last_error=NULL, sent_at=NOW() WHERE id=?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $id);
    } elseif ($status === 'failed') {
        $sql = "UPDATE email_recipients SET status='failed', attempts=attempts+1, last_error=? WHERE id=?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('si', $error, $id);
    } else { // pending (reintento)
        $sql = "UPDATE email_recipients SET status='pending', last_error=NULL WHERE id=?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $id);
    }
    if (!$stmt->execute()) throw new Exception($stmt->error);
    $stmt->close();

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    error_log('actualizar_email_recipient: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
$conn->close();
?>
