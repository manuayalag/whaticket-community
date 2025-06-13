import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { logToFile } from "./utils/fileLogger";
import { verifyOpenAIConfig } from "./utils/openaiChecker";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";

logToFile("==================================");
logToFile("INICIANDO SERVIDOR");
logToFile(`FECHA Y HORA: ${new Date().toISOString()}`);
logToFile(`DIRECTORIO DE TRABAJO: ${process.cwd()}`);
logToFile(`RUTA DE LOGS: ${process.env.LOG_FILE_PATH || "/usr/src/app/logs/debug.log"}`);
logToFile(`NÚMEROS OBJETIVO: 595984848082 (WhatsApp)`);
logToFile("VERSIÓN DE NODE: " + process.version);
logToFile("==================================");

// Verificar OpenAI al inicio
setTimeout(async () => {
  try {
    await verifyOpenAIConfig();
  } catch (error) {
    logToFile(`Error verificando OpenAI: ${error}`);
  }
}, 5000);

// Check every 60 seconds if OpenAI is working
setInterval(async () => {
  try {
    await verifyOpenAIConfig();
  } catch (error) {
    logToFile(`Error verificando OpenAI: ${error}`);
  }
}, 60000);

const server = app.listen(process.env.PORT, () => {
  logger.info(`Server started on port: ${process.env.PORT}`);
  logToFile(`SERVIDOR INICIADO EN PUERTO: ${process.env.PORT}`);
});

initIO(server);
StartAllWhatsAppsSessions();
gracefulShutdown(server);
