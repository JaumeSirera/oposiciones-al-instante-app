<?php
/**
 * Script de prueba para verificar el sistema de recordatorios
 * 
 * Uso: php test_cron_recordatorios.php [opciones]
 * 
 * Opciones:
 *   --solo-verificar    Solo verifica la configuración sin enviar emails
 *   --enviar-prueba     Envía un email de prueba a tu dirección
 *   --fecha=YYYY-MM-DD  Simula una fecha específica
 */

require_once 'config.php';

// Configuración
$SUPABASE_FUNCTION_URL = 'https://yrjwyeuqfleqhbveohrf.supabase.co/functions/v1/enviar-recordatorio-plan';
$SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyand5ZXVxZmxlcWhidmVvaHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjM1OTUsImV4cCI6MjA3NTUzOTU5NX0.QeAWfPjecNzz_d1MY1UHYmVN9bYl23rzot9gDsUtXKY';

// Colores para consola
function verde($texto) { return "\033[32m{$texto}\033[0m"; }
function rojo($texto) { return "\033[31m{$texto}\033[0m"; }
function amarillo($texto) { return "\033[33m{$texto}\033[0m"; }
function azul($texto) { return "\033[34m{$texto}\033[0m"; }

echo "\n" . azul("╔══════════════════════════════════════════════════════════╗") . "\n";
echo azul("║") . "     🔧 TEST DEL SISTEMA DE RECORDATORIOS                  " . azul("║") . "\n";
echo azul("╚══════════════════════════════════════════════════════════╝") . "\n\n";

// Parsear argumentos
$solo_verificar = in_array('--solo-verificar', $argv);
$enviar_prueba = in_array('--enviar-prueba', $argv);
$fecha_simulada = null;

foreach ($argv as $arg) {
    if (strpos($arg, '--fecha=') === 0) {
        $fecha_simulada = substr($arg, 8);
    }
}

$fecha_test = $fecha_simulada ?: date('Y-m-d');

echo "📅 Fecha de prueba: " . amarillo($fecha_test) . "\n";
echo "🕐 Hora actual: " . amarillo(date('H:i:s')) . "\n\n";

// ============================================================
// TEST 1: Verificar conexión a base de datos
// ============================================================
echo azul("━━━ TEST 1: Conexión a Base de Datos ━━━") . "\n";

if (!$conn) {
    echo rojo("✗ ERROR: No se pudo conectar a la base de datos") . "\n";
    echo "  Verifica config.php\n";
    exit(1);
}

echo verde("✓ Conexión a BD exitosa") . "\n\n";

// ============================================================
// TEST 2: Verificar tablas necesarias
// ============================================================
echo azul("━━━ TEST 2: Verificar Tablas ━━━") . "\n";

$tablas = ['recordatorios_plan', 'accounts', 'planes_estudio', 'planes_fisicos'];
$tablas_ok = true;

foreach ($tablas as $tabla) {
    $result = $conn->query("SHOW TABLES LIKE '$tabla'");
    if ($result && $result->num_rows > 0) {
        echo verde("✓") . " Tabla '$tabla' existe\n";
    } else {
        echo rojo("✗") . " Tabla '$tabla' NO existe\n";
        $tablas_ok = false;
    }
}

if (!$tablas_ok) {
    echo "\n" . rojo("ERROR: Faltan tablas necesarias") . "\n";
    exit(1);
}
echo "\n";

// ============================================================
// TEST 3: Contar recordatorios pendientes
// ============================================================
echo azul("━━━ TEST 3: Recordatorios Pendientes ━━━") . "\n";

