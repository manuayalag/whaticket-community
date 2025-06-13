import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { logToFile } from "./utils/fileLogger";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";

logToFile("==================================");
logToFile("INICIANDO SERVIDOR");
logToFile("==================================");

// Check every 30 seconds if OpenAI is working
setInterval(async () => {
  const { Setting } = require("./models");
  try {
    logToFile("==================================");
    logToFile(`VERIFICACIÓN PERIÓDICA DE OPENAI: ${new Date().toISOString()}`);

    const settings = await Setting.findOne({
      where: { key: "openai" },
    });

    if (settings) {
      logToFile(`Configuración de OpenAI encontrada: ${settings.value}`);
    } else {
      logToFile("¡NO SE ENCONTRÓ CONFIGURACIÓN DE OPENAI!");
    }
    logToFile("==================================");
  } catch (error) {
    logToFile(`Error al verificar configuración: ${error}`);
  }
}, 30000);

const server = app.listen(process.env.PORT, () => {
  logger.info(`Server started on port: ${process.env.PORT}`);
  logToFile(`SERVIDOR INICIADO EN PUERTO: ${process.env.PORT}`);
});

initIO(server);
StartAllWhatsAppsSessions();
gracefulShutdown(server);
