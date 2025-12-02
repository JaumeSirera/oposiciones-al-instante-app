<?php
/**
 * Script de prueba para verificar el sistema de recordatorios
 * 
 * USO VÍA NAVEGADOR:
 * https://oposiciones-test.com/api/test_cron_recordatorios.php
 * https://oposiciones-test.com/api/test_cron_recordatorios.php?fecha=2025-01-15
 * https://oposiciones-test.com/api/test_cron_recordatorios.php?enviar=1&clave=TU_CLAVE
 * 
 * PARÁMETROS:
 *   fecha=YYYY-MM-DD  Simula una fecha específica
 *   enviar=1          Envía un email de prueba al primer recordatorio pendiente
 *   marcar=1          Marca el recordatorio como enviado después de enviar
 *   clave=XXX         Clave de seguridad (requerida para enviar)
 */

// ============================================================
// CONFIGURACIÓN DE SEGURIDAD - CAMBIA ESTA CLAVE
// ============================================================
$CLAVE_SEGURIDAD = 'test_cron_2024_secreto';

// Verificar clave si se va a enviar email
if (isset($_GET['enviar']) && $_GET['enviar'] == '1') {
    if (!isset($_GET['clave']) || $_GET['clave'] !== $CLAVE_SEGURIDAD) {
        header('Content-Type: text/html; charset=utf-8');
        echo "<h2>❌ Error de seguridad</h2>";
        echo "<p>Debes proporcionar la clave correcta para enviar emails.</p>";
        echo "<p>Ejemplo: ?enviar=1&clave=tu_clave_secreta</p>";
        exit(1);
    }
}

require_once 'config.php';

$SUPABASE_FUNCTION_URL = 'https://yrjwyeuqfleqhbveohrf.supabase.co/functions/v1/enviar-recordatorio-plan';
$SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyand5ZXVxZmxlcWhidmVvaHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjM1OTUsImV4cCI6MjA3NTUzOTU5NX0.QeAWfPjecNzz_d1MY1UHYmVN9bYl23rzot9gDsUtXKY';

