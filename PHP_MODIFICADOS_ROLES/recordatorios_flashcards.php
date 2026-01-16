<?php
/**
 * API para gestionar recordatorios de flashcards
 * Permite configurar preferencias de notificación y obtener usuarios con flashcards pendientes
 *
 * VERSION: 2026-01-14-autodetect-columns
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('X-Flashcards-Recordatorios-Version: 2026-01-14-autodetect-columns');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db.php';

// Cache para columnas detectadas
$detectedColumns = null;

/**
 * Detectar columnas de la tabla flashcards
 */
function detectFlashcardColumns() {
    global $conn, $detectedColumns;
    
    if ($detectedColumns !== null) {
        return $detectedColumns;
    }
    
    $detectedColumns = [
        'next_review' => null,
        'user_id' => 'user_id'
    ];
    
    try {
        // Obtener columnas de la tabla flashcards
        if ($conn instanceof PDO) {
            $stmt = $conn->query("SHOW COLUMNS FROM flashcards");
            $columns = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $columns[] = $row['Field'];
            }
        } elseif (isset($conn) && method_exists($conn, 'prepare')) {
            // Es nuestro wrapper
            $nativeConn = null;
            // Intentar query directa
            $columns = [];
            try {
                $stmt = $conn->prepare("SHOW COLUMNS FROM flashcards");
                $stmt->execute([]);
                $rows = $stmt->fetchAll();
                foreach ($rows as $row) {
                    $columns[] = $row['Field'] ?? array_values($row)[0] ?? '';
                }
            } catch (Exception $e) {
                error_log("Error detecting columns: " . $e->getMessage());
            }
        } else {
            $result = $conn->query("SHOW COLUMNS FROM flashcards");
            $columns = [];
            while ($row = $result->fetch_assoc()) {
                $columns[] = $row['Field'];
            }
        }
        
        // Buscar columna de próxima revisión
        $nextReviewCandidates = ['next_review', 'proxima_revision', 'siguiente_revision', 'review_date', 'fecha_revision', 'nextReview'];
        foreach ($nextReviewCandidates as $col) {
            if (in_array($col, $columns)) {
                $detectedColumns['next_review'] = $col;
                break;
            }
        }
        
        // Buscar columna de usuario
        $userIdCandidates = ['user_id', 'id_usuario', 'usuario_id', 'userId'];
        foreach ($userIdCandidates as $col) {
            if (in_array($col, $columns)) {
                $detectedColumns['user_id'] = $col;
                break;
            }
        }
        
        error_log("Detected flashcard columns: " . json_encode($detectedColumns) . " from available: " . json_encode($columns));
        
    } catch (Exception $e) {
        error_log("Error detecting flashcard columns: " . $e->getMessage());
    }
    
    return $detectedColumns;
}

/**
 * Obtener condición SQL para flashcards pendientes
 */
function getPendingCondition($tableAlias = 'f') {
    $cols = detectFlashcardColumns();
    $nextReviewCol = $cols['next_review'];
    
    if ($nextReviewCol === null) {
        // Sin columna de revisión, contar todas
        return "1=1";
    }
    
    $prefix = $tableAlias ? "{$tableAlias}." : "";
    return "({$prefix}{$nextReviewCol} IS NULL OR {$prefix}{$nextReviewCol} <= NOW())";
}

/**
 * Obtener columna user_id
 */
function getUserIdColumn() {
    $cols = detectFlashcardColumns();
    return $cols['user_id'] ?? 'user_id';
}

/**
 * Obtener ORDER BY para flashcards
 */
function getOrderByClause($tableAlias = '') {
    $cols = detectFlashcardColumns();
    $nextReviewCol = $cols['next_review'];
    $prefix = $tableAlias ? "{$tableAlias}." : "";
    
    if ($nextReviewCol) {
        return "ORDER BY {$prefix}{$nextReviewCol} ASC";
    }
    return "ORDER BY {$prefix}id ASC";
}

/**
 * Compatibilidad: si db.php devuelve mysqli, adaptamos para que funcione como PDOStatement
 */
