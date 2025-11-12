import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function execCommand(command, description) {
  log(`\n${description}...`, colors.blue);
  try {
    execSync(command, { stdio: 'inherit', cwd: join(__dirname, '..') });
    log(`✓ ${description} completado`, colors.green);
    return true;
  } catch (error) {
    log(`✗ Error en ${description}`, colors.red);
    console.error(error.message);
    return false;
  }
}

// 1. Incrementar versión
log('\n=== INCREMENTANDO VERSIÓN ===', colors.bright);

const gradlePath = join(__dirname, '..', 'android', 'app', 'build.gradle');
let gradleContent = readFileSync(gradlePath, 'utf8');

// Extraer versionCode actual
const versionCodeMatch = gradleContent.match(/versionCode\s+(\d+)/);
if (!versionCodeMatch) {
  log('✗ No se pudo encontrar versionCode', colors.red);
  process.exit(1);
}

const currentVersionCode = parseInt(versionCodeMatch[1]);
const newVersionCode = currentVersionCode + 1;

// Generar nueva versionName con fecha actual
const now = new Date();
const day = String(now.getDate()).padStart(2, '0');
const month = String(now.getMonth() + 1).padStart(2, '0');
const year = String(now.getFullYear()).slice(-2);
const newVersionName = `${day}.${month}.${year}`;

// Reemplazar valores
gradleContent = gradleContent.replace(
  /versionCode\s+\d+/,
  `versionCode ${newVersionCode}`
);
gradleContent = gradleContent.replace(
  /versionName\s+"[^"]+"/,
  `versionName "${newVersionName}"`
);

writeFileSync(gradlePath, gradleContent, 'utf8');

log(`✓ Versión actualizada:`, colors.green);
log(`  versionCode: ${currentVersionCode} → ${newVersionCode}`, colors.yellow);
log(`  versionName: "${newVersionName}"`, colors.yellow);

// 2. Compilar web
log('\n=== COMPILANDO WEB ===', colors.bright);
if (!execCommand('npm run build', 'Compilación web')) {
  process.exit(1);
}

// 3. Sincronizar Capacitor
log('\n=== SINCRONIZANDO CAPACITOR ===', colors.bright);
if (!execCommand('npx cap sync android', 'Sincronización de Capacitor')) {
  process.exit(1);
}

// 4. Compilar AAB
log('\n=== COMPILANDO AAB ===', colors.bright);

// Detectar sistema operativo
const isWindows = process.platform === 'win32';
const gradlewCmd = isWindows ? 'gradlew.bat' : './gradlew';

// Comando completo para Windows
const buildCommand = isWindows
  ? `cd android && ${gradlewCmd} :app:bundleRelease --stacktrace`
  : `cd android && ${gradlewCmd} :app:bundleRelease --stacktrace`;

if (!execCommand(buildCommand, 'Compilación AAB')) {
  process.exit(1);
}

// 5. Mostrar ubicación del AAB
log('\n=== COMPILACIÓN EXITOSA ===', colors.bright + colors.green);
log(`\nAAB generado en:`, colors.yellow);
log(`android/app/build/outputs/bundle/release/app-release.aab\n`, colors.bright);
log(`Versión: ${newVersionCode} (${newVersionName})`, colors.blue);
