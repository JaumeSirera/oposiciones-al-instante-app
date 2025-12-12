<?php
/**
 * Script para limpiar respuestas inválidas de la base de datos
 * Elimina respuestas que solo contienen caracteres especiales (., ), (, -, etc.)
 * Preserva respuestas con letras, números y decimales válidos
 * 
 * USO: 
 *   - Modo simulación (ver qué se eliminaría): limpiar_respuestas_invalidas.php
 *   - Modo ejecución real: limpiar_respuestas_invalidas.php?ejecutar=1
 *   - Con clave de seguridad: limpiar_respuestas_invalidas.php?ejecutar=1&clave=TU_CLAVE
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
    
    // Si tiene al menos una letra o dígito, es válida
    if (preg_match('/[a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛäëïöüÄËÏÖÜçÇ]/u', $s)) {
        return true;
    }
    
    return false;
}

echo '<!DOCTYPE html>
<html>
<head>
    <title>Limpieza de Respuestas Inválidas</title>
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
        .invalid { background: #ffebee; }
        .btn { display: inline-block; padding: 10px 20px; background: #1976d2; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
        .btn-danger { background: #d32f2f; }
        code { background: #eee; padding: 2px 6px; border-radius: 3px; }
    </style>
</head>
<body>
<div class="container">';

echo '<h1>🧹 Limpieza de Respuestas Inválidas</h1>';

if (!$ejecutar) {
    echo '<div class="info">
        <strong>ℹ️ Modo Simulación</strong><br>
        Este es un análisis previo. No se eliminará nada.<br>
        Para ejecutar la limpieza real, añade <code>?ejecutar=1&clave=' . $CLAVE_SEGURIDAD . '</code> a la URL.
    </div>';
}

// Buscar todas las respuestas
$query = "SELECT r.id, r.id_pregunta, r.respuesta, r.indice, p.pregunta 
          FROM respuestas r 
          LEFT JOIN preguntas p ON r.id_pregunta = p.id 
          ORDER BY r.id DESC";

$result = $conn->query($query);

if (!$result) {
    echo '<div class="error">❌ Error en consulta: ' . $conn->error . '</div>';
    exit;
}

$invalidas = [];
$total = 0;

while ($row = $result->fetch_assoc()) {
    $total++;
    if (!es_respuesta_valida($row['respuesta'])) {
        $invalidas[] = $row;
    }
}

echo '<div class="info">
    <strong>📊 Estadísticas:</strong><br>
    Total de respuestas analizadas: <strong>' . number_format($total) . '</strong><br>
    Respuestas inválidas encontradas: <strong style="color: ' . (count($invalidas) > 0 ? 'red' : 'green') . '">' . count($invalidas) . '</strong>
</div>';

if (count($invalidas) > 0) {
    echo '<h2>🚫 Respuestas Inválidas Encontradas</h2>';
    echo '<table>
        <tr>
            <th>ID Respuesta</th>
            <th>ID Pregunta</th>
            <th>Respuesta</th>
            <th>Índice</th>
            <th>Pregunta (extracto)</th>
        </tr>';
    
    foreach ($invalidas as $inv) {
        $preguntaCorta = mb_substr($inv['pregunta'] ?? 'N/A', 0, 80) . '...';
        $respuestaEscapada = htmlspecialchars($inv['respuesta']);
        echo '<tr class="invalid">
            <td>' . $inv['id'] . '</td>
            <td>' . $inv['id_pregunta'] . '</td>
            <td><code>' . $respuestaEscapada . '</code></td>
            <td>' . $inv['indice'] . '</td>
            <td>' . htmlspecialchars($preguntaCorta) . '</td>
        </tr>';
    }
    echo '</table>';
    
    if ($ejecutar) {
        echo '<h2>🗑️ Ejecutando Limpieza...</h2>';
        
        $eliminadas = 0;
        $errores = 0;
        
        foreach ($invalidas as $inv) {
            $deleteQuery = "DELETE FROM respuestas WHERE id = ?";
            $stmt = $conn->prepare($deleteQuery);
            $stmt->bind_param('i', $inv['id']);
            
            if ($stmt->execute()) {
                $eliminadas++;
            } else {
                $errores++;
                echo '<div class="error">❌ Error eliminando ID ' . $inv['id'] . ': ' . $stmt->error . '</div>';
            }
            $stmt->close();
        }
        
        echo '<div class="success">
            <strong>✅ Limpieza Completada</strong><br>
            Respuestas eliminadas: <strong>' . $eliminadas . '</strong><br>
            Errores: <strong>' . $errores . '</strong>
        </div>';
        
        error_log("[limpiar_respuestas] Limpieza ejecutada: $eliminadas eliminadas, $errores errores");
    } else {
        echo '<div class="warning">
            <strong>⚠️ Acción Requerida</strong><br>
            Se encontraron ' . count($invalidas) . ' respuestas inválidas.<br>
            <a href="?ejecutar=1&clave=' . $CLAVE_SEGURIDAD . '" class="btn btn-danger" 
               onclick="return confirm(\'¿Estás seguro de eliminar ' . count($invalidas) . ' respuestas inválidas?\')">
                🗑️ Ejecutar Limpieza
            </a>
        </div>';
    }
} else {
    echo '<div class="success">
        <strong>✅ Base de datos limpia</strong><br>
        No se encontraron respuestas inválidas.
    </div>';
}

echo '</div></body></html>';

$conn->close();
?>
