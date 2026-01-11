<?php
/**
 * API para gestionar recordatorios de flashcards
 * Permite configurar preferencias de notificación y obtener usuarios con flashcards pendientes
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db.php';

// Obtener acción
$action = $_GET['action'] ?? $_POST['action'] ?? null;

if (!$action) {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? 'obtener_config';
}

try {
    switch ($action) {
        case 'obtener_config':
            obtenerConfiguracion();
            break;
        case 'guardar_config':
            guardarConfiguracion();
            break;
        case 'obtener_pendientes':
            obtenerUsuariosConPendientes();
            break;
        case 'marcar_enviado':
            marcarEnviado();
            break;
        case 'enviar_ahora':
            enviarRecordatorioAhora();
            break;
        case 'obtener_historial':
            obtenerHistorial();
            break;
        default:
            echo json_encode(['success' => false, 'error' => 'Acción no válida']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

/**
 * Obtener configuración de recordatorios de un usuario
 */
function obtenerConfiguracion() {
    global $conn;
    
    $id_usuario = $_GET['id_usuario'] ?? null;
    
    if (!$id_usuario) {
        echo json_encode(['success' => false, 'error' => 'id_usuario requerido']);
        return;
    }
    
    $stmt = $conn->prepare("
        SELECT * FROM recordatorios_flashcards_config 
        WHERE id_usuario = ?
    ");
    $stmt->execute([$id_usuario]);
    $config = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$config) {
        // Configuración por defecto
        $config = [
            'id_usuario' => (int)$id_usuario,
            'activo' => 1,
            'frecuencia' => 'diario',
            'hora_envio' => '09:00',
            'dias_semana' => '1,2,3,4,5',
            'min_pendientes' => 5,
            'ultimo_envio' => null
        ];
    }
    
    echo json_encode(['success' => true, 'config' => $config]);
}

/**
 * Guardar configuración de recordatorios
 */
