<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once 'db.php';

$email_history_id = isset($_GET['email_history_id']) ? intval($_GET['email_history_id']) : 0;
if ($email_history_id <= 0) {
    echo json_encode(['success' => false, 'error' => 'email_history_id inválido']); exit();
}

try {
    $stmt = $conn->prepare("SELECT id, email, nombre, status, attempts, last_error, sent_at, updated_at
                            FROM email_recipients WHERE email_history_id = ? ORDER BY status ASC, id ASC");
    $stmt->bind_param('i', $email_history_id);
    $stmt->execute();
    $res = $stmt->get_result();
    $items = [];
    $stats = ['total' => 0, 'sent' => 0, 'failed' => 0, 'pending' => 0];
    while ($row = $res->fetch_assoc()) {
        $row['id'] = intval($row['id']);
        $row['attempts'] = intval($row['attempts']);
        $items[] = $row;
        $stats['total']++;
        if (isset($stats[$row['status']])) $stats[$row['status']]++;
    }
    $stmt->close();

    echo json_encode(['success' => true, 'data' => $items, 'stats' => $stats]);
} catch (Exception $e) {
    error_log('obtener_email_recipients: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
$conn->close();
?>
