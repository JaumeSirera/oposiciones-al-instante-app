<?php
/**
 * ARCHIVO: planes_estudio.php
 * 
 * INSTRUCCIONES:
 * Este archivo añade la acción 'listar_todos' para que usuarios SA puedan
 * ver todos los planes de estudio de todos los usuarios.
 * 
 * Debes añadir el siguiente bloque de código después de la acción 'listar' existente
 * en tu archivo planes_estudio.php del servidor.
 */

/*
==============================================================================
CÓDIGO A AÑADIR - Acción listar_todos para SA
==============================================================================

Añade este bloque DESPUÉS de la acción 'listar' en tu planes_estudio.php:

*/

// ===================== LISTAR TODOS (SOLO SA) =====================
// Añadir después de la acción 'listar' existente

/*
if ($method === 'GET' && $action === 'listar_todos') {
    // Verificar que el usuario es SA (Super Admin)
    $nivel = $payload['nivel'] ?? '';
    if ($nivel !== 'SA') {
        echo json_encode(['success'=>false, 'error'=>'No autorizado. Solo SA puede ver todos los planes.']);
        exit;
    }

    try {
        // Obtener TODOS los planes de estudio con información del usuario
        $stmt = $conn->prepare("
            SELECT pe.*, a.username as usuario_nombre, a.email as usuario_email,
                   p.descripcion as proceso_nombre
            FROM planes_estudio pe
            LEFT JOIN accounts a ON pe.id_usuario = a.id
            LEFT JOIN procesos p ON pe.id_proceso = p.id
            ORDER BY pe.fecha_inicio DESC
        ");
        $stmt->execute();
        $res = $stmt->get_result();
        $planes = [];
        
        while ($row = $res->fetch_assoc()) {
            $plan_id = intval($row['id']);
            $uid = intval($row['id_usuario']);
            
            // Calcular progreso basado en tareas completadas
            $stmtTareas = $conn->prepare("
                SELECT COUNT(*) as total, SUM(CASE WHEN completada = 1 THEN 1 ELSE 0 END) as completadas
                FROM tareas_plan
                WHERE id_etapa IN (SELECT id FROM etapas_plan WHERE id_plan = ?)
            ");
            $stmtTareas->bind_param("i", $plan_id);
            $stmtTareas->execute();
            $resTareas = $stmtTareas->get_result();
            $tareas = $resTareas->fetch_assoc();
            $stmtTareas->close();
            
            $total = intval($tareas['total'] ?? 0);
            $completadas = intval($tareas['completadas'] ?? 0);
            $row['progreso'] = $total > 0 ? round(($completadas / $total) * 100, 2) : 0;
            
            // Verificar si tiene plan IA
            $stmtIA = $conn->prepare("SELECT COUNT(*) as cnt FROM planes_estudio_ia WHERE id_plan = ?");
            $stmtIA->bind_param("i", $plan_id);
            $stmtIA->execute();
            $resIA = $stmtIA->get_result();
            $cntIA = $resIA->fetch_assoc()['cnt'] ?? 0;
            $stmtIA->close();
            
            $row['tieneIA'] = $cntIA > 0;
            $row['total_sesiones'] = $total;
            
            $planes[] = $row;
        }
        
        echo json_encode(['success'=>true, 'planes'=>$planes], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        error_log("listar_todos planes_estudio error: ".$e->getMessage());
        echo json_encode(['success'=>false, 'error'=>'Error listando todos los planes de estudio']);
    }
    exit;
}
*/

/*
==============================================================================
NOTAS IMPORTANTES:
==============================================================================

1. El código anterior verifica que el usuario tenga nivel 'SA' antes de mostrar
   todos los planes.

2. Incluye información adicional:
   - usuario_nombre: nombre del usuario propietario del plan
   - usuario_email: email del usuario
   - proceso_nombre: nombre del proceso/oposición asociado

3. Calcula el progreso basado en las tareas completadas de cada plan.

4. Verifica si el plan tiene contenido generado por IA.

5. Asegúrate de que la tabla 'accounts' existe y tiene los campos 'username' y 'email'.

6. Ajusta los nombres de tablas según tu estructura de base de datos si es necesario:
   - planes_estudio
   - etapas_plan  
   - tareas_plan
   - planes_estudio_ia
   - accounts
   - procesos

*/
?>
