<?php
/**
 * Limpia preguntas generadas con basura de PDF (endobj, stream, ToUnicode, etc.)
 * y preguntas con texto sin sentido (muy corto, sin signos de interrogación, etc.)
 *
 * USO:
 *   Simulación:  limpiar_preguntas_pdf_basura.php
 *   Ejecutar:    limpiar_preguntas_pdf_basura.php?ejecutar=1&clave=limpiar2024
 *   Filtrar por proceso: &id_proceso=123
 *   Filtrar por usuario: &id_usuario=45
 *   Filtrar por fecha desde: &desde=2025-01-01
 */

header('Content-Type: text/html; charset=utf-8');
error_reporting(E_ALL);
ini_set('display_errors', 1);
set_time_limit(300);

require 'db.php';

$CLAVE = 'limpiar2024';
$ejecutar = isset($_GET['ejecutar']) && $_GET['ejecutar'] == '1';
$clave = $_GET['clave'] ?? '';
$id_proceso = isset($_GET['id_proceso']) ? intval($_GET['id_proceso']) : 0;
$id_usuario = isset($_GET['id_usuario']) ? intval($_GET['id_usuario']) : 0;
$desde = $_GET['desde'] ?? '';

if ($ejecutar && $clave !== $CLAVE) {
    die('<h2 style="color:red;">❌ Clave incorrecta</h2>');
}

// Patrones de basura típica extraída de PDFs mal parseados
$PATRONES_BASURA = [
    '/\bendobj\b/i',
    '/\bstream\b/i',
    '/\bToUnicode\b/i',
    '/\bxref\b/i',
    '/\bstartxref\b/i',
    '/\/Font\s*<</i',
    '/\/Type\s*\//i',
    '/\bobj\s*<</',
    '/%PDF-/i',
    '/\bFlateDecode\b/i',
    '/\bCIDFont\b/',
    '/\bBaseFont\b/',
];

function es_basura_pdf($texto, $patrones) {
    if (!$texto) return false;
    foreach ($patrones as $p) {
        if (preg_match($p, $texto)) return true;
    }
    return false;
}

function es_pregunta_sospechosa($p) {
    $t = trim($p ?? '');
    if (mb_strlen($t) < 15) return 'muy corta';
    // Ratio de caracteres no imprimibles / símbolos
    $limpio = preg_replace('/[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9\s]/u', '', $t);
    $ratio = mb_strlen($limpio) / max(1, mb_strlen($t));
    if ($ratio > 0.4) return 'demasiados símbolos';
    return '';
}

echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Limpiar preguntas basura PDF</title>
<style>
body{font-family:Arial;margin:20px;background:#f5f5f5}
.container{max-width:1200px;margin:0 auto;background:#fff;padding:20px;border-radius:8px}
.info{background:#e3f2fd;padding:12px;border-radius:4px;margin:10px 0}
.warn{background:#fff3e0;padding:12px;border-radius:4px;margin:10px 0}
.ok{background:#e8f5e9;padding:12px;border-radius:4px;margin:10px 0}
.err{background:#ffebee;padding:12px;border-radius:4px;margin:10px 0}
table{width:100%;border-collapse:collapse;margin-top:15px;font-size:13px}
th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}
th{background:#f5f5f5}
tr.bad{background:#ffebee}
code{background:#eee;padding:2px 4px;border-radius:3px;font-size:12px}
.btn{display:inline-block;padding:10px 20px;background:#d32f2f;color:#fff;text-decoration:none;border-radius:4px;margin-top:15px}
.stat{display:inline-block;padding:10px 15px;background:#f5f5f5;border-radius:6px;margin:5px}
.stat b{font-size:22px;color:#1976d2;display:block}
</style></head><body><div class="container">';

echo '<h1>🧹 Limpiar preguntas con basura de PDF</h1>';
echo '<p>Detecta preguntas que contienen restos del parseo binario del PDF (endobj, stream, ToUnicode, xref, FlateDecode…) o texto sin sentido.</p>';

if (!$ejecutar) {
    echo '<div class="info"><b>Modo simulación.</b> Añade <code>?ejecutar=1&clave='.$CLAVE.'</code> para eliminar realmente.</div>';
}

// Construir WHERE dinámico
$where = ['1=1'];
if ($id_proceso > 0) $where[] = "id_proceso = $id_proceso";
if ($id_usuario > 0) $where[] = "id_usuario = $id_usuario";
if ($desde !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $desde)) $where[] = "fecha >= '$desde'";
$whereSql = implode(' AND ', $where);

echo '<div class="info"><b>Filtros:</b> '.htmlspecialchars($whereSql).'</div>';

$q = "SELECT id, id_usuario, id_proceso, tema, pregunta, correcta, cita, fecha
      FROM preguntas WHERE $whereSql ORDER BY id DESC";
$res = $conn->query($q);
if (!$res) { echo '<div class="err">Error: '.$conn->error.'</div>'; exit; }

$sospechosas = [];
$total = 0;
while ($r = $res->fetch_assoc()) {
    $total++;
    $motivos = [];
    if (es_basura_pdf($r['pregunta'], $PATRONES_BASURA)) $motivos[] = 'basura PDF en pregunta';
    if (es_basura_pdf($r['correcta'], $PATRONES_BASURA)) $motivos[] = 'basura PDF en correcta';
    if (es_basura_pdf($r['cita'], $PATRONES_BASURA))     $motivos[] = 'basura PDF en cita';
    $sosp = es_pregunta_sospechosa($r['pregunta']);
    if ($sosp) $motivos[] = $sosp;

    // También revisar respuestas asociadas
    $rr = $conn->query("SELECT respuesta FROM respuestas WHERE id_pregunta = ".intval($r['id']));
    if ($rr) {
        while ($x = $rr->fetch_assoc()) {
            if (es_basura_pdf($x['respuesta'], $PATRONES_BASURA)) { $motivos[] = 'basura PDF en respuestas'; break; }
        }
    }

    if ($motivos) {
        $r['motivos'] = implode(', ', array_unique($motivos));
        $sospechosas[] = $r;
    }
}

echo '<div>
<div class="stat"><b>'.number_format($total).'</b>Analizadas</div>
<div class="stat"><b style="color:'.(count($sospechosas)?'#d32f2f':'#388e3c').'">'.count($sospechosas).'</b>Sospechosas</div>
</div>';

if (count($sospechosas) === 0) {
    echo '<div class="ok">✅ No se detectaron preguntas con basura de PDF ni texto sospechoso.</div>';
    echo '</div></body></html>';
    exit;
}

echo '<table><tr><th>ID</th><th>Proceso</th><th>Usuario</th><th>Fecha</th><th>Pregunta</th><th>Correcta</th><th>Motivos</th></tr>';
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

if ($ejecutar) {
    echo '<h2>🗑️ Eliminando…</h2>';
    $ok = 0; $err = 0;
    foreach ($sospechosas as $s) {
        $id = intval($s['id']);
        $conn->query("DELETE FROM respuestas WHERE id_pregunta = $id");
        if ($conn->query("DELETE FROM preguntas WHERE id = $id")) $ok++;
        else { $err++; echo '<div class="err">Error ID '.$id.': '.$conn->error.'</div>'; }
    }
    echo '<div class="ok"><b>✅ Eliminadas:</b> '.$ok.' &nbsp; <b>Errores:</b> '.$err.'</div>';
    error_log("[limpiar_pdf_basura] $ok eliminadas, $err errores");
} else {
    $qs = 'ejecutar=1&clave='.$CLAVE;
    if ($id_proceso) $qs .= '&id_proceso='.$id_proceso;
    if ($id_usuario) $qs .= '&id_usuario='.$id_usuario;
    if ($desde) $qs .= '&desde='.$desde;
    echo '<div class="warn">Se eliminarán <b>'.count($sospechosas).'</b> preguntas y sus respuestas.<br>
    <a href="?'.$qs.'" class="btn" onclick="return confirm(\'¿Eliminar '.count($sospechosas).' preguntas?\')">🗑️ Ejecutar limpieza</a></div>';
}

echo '</div></body></html>';
$conn->close();
