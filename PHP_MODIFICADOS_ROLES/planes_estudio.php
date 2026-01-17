<?php
/**
 * ARCHIVO: planes_estudio.php (VERSIÓN COMPLETA CON listar_todos)
 * 
 * INSTRUCCIONES:
 * Reemplaza tu planes_estudio.php actual con este archivo completo.
 * Incluye la nueva acción 'listar_todos' para usuarios SA.
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

// No mostrar errores en salida, pero sí loguear
ini_set('display_errors', '0');
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

require 'db.php';
require 'config.php';

/* =========================================================
 * Helpers
 * ========================================================= */
function crearEtapasAutomaticas($conn, $id_plan, $id_proceso, $fecha_inicio, $fecha_fin) {
    // Borra etapas y tareas existentes de este plan
    $conn->query("DELETE FROM planes_tareas WHERE id_etapa IN (SELECT id FROM planes_etapas WHERE id_plan = $id_plan)");
    $conn->query("DELETE FROM planes_etapas WHERE id_plan = $id_plan");

    // Cálculo de semanas
    $fechaIni = new DateTime($fecha_inicio);
    $fechaFin = new DateTime($fecha_fin);
    $dias = $fechaIni->diff($fechaFin)->days + 1;
    $semanas = max(1, ceil($dias / 7));

    // Temas del proceso
    $temas = [];
    $qTemas = $conn->query("SELECT DISTINCT tema FROM preguntas WHERE id_proceso = $id_proceso");
    while ($row = $qTemas->fetch_assoc()) $temas[] = $row['tema'];
    $temasPorSemana = $semanas > 0 ? ceil(count($temas) / $semanas) : count($temas);

    // Crea etapas y tareas
    for ($w = 0; $w < $semanas; $w++) {
        $etapaTitulo = "Semana " . ($w + 1);
        $temasSemana = array_slice($temas, $w * $temasPorSemana, $temasPorSemana);
        $etapaDesc = "Temas: " . implode(", ", $temasSemana);
        $stmt = $conn->prepare("INSERT INTO planes_etapas (id_plan, titulo, descripcion, orden) VALUES (?, ?, ?, ?)");
        $orden = $w + 1;
        $stmt->bind_param("issi", $id_plan, $etapaTitulo, $etapaDesc, $orden);
        $stmt->execute();
        $id_etapa = $conn->insert_id;

        // Una tarea por tema
        foreach ($temasSemana as $i => $tema) {
            $tareaTitulo = "Repasar y hacer test del tema: $tema";
            $tareaDesc = "Haz simulacros sobre $tema. Marca esta tarea al completar tu estudio.";
            $tOrden = $i + 1;
            $stmtT = $conn->prepare("INSERT INTO planes_tareas (id_etapa, titulo, descripcion, orden) VALUES (?, ?, ?, ?)");
            $stmtT->bind_param("issi", $id_etapa, $tareaTitulo, $tareaDesc, $tOrden);
            $stmtT->execute();
        }

        /* === NUEVO: tareas globales de la semana === */
        $ordenBase = count($temasSemana) + 1;
        // 1) Simulación de TEST semanal
        $t1 = "Simulación de test (semanal)";
        $d1 = "Realiza un test corto de repaso con preguntas de los temas de esta semana. Guarda tu resultado.";
        $o1 = $ordenBase;
        $stmtT = $conn->prepare("INSERT INTO planes_tareas (id_etapa, titulo, descripcion, orden) VALUES (?, ?, ?, ?)");
        $stmtT->bind_param("issi", $id_etapa, $t1, $d1, $o1);
        $stmtT->execute();

        // 2) Simulación de EXAMEN semanal
        $t2 = "Simulación de examen (semanal)";
        $d2 = "Examen completo cronometrado con mezcla de temas vistos hasta ahora.";
        $o2 = $ordenBase + 1;
        $stmtT = $conn->prepare("INSERT INTO planes_tareas (id_etapa, titulo, descripcion, orden) VALUES (?, ?, ?, ?)");
        $stmtT->bind_param("issi", $id_etapa, $t2, $d2, $o2);
        $stmtT->execute();
    }
}

