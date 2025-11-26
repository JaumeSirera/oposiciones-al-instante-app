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
    if ($tipo_plan === 'fisico') {
        $sql = "SELECT plan_json FROM planes_fisicos_ia WHERE id_plan = ?";
    } else if ($tipo_plan === 'estudio') {
        $sql = "SELECT plan_json FROM planes_estudio WHERE id_plan = ?";
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
    $plan = $result->fetch_assoc();

    if (!$plan) {
        echo json_encode([
            'success' => false,
            'error' => 'Plan no encontrado'
        ]);
        exit;
    }

    echo json_encode([
        'success' => true,
        'plan_json' => $plan['plan_json']
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