$fecha_simulada = isset($_GET['fecha']) ? $_GET['fecha'] : null;
$enviar_prueba = isset($_GET['enviar']) && $_GET['enviar'] == '1';
$fecha_test = $fecha_simulada ?: date('Y-m-d');

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Sistema de Recordatorios</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #eee; }
        .header { background: linear-gradient(135deg, #667eea, #764ba2); padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 1.5em; }
        .section { background: #16213e; padding: 15px 20px; border-radius: 8px; margin-bottom: 15px; }
        .section h2 { margin-top: 0; color: #667eea; font-size: 1.1em; border-bottom: 1px solid #333; padding-bottom: 10px; }
        .success { color: #4ade80; } .error { color: #f87171; } .warning { color: #fbbf24; } .info { color: #60a5fa; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.85em; font-weight: bold; }
        .badge-success { background: #166534; color: #4ade80; }
        .badge-error { background: #7f1d1d; color: #f87171; }
        .badge-warning { background: #78350f; color: #fbbf24; }
        .recordatorio { background: #0f172a; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #667eea; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
        .summary-item { background: #0f172a; padding: 15px; border-radius: 8px; text-align: center; }
        .summary-item .value { font-size: 2em; font-weight: bold; color: #667eea; }
        .summary-item .label { font-size: 0.85em; color: #94a3b8; }
        .btn { display: inline-block; padding: 10px 20px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; border-radius: 5px; margin: 5px; font-weight: bold; }
        .btn:hover { opacity: 0.9; }
        .btn-danger { background: linear-gradient(135deg, #dc2626, #991b1b); }
        .actions { text-align: center; margin: 20px 0; }
        pre { background: #0f172a; padding: 10px; border-radius: 5px; overflow-x: auto; font-size: 0.85em; }
        a { color: #667eea; }
    </style>
</head>
<body>

<div class="header">
    <h1>🔧 Test del Sistema de Recordatorios</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Verificación vía navegador</p>
</div>

<div class="section">
    <h2>📅 Información</h2>
    <p><strong>Fecha de prueba:</strong> <span class="info"><?= htmlspecialchars($fecha_test) ?></span></p>
    <p><strong>Hora actual:</strong> <span class="info"><?= date('H:i:s') ?></span></p>
    <p><strong>Modo:</strong> 
        <?php if ($enviar_prueba): ?>
            <span class="badge badge-warning">⚠️ ENVÍO ACTIVO</span>
        <?php else: ?>
            <span class="badge badge-success">✓ Solo verificación</span>
        <?php endif; ?>
    </p>
</div>

<div class="section">
    <h2>🔌 Conexión a Base de Datos</h2>
    <?php if (!$conn): ?>
        <p class="error">✗ ERROR: No se pudo conectar</p>
        <?php exit(1); ?>
    <?php else: ?>
        <p class="success">✓ Conexión exitosa</p>
    <?php endif; ?>
</div>

<?php
// Contar recordatorios
$stmt = $conn->prepare("SELECT COUNT(*) as total FROM recordatorios_plan WHERE fecha = ? AND enviado = 0");
$stmt->bind_param("s", $fecha_test);
$stmt->execute();
$pendientes_hoy = $stmt->get_result()->fetch_assoc()['total'];

$pendientes_total = $conn->query("SELECT COUNT(*) as total FROM recordatorios_plan WHERE enviado = 0")->fetch_assoc()['total'];
$enviados_total = $conn->query("SELECT COUNT(*) as total FROM recordatorios_plan WHERE enviado = 1")->fetch_assoc()['total'];
?>

<div class="section">
    <h2>📊 Estadísticas</h2>
    <div class="summary">
        <div class="summary-item"><div class="value"><?= $pendientes_hoy ?></div><div class="label">Pendientes hoy</div></div>
        <div class="summary-item"><div class="value"><?= $pendientes_total ?></div><div class="label">Total pendientes</div></div>
        <div class="summary-item"><div class="value"><?= $enviados_total ?></div><div class="label">Ya enviados</div></div>
    </div>
</div>

<div class="section">
    <h2>📬 Recordatorios Pendientes</h2>
    <?php
    $stmt = $conn->prepare("
        SELECT r.id_recordatorio, r.id_plan, r.id_usuario, r.fecha, r.hora_notificacion, r.temas, r.tipo_plan,
               u.email as email_usuario, COALESCE(pe.titulo, pf.titulo) as titulo_plan
        FROM recordatorios_plan r
        INNER JOIN accounts u ON r.id_usuario = u.id
        LEFT JOIN planes_estudio pe ON r.id_plan = pe.id AND r.tipo_plan = 'estudio'
        LEFT JOIN planes_fisicos pf ON r.id_plan = pf.id AND r.tipo_plan = 'fisico'
        WHERE r.fecha = ? AND r.enviado = 0
        ORDER BY r.hora_notificacion ASC LIMIT 10
    ");
    $stmt->bind_param("s", $fecha_test);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0):
    ?>
        <p class="warning">⚠ No hay recordatorios para <?= htmlspecialchars($fecha_test) ?></p>
        <?php
        $proximos = $conn->query("SELECT fecha, COUNT(*) as total FROM recordatorios_plan WHERE enviado = 0 GROUP BY fecha ORDER BY fecha ASC LIMIT 5");
        if ($proximos->num_rows > 0): ?>
        <p><strong>📆 Próximas fechas:</strong></p>
        <ul>
        <?php while ($row = $proximos->fetch_assoc()): ?>
            <li><a href="?fecha=<?= $row['fecha'] ?>"><?= $row['fecha'] ?></a> - <?= $row['total'] ?> recordatorio(s)</li>
        <?php endwhile; ?>
        </ul>
        <?php endif; ?>
    <?php else: 
        $primer_recordatorio = null;
        while ($row = $result->fetch_assoc()): 
            if (!$primer_recordatorio) $primer_recordatorio = $row;
            $temas = json_decode($row['temas'], true);
    ?>
        <div class="recordatorio">
            <p><strong>ID:</strong> <?= $row['id_recordatorio'] ?> | 
               <span class="badge badge-<?= $row['tipo_plan'] === 'estudio' ? 'success' : 'warning' ?>"><?= ucfirst($row['tipo_plan']) ?></span></p>
            <p><strong>📧</strong> <?= htmlspecialchars($row['email_usuario']) ?></p>
            <p><strong>📚</strong> <?= htmlspecialchars($row['titulo_plan']) ?></p>
            <p><strong>📅</strong> <?= $row['fecha'] ?> <?= $row['hora_notificacion'] ?></p>
        </div>
    <?php endwhile; endif; ?>
</div>

<?php
// Test Edge Function
$ch = curl_init($SUPABASE_FUNCTION_URL);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => 'OPTIONS', CURLOPT_TIMEOUT => 10, CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $SUPABASE_ANON_KEY]]);
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);
?>

<div class="section">
    <h2>🌐 Conectividad Edge Function</h2>
    <?php if ($curl_error): ?>
        <p class="error">✗ Error: <?= htmlspecialchars($curl_error) ?></p>
    <?php elseif ($http_code >= 200 && $http_code < 400): ?>
        <p class="success">✓ Accesible (HTTP <?= $http_code ?>)</p>
    <?php else: ?>
        <p class="warning">⚠ HTTP <?= $http_code ?></p>
    <?php endif; ?>
</div>

<?php if ($enviar_prueba && isset($primer_recordatorio)): ?>
<div class="section">
    <h2>📤 Envío de Prueba</h2>
    <?php
    $temas_decoded = json_decode($primer_recordatorio['temas'], true);
    $data = [
        'id_plan' => $primer_recordatorio['id_plan'],
        'id_usuario' => $primer_recordatorio['id_usuario'],
        'fecha' => $primer_recordatorio['fecha'],
        'temas' => $temas_decoded,
        'email_usuario' => $primer_recordatorio['email_usuario'],
        'tipo_plan' => $primer_recordatorio['tipo_plan'],
        'titulo_plan' => $primer_recordatorio['titulo_plan']
    ];
    
    $ch = curl_init($SUPABASE_FUNCTION_URL);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_TIMEOUT => 120, CURLOPT_CONNECTTIMEOUT => 30,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $SUPABASE_ANON_KEY, 'apikey: ' . $SUPABASE_ANON_KEY]]);
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    curl_close($ch);
    
    if ($curl_error): ?>
        <p class="error">✗ Error: <?= htmlspecialchars($curl_error) ?></p>
    <?php elseif ($http_code === 200): ?>
        <p class="success">✓ ¡Email enviado a <?= htmlspecialchars($primer_recordatorio['email_usuario']) ?>!</p>
        <?php if (isset($_GET['marcar']) && $_GET['marcar'] == '1'): 
            $stmt_update = $conn->prepare("UPDATE recordatorios_plan SET enviado = 1, fecha_envio = NOW() WHERE id_recordatorio = ?");
            $stmt_update->bind_param("i", $primer_recordatorio['id_recordatorio']);
            $stmt_update->execute();
        ?>
            <p class="success">✓ Marcado como enviado</p>
        <?php else: ?>
            <p class="warning">⚠ NO marcado como enviado (añade &marcar=1 para marcarlo)</p>
        <?php endif; ?>
    <?php else: ?>
        <p class="error">✗ Error HTTP <?= $http_code ?></p>
        <pre><?= htmlspecialchars(substr($response, 0, 500)) ?></pre>
    <?php endif; ?>
</div>
<?php endif; ?>

<div class="actions">
    <a href="?fecha=<?= date('Y-m-d') ?>" class="btn">🔄 Hoy</a>
    <a href="?fecha=<?= date('Y-m-d', strtotime('+1 day')) ?>" class="btn">📅 Mañana</a>
    <?php if ($pendientes_hoy > 0 && !$enviar_prueba): ?>
        <a href="?fecha=<?= htmlspecialchars($fecha_test) ?>&enviar=1&clave=<?= $CLAVE_SEGURIDAD ?>" class="btn btn-danger" 
           onclick="return confirm('¿Enviar email de prueba?');">📧 Enviar Prueba</a>
    <?php endif; ?>
</div>

<div class="section" style="text-align: center; opacity: 0.7; font-size: 0.9em;">
    <p>💡 Cambia <code>$CLAVE_SEGURIDAD</code> en el script por tu propia clave</p>
    <p>⏰ <?= date('Y-m-d H:i:s') ?></p>
</div>

</body>
</html>
<?php $conn->close(); ?>