if (isset($conn) && is_object($conn) && $conn instanceof mysqli) {
    class DbCompatMysqliStatement {
        private mysqli_stmt $stmt;
        private mysqli $native;
        /** @var mysqli_result|null|false */
        private $result = null;

        public function __construct(mysqli_stmt $stmt, mysqli $native) {
            $this->stmt = $stmt;
            $this->native = $native;
        }

        public function execute(array $params = []): bool {
            if (!empty($params)) {
                $types = '';
                $values = [];

                foreach ($params as $p) {
                    if (is_int($p) || (is_string($p) && ctype_digit($p))) {
                        $types .= 'i';
                        $values[] = (int)$p;
                    } elseif (is_float($p)) {
                        $types .= 'd';
                        $values[] = (float)$p;
                    } elseif (is_null($p)) {
                        $types .= 's';
                        $values[] = null;
                    } else {
                        $types .= 's';
                        $values[] = (string)$p;
                    }
                }

                $bindArgs = [$types];
                foreach ($values as $i => $v) {
                    $bindArgs[] = &$values[$i];
                }

                if (!@call_user_func_array([$this->stmt, 'bind_param'], $bindArgs)) {
                    throw new Exception('DB bind_param error: ' . $this->stmt->error);
                }
            }

            $ok = $this->stmt->execute();
            if (!$ok) {
                throw new Exception('DB execute error: ' . $this->stmt->error);
            }

            $this->result = null;
            if (method_exists($this->stmt, 'get_result')) {
                $res = $this->stmt->get_result();
                // get_result() returns false for non-SELECT queries (INSERT, UPDATE, DELETE)
                // Only store if it's a valid mysqli_result
                if ($res instanceof mysqli_result) {
                    $this->result = $res;
                }
            }

            return true;
        }

        public function fetch($mode = null): ?array {
            if ($this->result instanceof mysqli_result) {
                $row = $this->result->fetch_assoc();
                return $row ?: null;
            }
            return null;
        }

        public function fetchAll($mode = null): array {
            $rows = [];
            while (true) {
                $row = $this->fetch($mode);
                if (!$row) break;
                $rows[] = $row;
            }
            return $rows;
        }
    }

    class DbCompatMysqliConnection {
        public mysqli $native;

        public function __construct(mysqli $native) {
            $this->native = $native;
        }

        public function prepare(string $sql) {
            $stmt = $this->native->prepare($sql);
            if ($stmt === false) {
                throw new Exception('DB prepare error: ' . $this->native->error);
            }
            return new DbCompatMysqliStatement($stmt, $this->native);
        }
        
        public function query(string $sql) {
            return $this->native->query($sql);
        }
    }

    $conn = new DbCompatMysqliConnection($conn);
}

/**
 * Helpers
 */
function inferNombreDesdeEmail(string $email): string {
    $email = trim($email);
    if ($email === '') return 'Usuario';
    $parts = explode('@', $email);
    $name = $parts[0] ?? 'Usuario';
    $name = preg_replace('/[^a-zA-Z0-9._-]/', ' ', $name);
    $name = trim(preg_replace('/\s+/', ' ', $name));
    return $name !== '' ? $name : 'Usuario';
}

function insertarHistorial(int $id_usuario, int $pending_count): void {
    global $conn;
    
    $sqls = [
        "INSERT INTO recordatorios_flashcards_historial (id_usuario, fecha_envio, pending_count) VALUES (?, NOW(), ?)",
        "INSERT INTO recordatorios_flashcards_historial (user_id, fecha_envio, flashcards_pendientes) VALUES (?, NOW(), ?)",
        "INSERT INTO recordatorios_flashcards_historial (id_usuario, fecha_envio, flashcards_pendientes) VALUES (?, NOW(), ?)",
        "INSERT INTO recordatorios_flashcards_historial (user_id, fecha_envio, pending_count) VALUES (?, NOW(), ?)"
    ];

    $lastErr = null;
    foreach ($sqls as $sql) {
        try {
            $stmt = $conn->prepare($sql);
            $stmt->execute([$id_usuario, $pending_count]);
            return; // Éxito
        } catch (Exception $e) {
            $lastErr = $e->getMessage();
            continue;
        }
    }
    
    error_log("No se pudo insertar historial: " . $lastErr);
}

