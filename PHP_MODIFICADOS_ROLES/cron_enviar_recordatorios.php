<?php
/**
 * Cron Job para enviar recordatorios diarios de planes de estudio y físicos
 * 
 * Configurar en cPanel o crontab para ejecutar diariamente:
 * 0 8 * * * /usr/bin/php /ruta/a/tu/api/cron_enviar_recordatorios.php
 * 
 * Esto ejecutará el script todos los días a las 8:00 AM
 * 
 * ACTUALIZADO: Incluye reintentos, mejor manejo de timeouts y logging detallado
 */

require_once 'config.php';

// Configuración
$SUPABASE_FUNCTION_URL = 'https://yrjwyeuqfleqhbveohrf.supabase.co/functions/v1/enviar-recordatorio-plan';
$SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyand5ZXVxZmxlcWhidmVvaHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjM1OTUsImV4cCI6MjA3NTUzOTU5NX0.QeAWfPjecNzz_d1MY1UHYmVN9bYl23rzot9gDsUtXKY';

// Configuración de reintentos y timeouts
$MAX_RETRIES = 3;
$CURL_TIMEOUT = 120; // 2 minutos
$CURL_CONNECT_TIMEOUT = 30;
$RETRY_DELAY = 5; // segundos entre reintentos

// Función de logging
function cron_log($message, $level = 'INFO') {
    $timestamp = date('Y-m-d H:i:s');
    echo "[{$timestamp}] [{$level}] {$message}\n";
    error_log("[CRON_RECORDATORIOS][{$level}] {$message}");
}

// Función para enviar recordatorio con reintentos
function enviar_recordatorio_con_reintentos($url, $data, $apiKey, $maxRetries, $timeout, $connectTimeout, $retryDelay) {
    $lastError = null;
    
    for ($intento = 1; $intento <= $maxRetries; $intento++) {
        cron_log("Intento {$intento}/{$maxRetries} para enviar recordatorio id_plan={$data['id_plan']}", 'DEBUG');
        
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => $connectTimeout,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey,
                'apikey: ' . $apiKey
            ],
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_FOLLOWLOCATION => true
        ]);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curl_error = curl_error($ch);
        $curl_errno = curl_errno($ch);
        curl_close($ch);
        
        // Si hay error de cURL
        if ($curl_errno !== 0) {
            $lastError = "cURL error ({$curl_errno}): {$curl_error}";
            cron_log($lastError, 'WARN');
            
            if ($intento < $maxRetries) {
                cron_log("Esperando {$retryDelay}s antes de reintentar...", 'DEBUG');
                sleep($retryDelay);
                continue;
            }
            return ['success' => false, 'error' => $lastError, 'http_code' => 0];
        }
        
        // Si la respuesta es exitosa (2xx)
        if ($http_code >= 200 && $http_code < 300) {
            return ['success' => true, 'response' => $response, 'http_code' => $http_code];
        }
        
        // Si es un error del servidor (5xx), reintentar
        if ($http_code >= 500 && $intento < $maxRetries) {
            $lastError = "HTTP {$http_code}: {$response}";
            cron_log("Error del servidor ({$http_code}), reintentando...", 'WARN');
            sleep($retryDelay);
            continue;
        }
        
        // Error del cliente (4xx) o último intento fallido
        return ['success' => false, 'error' => "HTTP {$http_code}", 'response' => $response, 'http_code' => $http_code];
    }
    
    return ['success' => false, 'error' => $lastError ?: 'Max retries exceeded', 'http_code' => 0];
}

cron_log("=== INICIANDO ENVÍO DE RECORDATORIOS DIARIOS ===");
cron_log("Fecha actual: " . date('Y-m-d H:i:s'));

