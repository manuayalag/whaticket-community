import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";

// FORCE LOGS TO CONSOLE
console.log = function () {
  const args = Array.from(arguments);
  process.stdout.write(args.join(" ") + "\n");
};

console.error = function () {
  const args = Array.from(arguments);
  process.stderr.write(args.join(" ") + "\n");
};

// Log server startup
console.log("\n==================================");
console.log("SERVIDOR INICIANDO");
console.log("==================================\n");

// Check every 30 seconds if OpenAI is working
setInterval(async () => {
  const { Setting } = require("./models");
  try {
    console.log("\n==================================");
    console.log(`VERIFICACIÓN PERIÓDICA DE OPENAI: ${new Date().toISOString()}`);

    const settings = await Setting.findOne({
      where: { key: "openai" },
    });

    if (settings) {
      console.log("Configuración de OpenAI encontrada:", settings.value);
    } else {
      console.log("¡NO SE ENCONTRÓ CONFIGURACIÓN DE OPENAI!");
    }
    console.log("==================================\n");
  } catch (error) {
    console.error("Error al verificar configuración:", error);
  }
}, 30000);

const server = app.listen(process.env.PORT, () => {
  logger.info(`Server started on port: ${process.env.PORT}`);
  console.log(`SERVIDOR INICIADO EN PUERTO: ${process.env.PORT}`);
});

initIO(server);
StartAllWhatsAppsSessions();
gracefulShutdown(server);
