import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(__dirname, '..', '..', 'debug.log');

// Ensure the log file exists
try {
  fs.writeFileSync(LOG_FILE, '=== LOG INITIALIZED ===\n', { flag: 'a' });
} catch (error) {
  console.error('Failed to initialize log file', error);
}

export const logToFile = (message: string): void => {
  try {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, logMessage);
  } catch (error) {
    console.error('Failed to write to log file', error);
  }
};

export const clearLogFile = (): void => {
  try {
    fs.writeFileSync(LOG_FILE, '=== LOG CLEARED ===\n');
  } catch (error) {
    console.error('Failed to clear log file', error);
  }
};