// Método/params
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;
$id_usuario = isset($_GET['id_usuario']) ? intval($_GET['id_usuario']) : null;
$id_plan = isset($_GET['id_plan']) ? intval($_GET['id_plan']) : null;

// Aceptar también ?id=... y body id/id_plan
$id = isset($_GET['id']) ? intval($_GET['id']) : null;
if (!$id_plan && $id) $id_plan = $id;

$data = json_decode(file_get_contents("php://input"), true);
if (!$id_plan && isset($data['id_plan'])) $id_plan = intval($data['id_plan']);
if (!$id_plan && isset($data['id']))      $id_plan = intval($data['id']);

// ===== JWT =====
function validarToken($claveJWT) {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    if (!preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        echo json_encode(["error" => "Token no proporcionado"]); exit;
    }
    $token = $matches[1];
    $partes = explode('.', $token);
    if (count($partes) !== 3) { echo json_encode(["error" => "Token mal formado"]); exit; }
    $base64Header = $partes[0];
    $base64Payload = $partes[1];
    $base64Firma = $partes[2];
    $firmaEsperada = base64_encode(hash_hmac('sha256', "$base64Header.$base64Payload", $claveJWT, true));
    if (!hash_equals($firmaEsperada, $base64Firma)) { echo json_encode(["error" => "Firma inválida"]); exit; }
    $payload = json_decode(base64_decode($base64Payload), true);
    if (($payload['exp'] ?? 0) < time()) { echo json_encode(["error" => "Token expirado"]); exit; }
    return $payload;
}

$payload = validarToken($claveJWT);

/* =========================================================
 * 1) LISTAR PLANES (con resumen_ia) - Para usuario específico
 * ========================================================= */
if ($method === 'GET' && $action === 'listar' && $id_usuario) {
    $stmt = $conn->prepare("SELECT * FROM planes_estudio WHERE id_usuario = ? ORDER BY fecha_inicio DESC");
    $stmt->bind_param("i", $id_usuario);
    $stmt->execute();
    $result = $stmt->get_result();
    $planes = [];
    while ($row = $result->fetch_assoc()) {
        $plan_id = intval($row['id']);
        if (!$plan_id) { continue; }
        $row['tieneIA'] = false;
        $row['ia_avance_ratio'] = 0;
        $row['total_sesiones'] = 0;
        $row['ultima_sesion'] = null;
        $row['resumen_ia'] = null;

        // Plan IA (plan_json)
        $q_ia = $conn->prepare("SELECT plan_json FROM planes_ia WHERE id_plan = ? ORDER BY fecha DESC, id DESC LIMIT 1");
        if ($q_ia) {
            $q_ia->bind_param("i", $plan_id);
            $q_ia->execute();
            $q_ia->store_result();
            $q_ia->bind_result($plan_json);
            if ($q_ia->fetch() && $plan_json) {
                $row['tieneIA'] = true;
                $plan_ia = json_decode($plan_json, true);
                $num_semanas = 0;
                if (is_array($plan_ia) && isset($plan_ia['plan']) && is_array($plan_ia['plan'])) {
                    $num_semanas = count($plan_ia['plan']);
                } elseif (is_array($plan_ia)) {
                    $num_semanas = count($plan_ia);
                }
                // Avance IA
                $q_av = $conn->prepare("SELECT avance_json, fecha FROM planes_ia_avance WHERE id_plan=? AND id_usuario=? ORDER BY fecha DESC LIMIT 1");
                if ($q_av) {
                    $q_av->bind_param("ii", $plan_id, $id_usuario);
                    $q_av->execute();
                    $q_av->store_result();
                    $q_av->bind_result($avance_json, $fecha_avance);
                    if ($q_av->fetch() && $avance_json) {
                        $avance = json_decode($avance_json, true);
                        if (is_array($avance)) {
                            $hechas = array_filter($avance, fn($x) => !!$x);
                            $row['total_sesiones'] = count($hechas);
                            $row['ia_avance_ratio'] = $num_semanas ? count($hechas)/$num_semanas : 0;
                            $lastIdx = array_keys($avance, true);
                            if ($lastIdx) {
                                if (isset($plan_ia['plan']) && is_array($plan_ia['plan'])) {
                                    $ix = end($lastIdx);
                                    if (isset($plan_ia['plan'][$ix]['fecha_fin'])) {
                                        $row['ultima_sesion'] = $plan_ia['plan'][$ix]['fecha_fin'];
                                    }
                                }
                            }
                        }
                    }
                    $q_av->free_result();
                    $q_av->close();
                }
            }
            $q_ia->free_result();
            $q_ia->close();
        }

        // Resumen IA
        $q_res = $conn->prepare("SELECT resumen FROM planes_ia WHERE id_plan = ? ORDER BY fecha DESC, id DESC LIMIT 1");
        if ($q_res) {
            $q_res->bind_param("i", $plan_id);
            $q_res->execute();
            $q_res->store_result();
            $q_res->bind_result($resumen_ia);
            if ($q_res->fetch()) {
                $row['resumen_ia'] = $resumen_ia;
            }
            $q_res->free_result();
            $q_res->close();
        }
        $planes[] = $row;
    }
    echo json_encode(['success' => true, 'planes' => $planes]); exit;
}

