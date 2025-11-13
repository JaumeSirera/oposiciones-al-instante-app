const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, description) {
  try {
    log(`\n▶ ${description}...`, 'blue');
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    log(`✓ ${description} completado`, 'green');
    return output;
  } catch (error) {
    log(`✗ Error en ${description}`, 'red');
    console.error(error.message);
    throw error;
  }
}

function readKeyProperties() {
  const keyPropertiesPath = path.join(__dirname, '..', 'android', 'key.properties');
  
  if (!fs.existsSync(keyPropertiesPath)) {
    log('⚠ No se encontró android/key.properties', 'yellow');
    return null;
  }

  const content = fs.readFileSync(keyPropertiesPath, 'utf8');
  const properties = {};
  
  content.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      properties[key.trim()] = value.trim();
    }
  });

  return properties;
}

function encodeKeystore() {
  const keystorePath = path.join(__dirname, '..', 'android', 'app', 'eas-upload.jks');
  
  if (!fs.existsSync(keystorePath)) {
    log('⚠ No se encontró el keystore en android/app/eas-upload.jks', 'yellow');
    return null;
  }

  const keystore = fs.readFileSync(keystorePath);
  return keystore.toString('base64');
}

function generateSecretsGuide() {
  log('\n====================================', 'blue');
  log('  CONFIGURACIÓN DE GITHUB SECRETS', 'blue');
  log('====================================\n', 'blue');

  const properties = readKeyProperties();
  const keystoreBase64 = encodeKeystore();

  if (!properties || !keystoreBase64) {
    log('⚠ Completa la configuración del keystore primero', 'yellow');
    log('\n1. Asegúrate de tener android/key.properties configurado', 'yellow');
    log('2. Asegúrate de tener android/app/eas-upload.jks presente\n', 'yellow');
    return;
  }

  log('Ve a: GitHub → Tu Repositorio → Settings → Secrets and variables → Actions\n', 'green');
  log('Crea estos secrets (copia los valores de abajo):\n', 'green');

  log('1. KEYSTORE_BASE64:', 'blue');
  log(`   ${keystoreBase64.substring(0, 50)}...\n`, 'reset');

  log('2. KEYSTORE_PASSWORD:', 'blue');
  log(`   ${properties.storePassword}\n`, 'reset');

  log('3. KEY_PASSWORD:', 'blue');
  log(`   ${properties.keyPassword}\n`, 'reset');

  log('4. KEY_ALIAS:', 'blue');
  log(`   ${properties.keyAlias}\n`, 'reset');

  // Guardar en un archivo para referencia
  const secretsFile = path.join(__dirname, 'github-secrets.txt');
  const secretsContent = `
CONFIGURACIÓN DE GITHUB SECRETS
=================================

Ve a: GitHub → Settings → Secrets and variables → Actions

Crea estos secrets:

1. KEYSTORE_BASE64
${keystoreBase64}

2. KEYSTORE_PASSWORD
${properties.storePassword}

3. KEY_PASSWORD
${properties.keyPassword}

4. KEY_ALIAS
${properties.keyAlias}

5. GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (opcional - para deploy automático)
[Pega aquí el contenido de tu service account JSON de Google Play]

NOTA: Este archivo contiene información sensible. No lo subas a Git.
`;

  fs.writeFileSync(secretsFile, secretsContent);
  log(`✓ Valores guardados en: ${secretsFile}`, 'green');
  log('  (Este archivo está en .gitignore por seguridad)\n', 'yellow');
}

function checkGitHubCli() {
  try {
    execSync('gh --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function setupSecretsWithCLI() {
  if (!checkGitHubCli()) {
    log('\n⚠ GitHub CLI (gh) no está instalado', 'yellow');
    log('Instálalo desde: https://cli.github.com/\n', 'yellow');
    return false;
  }

  const properties = readKeyProperties();
  const keystoreBase64 = encodeKeystore();

  if (!properties || !keystoreBase64) {
    return false;
  }

  try {
    log('\n▶ Configurando secrets automáticamente...', 'blue');
    
    // Guardar temporalmente en archivos
    const tempDir = path.join(__dirname, '.temp-secrets');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    fs.writeFileSync(path.join(tempDir, 'keystore.txt'), keystoreBase64);
    fs.writeFileSync(path.join(tempDir, 'store-pass.txt'), properties.storePassword);
    fs.writeFileSync(path.join(tempDir, 'key-pass.txt'), properties.keyPassword);
    fs.writeFileSync(path.join(tempDir, 'alias.txt'), properties.keyAlias);

    // Configurar secrets usando gh CLI
    execCommand(`gh secret set KEYSTORE_BASE64 < ${path.join(tempDir, 'keystore.txt')}`, 'Configurando KEYSTORE_BASE64');
    execCommand(`gh secret set KEYSTORE_PASSWORD < ${path.join(tempDir, 'store-pass.txt')}`, 'Configurando KEYSTORE_PASSWORD');
    execCommand(`gh secret set KEY_PASSWORD < ${path.join(tempDir, 'key-pass.txt')}`, 'Configurando KEY_PASSWORD');
    execCommand(`gh secret set KEY_ALIAS < ${path.join(tempDir, 'alias.txt')}`, 'Configurando KEY_ALIAS');

    // Limpiar archivos temporales
    fs.rmSync(tempDir, { recursive: true, force: true });

    log('\n✓ Secrets configurados exitosamente en GitHub', 'green');
    return true;
  } catch (error) {
    log('\n✗ Error configurando secrets automáticamente', 'red');
    log('Usa el método manual mostrado arriba\n', 'yellow');
    return false;
  }
}

async function main() {
  log('\n====================================', 'green');
  log('  CONFIGURACIÓN GITHUB ACTIONS', 'green');
  log('====================================\n', 'green');

  // Generar guía de secrets
  generateSecretsGuide();

  // Intentar configurar automáticamente con gh CLI
  log('\n¿Quieres intentar configurar los secrets automáticamente?', 'blue');
  log('(Requiere GitHub CLI instalado y autenticado)\n', 'blue');

  const setupAuto = setupSecretsWithCLI();

  if (!setupAuto) {
    log('\n▶ Configura los secrets manualmente siguiendo la guía de arriba', 'yellow');
  }

  log('\n====================================', 'green');
  log('  PRÓXIMOS PASOS', 'green');
  log('====================================\n', 'green');
  log('1. Asegúrate de que todos los secrets estén configurados en GitHub', 'blue');
  log('2. Haz commit y push de los cambios', 'blue');
  log('3. El workflow se ejecutará automáticamente en cada push a main', 'blue');
  log('4. Encuentra el AAB compilado en: Actions → workflow → Artifacts\n', 'blue');
}

main().catch(error => {
  log('\n✗ Error en la configuración', 'red');
  console.error(error);
  process.exit(1);
});
