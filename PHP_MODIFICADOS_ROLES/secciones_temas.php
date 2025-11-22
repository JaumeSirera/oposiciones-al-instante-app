<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

require 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $proceso_id = $_GET['proceso_id'] ?? null;
    
    if (!$proceso_id) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Falta el parámetro proceso_id'
        ]);
        exit;
    }
    
    try {
        // Obtener secciones únicas del proceso
        $stmtSecciones = $conn->prepare("
            SELECT DISTINCT seccion 
            FROM preguntas 
            WHERE id_proceso = ? 
            AND seccion IS NOT NULL 
            AND seccion != ''
            ORDER BY seccion ASC
        ");
        $stmtSecciones->bind_param("i", $proceso_id);
        $stmtSecciones->execute();
        $resultSecciones = $stmtSecciones->get_result();
        
        $secciones = [];
        while ($row = $resultSecciones->fetch_assoc()) {
            $secciones[] = $row['seccion'];
        }
        
        // Obtener temas únicos del proceso
        $stmtTemas = $conn->prepare("
            SELECT DISTINCT tema 
            FROM preguntas 
            WHERE id_proceso = ? 
            AND tema IS NOT NULL 
            AND tema != ''
            ORDER BY tema ASC
        ");
        $stmtTemas->bind_param("i", $proceso_id);
        $stmtTemas->execute();
        $resultTemas = $stmtTemas->get_result();
        
        $temas = [];
        while ($row = $resultTemas->fetch_assoc()) {
            $temas[] = $row['tema'];
        }
        
        echo json_encode([
            'success' => true,
            'secciones' => $secciones,
            'temas' => $temas,
            'total_secciones' => count($secciones),
            'total_temas' => count($temas)
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Error al obtener datos: ' . $e->getMessage()
        ]);
    }
    
    exit;
}

http_response_code(405);
echo json_encode([
    'success' => false,
    'error' => 'Método no permitido'
]);
