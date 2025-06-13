import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import fetch from "node-fetch";
import { OpenAI } from "openai";
import Setting from "../../models/Setting";
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

// Simple implementation focusing only on the core functionality
export const wbotMessageListener = (wbot: Session): void => {
  console.log("=========================================");
  console.log("INICIANDO LISTENER DE MENSAJES");
  console.log("=========================================");

  // Process only messages from our target
  wbot.on("message", async (msg) => {
    try {
      console.log("=========================================");
      console.log("NUEVO MENSAJE RECIBIDO");
      console.log("De:", msg.from);
      console.log("Contenido:", msg.body);

      // Check if it's our target number
      const contactNumber = msg.from.replace("@c.us", "");
      console.log("Número extraído:", contactNumber);

      if (contactNumber === TARGET_NUMBER) {
        console.log("¡MENSAJE DE NÚMERO OBJETIVO DETECTADO!");
        console.log("Procesando con OpenAI...");

        try {
          const settings = await Setting.findOne({
            where: { key: 'openai' }
          });

          if (!settings) {
            console.log("ERROR: No se encontró configuración de OpenAI");
            await wbot.sendMessage(msg.from, "Error: OpenAI no está configurado");
            return;
          }

          console.log("Configuración de OpenAI encontrada:", settings.value);
          const parsedSettings = JSON.parse(settings.value);
          
          if (!parsedSettings.key) {
            console.log("ERROR: No se encontró API key de OpenAI");
            await wbot.sendMessage(msg.from, "Error: Falta API key de OpenAI");
            return;
          }

          const openai = new OpenAI({ apiKey: parsedSettings.key });
          
          console.log("Enviando mensaje a OpenAI:", msg.body);
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
          console.log("Respuesta de OpenAI:", response);

          console.log("Enviando respuesta al usuario...");
          await wbot.sendMessage(msg.from, `\u200e${response}`);
          console.log("Respuesta enviada exitosamente");

        } catch (error) {
          console.error("ERROR al procesar con OpenAI:", error);
          try {
            await wbot.sendMessage(msg.from, `Error al procesar con IA: ${error.message || "Error desconocido"}`);
          } catch (sendError) {
            console.error("ERROR al enviar mensaje de error:", sendError);
          }
        }
      } else {
        console.log("Mensaje no es del número objetivo, ignorando");
      }

    } catch (err) {
      console.error("ERROR general al procesar mensaje:", err);
    }
  });

  console.log("LISTENER DE MENSAJES INICIALIZADO");
  console.log("=========================================");
};
