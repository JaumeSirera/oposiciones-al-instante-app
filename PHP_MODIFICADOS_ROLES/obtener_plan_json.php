<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require 'db.php';

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['id_plan']) || !isset($data['tipo_plan'])) {
        echo json_encode([
            'success' => false,
            'error' => 'id_plan y tipo_plan son requeridos'
        ]);
        exit;
    }

    $id_plan = intval($data['id_plan']);
    $tipo_plan = $data['tipo_plan'];

    // Determinar la tabla según el tipo de plan
    // NUEVO: en lugar de devolver solo la última fila, fusionamos TODAS las filas
    // de un mismo id_plan (para soportar generación incremental de semanas)
    if ($tipo_plan === 'fisico') {
        $sql = "SELECT id, plan_json FROM planes_fisicos_ia WHERE id_plan = ? ORDER BY id ASC";
    } else if ($tipo_plan === 'estudio') {
        $sql = "SELECT id, plan_json FROM planes_estudio WHERE id_plan = ? ORDER BY id ASC";
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'tipo_plan debe ser "fisico" o "estudio"'
        ]);
        exit;
    }

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Error preparando consulta: " . $conn->error);
    }

    $stmt->bind_param("i", $id_plan);
    
    if (!$stmt->execute()) {
        throw new Exception("Error ejecutando consulta: " . $stmt->error);
    }

    $result = $stmt->get_result();

    $mergedWeeks = [];
    $rowCount = 0;

    while ($row = $result->fetch_assoc()) {
        $rowCount++;
        $planRaw = $row['plan_json'] ?? '';
        if (!$planRaw) continue;

        $planData = json_decode($planRaw, true);
        if (!is_array($planData)) continue;

        // Detectar array de semanas
        if (isset($planData['plan']) && is_array($planData['plan'])) {
            $weeks = $planData['plan'];
        } else if (isset($planData['semanas']) && is_array($planData['semanas'])) {
            $weeks = $planData['semanas'];
        } else if (array_keys($planData) === range(0, count($planData) - 1)) {
            // Lista simple [ { semana: 1, ... }, { semana: 2, ... } ]
            $weeks = $planData;
        } else {
            // Estructura desconocida, la ignoramos pero registramos
            error_log("[obtener_plan_json] Estructura desconocida en fila id=" . $row['id'] . " keys=" . implode(',', array_keys($planData)));
            continue;
        }

        // Fusionar semanas: si se repite una semana, la fila más reciente (id mayor) prevalece
        foreach ($weeks as $week) {
            if (!is_array($week)) continue;

            if (isset($week['semana'])) {
                $index = max(0, (int)$week['semana'] - 1);
            } else {
                // Si no hay campo 'semana', las añadimos al final manteniendo orden
                $index = count($mergedWeeks);
            }

            $mergedWeeks[$index] = $week;
        }
    }

    if (empty($mergedWeeks)) {
        echo json_encode([
            'success' => false,
            'error' => 'Plan no encontrado'
        ]);
        exit;
    }

    // Ordenar por índice de semana y normalizar a array secuencial
    ksort($mergedWeeks);
    $normalizedWeeks = array_values($mergedWeeks);

    $finalPlan = [
        'plan' => $normalizedWeeks,
    ];

    // Log para debugging
    $plan_json = json_encode($finalPlan, JSON_UNESCAPED_UNICODE);
    $plan_json_length = strlen($plan_json);
    error_log("[obtener_plan_json] id_plan: $id_plan, tipo_plan: $tipo_plan, filas_consideradas: $rowCount, semanas_finales: " . count($normalizedWeeks) . ", plan_json length: $plan_json_length caracteres");

    echo json_encode([
        'success' => true,
        'plan_json' => $plan_json
    ]);

    $stmt->close();
    $conn->close();

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
    exit;
}
