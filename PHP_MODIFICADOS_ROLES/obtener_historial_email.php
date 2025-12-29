<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
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

// Solo aceptar GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit();
}

try {
    // Parámetros opcionales
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;
    $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;
    
    // Limitar el máximo de registros
    if ($limit > 100) $limit = 100;
    if ($limit < 1) $limit = 50;
    
    // Obtener el total de registros
    $countSql = "SELECT COUNT(*) as total FROM email_history";
    $countResult = $conn->query($countSql);
    $total = 0;
    
    if ($countResult && $row = $countResult->fetch_assoc()) {
        $total = intval($row['total']);
    }
    
    // Obtener historial ordenado por fecha descendente
    $sql = "SELECT id, subject, message, recipients_count, sent_by, sent_at, status, errors 
            FROM email_history 
            ORDER BY sent_at DESC 
            LIMIT ? OFFSET ?";
    
    $stmt = $conn->prepare($sql);
    
    if (!$stmt) {
        throw new Exception("Error preparando la consulta: " . $conn->error);
    }
    
    $stmt->bind_param("ii", $limit, $offset);
    
    if (!$stmt->execute()) {
        throw new Exception("Error ejecutando la consulta: " . $stmt->error);
    }
    
    $result = $stmt->get_result();
    $historial = [];
    
    while ($row = $result->fetch_assoc()) {
        $historial[] = [
            'id' => intval($row['id']),
            'subject' => $row['subject'],
            'message' => $row['message'],
            'recipients_count' => intval($row['recipients_count']),
            'sent_by' => $row['sent_by'],
            'sent_at' => $row['sent_at'],
            'status' => $row['status'],
            'errors' => $row['errors']
        ];
    }
    
    $stmt->close();
    
    echo json_encode([
        'success' => true,
        'data' => $historial,
        'total' => $total,
        'limit' => $limit,
        'offset' => $offset
    ]);
    
} catch (Exception $e) {
    error_log("Error en obtener_historial_email.php: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error' => 'Error al obtener el historial: ' . $e->getMessage()
    ]);
}

$conn->close();
?>
