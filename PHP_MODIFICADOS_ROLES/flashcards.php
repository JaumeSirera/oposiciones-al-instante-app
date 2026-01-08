<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

require 'db.php';
require 'config.php';

function validarToken($claveJWT) {
    try {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? '';
        
        if (!preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            return null;
        }

        $token = $matches[1];
        $partes = explode('.', $token);
        if (count($partes) !== 3) {
            return null;
        }

        $base64Header = $partes[0];
        $base64Payload = $partes[1];
        $base64Firma = $partes[2];
        $firmaEsperada = base64_encode(hash_hmac('sha256', "$base64Header.$base64Payload", $claveJWT, true));

        if (!hash_equals($firmaEsperada, $base64Firma)) {
            return null;
        }

        $payload = json_decode(base64_decode($base64Payload), true);
        if ($payload['exp'] < time()) {
            return null;
        }

        return $payload;
    } catch (Exception $e) {
        error_log("Error validando token: " . $e->getMessage());
        return null;
    }
}

// Validar token
$payload = validarToken($claveJWT);
if (!$payload) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autorizado']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            handleGet($conn);
            break;
        case 'POST':
            handlePost($conn);
            break;
        case 'PUT':
            handlePut($conn);
            break;
        case 'DELETE':
            handleDelete($conn);
            break;
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    }
} catch (Exception $e) {
    error_log("Error en flashcards.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

function handleGet($conn) {
    $user_id = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;
    $action = isset($_GET['action']) ? $_GET['action'] : 'list';
    
    if (!$user_id) {
        echo json_encode(['success' => false, 'error' => 'user_id requerido']);
        return;
    }
    
    switch ($action) {
        case 'pending':
            // Obtener flashcards pendientes de revisión
            $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
            $id_proceso = isset($_GET['id_proceso']) ? intval($_GET['id_proceso']) : null;
            
            $sql = "SELECT 
                        f.id, f.front, f.back, f.category, f.tags, f.id_proceso, f.source_type,
                        COALESCE(fp.ease_factor, 2.50) as ease_factor,
                        COALESCE(fp.interval_days, 0) as interval_days,
                        COALESCE(fp.repetitions, 0) as repetitions,
                        fp.next_review,
                        COALESCE(fp.total_reviews, 0) as total_reviews,
                        COALESCE(fp.correct_reviews, 0) as correct_reviews
                    FROM flashcards f
                    LEFT JOIN flashcard_progress fp ON f.id = fp.flashcard_id AND f.user_id = fp.user_id
                    WHERE f.user_id = ?
                    AND (fp.next_review IS NULL OR fp.next_review <= CURDATE())";
            
            $params = [$user_id];
            $types = "i";
            
            if ($id_proceso) {
                $sql .= " AND f.id_proceso = ?";
                $params[] = $id_proceso;
                $types .= "i";
            }
            
            $sql .= " ORDER BY 
                        CASE WHEN fp.next_review IS NULL THEN 0 ELSE 1 END,
                        fp.next_review ASC,
                        fp.ease_factor ASC
                    LIMIT ?";
            $params[] = $limit;
            $types .= "i";
            
            $stmt = $conn->prepare($sql);
            $stmt->bind_param($types, ...$params);
            $stmt->execute();
            $result = $stmt->get_result();
            
            $flashcards = [];
            while ($row = $result->fetch_assoc()) {
                $flashcards[] = $row;
            }
            
            echo json_encode(['success' => true, 'flashcards' => $flashcards, 'count' => count($flashcards)]);
            break;
            
        case 'stats':
            // Estadísticas del usuario
            $stmt = $conn->prepare("
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN fp.next_review IS NULL OR fp.next_review <= CURDATE() THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN fp.repetitions >= 5 THEN 1 ELSE 0 END) as mastered,
                    AVG(COALESCE(fp.ease_factor, 2.50)) as avg_ease,
                    SUM(COALESCE(fp.total_reviews, 0)) as total_reviews,
                    SUM(COALESCE(fp.correct_reviews, 0)) as correct_reviews
                FROM flashcards f
                LEFT JOIN flashcard_progress fp ON f.id = fp.flashcard_id AND f.user_id = fp.user_id
                WHERE f.user_id = ?
            ");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $stats = $stmt->get_result()->fetch_assoc();
            
            // Convertir a números
            $stats['total'] = intval($stats['total']);
            $stats['pending'] = intval($stats['pending']);
            $stats['mastered'] = intval($stats['mastered']);
            $stats['avg_ease'] = round(floatval($stats['avg_ease']), 2);
            $stats['total_reviews'] = intval($stats['total_reviews']);
            $stats['correct_reviews'] = intval($stats['correct_reviews']);
            $stats['accuracy'] = $stats['total_reviews'] > 0 
                ? round(($stats['correct_reviews'] / $stats['total_reviews']) * 100, 1) 
                : 0;
            
            echo json_encode(['success' => true, 'stats' => $stats]);
            break;
            
        case 'categories':
            // Obtener categorías del usuario
            $stmt = $conn->prepare("
                SELECT DISTINCT category, COUNT(*) as count
                FROM flashcards
                WHERE user_id = ? AND category IS NOT NULL AND category != ''
                GROUP BY category
                ORDER BY count DESC
            ");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $result = $stmt->get_result();
            
            $categories = [];
            while ($row = $result->fetch_assoc()) {
                $categories[] = $row;
            }
            
            echo json_encode(['success' => true, 'categories' => $categories]);
            break;
            
        default:
            // Listar todas las flashcards
            $id_proceso = isset($_GET['id_proceso']) ? intval($_GET['id_proceso']) : null;
            $category = isset($_GET['category']) ? $_GET['category'] : null;
            $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
            $limit = isset($_GET['limit']) ? min(100, max(1, intval($_GET['limit']))) : 50;
            $offset = ($page - 1) * $limit;
            
            $sql = "SELECT 
                        f.*,
                        COALESCE(fp.ease_factor, 2.50) as ease_factor,
                        COALESCE(fp.interval_days, 0) as interval_days,
                        COALESCE(fp.repetitions, 0) as repetitions,
                        fp.next_review,
                        fp.last_review,
                        COALESCE(fp.total_reviews, 0) as total_reviews,
                        COALESCE(fp.correct_reviews, 0) as correct_reviews
                    FROM flashcards f
                    LEFT JOIN flashcard_progress fp ON f.id = fp.flashcard_id AND f.user_id = fp.user_id
                    WHERE f.user_id = ?";
            
            $params = [$user_id];
            $types = "i";
            
            if ($id_proceso) {
                $sql .= " AND f.id_proceso = ?";
                $params[] = $id_proceso;
                $types .= "i";
            }
            
            if ($category) {
                $sql .= " AND f.category = ?";
                $params[] = $category;
                $types .= "s";
            }
            
            $sql .= " ORDER BY f.created_at DESC LIMIT ? OFFSET ?";
            $params[] = $limit;
            $params[] = $offset;
            $types .= "ii";
            
            $stmt = $conn->prepare($sql);
            $stmt->bind_param($types, ...$params);
            $stmt->execute();
            $result = $stmt->get_result();
            
            $flashcards = [];
            while ($row = $result->fetch_assoc()) {
                $flashcards[] = $row;
            }
            
            // Contar total
            $countSql = "SELECT COUNT(*) as total FROM flashcards WHERE user_id = ?";
            $countParams = [$user_id];
            $countTypes = "i";
            
            if ($id_proceso) {
                $countSql .= " AND id_proceso = ?";
                $countParams[] = $id_proceso;
                $countTypes .= "i";
            }
            if ($category) {
                $countSql .= " AND category = ?";
                $countParams[] = $category;
                $countTypes .= "s";
            }
            
            $countStmt = $conn->prepare($countSql);
            $countStmt->bind_param($countTypes, ...$countParams);
            $countStmt->execute();
            $total = $countStmt->get_result()->fetch_assoc()['total'];
            
            echo json_encode([
                'success' => true, 
                'flashcards' => $flashcards,
                'total' => intval($total),
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]);
    }
}

function handlePost($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? 'create';
    
    switch ($action) {
        case 'create':
            // Crear nueva flashcard
            $user_id = intval($input['user_id'] ?? 0);
            $front = trim($input['front'] ?? '');
            $back = trim($input['back'] ?? '');
            $category = trim($input['category'] ?? '');
            $tags = trim($input['tags'] ?? '');
            $id_proceso = isset($input['id_proceso']) ? intval($input['id_proceso']) : null;
            $source_type = $input['source_type'] ?? 'manual';
            $source_id = isset($input['source_id']) ? intval($input['source_id']) : null;
            
            if (!$user_id || !$front || !$back) {
                echo json_encode(['success' => false, 'error' => 'user_id, front y back son requeridos']);
                return;
            }
            
            $stmt = $conn->prepare("
                INSERT INTO flashcards (user_id, id_proceso, front, back, category, tags, source_type, source_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->bind_param("iisssssi", $user_id, $id_proceso, $front, $back, $category, $tags, $source_type, $source_id);
            
            if ($stmt->execute()) {
                $newId = $conn->insert_id;
                echo json_encode(['success' => true, 'id' => $newId, 'message' => 'Flashcard creada']);
            } else {
                echo json_encode(['success' => false, 'error' => 'Error al crear flashcard']);
            }
            break;
            
        case 'review':
            // Registrar revisión con algoritmo SM-2
            $user_id = intval($input['user_id'] ?? 0);
            $flashcard_id = intval($input['flashcard_id'] ?? 0);
            $quality = intval($input['quality'] ?? 3); // 0-5: 0-2 incorrecto, 3-5 correcto
            
            if (!$user_id || !$flashcard_id) {
                echo json_encode(['success' => false, 'error' => 'user_id y flashcard_id requeridos']);
                return;
            }
            
            // Obtener progreso actual
            $stmt = $conn->prepare("
                SELECT * FROM flashcard_progress 
                WHERE user_id = ? AND flashcard_id = ?
            ");
            $stmt->bind_param("ii", $user_id, $flashcard_id);
            $stmt->execute();
            $progress = $stmt->get_result()->fetch_assoc();
            
            // Valores por defecto si no existe
            $ease_factor = $progress ? floatval($progress['ease_factor']) : 2.5;
            $interval = $progress ? intval($progress['interval_days']) : 0;
            $repetitions = $progress ? intval($progress['repetitions']) : 0;
            $total_reviews = $progress ? intval($progress['total_reviews']) : 0;
            $correct_reviews = $progress ? intval($progress['correct_reviews']) : 0;
            
            // Algoritmo SM-2
            $total_reviews++;
            
            if ($quality >= 3) {
                // Respuesta correcta
                $correct_reviews++;
                
                if ($repetitions == 0) {
                    $interval = 1;
                } elseif ($repetitions == 1) {
                    $interval = 6;
                } else {
                    $interval = round($interval * $ease_factor);
                }
                $repetitions++;
            } else {
                // Respuesta incorrecta - reiniciar
                $repetitions = 0;
                $interval = 1;
            }
            
            // Actualizar factor de facilidad
            $ease_factor = $ease_factor + (0.1 - (5 - $quality) * (0.08 + (5 - $quality) * 0.02));
            $ease_factor = max(1.3, $ease_factor); // Mínimo 1.3
            
            // Calcular próxima revisión
            $next_review = date('Y-m-d', strtotime("+{$interval} days"));
            
            // Insertar o actualizar progreso
            $stmt = $conn->prepare("
                INSERT INTO flashcard_progress 
                    (user_id, flashcard_id, ease_factor, interval_days, repetitions, next_review, last_review, total_reviews, correct_reviews)
                VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?)
                ON DUPLICATE KEY UPDATE
                    ease_factor = VALUES(ease_factor),
                    interval_days = VALUES(interval_days),
                    repetitions = VALUES(repetitions),
                    next_review = VALUES(next_review),
                    last_review = NOW(),
                    total_reviews = VALUES(total_reviews),
                    correct_reviews = VALUES(correct_reviews),
                    updated_at = NOW()
            ");
            $stmt->bind_param("iidissii", $user_id, $flashcard_id, $ease_factor, $interval, $repetitions, $next_review, $total_reviews, $correct_reviews);
            
            if ($stmt->execute()) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Revisión registrada',
                    'next_review' => $next_review,
                    'interval_days' => $interval,
                    'ease_factor' => round($ease_factor, 2),
                    'repetitions' => $repetitions
                ]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Error al registrar revisión']);
            }
            break;
            
        case 'bulk_create':
            // Crear múltiples flashcards (ej: de preguntas falladas)
            $user_id = intval($input['user_id'] ?? 0);
            $flashcards = $input['flashcards'] ?? [];
            
            if (!$user_id || empty($flashcards)) {
                echo json_encode(['success' => false, 'error' => 'user_id y flashcards requeridos']);
                return;
            }
            
            $created = 0;
            $errors = 0;
            
            $stmt = $conn->prepare("
                INSERT INTO flashcards (user_id, id_proceso, front, back, category, tags, source_type, source_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            foreach ($flashcards as $card) {
                $front = trim($card['front'] ?? '');
                $back = trim($card['back'] ?? '');
                
                if (!$front || !$back) {
                    $errors++;
                    continue;
                }
                
                $id_proceso = isset($card['id_proceso']) ? intval($card['id_proceso']) : null;
                $category = trim($card['category'] ?? '');
                $tags = trim($card['tags'] ?? '');
                $source_type = $card['source_type'] ?? 'manual';
                $source_id = isset($card['source_id']) ? intval($card['source_id']) : null;
                
                $stmt->bind_param("iisssssi", $user_id, $id_proceso, $front, $back, $category, $tags, $source_type, $source_id);
                
                if ($stmt->execute()) {
                    $created++;
                } else {
                    $errors++;
                }
            }
            
            echo json_encode([
                'success' => true,
                'created' => $created,
                'errors' => $errors,
                'message' => "Se crearon $created flashcards"
            ]);
            break;
            
        default:
            echo json_encode(['success' => false, 'error' => 'Acción no válida']);
    }
}

function handlePut($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $id = intval($input['id'] ?? 0);
    $user_id = intval($input['user_id'] ?? 0);
    $front = trim($input['front'] ?? '');
    $back = trim($input['back'] ?? '');
    $category = trim($input['category'] ?? '');
    $tags = trim($input['tags'] ?? '');
    
    if (!$id || !$user_id) {
        echo json_encode(['success' => false, 'error' => 'id y user_id requeridos']);
        return;
    }
    
    // Verificar que la flashcard pertenece al usuario
    $stmt = $conn->prepare("SELECT id FROM flashcards WHERE id = ? AND user_id = ?");
    $stmt->bind_param("ii", $id, $user_id);
    $stmt->execute();
    
    if ($stmt->get_result()->num_rows === 0) {
        echo json_encode(['success' => false, 'error' => 'Flashcard no encontrada']);
        return;
    }
    
    $stmt = $conn->prepare("
        UPDATE flashcards 
        SET front = ?, back = ?, category = ?, tags = ?
        WHERE id = ? AND user_id = ?
    ");
    $stmt->bind_param("ssssii", $front, $back, $category, $tags, $id, $user_id);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Flashcard actualizada']);
    } else {
        echo json_encode(['success' => false, 'error' => 'Error al actualizar']);
    }
}

function handleDelete($conn) {
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
    $user_id = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;
    
    if (!$id || !$user_id) {
        echo json_encode(['success' => false, 'error' => 'id y user_id requeridos']);
        return;
    }
    
    $stmt = $conn->prepare("DELETE FROM flashcards WHERE id = ? AND user_id = ?");
    $stmt->bind_param("ii", $id, $user_id);
    
    if ($stmt->execute() && $stmt->affected_rows > 0) {
        echo json_encode(['success' => true, 'message' => 'Flashcard eliminada']);
    } else {
        echo json_encode(['success' => false, 'error' => 'Flashcard no encontrada']);
    }
}
?>
