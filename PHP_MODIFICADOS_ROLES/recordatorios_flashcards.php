<?php
/**
 * API para gestionar recordatorios de flashcards
 * Permite configurar preferencias de notificación y obtener usuarios con flashcards pendientes
 *
 * VERSION: 2026-01-13-compat-mysqli-pdo
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('X-Flashcards-Recordatorios-Version: 2026-01-13-compat-mysqli-pdo');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db.php';

/**
 * Compatibilidad: si db.php devuelve mysqli, adaptamos para que funcione como PDOStatement
 * (execute([$params]), fetch(), fetchAll())
 */
if (isset($conn) && is_object($conn) && $conn instanceof mysqli) {
    class DbCompatMysqliStatement {
        private mysqli_stmt $stmt;
        private mysqli $native;
        private ?mysqli_result $result = null;
        private ?array $boundRow = null;
        private ?array $boundRefs = null;

        public function __construct(mysqli_stmt $stmt, mysqli $native) {
            $this->stmt = $stmt;
            $this->native = $native;
        }

        /** @param array<int, mixed> $params */
        public function execute(array $params = []): bool {
            // Si hay params, hacemos bind_param y luego execute() sin argumentos
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

            // Preparar resultados si es SELECT
            $this->result = null;
            $this->boundRow = null;
            $this->boundRefs = null;

            if (method_exists($this->stmt, 'get_result')) {
                $this->result = $this->stmt->get_result();
            } else {
                $meta = $this->stmt->result_metadata();
                if ($meta) {
                    $fields = $meta->fetch_fields();
                    $row = [];
                    $refs = [];
                    foreach ($fields as $field) {
                        $row[$field->name] = null;
                        $refs[] = &$row[$field->name];
                    }
                    @call_user_func_array([$this->stmt, 'bind_result'], $refs);
                    $this->stmt->store_result();
                    $this->boundRow = $row;
                    $this->boundRefs = $refs;
                }
            }

            return true;
        }

        /** @return array<string, mixed>|null */
        public function fetch($mode = null): ?array {
            if ($this->result instanceof mysqli_result) {
                $row = $this->result->fetch_assoc();
                return $row ?: null;
            }

            if (is_array($this->boundRow)) {
                $ok = $this->stmt->fetch();
                if ($ok === null || $ok === false) {
                    return null;
                }
                $out = [];
                foreach ($this->boundRow as $k => $v) {
                    $out[$k] = $v;
                }
                return $out;
            }

            return null;
        }

        /** @return array<int, array<string, mixed>> */
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
        private mysqli $native;

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

/**
 * Intenta ejecutar una query con varias alternativas (para compatibilidad de columnas).
 * @param array<int, string> $sqlCandidates
 * @param array<int, mixed> $params
 * @return array{0: mixed, 1: string|null} [stmt|false, error]
 */
function db_prepare_safe(array $sqlCandidates, array $params = []): array {
    global $conn;

    $lastErr = null;
    foreach ($sqlCandidates as $sql) {
        try {
            $stmt = $conn->prepare($sql);
            if ($stmt === false) {
                $lastErr = 'prepare() devolvió false';
                continue;
            }
            if (!empty($params)) {
                $stmt->execute($params);
            }
            return [$stmt, null];
        } catch (Throwable $e) {
            $lastErr = $e->getMessage();
            continue;
        }
    }

    return [false, $lastErr ?? 'Error desconocido preparando consulta'];
}

function insertarHistorial(int $id_usuario, int $pending_count): void {
    $sqls = [
        "INSERT INTO recordatorios_flashcards_historial (id_usuario, fecha_envio, pending_count) VALUES (?, NOW(), ?)",
        "INSERT INTO recordatorios_flashcards_historial (user_id, fecha_envio, flashcards_pendientes) VALUES (?, NOW(), ?)",
        "INSERT INTO recordatorios_flashcards_historial (id_usuario, fecha_envio, flashcards_pendientes) VALUES (?, NOW(), ?)",
        "INSERT INTO recordatorios_flashcards_historial (user_id, fecha_envio, pending_count) VALUES (?, NOW(), ?)"
    ];

    [$stmt, $err] = db_prepare_safe($sqls, [$id_usuario, $pending_count]);
    if ($stmt === false) {
        throw new Exception('No se pudo insertar historial: ' . $err);
    }
}

/** @return array<int, array<string, mixed>> */
function seleccionarHistorial(int $id_usuario, int $limit): array {
    global $conn;

    $sqls = [
        "SELECT id_usuario, fecha_envio, pending_count FROM recordatorios_flashcards_historial WHERE id_usuario = ? ORDER BY fecha_envio DESC LIMIT ?",
        "SELECT user_id AS id_usuario, fecha_envio, flashcards_pendientes AS pending_count FROM recordatorios_flashcards_historial WHERE user_id = ? ORDER BY fecha_envio DESC LIMIT ?",
        "SELECT id_usuario, fecha_envio, flashcards_pendientes AS pending_count FROM recordatorios_flashcards_historial WHERE id_usuario = ? ORDER BY fecha_envio DESC LIMIT ?",
        "SELECT user_id AS id_usuario, fecha_envio, pending_count FROM recordatorios_flashcards_historial WHERE user_id = ? ORDER BY fecha_envio DESC LIMIT ?"
    ];

    [$stmt, $err] = db_prepare_safe($sqls, [$id_usuario, $limit]);
    if ($stmt === false) {
        throw new Exception('No se pudo obtener historial: ' . $err);
    }

    // Compat: DbCompatMysqliStatement y PDOStatement soportan fetchAll().
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    return is_array($rows) ? $rows : [];
}

function getBackendConfig(): array {
    // Usar las mismas variables/valores que ya usas en los recordatorios de planes.
    $baseUrl = getenv('BACKEND_FUNCTIONS_URL') ?: '';
    $publicKey = getenv('BACKEND_PUBLIC_KEY') ?: '';

    if ($baseUrl === '' || $publicKey === '') {
        throw new Exception('Faltan BACKEND_FUNCTIONS_URL y/o BACKEND_PUBLIC_KEY (usa los mismos valores que en recordatorios de planes).');
    }

    return [
        'baseUrl' => rtrim($baseUrl, '/'),
        'publicKey' => $publicKey,
    ];
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
    $stmt->execute([(int)$id_usuario]);
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

    $id_usuario = (int)$id_usuario;

    // Verificar si existe configuración
    $stmt = $conn->prepare("SELECT id FROM recordatorios_flashcards_config WHERE id_usuario = ?");
    $stmt->execute([$id_usuario]);
    $exists = $stmt->fetch(PDO::FETCH_ASSOC);

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
    $dia_semana = date('N'); // 1 = Lunes, 7 = Domingo

    // NOTA: evitamos depender de accounts.nombre (en algunas BBDD no existe)
    $stmt = $conn->prepare("
        SELECT 
            rfc.id_usuario,
            rfc.min_pendientes,
            rfc.frecuencia,
            rfc.ultimo_envio,
            a.email,
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

    // Para cada usuario, obtener preview de flashcards + nombre derivado
    foreach ($usuarios as &$usuario) {
        $stmtPreview = $conn->prepare("
            SELECT id, front, category 
            FROM flashcards 
            WHERE user_id = ? 
            AND (next_review IS NULL OR next_review <= NOW())
            ORDER BY next_review ASC
            LIMIT 3
        ");
        $stmtPreview->execute([(int)$usuario['id_usuario']]);
        $usuario['flashcards_preview'] = $stmtPreview->fetchAll(PDO::FETCH_ASSOC);
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

    $stmt = $conn->prepare("
        UPDATE recordatorios_flashcards_config 
        SET ultimo_envio = NOW()
        WHERE id_usuario = ?
    ");
    $stmt->execute([$id_usuario]);

    // Calcular pendientes y guardar historial (compat columnas)
    $stmtCnt = $conn->prepare("
        SELECT COUNT(*) AS pending_count
        FROM flashcards
        WHERE user_id = ?
        AND (next_review IS NULL OR next_review <= NOW())
    ");
    $stmtCnt->execute([$id_usuario]);
    $row = $stmtCnt->fetch(PDO::FETCH_ASSOC);
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

    // Obtener datos del usuario (sin depender de accounts.nombre)
    $stmt = $conn->prepare("
        SELECT a.email,
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

    // Llamar a la función del backend
    $cfg = getBackendConfig();
    $endpoint = $cfg['baseUrl'] . '/enviar-recordatorio-flashcards';
    $publicKey = $cfg['publicKey'];

    $payload = [
        'email_usuario' => $email,
        'nombre_usuario' => $nombre,
        'pending_count' => $pending_count,
        'flashcards_preview' => $flashcards_preview
    ];

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $publicKey,
            'apikey: ' . $publicKey
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

    if (is_array($result) && ($result['success'] ?? false)) {
        // Marcar como enviado
        $stmt = $conn->prepare("
            UPDATE recordatorios_flashcards_config 
            SET ultimo_envio = NOW()
            WHERE id_usuario = ?
        ");
        $stmt->execute([$id_usuario]);

        // Guardar en historial (compat columnas)
        insertarHistorial($id_usuario, $pending_count);
    }

    echo json_encode($result);
}

/**
 * Obtener historial de recordatorios enviados
 */
function obtenerHistorial() {
    $id_usuario = $_GET['id_usuario'] ?? null;
    $limit = $_GET['limit'] ?? 20;

    if (!$id_usuario) {
        echo json_encode(['success' => false, 'error' => 'id_usuario requerido']);
        return;
    }

    $id_usuario = (int)$id_usuario;
    $limit = (int)$limit;
    if ($limit <= 0) $limit = 20;
    if ($limit > 200) $limit = 200;

    $historial = seleccionarHistorial($id_usuario, $limit);

    echo json_encode(['success' => true, 'historial' => $historial]);
}
