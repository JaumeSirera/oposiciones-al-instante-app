<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configuración de errores
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Incluir conexión a base de datos
require_once 'db.php';

// Solo aceptar POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit();
}

// Leer datos JSON
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    echo json_encode(['success' => false, 'error' => 'Datos JSON inválidos']);
    exit();
}

// Validar campos requeridos
$subject = isset($data['subject']) ? trim($data['subject']) : '';
$message = isset($data['message']) ? trim($data['message']) : '';
$recipients_count = isset($data['recipients_count']) ? intval($data['recipients_count']) : 0;
$sent_by = isset($data['sent_by']) ? trim($data['sent_by']) : null;
$status = isset($data['status']) ? trim($data['status']) : 'sent';
$errors = isset($data['errors']) ? trim($data['errors']) : null;

if (empty($subject)) {
    echo json_encode(['success' => false, 'error' => 'El asunto es requerido']);
    exit();
}

if (empty($message)) {
    echo json_encode(['success' => false, 'error' => 'El mensaje es requerido']);
    exit();
}

try {
    // Insertar en la tabla email_history
    $sql = "INSERT INTO email_history (subject, message, recipients_count, sent_by, status, errors) 
            VALUES (?, ?, ?, ?, ?, ?)";
    
    $stmt = $conn->prepare($sql);
    
    if (!$stmt) {
        throw new Exception("Error preparando la consulta: " . $conn->error);
    }
    
    $stmt->bind_param("ssisss", $subject, $message, $recipients_count, $sent_by, $status, $errors);
    
    if (!$stmt->execute()) {
        throw new Exception("Error ejecutando la consulta: " . $stmt->error);
    }
    
    $insert_id = $conn->insert_id;
    $stmt->close();
    
    echo json_encode([
        'success' => true,
        'message' => 'Historial guardado correctamente',
        'id' => $insert_id
    ]);
    
} catch (Exception $e) {
    error_log("Error en guardar_historial_email.php: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error' => 'Error al guardar el historial: ' . $e->getMessage()
    ]);
}

$conn->close();
?>
