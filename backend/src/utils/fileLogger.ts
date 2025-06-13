import fs from "fs";
import path from "path";

// Define path based on environment variable or use a default that should work
const LOG_FILE = process.env.LOG_FILE_PATH || "/usr/src/app/logs/debug.log";

// Attempt to create any parent directories that don't exist
try {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Initialize the log file
  fs.writeFileSync(LOG_FILE, "=== LOG INITIALIZED ===\n", { flag: "a" });
  console.log("Log file initialized at:", LOG_FILE);
} catch (error) {
  console.error("Failed to initialize log file:", error);
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