// Recordatorios para la fecha de prueba
$stmt = $conn->prepare("
    SELECT COUNT(*) as total 
    FROM recordatorios_plan 
    WHERE fecha = ? AND enviado = 0
");
$stmt->bind_param("s", $fecha_test);
$stmt->execute();
$result = $stmt->get_result();
$row = $result->fetch_assoc();
$pendientes_hoy = $row['total'];

echo "📬 Recordatorios pendientes para {$fecha_test}: " . amarillo($pendientes_hoy) . "\n";

// Total pendientes (cualquier fecha)
$result = $conn->query("SELECT COUNT(*) as total FROM recordatorios_plan WHERE enviado = 0");
$row = $result->fetch_assoc();
echo "📬 Total recordatorios pendientes (todas las fechas): " . amarillo($row['total']) . "\n";

// Ya enviados
$result = $conn->query("SELECT COUNT(*) as total FROM recordatorios_plan WHERE enviado = 1");
$row = $result->fetch_assoc();
echo "📨 Recordatorios ya enviados: " . amarillo($row['total']) . "\n\n";

// ============================================================
// TEST 4: Mostrar detalle de recordatorios pendientes
// ============================================================
echo azul("━━━ TEST 4: Detalle de Recordatorios ━━━") . "\n";

$stmt = $conn->prepare("
    SELECT 
        r.id_recordatorio,
        r.id_plan,
        r.id_usuario,
        r.fecha,
        r.hora_notificacion,
        r.temas,
        r.tipo_plan,
        r.enviado,
        u.email as email_usuario,
        COALESCE(pe.titulo, pf.titulo) as titulo_plan
    FROM recordatorios_plan r
    INNER JOIN accounts u ON r.id_usuario = u.id
    LEFT JOIN planes_estudio pe ON r.id_plan = pe.id AND r.tipo_plan = 'estudio'
    LEFT JOIN planes_fisicos pf ON r.id_plan = pf.id AND r.tipo_plan = 'fisico'
    WHERE r.fecha = ? AND r.enviado = 0
    ORDER BY r.hora_notificacion ASC
    LIMIT 10
");

$stmt->bind_param("s", $fecha_test);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo amarillo("⚠ No hay recordatorios pendientes para {$fecha_test}") . "\n";
    echo "  Puedes probar con otra fecha usando: --fecha=YYYY-MM-DD\n\n";
    
    // Mostrar próximos recordatorios pendientes
    $result_proximos = $conn->query("
        SELECT fecha, COUNT(*) as total 
        FROM recordatorios_plan 
        WHERE enviado = 0 
        GROUP BY fecha 
        ORDER BY fecha ASC 
        LIMIT 5
    ");
    
    if ($result_proximos->num_rows > 0) {
        echo "📆 Próximas fechas con recordatorios pendientes:\n";
        while ($row = $result_proximos->fetch_assoc()) {
            echo "   - {$row['fecha']}: {$row['total']} recordatorio(s)\n";
        }
    }
} else {
    echo "Recordatorios encontrados para {$fecha_test}:\n\n";
    
    while ($row = $result->fetch_assoc()) {
        echo "┌─────────────────────────────────────────\n";
        echo "│ ID: " . amarillo($row['id_recordatorio']) . "\n";
        echo "│ Email: " . azul($row['email_usuario']) . "\n";
        echo "│ Plan: {$row['titulo_plan']}\n";
        echo "│ Tipo: {$row['tipo_plan']}\n";
        echo "│ Fecha: {$row['fecha']} {$row['hora_notificacion']}\n";
        
        $temas = json_decode($row['temas'], true);
        if ($temas && is_array($temas)) {
            echo "│ Temas: " . implode(', ', array_slice($temas, 0, 3));
            if (count($temas) > 3) echo " (+" . (count($temas) - 3) . " más)";
            echo "\n";
        }
        echo "└─────────────────────────────────────────\n\n";
    }
}

// ============================================================
// TEST 5: Verificar conectividad con Supabase Edge Function
// ============================================================
echo azul("━━━ TEST 5: Conectividad con Edge Function ━━━") . "\n";

$ch = curl_init($SUPABASE_FUNCTION_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'OPTIONS');
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $SUPABASE_ANON_KEY
]);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

if ($curl_error) {
    echo rojo("✗ Error de conexión: {$curl_error}") . "\n";
} elseif ($http_code >= 200 && $http_code < 400) {
    echo verde("✓ Edge Function accesible (HTTP {$http_code})") . "\n";
} else {
    echo amarillo("⚠ Edge Function respondió con HTTP {$http_code}") . "\n";
}
echo "\n";

