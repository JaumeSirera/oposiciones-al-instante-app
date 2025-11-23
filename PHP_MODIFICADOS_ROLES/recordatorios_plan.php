<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
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
        case 'obtener_todos':
            obtenerTodosRecordatorios();
            break;
        case 'editar':
            editarRecordatorio();
            break;
        case 'eliminar':
            eliminarRecordatorio();
            break;
        case 'enviar_ahora':
            enviarRecordatorioAhora();
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
    $tipo_plan = $input['tipo_plan'] ?? 'estudio';
    
    if (!$id_plan || !$id_usuario || empty($recordatorios)) {
        throw new Exception('Faltan parámetros requeridos');
    }
    
    $conn->begin_transaction();
    
    try {
        // Eliminar recordatorios anteriores del plan
        $stmt = $conn->prepare("DELETE FROM recordatorios_plan WHERE id_plan = ? AND tipo_plan = ?");
        $stmt->bind_param("is", $id_plan, $tipo_plan);
        $stmt->execute();
        
        // Insertar nuevos recordatorios
        $stmt = $conn->prepare("
            INSERT INTO recordatorios_plan 
            (id_plan, id_usuario, fecha, temas, enviado, tipo_plan) 
            VALUES (?, ?, ?, ?, 0, ?)
        ");
        
        foreach ($recordatorios as $recordatorio) {
            $fecha = $recordatorio['fecha'];
            $temas_json = json_encode($recordatorio['temas']);
            
            $stmt->bind_param("iisss", $id_plan, $id_usuario, $fecha, $temas_json, $tipo_plan);
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
            r.tipo_plan,
            u.email as email_usuario,
            COALESCE(pe.titulo, pf.titulo) as titulo_plan
        FROM recordatorios_plan r
        INNER JOIN usuarios u ON r.id_usuario = u.id_usuario
        LEFT JOIN planes_estudio pe ON r.id_plan = pe.id_plan AND r.tipo_plan = 'estudio'
        LEFT JOIN planes_fisicos pf ON r.id_plan = pf.id_plan AND r.tipo_plan = 'fisico'
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
            fecha_envio,
            tipo_plan
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

function obtenerTodosRecordatorios() {
    global $conn;
    
    $id_usuario = $_GET['id_usuario'] ?? null;
    $tipo_plan = $_GET['tipo_plan'] ?? null;
    $enviado = $_GET['enviado'] ?? null;
    $fecha_desde = $_GET['fecha_desde'] ?? null;
    $fecha_hasta = $_GET['fecha_hasta'] ?? null;
    
    $query = "
        SELECT 
            r.id_recordatorio,
            r.id_plan,
            r.id_usuario,
            r.fecha,
            r.temas,
            r.enviado,
            r.fecha_envio,
            r.tipo_plan,
            u.nombre as nombre_usuario,
            u.email as email_usuario,
            COALESCE(pe.titulo, pf.titulo) as titulo_plan
        FROM recordatorios_plan r
        INNER JOIN usuarios u ON r.id_usuario = u.id_usuario
        LEFT JOIN planes_estudio pe ON r.id_plan = pe.id_plan AND r.tipo_plan = 'estudio'
        LEFT JOIN planes_fisicos pf ON r.id_plan = pf.id_plan AND r.tipo_plan = 'fisico'
        WHERE 1=1
    ";
    
    $params = [];
    $types = "";
    
    if ($id_usuario) {
        $query .= " AND r.id_usuario = ?";
        $params[] = $id_usuario;
        $types .= "i";
    }
    
    if ($tipo_plan) {
        $query .= " AND r.tipo_plan = ?";
        $params[] = $tipo_plan;
        $types .= "s";
    }
    
    if ($enviado !== null) {
        $query .= " AND r.enviado = ?";
        $params[] = (int)$enviado;
        $types .= "i";
    }
    
    if ($fecha_desde) {
        $query .= " AND r.fecha >= ?";
        $params[] = $fecha_desde;
        $types .= "s";
    }
    
    if ($fecha_hasta) {
        $query .= " AND r.fecha <= ?";
        $params[] = $fecha_hasta;
        $types .= "s";
    }
    
    $query .= " ORDER BY r.fecha DESC, r.created_at DESC LIMIT 500";
    
    $stmt = $conn->prepare($query);
    
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    
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
        'total' => count($recordatorios)
    ]);
}

function editarRecordatorio() {
    global $conn;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $id_recordatorio = $input['id_recordatorio'] ?? null;
    $fecha = $input['fecha'] ?? null;
    $temas = $input['temas'] ?? null;
    
    if (!$id_recordatorio) {
        throw new Exception('Falta id_recordatorio');
    }
    
    $updates = [];
    $params = [];
    $types = "";
    
    if ($fecha !== null) {
        $updates[] = "fecha = ?";
        $params[] = $fecha;
        $types .= "s";
    }
    
    if ($temas !== null) {
        $updates[] = "temas = ?";
        $params[] = json_encode($temas);
        $types .= "s";
    }
    
    if (empty($updates)) {
        throw new Exception('No hay campos para actualizar');
    }
    
    $query = "UPDATE recordatorios_plan SET " . implode(", ", $updates) . " WHERE id_recordatorio = ?";
    $params[] = $id_recordatorio;
    $types .= "i";
    
    $stmt = $conn->prepare($query);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    
    if ($stmt->affected_rows === 0) {
        throw new Exception('Recordatorio no encontrado');
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Recordatorio actualizado exitosamente'
    ]);
}

