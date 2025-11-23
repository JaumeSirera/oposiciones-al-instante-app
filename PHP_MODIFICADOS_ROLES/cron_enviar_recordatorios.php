<?php
/**
 * Cron Job para enviar recordatorios diarios de planes de estudio
 * 
 * Configurar en cPanel o crontab para ejecutar diariamente:
 * 0 8 * * * /usr/bin/php /ruta/a/tu/api/cron_enviar_recordatorios.php
 * 
 * Esto ejecutará el script todos los días a las 8:00 AM
 */

require_once 'config.php';

// URL de tu Edge Function de Supabase
$SUPABASE_FUNCTION_URL = 'https://yrjwyeuqfleqhbveohrf.supabase.co/functions/v1/enviar-recordatorio-plan';
$SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyand5ZXVxZmxlcWhidmVvaHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjM1OTUsImV4cCI6MjA3NTUzOTU5NX0.QeAWfPjecNzz_d1MY1UHYmVN9bYl23rzot9gDsUtXKY';

echo "=== Iniciando envío de recordatorios diarios ===\n";
echo "Fecha: " . date('Y-m-d H:i:s') . "\n\n";

try {
    // Obtener recordatorios pendientes del día
    $fecha_hoy = date('Y-m-d');
    
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
        WHERE r.fecha = ? 
        AND r.enviado = 0
        ORDER BY r.fecha ASC
    ");
    
    $stmt->bind_param("s", $fecha_hoy);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $recordatorios = [];
    while ($row = $result->fetch_assoc()) {
        $row['temas'] = json_decode($row['temas'], true);
        $recordatorios[] = $row;
    }
    
    echo "Recordatorios pendientes encontrados: " . count($recordatorios) . "\n\n";
    
    if (empty($recordatorios)) {
        echo "No hay recordatorios para enviar hoy.\n";
        exit(0);
    }
    
    $enviados = 0;
    $errores = 0;
    
    // Enviar cada recordatorio
    foreach ($recordatorios as $recordatorio) {
        echo "Enviando recordatorio para: {$recordatorio['email_usuario']} - Plan: {$recordatorio['titulo_plan']}\n";
        
        // Llamar a la Edge Function de Supabase
        $data = [
            'id_plan' => $recordatorio['id_plan'],
            'id_usuario' => $recordatorio['id_usuario'],
            'fecha' => $recordatorio['fecha'],
            'temas' => $recordatorio['temas'],
            'email_usuario' => $recordatorio['email_usuario'],
            'tipo_plan' => $recordatorio['tipo_plan']
        ];
        
        $ch = curl_init($SUPABASE_FUNCTION_URL);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $SUPABASE_ANON_KEY,
            'apikey: ' . $SUPABASE_ANON_KEY
        ]);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($http_code === 200) {
            echo "✓ Email enviado exitosamente\n";
            $enviados++;
            
            // Marcar como enviado en la base de datos
            $stmt_update = $conn->prepare("
                UPDATE recordatorios_plan 
                SET enviado = 1, fecha_envio = NOW() 
                WHERE id_recordatorio = ?
            ");
            $stmt_update->bind_param("i", $recordatorio['id_recordatorio']);
            $stmt_update->execute();
            
        } else {
            echo "✗ Error al enviar email. Código HTTP: {$http_code}\n";
            echo "Respuesta: {$response}\n";
            $errores++;
        }
        
        echo "\n";
        
        // Pequeña pausa entre envíos para no saturar
        sleep(1);
    }
    
    echo "=== Resumen ===\n";
    echo "Total procesados: " . count($recordatorios) . "\n";
    echo "Enviados exitosamente: {$enviados}\n";
    echo "Errores: {$errores}\n";
    echo "Finalizado: " . date('Y-m-d H:i:s') . "\n";
    
} catch (Exception $e) {
    echo "ERROR CRÍTICO: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
    exit(1);
}

$conn->close();
exit(0);
?>