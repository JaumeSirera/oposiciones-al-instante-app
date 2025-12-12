<?php
/**
 * Script para detectar y eliminar preguntas huérfanas
 * Elimina preguntas que:
 *   - Tienen menos de 2 respuestas válidas en tabla respuestas
 *   - Tienen el campo 'correcta' inválido (vacío o solo caracteres especiales)
 * 
 * USO: 
 *   - Modo simulación (ver qué se eliminaría): limpiar_preguntas_huerfanas.php
 *   - Modo ejecución real: limpiar_preguntas_huerfanas.php?ejecutar=1&clave=TU_CLAVE
 */

header('Content-Type: text/html; charset=utf-8');
error_reporting(E_ALL);
ini_set('display_errors', 1);

require 'db.php';

// Clave de seguridad (cambiar antes de usar en producción)
$CLAVE_SEGURIDAD = 'limpiar2024';

$ejecutar = isset($_GET['ejecutar']) && $_GET['ejecutar'] == '1';
$clave = $_GET['clave'] ?? '';

// Verificar clave si se va a ejecutar
if ($ejecutar && $clave !== $CLAVE_SEGURIDAD) {
    die('<h2 style="color:red;">❌ Clave de seguridad incorrecta</h2>');
}

/**
 * Valida si una respuesta es válida (contiene al menos una letra o número)
 */
function es_respuesta_valida($s) {
    $s = trim($s ?? '');
    if ($s === '') return false;
    
    if (preg_match('/[a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛäëïöüÄËÏÖÜçÇ]/u', $s)) {
        return true;
    }
    
    return false;
}

