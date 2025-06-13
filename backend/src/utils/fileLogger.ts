import fs from "fs";
import path from "path";

// Lista de posibles rutas para los logs, en orden de preferencia
const possibleLogPaths = [
  process.env.LOG_FILE_PATH,
  "/home/user/whaticket/backend/logs/debug.log",
  "/root/whaticket/backend/logs/debug.log",
  "/usr/src/app/logs/debug.log",
  "/tmp/whaticket-debug.log"
];

// Usar la primera ruta válida
let LOG_FILE = "/tmp/whaticket-debug.log"; // Default fallback

// Función para intentar inicializar un archivo de log
function tryInitLogFile(filePath: string): boolean {
  try {
    // Crear el directorio si no existe
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Escribir mensaje inicial en el archivo
    fs.writeFileSync(filePath, `=== LOG INITIALIZED AT ${new Date().toISOString()} ===\n`, { flag: "a" });
    console.log("Log file initialized at:", filePath);
    return true;
  } catch (error) {
    console.log(`Could not initialize log at ${filePath}:`, error);
    return false;
  }
}

// Probar cada ruta hasta encontrar una que funcione
for (const logPath of possibleLogPaths) {
  if (logPath && tryInitLogFile(logPath)) {
    LOG_FILE = logPath;
    break;
  }
}

export const logToFile = (message: string): void => {
  try {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, logMessage);
    // También imprimir en consola para mayor visibilidad
    console.log(`[LOG] ${message}`);
  } catch (error) {
    console.error('Failed to write to log file', error);
  }
};

export const clearLogFile = (): void => {
  try {
    fs.writeFileSync(LOG_FILE, '=== LOG CLEARED ===\n');
    console.log('Log file cleared');
  } catch (error) {
    console.error('Failed to clear log file', error);
  }
};