try {
    // Verificar conexión a base de datos
    if (!$conn || $conn->connect_error) {
        throw new Exception("Error de conexión a base de datos: " . ($conn ? $conn->connect_error : 'conexión nula'));
    }
    cron_log("Conexión a base de datos OK");
    
    // Obtener recordatorios pendientes del día
    $fecha_hoy = date('Y-m-d');
    cron_log("Buscando recordatorios para fecha: {$fecha_hoy}");
    
    $stmt = $conn->prepare("
        SELECT 
            r.id_recordatorio,
            r.id_plan,
            r.id_usuario,
            r.fecha,
            r.temas,
            r.tipo_plan,
            r.hora_notificacion,
            u.email as email_usuario,
            COALESCE(pe.titulo, pf.titulo) as titulo_plan
        FROM recordatorios_plan r
        INNER JOIN accounts u ON r.id_usuario = u.id
        LEFT JOIN planes_estudio pe ON r.id_plan = pe.id AND r.tipo_plan = 'estudio'
        LEFT JOIN planes_fisicos pf ON r.id_plan = pf.id AND r.tipo_plan = 'fisico'
        WHERE r.fecha = ? 
        AND r.enviado = 0
        ORDER BY r.hora_notificacion ASC, r.fecha ASC
    ");
    
    if (!$stmt) {
        throw new Exception("Error preparando query: " . $conn->error);
    }
    
    $stmt->bind_param("s", $fecha_hoy);
    
    if (!$stmt->execute()) {
        throw new Exception("Error ejecutando query: " . $stmt->error);
    }
    
    $result = $stmt->get_result();
    
    $recordatorios = [];
    while ($row = $result->fetch_assoc()) {
        // Decodificar temas JSON
        $temas_decoded = json_decode($row['temas'], true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            cron_log("Warning: Error decodificando temas para recordatorio {$row['id_recordatorio']}: " . json_last_error_msg(), 'WARN');
            $temas_decoded = [];
        }
        $row['temas'] = $temas_decoded;
        $recordatorios[] = $row;
    }
    $stmt->close();
    
    $total = count($recordatorios);
    cron_log("Recordatorios pendientes encontrados: {$total}");
    
    if ($total === 0) {
        cron_log("No hay recordatorios para enviar hoy. Finalizando.");
        $conn->close();
        exit(0);
    }
    
    $enviados = 0;
    $errores = 0;
    $errores_detalle = [];
    
    // Procesar cada recordatorio
    foreach ($recordatorios as $index => $recordatorio) {
        $progreso = ($index + 1) . "/{$total}";
        $tipo = $recordatorio['tipo_plan'] ?? 'estudio';
        
        cron_log("[{$progreso}] Procesando recordatorio:");
        cron_log("  - ID: {$recordatorio['id_recordatorio']}");
        cron_log("  - Email: {$recordatorio['email_usuario']}");
        cron_log("  - Plan: {$recordatorio['titulo_plan']} (tipo: {$tipo})");
        cron_log("  - Fecha: {$recordatorio['fecha']}");
        
        // Validar que el email existe
        if (empty($recordatorio['email_usuario'])) {
            cron_log("  ✗ Error: Email vacío para usuario {$recordatorio['id_usuario']}", 'ERROR');
            $errores++;
            $errores_detalle[] = "Recordatorio {$recordatorio['id_recordatorio']}: email vacío";
            continue;
        }
        
        // Preparar datos para la Edge Function
        $data = [
            'id_plan' => (int)$recordatorio['id_plan'],
            'id_usuario' => (int)$recordatorio['id_usuario'],
            'fecha' => $recordatorio['fecha'],
            'temas' => $recordatorio['temas'],
            'email_usuario' => $recordatorio['email_usuario'],
            'tipo_plan' => $tipo,
            'titulo_plan' => $recordatorio['titulo_plan']
        ];
        
        // Enviar con reintentos
        $resultado = enviar_recordatorio_con_reintentos(
            $SUPABASE_FUNCTION_URL,
            $data,
            $SUPABASE_ANON_KEY,
            $MAX_RETRIES,
            $CURL_TIMEOUT,
            $CURL_CONNECT_TIMEOUT,
            $RETRY_DELAY
        );
        
        if ($resultado['success']) {
            cron_log("  ✓ Email enviado exitosamente (HTTP {$resultado['http_code']})");
            $enviados++;
            
            // Marcar como enviado en la base de datos
            $stmt_update = $conn->prepare("
                UPDATE recordatorios_plan 
                SET enviado = 1, fecha_envio = NOW() 
                WHERE id_recordatorio = ?
            ");
            
            if ($stmt_update) {
                $stmt_update->bind_param("i", $recordatorio['id_recordatorio']);
                if (!$stmt_update->execute()) {
                    cron_log("  Warning: No se pudo marcar como enviado: " . $stmt_update->error, 'WARN');
                }
                $stmt_update->close();
            }
        } else {
            $error_msg = $resultado['error'] ?? 'Error desconocido';
            $response = $resultado['response'] ?? '';
            
            cron_log("  ✗ Error al enviar: {$error_msg}", 'ERROR');
            if ($response) {
                cron_log("  Respuesta: " . substr($response, 0, 500), 'DEBUG');
            }
            
            $errores++;
            $errores_detalle[] = "Recordatorio {$recordatorio['id_recordatorio']}: {$error_msg}";
        }
        
        // Pausa entre envíos para no saturar (excepto el último)
        if ($index < $total - 1) {
            sleep(1);
        }
    }
    
    // Resumen final
    cron_log("=== RESUMEN DE EJECUCIÓN ===");
    cron_log("Total procesados: {$total}");
    cron_log("Enviados exitosamente: {$enviados}");
    cron_log("Errores: {$errores}");
    
    if (!empty($errores_detalle)) {
        cron_log("Detalle de errores:");
        foreach ($errores_detalle as $detalle) {
            cron_log("  - {$detalle}", 'ERROR');
        }
    }
    
    cron_log("=== FINALIZADO: " . date('Y-m-d H:i:s') . " ===");
    
    $conn->close();
    
    // Código de salida basado en resultado
    if ($errores > 0 && $enviados === 0) {
        exit(1); // Todos fallaron
    } elseif ($errores > 0) {
        exit(2); // Algunos fallaron
    }
    exit(0); // Todos exitosos
    
} catch (Exception $e) {
    cron_log("ERROR CRÍTICO: " . $e->getMessage(), 'ERROR');
    cron_log("Trace: " . $e->getTraceAsString(), 'ERROR');
    
    if (isset($conn) && $conn) {
        $conn->close();
    }
    exit(1);
}
?>
