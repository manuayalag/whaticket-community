import pino from "pino";

// Force direct logging to console for maximum visibility
const consoleLog = console.log;
const consoleError = console.error;

const logger = {
  info: (...args: any[]) => {
    consoleLog(`[INFO] ${new Date().toISOString()}`, ...args);
  },
  error: (...args: any[]) => {
    consoleError(`[ERROR] ${new Date().toISOString()}`, ...args);
  },
  warn: (...args: any[]) => {
    consoleLog(`[WARN] ${new Date().toISOString()}`, ...args);
  },
  debug: (...args: any[]) => {
    consoleLog(`[DEBUG] ${new Date().toISOString()}`, ...args);
  }
};

export { logger };
