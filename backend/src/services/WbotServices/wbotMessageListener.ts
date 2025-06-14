import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import fetch from "node-fetch";
import { OpenAI } from "openai";
import Setting from "../../models/Setting";
import { logToFile, clearLogFile } from "../../utils/fileLogger";
import {
  Message as WbotMessage,
  Client
} from "whatsapp-web.js";

// Set fetch globally for OpenAI
if (!globalThis.fetch) {
  globalThis.fetch = fetch as any;
}

type Session = Client;

const TARGET_NUMBER = "595984848082";

// Clear log file on start
clearLogFile();

// Simple implementation focusing only on the core functionality
export const wbotMessageListener = (wbot: Session): void => {
  logToFile("=========================================");
  logToFile("INICIANDO LISTENER DE MENSAJES");
  logToFile("=========================================");

  // Process only messages from our target
  wbot.on("message", async (msg) => {
    try {
      logToFile("=========================================");
      logToFile("NUEVO MENSAJE RECIBIDO");
      logToFile(`De: ${msg.from}`);
      logToFile(`Contenido: ${msg.body}`);      // Check if it's our target number
      const contactNumber = msg.from.replace("@c.us", "");
      logToFile(`Número extraído: ${contactNumber}`);

      // Always process the message in the system but only use OpenAI for target number
      const isTargetNumber = contactNumber === TARGET_NUMBER;
      
      if (isTargetNumber) {
        logToFile("¡MENSAJE DE NÚMERO OBJETIVO DETECTADO!");
        logToFile("Procesando con OpenAI...");

        try {
          const settings = await Setting.findOne({
            where: { key: 'openai' }
          });

          if (!settings) {
            logToFile("ERROR: No se encontró configuración de OpenAI");
            await wbot.sendMessage(msg.from, "Error: OpenAI no está configurado");
            return;
          }

          logToFile(`Configuración de OpenAI encontrada: ${settings.value}`);
          const parsedSettings = JSON.parse(settings.value);
          
          if (!parsedSettings.key) {
            logToFile("ERROR: No se encontró API key de OpenAI");
            await wbot.sendMessage(msg.from, "Error: Falta API key de OpenAI");
            return;
          }

          const openai = new OpenAI({ apiKey: parsedSettings.key });
          
          logToFile(`Enviando mensaje a OpenAI: ${msg.body}`);
          const completion = await openai.chat.completions.create({
            messages: [
              { 
                role: 'system', 
                content: parsedSettings.systemMessage || 'Eres un asistente amable y profesional.' 
              },
              { 
                role: 'user', 
                content: msg.body 
              }
            ],
            model: parsedSettings.model || 'gpt-3.5-turbo',
            temperature: 0.7,
            max_tokens: 500
          });

          const response = completion.choices[0]?.message?.content || "No se generó respuesta";
          logToFile(`Respuesta de OpenAI: ${response}`);

          logToFile("Enviando respuesta al usuario...");
          await wbot.sendMessage(msg.from, `\u200e${response}`);
          logToFile("Respuesta enviada exitosamente");

        } catch (error: any) {
          logToFile(`ERROR al procesar con OpenAI: ${error?.message || 'Error desconocido'}`);
          try {
            await wbot.sendMessage(msg.from, `Error al procesar con IA: ${error?.message || "Error desconocido"}`);
          } catch (sendError: any) {
            logToFile(`ERROR al enviar mensaje de error: ${sendError?.message || 'Error desconocido'}`);
          }
        }      } else {
        logToFile("Mensaje recibido correctamente - No es del número objetivo, no se procesará con IA pero se registrará en el sistema");
      }
      
      // All messages will continue to be processed by the rest of the system

    } catch (err: any) {
      logToFile(`ERROR general al procesar mensaje: ${err?.message || 'Error desconocido'}`);
    }
  });

  logToFile("LISTENER DE MENSAJES INICIALIZADO");
  logToFile("=========================================");
};
