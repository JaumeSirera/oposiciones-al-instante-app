import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración
const GITHUB_OWNER = 'JaumeSirera';
const GITHUB_REPO = 'oposiciones-al-instante-app';
const OUTPUT_DIR = join(__dirname, '..', 'downloads');

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

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Seguir redirecciones
        return httpsGet(res.headers.location, headers).then(resolve).catch(reject);
      }
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ data, headers: res.headers });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, outputPath, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Seguir redirecciones
        return downloadFile(res.headers.location, outputPath, headers).then(resolve).catch(reject);
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        writeFileSync(outputPath, Buffer.concat(chunks));
        resolve();
      });
    }).on('error', reject);
  });
}

async function getLatestRelease() {
  log('\n=== OBTENIENDO ÚLTIMA RELEASE ===', colors.bright);
  
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
  const headers = {
    'User-Agent': 'Node.js',
    'Accept': 'application/vnd.github.v3+json'
  };
  
  // Si hay un token de GitHub en variables de entorno, usarlo
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    log('✓ Usando token de GitHub para autenticación', colors.green);
  }
  
  try {
    const { data } = await httpsGet(url, headers);
    const release = JSON.parse(data);
    
    log(`✓ Release encontrada: ${release.tag_name}`, colors.green);
    log(`  Nombre: ${release.name}`, colors.yellow);
    log(`  Fecha: ${new Date(release.published_at).toLocaleString()}`, colors.yellow);
    
    return release;
  } catch (error) {
    log(`✗ Error al obtener release: ${error.message}`, colors.red);
    if (error.message.includes('404')) {
      log('\n[AYUDA] No se encontraron releases. Asegúrate de:', colors.yellow);
      log('  1. Que el repositorio tenga releases publicadas', colors.yellow);
      log('  2. Que el repositorio sea público o tengas un GITHUB_TOKEN configurado', colors.yellow);
    }
    throw error;
  }
}

async function downloadAAB(release) {
  log('\n=== DESCARGANDO AAB ===', colors.bright);
  
  // Buscar el archivo AAB en los assets
  const aabAsset = release.assets.find(asset => asset.name.endsWith('.aab'));
  
  if (!aabAsset) {
    throw new Error('No se encontró ningún archivo AAB en la release');
  }
  
  log(`  Archivo: ${aabAsset.name}`, colors.yellow);
  log(`  Tamaño: ${(aabAsset.size / 1024 / 1024).toFixed(2)} MB`, colors.yellow);
  
  // Crear directorio de salida si no existe
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const outputPath = join(OUTPUT_DIR, aabAsset.name);
  
  const headers = {
    'User-Agent': 'Node.js',
    'Accept': 'application/octet-stream'
  };
  
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }
  
  log('\nDescargando...', colors.blue);
  
  try {
    await downloadFile(aabAsset.browser_download_url, outputPath, headers);
    log(`✓ AAB descargado exitosamente`, colors.green);
    log(`\n${colors.bright}${colors.green}Ubicación:${colors.reset} ${outputPath}\n`, colors.yellow);
    
    return outputPath;
  } catch (error) {
    log(`✗ Error al descargar: ${error.message}`, colors.red);
    throw error;
  }
}

async function main() {
  try {
    log('\n=====================================', colors.bright + colors.blue);
    log('  DESCARGA AUTOMÁTICA DE AAB', colors.bright + colors.blue);
    log('=====================================\n', colors.bright + colors.blue);
    
    const release = await getLatestRelease();
    await downloadAAB(release);
    
    log('=== DESCARGA COMPLETADA ===\n', colors.bright + colors.green);
    
  } catch (error) {
    log(`\n✗ Error: ${error.message}`, colors.red);
    process.exit(1);
  }
}

main();
