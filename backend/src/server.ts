import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { logToFile } from "./utils/fileLogger";
import { verifyOpenAIConfig } from "./utils/openaiChecker";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";

logToFile("==================================");
logToFile("INICIANDO SERVIDOR");
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