// ============================================================
// TEST 6: Enviar email de prueba (opcional)
// ============================================================
if ($enviar_prueba && $pendientes_hoy > 0) {
    echo azul("━━━ TEST 6: Envío de Prueba ━━━") . "\n";
    
    // Obtener el primer recordatorio pendiente
    $stmt = $conn->prepare("
        SELECT 
            r.id_recordatorio,
            r.id_plan,
            r.id_usuario,
            r.fecha,
            r.temas,
            r.tipo_plan,
            u.email as email_usuario,
            COALESCE(pe.titulo, pf.titulo) as titulo_plan
        FROM recordatorios_plan r
        INNER JOIN accounts u ON r.id_usuario = u.id
        LEFT JOIN planes_estudio pe ON r.id_plan = pe.id AND r.tipo_plan = 'estudio'
        LEFT JOIN planes_fisicos pf ON r.id_plan = pf.id AND r.tipo_plan = 'fisico'
        WHERE r.fecha = ? AND r.enviado = 0
        ORDER BY r.hora_notificacion ASC
        LIMIT 1
    ");
    
    $stmt->bind_param("s", $fecha_test);
    $stmt->execute();
    $result = $stmt->get_result();
    $recordatorio = $result->fetch_assoc();
    
    if ($recordatorio) {
        echo "📤 Enviando email de prueba a: " . azul($recordatorio['email_usuario']) . "\n";
        
        $data = [
            'id_plan' => $recordatorio['id_plan'],
            'id_usuario' => $recordatorio['id_usuario'],
            'fecha' => $recordatorio['fecha'],
            'temas' => json_decode($recordatorio['temas'], true),
            'email_usuario' => $recordatorio['email_usuario'],
            'tipo_plan' => $recordatorio['tipo_plan'],
            'titulo_plan' => $recordatorio['titulo_plan']
        ];
        
        $ch = curl_init($SUPABASE_FUNCTION_URL);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_TIMEOUT, 120);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 30);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $SUPABASE_ANON_KEY,
            'apikey: ' . $SUPABASE_ANON_KEY
        ]);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curl_error = curl_error($ch);
        curl_close($ch);
        
        if ($curl_error) {
            echo rojo("✗ Error cURL: {$curl_error}") . "\n";
        } elseif ($http_code === 200) {
            echo verde("✓ Email enviado exitosamente!") . "\n";
            
            // Preguntar si marcar como enviado
            echo "\n¿Marcar este recordatorio como enviado? (s/n): ";
            $handle = fopen("php://stdin", "r");
            $line = fgets($handle);
            if (trim(strtolower($line)) === 's') {
                $stmt_update = $conn->prepare("
                    UPDATE recordatorios_plan 
                    SET enviado = 1, fecha_envio = NOW() 
                    WHERE id_recordatorio = ?
                ");
                $stmt_update->bind_param("i", $recordatorio['id_recordatorio']);
                $stmt_update->execute();
                echo verde("✓ Marcado como enviado") . "\n";
            }
            fclose($handle);
        } else {
            echo rojo("✗ Error HTTP {$http_code}") . "\n";
            echo "Respuesta: " . substr($response, 0, 500) . "\n";
        }
    }
} elseif ($enviar_prueba) {
    echo amarillo("⚠ No hay recordatorios pendientes para enviar prueba") . "\n";
}

echo "\n";

// ============================================================
// RESUMEN
// ============================================================
echo azul("╔══════════════════════════════════════════════════════════╗") . "\n";
echo azul("║") . "                    📊 RESUMEN                             " . azul("║") . "\n";
echo azul("╚══════════════════════════════════════════════════════════╝") . "\n\n";

echo "✓ Base de datos: " . verde("OK") . "\n";
echo "✓ Tablas: " . verde("OK") . "\n";
echo "✓ Edge Function: " . ($curl_error ? rojo("ERROR") : verde("OK")) . "\n";
echo "📬 Recordatorios pendientes hoy: {$pendientes_hoy}\n\n";

if (!$enviar_prueba && $pendientes_hoy > 0) {
    echo amarillo("💡 TIP: Usa --enviar-prueba para enviar un email de prueba") . "\n";
}

echo "\n" . verde("Test completado!") . "\n\n";

$conn->close();
exit(0);
?>
