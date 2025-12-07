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

    // Para planes físicos, obtenemos plan_json de planes_fisicos_ia
    // Para planes de estudio, NO tienen plan_json, retornamos estructura vacía
    // (los temas del día ya vienen en el recordatorio directamente)
    
    if ($tipo_plan === 'fisico') {
        // Fusionar TODAS las filas de un mismo id_plan (para soportar generación incremental)
        $sql = "SELECT id, plan_json FROM planes_fisicos_ia WHERE id_plan = ? ORDER BY id ASC";
        
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

        $stmt->close();

        if (empty($mergedWeeks)) {
            echo json_encode([
                'success' => false,
                'error' => 'Plan físico no encontrado o sin semanas generadas'
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

    } else if ($tipo_plan === 'estudio') {
        // Para planes de estudio, NO hay plan_json en la tabla
        // Los temas del día vienen directamente del recordatorio
        // Retornamos un plan vacío indicando que use los temas del recordatorio
        
        // Intentamos obtener al menos el título del plan
        $stmt = $conn->prepare("SELECT id, titulo, descripcion FROM planes_estudio WHERE id = ?");
        if (!$stmt) {
            throw new Exception("Error preparando consulta: " . $conn->error);
        }

        $stmt->bind_param("i", $id_plan);
        
        if (!$stmt->execute()) {
            throw new Exception("Error ejecutando consulta: " . $stmt->error);
        }

        $result = $stmt->get_result();
        $plan = $result->fetch_assoc();
        $stmt->close();

        if (!$plan) {
            echo json_encode([
                'success' => false,
                'error' => 'Plan de estudio no encontrado'
            ]);
            exit;
        }

        // Retornar estructura que indica usar temas del recordatorio
        $planJson = [
            'titulo' => $plan['titulo'] ?? 'Plan de Estudio',
            'descripcion' => $plan['descripcion'] ?? '',
            'usar_temas_recordatorio' => true, // Flag para la edge function
            'plan' => [] // Vacío - usar temas del recordatorio
        ];

        error_log("[obtener_plan_json] Plan de estudio id_plan: $id_plan - retornando estructura para usar temas del recordatorio");

        echo json_encode([
            'success' => true,
            'plan_json' => json_encode($planJson, JSON_UNESCAPED_UNICODE)
        ]);

    } else {
        echo json_encode([
            'success' => false,
            'error' => 'tipo_plan debe ser "fisico" o "estudio"'
        ]);
        exit;
    }

    $conn->close();

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
    exit;
}