function seleccionarHistorial(int $id_usuario, int $limit): array {
    global $conn;

    $sqls = [
        "SELECT * FROM recordatorios_flashcards_historial WHERE id_usuario = ? ORDER BY fecha_envio DESC LIMIT ?",
        "SELECT * FROM recordatorios_flashcards_historial WHERE user_id = ? ORDER BY fecha_envio DESC LIMIT ?"
    ];

    foreach ($sqls as $sql) {
        try {
            $stmt = $conn->prepare($sql);
            $stmt->execute([$id_usuario, $limit]);
            return $stmt->fetchAll();
        } catch (Exception $e) {
            continue;
        }
    }
    
    return [];
}

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
        case 'obtener_todos':
            obtenerTodosRecordatorios();
            break;
        case 'version':
            echo json_encode([
                'success' => true, 
                'version' => '2026-01-14-autodetect-columns',
                'detected_columns' => detectFlashcardColumns()
            ]);
            break;
        case 'debug_columns':
            debugColumns();
            break;
        default:
            echo json_encode(['success' => false, 'error' => 'Acción no válida']);
    }
} catch (Exception $e) {
    error_log("Error en recordatorios_flashcards.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

/**
 * Debug: mostrar columnas detectadas
 */
function debugColumns() {
    global $conn;
    
    $flashcardCols = [];
    $historialCols = [];
    
    try {
        if ($conn instanceof PDO) {
            $stmt = $conn->query("SHOW COLUMNS FROM flashcards");
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $flashcardCols[] = $row['Field'];
            }
            $stmt = $conn->query("SHOW COLUMNS FROM recordatorios_flashcards_historial");
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $historialCols[] = $row['Field'];
            }
        } elseif (isset($conn->native)) {
            $result = $conn->native->query("SHOW COLUMNS FROM flashcards");
            while ($row = $result->fetch_assoc()) {
                $flashcardCols[] = $row['Field'];
            }
            $result = $conn->native->query("SHOW COLUMNS FROM recordatorios_flashcards_historial");
            while ($row = $result->fetch_assoc()) {
                $historialCols[] = $row['Field'];
            }
        } else {
            $result = $conn->query("SHOW COLUMNS FROM flashcards");
            while ($row = $result->fetch_assoc()) {
                $flashcardCols[] = $row['Field'];
            }
            $result = $conn->query("SHOW COLUMNS FROM recordatorios_flashcards_historial");
            while ($row = $result->fetch_assoc()) {
                $historialCols[] = $row['Field'];
            }
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        return;
    }
    
    echo json_encode([
        'success' => true,
        'flashcards_columns' => $flashcardCols,
        'historial_columns' => $historialCols,
        'detected' => detectFlashcardColumns()
    ]);
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

    $stmt = $conn->prepare("SELECT * FROM recordatorios_flashcards_config WHERE id_usuario = ?");
    $stmt->execute([(int)$id_usuario]);
    $config = $stmt->fetch();

    if (!$config) {
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

    $id_usuario = (int)$id_usuario;

    $stmt = $conn->prepare("SELECT id FROM recordatorios_flashcards_config WHERE id_usuario = ?");
    $stmt->execute([$id_usuario]);
    $exists = $stmt->fetch();

    if ($exists) {
        $stmt = $conn->prepare("
            UPDATE recordatorios_flashcards_config 
            SET activo = ?, frecuencia = ?, hora_envio = ?, dias_semana = ?, min_pendientes = ?, updated_at = NOW()
            WHERE id_usuario = ?
        ");
        $stmt->execute([$activo, $frecuencia, $hora_envio, $dias_semana, (int)$min_pendientes, $id_usuario]);
    } else {
        $stmt = $conn->prepare("
            INSERT INTO recordatorios_flashcards_config 
            (id_usuario, activo, frecuencia, hora_envio, dias_semana, min_pendientes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        ");
        $stmt->execute([$id_usuario, $activo, $frecuencia, $hora_envio, $dias_semana, (int)$min_pendientes]);
    }

    echo json_encode(['success' => true, 'message' => 'Configuración guardada']);
}

/**
 * Obtener usuarios con flashcards pendientes que deben recibir recordatorio
 */
function obtenerUsuariosConPendientes() {
    global $conn;

    $hora_actual = date('H:i');
    $dia_semana = date('N');
    
    $pendingCond = getPendingCondition('f');
    $userIdCol = getUserIdColumn();

    $stmt = $conn->prepare("
        SELECT 
            rfc.id_usuario,
            rfc.min_pendientes,
            rfc.frecuencia,
            rfc.ultimo_envio,
            a.email,
            (SELECT COUNT(*) FROM flashcards f 
             WHERE f.{$userIdCol} = rfc.id_usuario 
             AND {$pendingCond}) as pending_count
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
    $usuarios = $stmt->fetchAll();

    $pendingCondNoAlias = getPendingCondition('');
    $orderBy = getOrderByClause('');

    foreach ($usuarios as &$usuario) {
        $stmtPreview = $conn->prepare("
            SELECT id, front, category 
            FROM flashcards 
            WHERE {$userIdCol} = ? 
            AND {$pendingCondNoAlias}
            {$orderBy}
            LIMIT 3
        ");
        $stmtPreview->execute([(int)$usuario['id_usuario']]);
        $usuario['flashcards_preview'] = $stmtPreview->fetchAll();
        $usuario['nombre'] = inferNombreDesdeEmail((string)($usuario['email'] ?? ''));
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

    $id_usuario = (int)$id_usuario;

    $stmt = $conn->prepare("UPDATE recordatorios_flashcards_config SET ultimo_envio = NOW() WHERE id_usuario = ?");
    $stmt->execute([$id_usuario]);

    $pendingCond = getPendingCondition('');
    $userIdCol = getUserIdColumn();
    
    $stmtCnt = $conn->prepare("SELECT COUNT(*) AS pending_count FROM flashcards WHERE {$userIdCol} = ? AND {$pendingCond}");
    $stmtCnt->execute([$id_usuario]);
    $row = $stmtCnt->fetch();
    $pending = (int)($row['pending_count'] ?? 0);

    insertarHistorial($id_usuario, $pending);

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

    $id_usuario = (int)$id_usuario;
    
    $pendingCond = getPendingCondition('f');
    $userIdCol = getUserIdColumn();

    $stmt = $conn->prepare("
        SELECT a.email,
        (SELECT COUNT(*) FROM flashcards f 
         WHERE f.{$userIdCol} = ? 
         AND {$pendingCond}) as pending_count
        FROM accounts a WHERE a.id = ?
    ");
    $stmt->execute([$id_usuario, $id_usuario]);
    $usuario = $stmt->fetch();

    if (!$usuario) {
        echo json_encode(['success' => false, 'error' => 'Usuario no encontrado']);
        return;
    }

    $pending_count = (int)($usuario['pending_count'] ?? 0);

    if ($pending_count === 0) {
        echo json_encode(['success' => false, 'error' => 'No tienes flashcards pendientes']);
        return;
    }

    $email = (string)($usuario['email'] ?? '');
    if ($email === '') {
        echo json_encode(['success' => false, 'error' => 'Email de usuario no disponible']);
        return;
    }

    $nombre = inferNombreDesdeEmail($email);

    $pendingCondNoAlias = getPendingCondition('');
    $orderBy = getOrderByClause('');
    
    $stmtPreview = $conn->prepare("
        SELECT id, front, category 
        FROM flashcards 
        WHERE {$userIdCol} = ? 
        AND {$pendingCondNoAlias}
        {$orderBy}
        LIMIT 3
    ");
    $stmtPreview->execute([$id_usuario]);
    $flashcards_preview = $stmtPreview->fetchAll();

    // Llamar a la edge function
    $supabaseUrl = 'https://yrjwyeuqfleqhbveohrf.supabase.co/functions/v1/enviar-recordatorio-flashcards';
    $supabaseKey = getenv('SUPABASE_ANON_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyand5ZXVxZmxlcWhidmVvaHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjM1OTUsImV4cCI6MjA3NTUzOTU5NX0.QeAWfPjecNzz_d1MY1UHYmVN9bYl23rzot9gDsUtXKY';

    $payload = [
        'email_usuario' => $email,
        'nombre_usuario' => $nombre,
        'pending_count' => $pending_count,
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

    if (isset($result['success']) && $result['success']) {
        $stmt = $conn->prepare("UPDATE recordatorios_flashcards_config SET ultimo_envio = NOW() WHERE id_usuario = ?");
        $stmt->execute([$id_usuario]);
        insertarHistorial($id_usuario, $pending_count);
    }

    echo json_encode($result ?: ['success' => false, 'error' => 'Respuesta inválida del servidor']);
}

/**
 * Obtener historial de recordatorios enviados
 */
function obtenerHistorial() {
    $id_usuario = $_GET['id_usuario'] ?? null;
    $limit = (int)($_GET['limit'] ?? 20);

    if (!$id_usuario) {
        echo json_encode(['success' => false, 'error' => 'id_usuario requerido']);
        return;
    }

    $historial = seleccionarHistorial((int)$id_usuario, $limit);
    echo json_encode(['success' => true, 'historial' => $historial]);
}

/**
 * Obtener todas las configuraciones e historial (para usuarios SA)
 * Si se proporciona id_usuario, filtra por ese usuario
 */
function obtenerTodosRecordatorios() {
    global $conn;
    
    // Leer id_usuario de GET o del body JSON
    $input = json_decode(file_get_contents('php://input'), true);
    $id_usuario = $_GET['id_usuario'] ?? $input['id_usuario'] ?? null;
    
    try {
        // Obtener configuraciones
        if ($id_usuario) {
            // Filtrar por usuario específico
            $stmt = $conn->prepare("
                SELECT rfc.*, a.email as email_usuario, a.nombre as nombre_usuario
                FROM recordatorios_flashcards_config rfc
                LEFT JOIN accounts a ON a.id = rfc.id_usuario
                WHERE rfc.id_usuario = ?
                ORDER BY rfc.updated_at DESC
            ");
            $stmt->execute([(int)$id_usuario]);
        } else {
            // Obtener todos (modo SA)
            $stmt = $conn->prepare("
                SELECT rfc.*, a.email as email_usuario, a.nombre as nombre_usuario
                FROM recordatorios_flashcards_config rfc
                LEFT JOIN accounts a ON a.id = rfc.id_usuario
                ORDER BY rfc.updated_at DESC
                LIMIT 100
            ");
            $stmt->execute([]);
        }
        $configs = $stmt->fetchAll();
        
        // Inferir nombre desde email si no está disponible
        foreach ($configs as &$config) {
            if (empty($config['nombre_usuario']) && !empty($config['email_usuario'])) {
                $config['nombre_usuario'] = inferNombreDesdeEmail($config['email_usuario']);
            }
        }
        
        // Obtener historial reciente
        if ($id_usuario) {
            $historial = seleccionarHistorial((int)$id_usuario, 50);
            // Añadir info de usuario al historial
            foreach ($historial as &$h) {
                $h['nombre_usuario'] = $configs[0]['nombre_usuario'] ?? null;
                $h['email_usuario'] = $configs[0]['email_usuario'] ?? null;
            }
        } else {
            // Obtener historial de todos los usuarios (últimos 50 envíos)
            $sqlHistorial = "
                SELECT h.*, a.email as email_usuario, a.nombre as nombre_usuario
                FROM recordatorios_flashcards_historial h
                LEFT JOIN accounts a ON a.id = h.id_usuario OR a.id = h.user_id
                ORDER BY h.fecha_envio DESC
                LIMIT 50
            ";
            
            try {
                $stmtH = $conn->prepare($sqlHistorial);
                $stmtH->execute([]);
                $historial = $stmtH->fetchAll();
                
                // Inferir nombres
                foreach ($historial as &$h) {
                    if (empty($h['nombre_usuario']) && !empty($h['email_usuario'])) {
                        $h['nombre_usuario'] = inferNombreDesdeEmail($h['email_usuario']);
                    }
                    // Normalizar campo id_usuario
                    if (!isset($h['id_usuario']) && isset($h['user_id'])) {
                        $h['id_usuario'] = $h['user_id'];
                    }
                    // Normalizar pending_count
                    if (!isset($h['pending_count']) && isset($h['flashcards_pendientes'])) {
                        $h['pending_count'] = $h['flashcards_pendientes'];
                    }
                }
            } catch (Exception $e) {
                error_log("Error obteniendo historial global: " . $e->getMessage());
                $historial = [];
            }
        }
        
        echo json_encode([
            'success' => true,
            'configs' => $configs,
            'historial' => $historial
        ]);
        
    } catch (Exception $e) {
        error_log("Error en obtenerTodosRecordatorios: " . $e->getMessage());
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
