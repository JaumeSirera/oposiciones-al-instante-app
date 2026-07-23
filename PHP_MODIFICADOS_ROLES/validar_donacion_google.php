<?php
/**
 * validar_donacion_google.php
 *
 * Valida una compra (donación consumible) realizada vía Google Play Billing.
 * Requiere:
 *   - Cuenta de servicio de Google Cloud con acceso a la API de Google Play Developer
 *   - Archivo JSON de credenciales subido al servidor (fuera de public_html idealmente)
 *   - La app declarada en Play Console con los productos consumibles (SKUs) siguientes:
 *
 *   SKUs esperados:
 *     donation_5    -> 5,00 €
 *     donation_10   -> 10,00 €
 *     donation_20   -> 20,00 €
 *
 * Input (POST JSON):
 *   {
 *     "id_usuario": 123,
 *     "product_id": "donation_10",
 *     "purchase_token": "abcd....",
 *     "order_id": "GPA.1234-5678-9012-34567"
 *   }
 *
 * Output:
 *   { "success": true, "estado": "validated", "amount_cents": 1000 }
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: authorization, content-type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// --- Configuración ---
// Cambia esta ruta por la ubicación real del JSON de tu cuenta de servicio.
// Recomendado guardarlo FUERA de public_html.
$SERVICE_ACCOUNT_JSON = __DIR__ . '/../private/google-play-service-account.json';
$PACKAGE_NAME         = 'com.jaumesirera.TestsOposiciones';

// Mapeo de SKUs a importes (céntimos). El importe real lo declaras también en Play Console.
$SKU_MAP = [
  'donation_5'  => 500,
  'donation_10' => 1000,
  'donation_20' => 2000,
];

require_once __DIR__ . '/conexion.php'; // Debe exponer $conn (mysqli) según convención del proyecto

function respond($data, $code = 200) {
  http_response_code($code);
  echo json_encode($data);
  exit;
}

// --- Leer input ---
$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
if (!$input) respond(['success' => false, 'error' => 'JSON inválido'], 400);

$idUsuario   = intval($input['id_usuario'] ?? 0);
$productId   = trim($input['product_id'] ?? '');
$purchaseTok = trim($input['purchase_token'] ?? '');
$orderId     = trim($input['order_id'] ?? '');

if (!$idUsuario || !$productId || !$purchaseTok) {
  respond(['success' => false, 'error' => 'Faltan parámetros'], 400);
}
if (!isset($SKU_MAP[$productId])) {
  respond(['success' => false, 'error' => 'SKU no reconocido'], 400);
}
$amountCents = $SKU_MAP[$productId];

// --- Idempotencia: si ya está validado, devolver OK ---
$stmt = $conn->prepare("SELECT id, estado FROM donaciones_iap WHERE purchase_token = ? LIMIT 1");
$stmt->bind_param('s', $purchaseTok);
$stmt->execute();
$existing = $stmt->get_result()->fetch_assoc();
$stmt->close();

if ($existing && in_array($existing['estado'], ['validated', 'consumed'])) {
  respond(['success' => true, 'estado' => $existing['estado'], 'amount_cents' => $amountCents, 'duplicated' => true]);
}

// --- Obtener access_token de Google (JWT bearer) ---
function getGoogleAccessToken($jsonPath) {
  if (!file_exists($jsonPath)) throw new Exception("Falta service account JSON: $jsonPath");
  $sa = json_decode(file_get_contents($jsonPath), true);
  if (!$sa) throw new Exception('Service account JSON inválido');

  $now = time();
  $header = ['alg' => 'RS256', 'typ' => 'JWT'];
  $claim  = [
    'iss'   => $sa['client_email'],
    'scope' => 'https://www.googleapis.com/auth/androidpublisher',
    'aud'   => 'https://oauth2.googleapis.com/token',
    'exp'   => $now + 3600,
    'iat'   => $now,
  ];

  $b64 = fn($d) => rtrim(strtr(base64_encode($d), '+/', '-_'), '=');
  $segments = $b64(json_encode($header)) . '.' . $b64(json_encode($claim));
  $sig = '';
  openssl_sign($segments, $sig, $sa['private_key'], 'sha256WithRSAEncryption');
  $jwt = $segments . '.' . $b64($sig);

  $ch = curl_init('https://oauth2.googleapis.com/token');
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POSTFIELDS => http_build_query([
      'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      'assertion'  => $jwt,
    ]),
    CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
  ]);
  $resp = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($code !== 200) throw new Exception("OAuth Google falló ($code): $resp");
  $tok = json_decode($resp, true);
  return $tok['access_token'] ?? null;
}

try {
  $accessToken = getGoogleAccessToken($SERVICE_ACCOUNT_JSON);
  if (!$accessToken) throw new Exception('No se obtuvo access_token');

  // --- Consultar estado de la compra ---
  $url = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
       . rawurlencode($PACKAGE_NAME)
       . "/purchases/products/"
       . rawurlencode($productId)
       . "/tokens/"
       . rawurlencode($purchaseTok);

  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer $accessToken"],
  ]);
  $body = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  if ($code !== 200) {
    $stmt = $conn->prepare("INSERT INTO donaciones_iap (id_usuario, product_id, purchase_token, order_id, amount_cents, estado, google_response) VALUES (?, ?, ?, ?, ?, 'failed', ?)");
    $stmt->bind_param('isssis', $idUsuario, $productId, $purchaseTok, $orderId, $amountCents, $body);
    $stmt->execute(); $stmt->close();
    respond(['success' => false, 'error' => "Google devolvió $code", 'details' => $body], 400);
  }

  $data = json_decode($body, true);
  // purchaseState: 0 = purchased, 1 = canceled, 2 = pending
  $purchaseState = intval($data['purchaseState'] ?? -1);
  $consumptionState = intval($data['consumptionState'] ?? 0); // 0 = yet to consume, 1 = consumed

  if ($purchaseState !== 0) {
    respond(['success' => false, 'error' => 'Compra no completada', 'purchaseState' => $purchaseState], 400);
  }

  $estado = $consumptionState === 1 ? 'consumed' : 'validated';

  // --- Guardar en BD ---
  if ($existing) {
    $stmt = $conn->prepare("UPDATE donaciones_iap SET estado = ?, google_response = ?, fecha_validacion = NOW() WHERE id = ?");
    $stmt->bind_param('ssi', $estado, $body, $existing['id']);
  } else {
    $stmt = $conn->prepare("INSERT INTO donaciones_iap (id_usuario, product_id, purchase_token, order_id, amount_cents, estado, google_response, fecha_validacion) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())");
    $stmt->bind_param('isssiss', $idUsuario, $productId, $purchaseTok, $orderId, $amountCents, $estado, $body);
  }
  $stmt->execute(); $stmt->close();

  respond(['success' => true, 'estado' => $estado, 'amount_cents' => $amountCents]);
} catch (Exception $e) {
  respond(['success' => false, 'error' => $e->getMessage()], 500);
}
