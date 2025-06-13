import fs from 'fs';
import path from 'path';

// En Docker, necesitamos escribir en un directorio accesible
const LOG_FILE = '/usr/src/app/debug.log';

// Ensure the log file exists
try {
  fs.writeFileSync(LOG_FILE, '=== LOG INITIALIZED ===\n', { flag: 'a' });
  console.log('Log file initialized at:', LOG_FILE);
} catch (error) {
  console.error('Failed to initialize log file', error);
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