echo '<!DOCTYPE html>
<html>
<head>
    <title>Limpieza de Preguntas Huérfanas</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        .info { background: #e3f2fd; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
        .warning { background: #fff3e0; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
        .success { background: #e8f5e9; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
        .error { background: #ffebee; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; }
        .orphan { background: #ffebee; }
        .btn { display: inline-block; padding: 10px 20px; background: #1976d2; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
        .btn-danger { background: #d32f2f; }
        code { background: #eee; padding: 2px 6px; border-radius: 3px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
        .badge-0 { background: #f44336; color: white; }
        .badge-1 { background: #ff9800; color: white; }
        .progress-container { background: #e0e0e0; border-radius: 4px; height: 24px; margin: 10px 0; overflow: hidden; }
        .progress-bar { background: linear-gradient(90deg, #4caf50, #8bc34a); height: 100%; transition: width 0.1s; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; }
        .status { padding: 10px; background: #fff9c4; border-radius: 4px; margin: 10px 0; font-family: monospace; }
    </style>
</head>
<body>
<div class="container">';

echo '<h1>🧹 Limpieza de Preguntas Huérfanas</h1>';
echo '<p>Detecta preguntas con menos de 2 respuestas válidas o con campo "correcta" inválido</p>';

if (!$ejecutar) {
    echo '<div class="info">
        <strong>ℹ️ Modo Simulación</strong><br>
        Este es un análisis previo. No se eliminará nada.<br>
        Para ejecutar la limpieza real, añade <code>?ejecutar=1&clave=' . $CLAVE_SEGURIDAD . '</code> a la URL.
    </div>';
}

// Forzar output buffering para mostrar progreso en tiempo real
if (ob_get_level()) ob_end_flush();
ob_implicit_flush(true);

// Primero contar total de preguntas
$countQuery = "SELECT COUNT(*) as total FROM preguntas";
$countResult = $conn->query($countQuery);
$totalCount = $countResult ? $countResult->fetch_assoc()['total'] : 0;

echo '<div class="info" id="progress-info">
    <strong>🔍 Analizando preguntas...</strong><br>
    <div class="progress-container">
        <div class="progress-bar" id="progress-bar" style="width: 0%">0%</div>
    </div>
    <div class="status" id="status">Iniciando análisis de ' . number_format($totalCount) . ' preguntas...</div>
</div>';

// Script para actualizar progreso
echo '<script>
function updateProgress(current, total, message) {
    var pct = Math.round((current / total) * 100);
    document.getElementById("progress-bar").style.width = pct + "%";
    document.getElementById("progress-bar").innerText = pct + "%";
    document.getElementById("status").innerText = message;
}
</script>';

// Flush inicial
if (function_exists('flush')) { flush(); }
if (function_exists('ob_flush') && ob_get_level()) { @ob_flush(); }

// Buscar todas las preguntas con sus respuestas y campo correcta
$query = "SELECT p.id, p.pregunta, p.correcta, p.id_proceso, p.tema, p.seccion,
          (SELECT COUNT(*) FROM respuestas r WHERE r.id_pregunta = p.id) as total_respuestas
          FROM preguntas p
          ORDER BY p.id DESC";

$result = $conn->query($query);

if (!$result) {
    echo '<div class="error">❌ Error en consulta: ' . $conn->error . '</div>';
    exit;
}

$huerfanas = [];
$total_preguntas = 0;
$update_interval = max(1, intval($totalCount / 100)); // Actualizar cada 1%

while ($row = $result->fetch_assoc()) {
    $total_preguntas++;
    $id_pregunta = $row['id'];
    
    // Mostrar progreso cada 1% o cada 50 preguntas
    if ($total_preguntas % $update_interval == 0 || $total_preguntas <= 5) {
        $preguntaCorta = mb_substr($row['pregunta'] ?? '', 0, 40);
        echo '<script>updateProgress(' . $total_preguntas . ', ' . $totalCount . ', "Pregunta #' . $total_preguntas . '/' . $totalCount . ' (ID: ' . $id_pregunta . ') - ' . addslashes($preguntaCorta) . '...");</script>';
        if (function_exists('flush')) { flush(); }
        if (function_exists('ob_flush') && ob_get_level()) { @ob_flush(); }
    }
    
    // Obtener respuestas de esta pregunta y contar válidas
    $query_resp = "SELECT respuesta FROM respuestas WHERE id_pregunta = $id_pregunta";
    $result_resp = $conn->query($query_resp);
    
    $respuestas_validas = 0;
    $respuestas_invalidas = [];
    
    if ($result_resp) {
        while ($resp = $result_resp->fetch_assoc()) {
            if (es_respuesta_valida($resp['respuesta'])) {
                $respuestas_validas++;
            } else {
                $respuestas_invalidas[] = $resp['respuesta'];
            }
        }
    }
    
    // Verificar si el campo correcta es válido
    $correcta_valida = es_respuesta_valida($row['correcta']);
    $motivo_huerfana = '';
    
    // Si tiene menos de 2 respuestas válidas O correcta es inválida, es huérfana
    if ($respuestas_validas < 2) {
        $motivo_huerfana = 'Menos de 2 respuestas válidas';
    } elseif (!$correcta_valida) {
        $motivo_huerfana = 'Campo "correcta" inválido';
    }
    
    if ($motivo_huerfana !== '') {
        $row['respuestas_validas'] = $respuestas_validas;
        $row['respuestas_invalidas'] = $respuestas_invalidas;
        $row['correcta_valida'] = $correcta_valida;
        $row['motivo'] = $motivo_huerfana;
        $huerfanas[] = $row;
    }
}

// Ocultar barra de progreso y mostrar completado
echo '<script>
document.getElementById("progress-bar").style.width = "100%";
document.getElementById("progress-bar").innerText = "100%";
document.getElementById("status").innerText = "✅ Análisis completado: ' . $total_preguntas . ' preguntas procesadas, ' . count($huerfanas) . ' huérfanas encontradas";
</script>';
if (function_exists('flush')) { flush(); }

echo '<div class="info">
    <strong>📊 Estadísticas:</strong><br>
    Total de preguntas analizadas: <strong>' . number_format($total_preguntas) . '</strong><br>
    Preguntas huérfanas encontradas: <strong style="color: ' . (count($huerfanas) > 0 ? 'red' : 'green') . '">' . count($huerfanas) . '</strong>
</div>';

if (count($huerfanas) > 0) {
    echo '<h2>🚫 Preguntas Huérfanas Encontradas</h2>';
    echo '<p>Estas preguntas tienen problemas y no pueden usarse en tests:</p>';
    echo '<table>
        <tr>
            <th>ID</th>
            <th>Pregunta (extracto)</th>
            <th>Correcta</th>
            <th>Proceso</th>
            <th>Resp. Válidas</th>
            <th>Motivo</th>
        </tr>';
    
    foreach ($huerfanas as $h) {
        $preguntaCorta = mb_substr($h['pregunta'] ?? 'N/A', 0, 50) . '...';
        $correctaCorta = mb_substr($h['correcta'] ?? 'N/A', 0, 30);
        $badgeClass = $h['correcta_valida'] ? '' : 'badge-0';
        
        echo '<tr class="orphan">
            <td>' . $h['id'] . '</td>
            <td>' . htmlspecialchars($preguntaCorta) . '</td>
            <td><code class="' . $badgeClass . '">' . htmlspecialchars($correctaCorta) . '</code></td>
            <td>' . $h['id_proceso'] . '</td>
            <td><span class="badge badge-' . min($h['respuestas_validas'], 1) . '">' . $h['respuestas_validas'] . '</span></td>
            <td>' . htmlspecialchars($h['motivo']) . '</td>
        </tr>';
    }
    echo '</table>';
    
    if ($ejecutar) {
        echo '<h2>🗑️ Ejecutando Limpieza...</h2>';
        
        $eliminadas = 0;
        $errores = 0;
        
        foreach ($huerfanas as $h) {
            $id = $h['id'];
            
            // Primero eliminar respuestas asociadas
            $deleteResp = "DELETE FROM respuestas WHERE id_pregunta = $id";
            $conn->query($deleteResp);
            
            // Luego eliminar la pregunta
            $deletePreg = "DELETE FROM preguntas WHERE id = $id";
            if ($conn->query($deletePreg)) {
                $eliminadas++;
            } else {
                $errores++;
                echo '<div class="error">❌ Error eliminando pregunta ID ' . $id . ': ' . $conn->error . '</div>';
            }
        }
        
        echo '<div class="success">
            <strong>✅ Limpieza Completada</strong><br>
            Preguntas eliminadas: <strong>' . $eliminadas . '</strong><br>
            Errores: <strong>' . $errores . '</strong>
        </div>';
        
        error_log("[limpiar_huerfanas] Limpieza ejecutada: $eliminadas preguntas eliminadas, $errores errores");
    } else {
        echo '<div class="warning">
            <strong>⚠️ Acción Requerida</strong><br>
            Se encontraron ' . count($huerfanas) . ' preguntas huérfanas que serán eliminadas junto con sus respuestas.<br>
            <a href="?ejecutar=1&clave=' . $CLAVE_SEGURIDAD . '" class="btn btn-danger" 
               onclick="return confirm(\'¿Estás seguro de eliminar ' . count($huerfanas) . ' preguntas huérfanas y sus respuestas?\')">
                🗑️ Ejecutar Limpieza
            </a>
        </div>';
    }
} else {
    echo '<div class="success">
        <strong>✅ Base de datos limpia</strong><br>
        No se encontraron preguntas huérfanas. Todas las preguntas tienen al menos 2 respuestas válidas.
    </div>';
}

echo '</div></body></html>';

$conn->close();
?>
