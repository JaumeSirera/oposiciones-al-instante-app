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
 *   - Con límite de procesamiento: limpiar_preguntas_huerfanas.php?limite=1000
 *   - Continuar desde ID: limpiar_preguntas_huerfanas.php?desde=12345
 */

header('Content-Type: text/html; charset=utf-8');
error_reporting(E_ALL);
ini_set('display_errors', 1);
set_time_limit(300); // 5 minutos máximo

require 'db.php';

// Clave de seguridad (cambiar antes de usar en producción)
$CLAVE_SEGURIDAD = 'limpiar2024';

$ejecutar = isset($_GET['ejecutar']) && $_GET['ejecutar'] == '1';
$clave = $_GET['clave'] ?? '';
$limite = isset($_GET['limite']) ? intval($_GET['limite']) : 0; // 0 = sin límite
$desde_id = isset($_GET['desde']) ? intval($_GET['desde']) : 0;

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
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
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
        .btn { display: inline-block; padding: 10px 20px; background: #1976d2; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; margin-right: 10px; }
        .btn-danger { background: #d32f2f; }
        .btn-success { background: #388e3c; }
        code { background: #eee; padding: 2px 6px; border-radius: 3px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
        .badge-0 { background: #f44336; color: white; }
        .badge-1 { background: #ff9800; color: white; }
        .progress-log { background: #263238; color: #b0bec5; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; max-height: 200px; overflow-y: auto; margin: 15px 0; }
        .progress-log .line { margin: 2px 0; }
        .progress-log .ok { color: #4caf50; }
        .progress-log .warn { color: #ff9800; }
        .progress-log .err { color: #f44336; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-box { background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-box .number { font-size: 24px; font-weight: bold; color: #1976d2; }
        .stat-box .label { font-size: 12px; color: #666; }
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

// Contar total de preguntas
$countQuery = "SELECT COUNT(*) as total FROM preguntas";
if ($desde_id > 0) {
    $countQuery = "SELECT COUNT(*) as total FROM preguntas WHERE id >= $desde_id";
}
$countResult = $conn->query($countQuery);
$totalCount = $countResult ? $countResult->fetch_assoc()['total'] : 0;

$procesarCount = ($limite > 0) ? min($limite, $totalCount) : $totalCount;

echo '<div class="info">
    <strong>📋 Configuración:</strong><br>
    Total de preguntas en BD: <strong>' . number_format($totalCount) . '</strong>';
if ($desde_id > 0) {
    echo '<br>Procesando desde ID: <strong>' . $desde_id . '</strong>';
}
if ($limite > 0) {
    echo '<br>Límite de procesamiento: <strong>' . number_format($limite) . '</strong> preguntas';
}
echo '</div>';

echo '<div class="progress-log" id="log">';
echo '<div class="line">🚀 Iniciando análisis...</div>';

$inicio = microtime(true);

// Buscar preguntas
$query = "SELECT p.id, p.pregunta, p.correcta, p.id_proceso, p.tema, p.seccion
          FROM preguntas p";
if ($desde_id > 0) {
    $query .= " WHERE p.id >= $desde_id";
}
$query .= " ORDER BY p.id ASC";
if ($limite > 0) {
    $query .= " LIMIT $limite";
}

$result = $conn->query($query);

if (!$result) {
    echo '<div class="line err">❌ Error en consulta: ' . $conn->error . '</div>';
    echo '</div>';
    exit;
}

$huerfanas = [];
$total_preguntas = 0;
$ultimo_id = 0;
$log_interval = max(100, intval($procesarCount / 20)); // Log cada 5%

while ($row = $result->fetch_assoc()) {
    $total_preguntas++;
    $id_pregunta = $row['id'];
    $ultimo_id = $id_pregunta;
    
    // Mostrar log cada cierto intervalo
    if ($total_preguntas % $log_interval == 0) {
        $pct = round(($total_preguntas / $procesarCount) * 100);
        $tiempo = round(microtime(true) - $inicio, 1);
        echo '<div class="line ok">[' . $pct . '%] Procesadas ' . number_format($total_preguntas) . ' preguntas (ID: ' . $id_pregunta . ') - ' . $tiempo . 's</div>';
    }
    
    // Obtener respuestas y contar válidas
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

$tiempo_total = round(microtime(true) - $inicio, 2);
echo '<div class="line ok">✅ Análisis completado en ' . $tiempo_total . ' segundos</div>';
echo '</div>';

// Estadísticas
echo '<div class="stats-grid">
    <div class="stat-box">
        <div class="number">' . number_format($total_preguntas) . '</div>
        <div class="label">Preguntas analizadas</div>
    </div>
    <div class="stat-box">
        <div class="number" style="color: ' . (count($huerfanas) > 0 ? '#d32f2f' : '#388e3c') . '">' . count($huerfanas) . '</div>
        <div class="label">Huérfanas encontradas</div>
    </div>
    <div class="stat-box">
        <div class="number">' . $tiempo_total . 's</div>
        <div class="label">Tiempo de análisis</div>
    </div>
    <div class="stat-box">
        <div class="number">' . round($total_preguntas / max(1, $tiempo_total)) . '</div>
        <div class="label">Preguntas/segundo</div>
    </div>
</div>';

// Si hay más preguntas por procesar, mostrar botón para continuar
if ($limite > 0 && $total_preguntas >= $limite) {
    $siguiente_id = $ultimo_id + 1;
    echo '<div class="warning">
        <strong>⏳ Procesamiento parcial</strong><br>
        Se procesaron ' . number_format($limite) . ' preguntas. Puede haber más pendientes.<br>
        <a href="?limite=' . $limite . '&desde=' . $siguiente_id . '" class="btn btn-success">
            ➡️ Continuar desde ID ' . $siguiente_id . '
        </a>
    </div>';
}

if (count($huerfanas) > 0) {
    echo '<h2>🚫 Preguntas Huérfanas Encontradas (' . count($huerfanas) . ')</h2>';
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
        echo '<div class="progress-log">';
        
        $eliminadas = 0;
        $errores = 0;
        
        foreach ($huerfanas as $h) {
            $id = $h['id'];
            
            $deleteResp = "DELETE FROM respuestas WHERE id_pregunta = $id";
            $conn->query($deleteResp);
            
            $deletePreg = "DELETE FROM preguntas WHERE id = $id";
            if ($conn->query($deletePreg)) {
                $eliminadas++;
                echo '<div class="line ok">✓ Eliminada pregunta ID ' . $id . '</div>';
            } else {
                $errores++;
                echo '<div class="line err">✗ Error ID ' . $id . ': ' . $conn->error . '</div>';
            }
        }
        
        echo '</div>';
        
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
            <a href="?ejecutar=1&clave=' . $CLAVE_SEGURIDAD . ($limite > 0 ? '&limite=' . $limite : '') . ($desde_id > 0 ? '&desde=' . $desde_id : '') . '" class="btn btn-danger" 
               onclick="return confirm(\'¿Estás seguro de eliminar ' . count($huerfanas) . ' preguntas huérfanas y sus respuestas?\')">
                🗑️ Ejecutar Limpieza
            </a>
        </div>';
    }
} else {
    echo '<div class="success">
        <strong>✅ Base de datos limpia</strong><br>
        No se encontraron preguntas huérfanas en este lote. Todas las preguntas tienen al menos 2 respuestas válidas.
    </div>';
}

echo '</div></body></html>';

$conn->close();
?>
