<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'config.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    switch ($action) {
        case 'crear':
            crearRecordatorios();
            break;
        case 'obtener_pendientes':
            obtenerRecordatoriosPendientes();
            break;
        case 'marcar_enviado':
            marcarRecordatorioEnviado();
            break;
        case 'obtener_por_plan':
            obtenerRecordatoriosPorPlan();
            break;
        default:
            throw new Exception('Acción no válida');
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function crearRecordatorios() {
    global $conn;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $id_plan = $input['id_plan'] ?? null;
    $id_usuario = $input['id_usuario'] ?? null;
    $recordatorios = $input['recordatorios'] ?? [];
    
    if (!$id_plan || !$id_usuario || empty($recordatorios)) {
        throw new Exception('Faltan parámetros requeridos');
    }
    
    $conn->begin_transaction();
    
    try {
        // Eliminar recordatorios anteriores del plan
        $stmt = $conn->prepare("DELETE FROM recordatorios_plan WHERE id_plan = ?");
        $stmt->bind_param("i", $id_plan);
        $stmt->execute();
        
        // Insertar nuevos recordatorios
        $stmt = $conn->prepare("
            INSERT INTO recordatorios_plan 
            (id_plan, id_usuario, fecha, temas, enviado) 
            VALUES (?, ?, ?, ?, 0)
        ");
        
        foreach ($recordatorios as $recordatorio) {
            $fecha = $recordatorio['fecha'];
            $temas_json = json_encode($recordatorio['temas']);
            
            $stmt->bind_param("iiss", $id_plan, $id_usuario, $fecha, $temas_json);
            $stmt->execute();
        }
        
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Recordatorios creados exitosamente',
            'total' => count($recordatorios)
        ]);
        
    } catch (Exception $e) {
        $conn->rollback();
        throw $e;
    }
}

function obtenerRecordatoriosPendientes() {
    global $conn;
    
    $fecha_hoy = date('Y-m-d');
    
    $stmt = $conn->prepare("
        SELECT 
            r.id_recordatorio,
            r.id_plan,
            r.id_usuario,
            r.fecha,
            r.temas,
            u.email as email_usuario,
            p.titulo as titulo_plan
        FROM recordatorios_plan r
        INNER JOIN usuarios u ON r.id_usuario = u.id_usuario
        INNER JOIN planes_estudio p ON r.id_plan = p.id_plan
        WHERE r.fecha = ? 
        AND r.enviado = 0
        ORDER BY r.fecha ASC
    ");
    
    $stmt->bind_param("s", $fecha_hoy);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $recordatorios = [];
    while ($row = $result->fetch_assoc()) {
        $row['temas'] = json_decode($row['temas'], true);
        $recordatorios[] = $row;
    }
    
    echo json_encode([
        'success' => true,
        'recordatorios' => $recordatorios,
        'fecha' => $fecha_hoy
    ]);
}

function marcarRecordatorioEnviado() {
    global $conn;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $id_plan = $input['id_plan'] ?? null;
    $fecha = $input['fecha'] ?? null;
    
    if (!$id_plan || !$fecha) {
        throw new Exception('Faltan parámetros requeridos');
    }
    
    $stmt = $conn->prepare("
        UPDATE recordatorios_plan 
        SET enviado = 1, fecha_envio = NOW() 
        WHERE id_plan = ? AND fecha = ?
    ");
    
    $stmt->bind_param("is", $id_plan, $fecha);
    $stmt->execute();
    
    echo json_encode([
        'success' => true,
        'message' => 'Recordatorio marcado como enviado'
    ]);
}

function obtenerRecordatoriosPorPlan() {
    global $conn;
    
    $id_plan = $_GET['id_plan'] ?? null;
    
    if (!$id_plan) {
        throw new Exception('Falta id_plan');
    }
    
    $stmt = $conn->prepare("
        SELECT 
            id_recordatorio,
            fecha,
            temas,
            enviado,
            fecha_envio
        FROM recordatorios_plan
        WHERE id_plan = ?
        ORDER BY fecha ASC
    ");
    
    $stmt->bind_param("i", $id_plan);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $recordatorios = [];
    while ($row = $result->fetch_assoc()) {
        $row['temas'] = json_decode($row['temas'], true);
        $recordatorios[] = $row;
    }
    
    echo json_encode([
        'success' => true,
        'recordatorios' => $recordatorios
    ]);
}
?>