/* =========================================================
 * 1.1) LISTAR TODOS LOS PLANES (SOLO SA) - NUEVO
 * ========================================================= */
elseif ($method === 'GET' && $action === 'listar_todos') {
    // Verificar que el usuario es SA (Super Admin)
    $nivel = $payload['nivel'] ?? '';
    if ($nivel !== 'SA') {
        echo json_encode(['success' => false, 'error' => 'No autorizado. Solo SA puede ver todos los planes.']);
        exit;
    }

    // Obtener TODOS los planes de estudio con información del usuario
    $sql = "
        SELECT 
            pe.*,
            a.username as usuario_nombre,
            a.email as usuario_email,
            p.descripcion as proceso_nombre
        FROM planes_estudio pe
        LEFT JOIN accounts a ON pe.id_usuario = a.id
        LEFT JOIN procesos p ON pe.id_proceso = p.id
        ORDER BY pe.fecha_inicio DESC
    ";
    
    $result = $conn->query($sql);
    if (!$result) {
        echo json_encode(['success' => false, 'error' => 'Error en consulta: ' . $conn->error]);
        exit;
    }

    $planes = [];
    while ($row = $result->fetch_assoc()) {
        $plan_id = intval($row['id']);
        $uid = intval($row['id_usuario']);
        
        $row['tieneIA'] = false;
        $row['ia_avance_ratio'] = 0;
        $row['total_sesiones'] = 0;
        $row['ultima_sesion'] = null;
        $row['resumen_ia'] = null;

        // Plan IA (plan_json)
        $q_ia = $conn->prepare("SELECT plan_json FROM planes_ia WHERE id_plan = ? ORDER BY fecha DESC, id DESC LIMIT 1");
        if ($q_ia) {
            $q_ia->bind_param("i", $plan_id);
            $q_ia->execute();
            $q_ia->store_result();
            $q_ia->bind_result($plan_json);
            if ($q_ia->fetch() && $plan_json) {
                $row['tieneIA'] = true;
                $plan_ia = json_decode($plan_json, true);
                $num_semanas = 0;
                if (is_array($plan_ia) && isset($plan_ia['plan']) && is_array($plan_ia['plan'])) {
                    $num_semanas = count($plan_ia['plan']);
                } elseif (is_array($plan_ia)) {
                    $num_semanas = count($plan_ia);
                }
                // Avance IA del propietario del plan
                $q_av = $conn->prepare("SELECT avance_json, fecha FROM planes_ia_avance WHERE id_plan=? AND id_usuario=? ORDER BY fecha DESC LIMIT 1");
                if ($q_av) {
                    $q_av->bind_param("ii", $plan_id, $uid);
                    $q_av->execute();
                    $q_av->store_result();
                    $q_av->bind_result($avance_json, $fecha_avance);
                    if ($q_av->fetch() && $avance_json) {
                        $avance = json_decode($avance_json, true);
                        if (is_array($avance)) {
                            $hechas = array_filter($avance, fn($x) => !!$x);
                            $row['total_sesiones'] = count($hechas);
                            $row['ia_avance_ratio'] = $num_semanas ? count($hechas)/$num_semanas : 0;
                        }
                    }
                    $q_av->free_result();
                    $q_av->close();
                }
            }
            $q_ia->free_result();
            $q_ia->close();
        }

        // Resumen IA
        $q_res = $conn->prepare("SELECT resumen FROM planes_ia WHERE id_plan = ? ORDER BY fecha DESC, id DESC LIMIT 1");
        if ($q_res) {
            $q_res->bind_param("i", $plan_id);
            $q_res->execute();
            $q_res->store_result();
            $q_res->bind_result($resumen_ia);
            if ($q_res->fetch()) {
                $row['resumen_ia'] = $resumen_ia;
            }
            $q_res->free_result();
            $q_res->close();
        }

        $planes[] = $row;
    }

    echo json_encode(['success' => true, 'planes' => $planes], JSON_UNESCAPED_UNICODE);
    exit;
}