function eliminarRecordatorio() {
    global $conn;
    
    $input = json_decode(file_get_contents('php://input'), true);
    $id_recordatorio = $input['id_recordatorio'] ?? null;
    
    if (!$id_recordatorio) {
        throw new Exception('Falta id_recordatorio');
    }
    
    $stmt = $conn->prepare("DELETE FROM recordatorios_plan WHERE id_recordatorio = ?");
    $stmt->bind_param("i", $id_recordatorio);
    $stmt->execute();
    
    if ($stmt->affected_rows === 0) {
        throw new Exception('Recordatorio no encontrado');
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Recordatorio eliminado exitosamente'
    ]);
}

function enviarRecordatorioAhora() {
    global $conn;
    
    $input = json_decode(file_get_contents('php://input'), true);
    $id_recordatorio = $input['id_recordatorio'] ?? null;
    
    if (!$id_recordatorio) {
        throw new Exception('Falta id_recordatorio');
    }
    
    // Obtener información del recordatorio
    $stmt = $conn->prepare("
        SELECT 
            r.id_recordatorio,
            r.id_plan,
            r.id_usuario,
            r.fecha,
            r.temas,
            r.tipo_plan,
            u.email as email_usuario,
            u.nombre as nombre_usuario,
            COALESCE(pe.titulo, pf.titulo) as titulo_plan
        FROM recordatorios_plan r
        INNER JOIN usuarios u ON r.id_usuario = u.id_usuario
        LEFT JOIN planes_estudio pe ON r.id_plan = pe.id_plan AND r.tipo_plan = 'estudio'
        LEFT JOIN planes_fisicos pf ON r.id_plan = pf.id_plan AND r.tipo_plan = 'fisico'
        WHERE r.id_recordatorio = ?
    ");
    
    $stmt->bind_param("i", $id_recordatorio);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        throw new Exception('Recordatorio no encontrado');
    }
    
    $recordatorio = $result->fetch_assoc();
    $recordatorio['temas'] = json_decode($recordatorio['temas'], true);
    
    // Aquí deberías integrar con tu sistema de envío de emails
    // Por ahora solo marcamos como enviado
    
    $stmt = $conn->prepare("
        UPDATE recordatorios_plan 
        SET enviado = 1, fecha_envio = NOW() 
        WHERE id_recordatorio = ?
    ");
    
    $stmt->bind_param("i", $id_recordatorio);
    $stmt->execute();
    
    echo json_encode([
        'success' => true,
        'message' => 'Recordatorio enviado exitosamente',
        'recordatorio' => $recordatorio
    ]);
}
?>