function guardarConfiguracion() {
    global $conn;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $id_usuario = $input['id_usuario'] ?? null;
    $activo = isset($input['activo']) ? (int)$input['activo'] : 1;
    $frecuencia = $input['frecuencia'] ?? 'diario';
    $hora_envio = $input['hora_envio'] ?? '09:00';
    $dias_semana = $input['dias_semana'] ?? '1,2,3,4,5';
    $min_pendientes = $input['min_pendientes'] ?? 5;
    
    if (!$id_usuario) {
        echo json_encode(['success' => false, 'error' => 'id_usuario requerido']);
        return;
    }
    
    // Verificar si existe configuración
    $stmt = $conn->prepare("SELECT id FROM recordatorios_flashcards_config WHERE id_usuario = ?");
    $stmt->execute([$id_usuario]);
    $exists = $stmt->fetch();
    
    if ($exists) {
        $stmt = $conn->prepare("
            UPDATE recordatorios_flashcards_config 
            SET activo = ?, frecuencia = ?, hora_envio = ?, dias_semana = ?, min_pendientes = ?, updated_at = NOW()
            WHERE id_usuario = ?
        ");
        $stmt->execute([$activo, $frecuencia, $hora_envio, $dias_semana, $min_pendientes, $id_usuario]);
    } else {
        $stmt = $conn->prepare("
            INSERT INTO recordatorios_flashcards_config 
            (id_usuario, activo, frecuencia, hora_envio, dias_semana, min_pendientes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        ");
        $stmt->execute([$id_usuario, $activo, $frecuencia, $hora_envio, $dias_semana, $min_pendientes]);
    }
    
    echo json_encode(['success' => true, 'message' => 'Configuración guardada']);
}

/**
 * Obtener usuarios con flashcards pendientes que deben recibir recordatorio
 */
function obtenerUsuariosConPendientes() {
    global $conn;
    
    $hora_actual = date('H:i');
    $dia_semana = date('N'); // 1 = Lunes, 7 = Domingo
    
    // Usuarios con configuración activa que coincide con hora y día actual
    $stmt = $conn->prepare("
        SELECT 
            rfc.id_usuario,
            rfc.min_pendientes,
            rfc.frecuencia,
            rfc.ultimo_envio,
            a.email,
            a.nombre,
            (SELECT COUNT(*) FROM flashcards f 
             WHERE f.user_id = rfc.id_usuario 
             AND (f.next_review IS NULL OR f.next_review <= NOW())) as pending_count
        FROM recordatorios_flashcards_config rfc
        INNER JOIN accounts a ON a.id = rfc.id_usuario
        WHERE rfc.activo = 1
        AND rfc.hora_envio = ?
        AND FIND_IN_SET(?, rfc.dias_semana) > 0
        AND (
            rfc.ultimo_envio IS NULL 
            OR (rfc.frecuencia = 'diario' AND DATE(rfc.ultimo_envio) < CURDATE())
            OR (rfc.frecuencia = 'semanal' AND DATE(rfc.ultimo_envio) < DATE_SUB(CURDATE(), INTERVAL 7 DAY))
        )
        HAVING pending_count >= rfc.min_pendientes
    ");
    $stmt->execute([$hora_actual, $dia_semana]);
    $usuarios = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Para cada usuario, obtener preview de flashcards
    foreach ($usuarios as &$usuario) {
        $stmtPreview = $conn->prepare("
            SELECT id, front, category 
            FROM flashcards 
            WHERE user_id = ? 
            AND (next_review IS NULL OR next_review <= NOW())
            ORDER BY next_review ASC
            LIMIT 3
        ");
        $stmtPreview->execute([$usuario['id_usuario']]);
        $usuario['flashcards_preview'] = $stmtPreview->fetchAll(PDO::FETCH_ASSOC);
    }
    
    echo json_encode(['success' => true, 'usuarios' => $usuarios]);
}

/**
 * Marcar que se envió recordatorio a un usuario
 */
function marcarEnviado() {
    global $conn;
    
    $input = json_decode(file_get_contents('php://input'), true);
    $id_usuario = $input['id_usuario'] ?? null;
    
    if (!$id_usuario) {
        echo json_encode(['success' => false, 'error' => 'id_usuario requerido']);
        return;
    }
    
    $stmt = $conn->prepare("
        UPDATE recordatorios_flashcards_config 
        SET ultimo_envio = NOW()
        WHERE id_usuario = ?
    ");
    $stmt->execute([$id_usuario]);
    
    // Guardar en historial
    $stmt = $conn->prepare("
        INSERT INTO recordatorios_flashcards_historial (id_usuario, fecha_envio, pending_count)
        SELECT ?, NOW(), COUNT(*) FROM flashcards 
        WHERE user_id = ? AND (next_review IS NULL OR next_review <= NOW())
    ");
    $stmt->execute([$id_usuario, $id_usuario]);
    
    echo json_encode(['success' => true]);
}

/**
 * Enviar recordatorio manualmente
 */
function enviarRecordatorioAhora() {
    global $conn;
    
    $input = json_decode(file_get_contents('php://input'), true);
    $id_usuario = $input['id_usuario'] ?? null;
    
    if (!$id_usuario) {
        echo json_encode(['success' => false, 'error' => 'id_usuario requerido']);
        return;
    }
    
    // Obtener datos del usuario
    $stmt = $conn->prepare("
        SELECT a.email, a.nombre,
        (SELECT COUNT(*) FROM flashcards f 
         WHERE f.user_id = ? 
         AND (f.next_review IS NULL OR f.next_review <= NOW())) as pending_count
        FROM accounts a WHERE a.id = ?
    ");
    $stmt->execute([$id_usuario, $id_usuario]);
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$usuario) {
        echo json_encode(['success' => false, 'error' => 'Usuario no encontrado']);
        return;
    }
    
    if ($usuario['pending_count'] == 0) {
        echo json_encode(['success' => false, 'error' => 'No tienes flashcards pendientes']);
        return;
    }
    
    // Obtener preview de flashcards
    $stmtPreview = $conn->prepare("
        SELECT id, front, category 
        FROM flashcards 
        WHERE user_id = ? 
        AND (next_review IS NULL OR next_review <= NOW())
        ORDER BY next_review ASC
        LIMIT 3
    ");
    $stmtPreview->execute([$id_usuario]);
    $flashcards_preview = $stmtPreview->fetchAll(PDO::FETCH_ASSOC);
    
    // Llamar a la edge function
    $supabaseUrl = 'https://yrjwyeuqfleqhbveohrf.supabase.co/functions/v1/enviar-recordatorio-flashcards';
    $supabaseKey = getenv('SUPABASE_ANON_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyand5ZXVxZmxlcWhidmVvaHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjM1OTUsImV4cCI6MjA3NTUzOTU5NX0.QeAWfPjecNzz_d1MY1UHYmVN9bYl23rzot9gDsUtXKY';
    
    $payload = [
        'email_usuario' => $usuario['email'],
        'nombre_usuario' => $usuario['nombre'],
        'pending_count' => (int)$usuario['pending_count'],
        'flashcards_preview' => $flashcards_preview
    ];
    
    $ch = curl_init($supabaseUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $supabaseKey
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 30
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        echo json_encode(['success' => false, 'error' => 'Error al enviar email: ' . $response]);
        return;
    }
    
    $result = json_decode($response, true);
    
    if ($result['success']) {
        // Marcar como enviado
        $stmt = $conn->prepare("
            UPDATE recordatorios_flashcards_config 
            SET ultimo_envio = NOW()
            WHERE id_usuario = ?
        ");
        $stmt->execute([$id_usuario]);
        
        // Guardar en historial
        $stmt = $conn->prepare("
            INSERT INTO recordatorios_flashcards_historial (id_usuario, fecha_envio, pending_count)
            VALUES (?, NOW(), ?)
        ");
        $stmt->execute([$id_usuario, $usuario['pending_count']]);
    }
    
    echo json_encode($result);
}

/**
 * Obtener historial de recordatorios enviados
 */
function obtenerHistorial() {
    global $conn;
    
    $id_usuario = $_GET['id_usuario'] ?? null;
    $limit = $_GET['limit'] ?? 20;
    
    if (!$id_usuario) {
        echo json_encode(['success' => false, 'error' => 'id_usuario requerido']);
        return;
    }
    
    $stmt = $conn->prepare("
        SELECT * FROM recordatorios_flashcards_historial
        WHERE id_usuario = ?
        ORDER BY fecha_envio DESC
        LIMIT ?
    ");
    $stmt->execute([$id_usuario, (int)$limit]);
    $historial = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(['success' => true, 'historial' => $historial]);
}