/* =========================================================
 * 2) CREAR PLAN  (+ auto generación de etapas si hay proceso)
 * ========================================================= */
elseif ($method === 'POST' && $action === 'crear') {
    $id_usuario = isset($data['id_usuario']) ? intval($data['id_usuario']) : null;
    $id_proceso = isset($data['id_proceso']) ? intval($data['id_proceso']) : 0; // 0 = sin proceso
    $titulo = trim($data['titulo'] ?? '');
    $descripcion = trim($data['descripcion'] ?? '');
    $fecha_inicio = isset($data['fecha_inicio']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $data['fecha_inicio'])
        ? $data['fecha_inicio'] : date('Y-m-d');
    $fecha_fin = isset($data['fecha_fin']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $data['fecha_fin'])
        ? $data['fecha_fin'] : date('Y-m-d');

    if (!$id_usuario) { echo json_encode(['success' => false, 'error' => 'Falta id_usuario']); exit; }
    if ($titulo === '') { echo json_encode(['success' => false, 'error' => 'Falta título']); exit; }

    $estado = 'activo';
    $progreso = '0.00';
    $nota_general = null;

    $stmt = $conn->prepare("INSERT INTO planes_estudio (id_usuario, id_proceso, titulo, descripcion, fecha_inicio, fecha_fin, estado, progreso, nota_general) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("iisssssds", $id_usuario, $id_proceso, $titulo, $descripcion, $fecha_inicio, $fecha_fin, $estado, $progreso, $nota_general);
    if ($stmt->execute()) {
        $nuevoId = $conn->insert_id;
        // Generar etapas/tareas automáticamente si hay proceso
        if ($id_proceso) {
          crearEtapasAutomaticas($conn, $nuevoId, $id_proceso, $fecha_inicio, $fecha_fin);
        }
        echo json_encode(['success' => true, 'id_plan' => $nuevoId]);
    } else {
        error_log("Error creando plan: " . $stmt->error);
        echo json_encode(['success' => false, 'error' => 'No se pudo crear', 'detail' => $stmt->error]);
    }
    exit;
}

/* =========================================================
 * 3) DETALLE DE PLAN
 * ========================================================= */
elseif ($method === 'GET' && $action === 'detalle' && $id_plan) {
    $res_plan = $conn->query("SELECT * FROM planes_estudio WHERE id = $id_plan");
    if (!$res_plan) {
        echo json_encode(['success' => false, 'error' => 'Error en la consulta de plan: ' . $conn->error]); exit;
    }
    $plan = $res_plan->fetch_assoc();
    if (!$plan) { echo json_encode(['success' => false, 'error' => 'Plan no encontrado']); exit; }

    $etapas = [];
    $q_etapas = $conn->query("SELECT * FROM planes_etapas WHERE id_plan = $id_plan ORDER BY orden ASC");
    if ($q_etapas) {
        while ($e = $q_etapas->fetch_assoc()) {
            $e['tareas'] = [];
            $q_tareas = $conn->query("SELECT * FROM planes_tareas WHERE id_etapa = {$e['id']} ORDER BY orden ASC");
            if ($q_tareas) { while ($t = $q_tareas->fetch_assoc()) { $e['tareas'][] = $t; } }
            $etapas[] = $e;
        }
    }
    echo json_encode(['success' => true, 'plan' => $plan, 'etapas' => $etapas]); exit;
}

/* =========================================================
 * 3.1) PLAN IA PERSONAL (proxy)
 * ========================================================= */
elseif ($method === 'GET' && $action === 'plan_ia_personal' && $id_plan) {
    $q = $conn->prepare("SELECT plan_json, resumen FROM planes_ia WHERE id_plan = ? ORDER BY fecha DESC, id DESC LIMIT 1");
    if (!$q) { echo json_encode(['success'=>false, 'error'=>'Error al preparar consulta', 'detail'=>$conn->error]); exit; }
    $q->bind_param("i", $id_plan);
    $q->execute(); $q->store_result(); $q->bind_result($plan_json, $resumen);
    if (!$q->fetch() || !$plan_json) { echo json_encode(['success'=>false, 'error'=>'No hay plan IA generado para este plan']); $q->free_result(); $q->close(); exit; }
    $q->free_result(); $q->close();
    $planIA = json_decode($plan_json, true);
    if ($planIA === null) { echo json_encode(['success'=>false, 'error'=>'plan_json mal formado']); exit; }
    $avance = null;
    if ($id_usuario) {
        $qa = $conn->prepare("SELECT avance_json, fecha FROM planes_ia_avance WHERE id_plan=? AND id_usuario=? ORDER BY fecha DESC LIMIT 1");
        if ($qa) {
            $qa->bind_param("ii", $id_plan, $id_usuario);
            $qa->execute(); $qa->store_result(); $qa->bind_result($avance_json, $fecha_avance);
            if ($qa->fetch() && $avance_json) { $avance = json_decode($avance_json, true); }
            $qa->free_result(); $qa->close();
        }
    }
    echo json_encode(['success'=>true,'plan_ia'=>$planIA,'resumen_ia'=>$resumen ?? null,'avance'=>$avance]); exit;
}

/* =========================================================
 * 4) ACTUALIZAR PLAN
 * ========================================================= */
elseif ($method === 'POST' && $action === 'actualizar') {
    $id_plan = isset($data['id_plan']) ? intval($data['id_plan']) : null;
    if (!$id_plan) { echo json_encode(['success' => false, 'error' => 'Falta id_plan']); exit; }

    $titulo = isset($data['titulo']) ? trim($data['titulo']) : null;
    $descripcion = array_key_exists('descripcion', $data) ? trim($data['descripcion']) : null;
    $fecha_inicio = isset($data['fecha_inicio']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $data['fecha_inicio']) ? $data['fecha_inicio'] : null;
    $fecha_fin = isset($data['fecha_fin']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $data['fecha_fin']) ? $data['fecha_fin'] : null;
    $estado = isset($data['estado']) ? $data['estado'] : null;
    $progreso = isset($data['progreso']) ? $data['progreso'] : null;
    $nota_general = array_key_exists('nota_general', $data) ? $data['nota_general'] : null;
    $id_proceso = isset($data['id_proceso']) ? intval($data['id_proceso']) : null;

    $fields = []; $types = ''; $values = [];
    if ($titulo !== null) { $fields[] = "titulo = ?"; $types .= 's'; $values[] = $titulo; }
    if ($descripcion !== null) { $fields[] = "descripcion = ?"; $types .= 's'; $values[] = $descripcion; }
    if ($fecha_inicio !== null) { $fields[] = "fecha_inicio = ?"; $types .= 's'; $values[] = $fecha_inicio; }
    if ($fecha_fin !== null) { $fields[] = "fecha_fin = ?"; $types .= 's'; $values[] = $fecha_fin; }
    if ($estado !== null) { $fields[] = "estado = ?"; $types .= 's'; $values[] = $estado; }
    if ($progreso !== null) { $fields[] = "progreso = ?"; $types .= 'd'; $values[] = $progreso; }
    if ($nota_general !== null) { $fields[] = "nota_general = ?"; $types .= 's'; $values[] = $nota_general; }
    if ($id_proceso !== null) { $fields[] = "id_proceso = ?"; $types .= 'i'; $values[] = $id_proceso; }

    if (!count($fields)) { echo json_encode(['success' => false, 'error' => 'Nada que actualizar']); exit; }

    $set_clause = implode(', ', $fields);
    $sql = "UPDATE planes_estudio SET $set_clause WHERE id = ?";
    $types .= 'i'; $values[] = $id_plan;

    $stmt = $conn->prepare($sql);
    if (!$stmt) { echo json_encode(['success' => false, 'error' => 'Prepare fallido', 'detail' => $conn->error]); exit; }
    $bind_names = []; $bind_names[] = $types;
    for ($i = 0; $i < count($values); $i++) { $bind_name = 'val'.$i; $$bind_name = $values[$i]; $bind_names[] = &$$bind_name; }
    call_user_func_array([$stmt, 'bind_param'], $bind_names);
    echo json_encode(['success' => $stmt->execute()]); exit;
}

/* =========================================================
 * 5) ELIMINAR PLAN (POST recomendado, DELETE compatible)
 * ========================================================= */
elseif (
    ($method === 'POST'   && $action === 'eliminar'   && $id_plan) ||
    ($method === 'DELETE' && in_array($action, ['eliminar','delete_plan'], true) && $id_plan)
) {
    $pid = intval($id_plan);
    if (!$pid) { echo json_encode(['success'=>false,'error'=>'id inválido']); exit; }
    $conn->begin_transaction();
    try {
        $conn->query("DELETE FROM planes_tareas WHERE id_etapa IN (SELECT id FROM planes_etapas WHERE id_plan = $pid)");
        $conn->query("DELETE FROM planes_etapas WHERE id_plan = $pid");
        @ $conn->query("DELETE FROM planes_ia_avance WHERE id_plan = $pid");
        @ $conn->query("DELETE FROM planes_ia        WHERE id_plan = $pid");
        @ $conn->query("DELETE FROM planes_registro_sesion WHERE id_plan = $pid");
        $conn->query("DELETE FROM planes_estudio WHERE id = $pid");
        $conn->commit();
        echo json_encode(['success' => true]);
    } catch (Throwable $e) {
        $conn->rollback();
        error_log('planes_estudio::eliminar ERROR: '.$e->getMessage());
        echo json_encode(['success' => false, 'error' => 'No se pudo eliminar el plan']);
    }
    exit;
}

/* =========================================================
 * 6) GUARDAR SEGUIMIENTO DE PLAN
 * ========================================================= */
elseif ($action === 'guardar_seguimiento' && $method === 'POST') {
    $id_plan = isset($data['id_plan']) ? intval($data['id_plan']) : 0;
    $dias_semana = isset($data['dias_semana']) ? $data['dias_semana'] : '[]';
    $horas = isset($data['horas']) ? $data['horas'] : '';

    if (!$id_plan) { echo json_encode(['success'=>false,'error'=>'Falta id_plan']); exit; }

    $stmt = $conn->prepare("UPDATE planes_estudio SET dias_semana=?, horas_semana=? WHERE id=?");
    $stmt->bind_param("ssi", $dias_semana, $horas, $id_plan);
    $stmt->execute();

    $q = $conn->query("SELECT id_proceso, fecha_inicio, fecha_fin FROM planes_estudio WHERE id=$id_plan");
    $planRow = $q->fetch_assoc();
    if ($planRow && $planRow['id_proceso']) {
        crearEtapasAutomaticas($conn, $id_plan, $planRow['id_proceso'], $planRow['fecha_inicio'], $planRow['fecha_fin']);
    }
    echo json_encode(['success'=>true]); exit;
}

/* =========================================================
 * 7) MARCAR/EDITAR COMPLETADO DE TAREA
 * ========================================================= */
elseif ($action === 'marcar_tarea' && $method === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);
    $id_tarea = isset($input['id_tarea']) ? intval($input['id_tarea']) : 0;
    $completada = isset($input['completada']) ? intval($input['completada']) : 0;

    if (!$id_tarea) { echo json_encode(['success'=>false, 'error'=>'Faltan datos']); exit; }

    $stmt = $conn->prepare("UPDATE planes_tareas SET completada=? WHERE id=?");
    $stmt->bind_param("ii", $completada, $id_tarea);
    $ok = $stmt->execute();
    echo json_encode(['success'=>$ok]); exit;
}

/* =========================================================
 * MÉTODO / ACCIÓN NO SOPORTADOS
 * ========================================================= */
else {
    echo json_encode(["error" => "Método o acción no soportados"]);
}
