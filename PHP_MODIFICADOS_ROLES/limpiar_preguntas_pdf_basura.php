<?php
/**
 * Limpia preguntas generadas con basura de PDF (endobj, stream, ToUnicode, etc.)
 * y preguntas con texto sin sentido.
 *
 * USO:
 *   Simulación:  limpiar_preguntas_pdf_basura.php
 *   Ejecutar:    limpiar_preguntas_pdf_basura.php?ejecutar=1&clave=limpiar2024
 *   Filtros:     &id_proceso=123  &id_usuario=45  &desde=2025-01-01
 *   Batching:    &limite=500  &desde_id=12000   (evita timeouts)
 */

header('Content-Type: text/html; charset=utf-8');
header('X-Accel-Buffering: no');
error_reporting(E_ALL);
ini_set('display_errors', 1);
set_time_limit(0);
ini_set('max_execution_time', 0);
@ini_set('output_buffering', 'off');
@ini_set('zlib.output_compression', 0);
while (ob_get_level() > 0) { ob_end_flush(); }
ob_implicit_flush(true);

require 'db.php';

$CLAVE = 'limpiar2024';
$ejecutar   = isset($_GET['ejecutar']) && $_GET['ejecutar'] == '1';
$clave      = $_GET['clave'] ?? '';
$id_proceso = isset($_GET['id_proceso']) ? intval($_GET['id_proceso']) : 0;
$id_usuario = isset($_GET['id_usuario']) ? intval($_GET['id_usuario']) : 0;
$desde      = $_GET['desde'] ?? '';
$limite     = isset($_GET['limite']) ? max(50, intval($_GET['limite'])) : 500; // por defecto 500 por lote
$desde_id   = isset($_GET['desde_id']) ? intval($_GET['desde_id']) : 0;
$auto       = isset($_GET['auto']) && $_GET['auto'] == '1'; // avance automático entre lotes
$confirmado = isset($_GET['confirmado']) && $_GET['confirmado'] == '1'; // salta confirm() en auto

if ($ejecutar && $clave !== $CLAVE) {
    die('<h2 style="color:red;">❌ Clave incorrecta</h2>');
}

$PATRONES_BASURA = [
    '/\bendobj\b/i', '/\bstream\b/i', '/\bToUnicode\b/i',
    '/\bxref\b/i', '/\bstartxref\b/i', '/\/Font\s*<</i',
    '/\/Type\s*\//i', '/\bobj\s*<</', '/%PDF-/i',
    '/\bFlateDecode\b/i', '/\bCIDFont\b/', '/\bBaseFont\b/',
];

function es_basura_pdf($texto, $patrones) {
    if (!$texto) return false;
    foreach ($patrones as $p) if (preg_match($p, $texto)) return true;
    return false;
}
function es_pregunta_sospechosa($p) {
    $t = trim($p ?? '');
    if (mb_strlen($t) < 15) return 'muy corta';
    $limpio = preg_replace('/[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9\s]/u', '', $t);
    $ratio = mb_strlen($limpio) / max(1, mb_strlen($t));
    if ($ratio > 0.4) return 'demasiados símbolos';
    return '';
}
function logline($msg, $cls = '') {
    echo '<div class="log '.$cls.'">'.htmlspecialchars($msg).'</div>';
    @flush();
}

echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Limpiar preguntas basura PDF</title>
<style>
body{font-family:Arial;margin:20px;background:#f5f5f5}
.container{max-width:1200px;margin:0 auto;background:#fff;padding:20px;border-radius:8px}
.info{background:#e3f2fd;padding:12px;border-radius:4px;margin:10px 0}
.warn{background:#fff3e0;padding:12px;border-radius:4px;margin:10px 0}
.ok{background:#e8f5e9;padding:12px;border-radius:4px;margin:10px 0}
.err{background:#ffebee;padding:12px;border-radius:4px;margin:10px 0}
.progress{background:#263238;color:#b0bec5;padding:12px;border-radius:4px;font-family:monospace;font-size:12px;max-height:300px;overflow-y:auto;margin:10px 0}
.log{margin:2px 0}
.log.ok{color:#4caf50}.log.warn{color:#ff9800}.log.err{color:#f44336}
table{width:100%;border-collapse:collapse;margin-top:15px;font-size:13px}
th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}
th{background:#f5f5f5}
tr.bad{background:#ffebee}
code{background:#eee;padding:2px 4px;border-radius:3px;font-size:12px}
.btn{display:inline-block;padding:10px 20px;background:#d32f2f;color:#fff;text-decoration:none;border-radius:4px;margin:8px 8px 0 0}
.btn.next{background:#388e3c}
.stat{display:inline-block;padding:10px 15px;background:#f5f5f5;border-radius:6px;margin:5px}
.stat b{font-size:22px;color:#1976d2;display:block}
</style></head><body><div class="container">';

echo '<h1>🧹 Limpiar preguntas con basura de PDF</h1>';
echo '<p>Procesa por lotes para evitar timeouts. Muestra el progreso en vivo.</p>';

if (!$ejecutar) {
    echo '<div class="info"><b>Modo simulación.</b> Añade <code>?ejecutar=1&clave='.$CLAVE.'</code> para eliminar.</div>';
}

// WHERE dinámico
$where = ['1=1'];
if ($id_proceso > 0) $where[] = "id_proceso = $id_proceso";
if ($id_usuario > 0) $where[] = "id_usuario = $id_usuario";
if ($desde !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $desde)) $where[] = "fecha >= '$desde'";
if ($desde_id > 0) $where[] = "id >= $desde_id";
$whereSql = implode(' AND ', $where);

echo '<div class="info">
<b>Filtros:</b> '.htmlspecialchars($whereSql).'<br>
<b>Tamaño del lote:</b> '.$limite.' preguntas
</div>';

echo '<h3>⏳ Progreso</h3><div class="progress" id="log">';
logline('🚀 Iniciando análisis...', 'ok');

$inicio = microtime(true);

// 1) Cargar IDs del lote
$q = "SELECT id, id_usuario, id_proceso, tema, pregunta, correcta, cita, fecha
      FROM preguntas WHERE $whereSql ORDER BY id ASC LIMIT $limite";
$res = $conn->query($q);
if (!$res) {
    logline('❌ Error consulta: '.$conn->error, 'err');
    echo '</div></div></body></html>'; exit;
}

$preguntas = [];
$ids = [];
while ($r = $res->fetch_assoc()) {
    $preguntas[$r['id']] = $r;
    $ids[] = intval($r['id']);
}
$total = count($preguntas);
logline("📥 Cargadas $total preguntas en el lote", 'ok');

// 2) Buscar respuestas con basura en 1 sola query (evita N+1)
$idsBasuraResp = [];
if ($ids) {
    $inIds = implode(',', $ids);
    $rr = $conn->query("SELECT DISTINCT id_pregunta, respuesta FROM respuestas WHERE id_pregunta IN ($inIds)");
    if ($rr) {
        while ($x = $rr->fetch_assoc()) {
            if (es_basura_pdf($x['respuesta'], $PATRONES_BASURA)) {
                $idsBasuraResp[intval($x['id_pregunta'])] = true;
            }
        }
    }
    logline('🔎 Respuestas revisadas en bloque (basura encontrada en '.count($idsBasuraResp).' preguntas)', 'ok');
}

// 3) Detectar sospechosas
$sospechosas = [];
$i = 0; $ultimo_id = 0;
foreach ($preguntas as $id => $r) {
    $i++;
    $ultimo_id = intval($id);
    $motivos = [];
    if (es_basura_pdf($r['pregunta'], $PATRONES_BASURA)) $motivos[] = 'basura PDF en pregunta';
    if (es_basura_pdf($r['correcta'], $PATRONES_BASURA)) $motivos[] = 'basura PDF en correcta';
    if (es_basura_pdf($r['cita'], $PATRONES_BASURA))     $motivos[] = 'basura PDF en cita';
    if (isset($idsBasuraResp[intval($id)]))              $motivos[] = 'basura PDF en respuestas';
    $sosp = es_pregunta_sospechosa($r['pregunta']);
    if ($sosp) $motivos[] = $sosp;

    if ($motivos) {
        $r['motivos'] = implode(', ', array_unique($motivos));
        $sospechosas[] = $r;
    }
    if ($i % 100 === 0) {
        logline("… analizadas $i / $total (última ID $ultimo_id)");
    }
}

$tiempo = round(microtime(true) - $inicio, 2);
logline("✅ Análisis del lote completado en {$tiempo}s. Sospechosas: ".count($sospechosas), 'ok');

// 4) Eliminar si toca
if ($ejecutar && count($sospechosas) > 0) {
    logline('🗑️ Eliminando '.count($sospechosas).' preguntas y sus respuestas...', 'warn');
    $ok = 0; $err = 0;
    foreach ($sospechosas as $s) {
        $id = intval($s['id']);
        $conn->query("DELETE FROM respuestas WHERE id_pregunta = $id");
        if ($conn->query("DELETE FROM preguntas WHERE id = $id")) {
            $ok++;
            if ($ok % 20 === 0) logline("… eliminadas $ok", 'ok');
        } else {
            $err++;
            logline("❌ Error ID $id: ".$conn->error, 'err');
        }
    }
    logline("✅ Eliminadas: $ok · Errores: $err", 'ok');
    error_log("[limpiar_pdf_basura] $ok eliminadas, $err errores");
}

echo '</div>'; // cerrar progress

// 5) Estadísticas + tabla
echo '<div>
<div class="stat"><b>'.number_format($total).'</b>Analizadas (lote)</div>
<div class="stat"><b style="color:'.(count($sospechosas)?'#d32f2f':'#388e3c').'">'.count($sospechosas).'</b>Sospechosas</div>
<div class="stat"><b>'.$tiempo.'s</b>Tiempo</div>
<div class="stat"><b>'.$ultimo_id.'</b>Última ID procesada</div>
</div>';

if (count($sospechosas) > 0) {
    echo '<h3>Detalle</h3><table><tr><th>ID</th><th>Proceso</th><th>Usuario</th><th>Fecha</th><th>Pregunta</th><th>Correcta</th><th>Motivos</th></tr>';
    foreach ($sospechosas as $s) {
        echo '<tr class="bad">
            <td>'.$s['id'].'</td>
            <td>'.$s['id_proceso'].'</td>
            <td>'.$s['id_usuario'].'</td>
            <td>'.$s['fecha'].'</td>
            <td>'.htmlspecialchars(mb_substr($s['pregunta'] ?? '', 0, 120)).'…</td>
            <td><code>'.htmlspecialchars(mb_substr($s['correcta'] ?? '', 0, 40)).'</code></td>
            <td><b style="color:#d32f2f">'.htmlspecialchars($s['motivos']).'</b></td>
        </tr>';
    }
    echo '</table>';
}

// 6) Botones: siguiente lote / ejecutar / auto
$baseQs = "limite=$limite";
if ($id_proceso) $baseQs .= "&id_proceso=$id_proceso";
if ($id_usuario) $baseQs .= "&id_usuario=$id_usuario";
if ($desde)      $baseQs .= "&desde=".urlencode($desde);

$hayMas = ($total >= $limite);
$siguiente = $ultimo_id + 1;

echo '<div class="warn" style="margin-top:20px">';
if (!$ejecutar && count($sospechosas) > 0) {
    $qs = $baseQs."&ejecutar=1&clave=$CLAVE".($desde_id?"&desde_id=$desde_id":"");
    echo '<a href="?'.$qs.'" class="btn" onclick="return confirm(\'¿Eliminar '.count($sospechosas).' preguntas de este lote?\')">🗑️ Ejecutar este lote</a> ';
    $qsAuto = $baseQs."&ejecutar=1&clave=$CLAVE&auto=1&confirmado=1";
    echo '<a href="?'.$qsAuto.'" class="btn" style="background:#6a1b9a" onclick="return confirm(\'Se procesarán TODOS los lotes automáticamente hasta el final. ¿Continuar?\')">⚡ Ejecutar TODO automáticamente</a>';
}
if ($hayMas) {
    $qsNext = $baseQs."&desde_id=$siguiente".($ejecutar?"&ejecutar=1&clave=$CLAVE":"").($auto?"&auto=1&confirmado=1":"");
    echo ' <a href="?'.$qsNext.'" class="btn next" id="btnNext">➡️ Siguiente lote (desde ID '.$siguiente.')</a>';

    if ($auto && $confirmado) {
        // Redirección automática al siguiente lote
        $segundos = 2;
        echo '<div class="ok" style="margin-top:12px">⚡ <b>Modo automático activo.</b> Redirigiendo al siguiente lote en '.$segundos.'s…</div>';
        echo '<script>setTimeout(function(){ window.location.href = "?'.$qsNext.'"; }, '.($segundos*1000).');</script>';
        echo '<noscript><meta http-equiv="refresh" content="'.$segundos.';url=?'.$qsNext.'"></noscript>';
    }
} else {
    echo '<div class="ok" style="margin-top:10px">✅ No hay más preguntas que procesar con estos filtros. Proceso completado.</div>';
}
echo '</div>';

echo '</div></body></html>';
$conn->close();
