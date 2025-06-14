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
import Ticket from "../../models/Ticket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import { logger } from "../../utils/logger";
import { Op } from "sequelize";

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
      
      // Variable para mantener referencia al contacto para uso posterior
      let contact;
        // Procesar el mensaje para crear un ticket y guardar el mensaje
      try {
        const whatsappId = (wbot as any).id;
        if (!whatsappId) {
          logToFile("ERROR: No se pudo obtener el ID de WhatsApp");
          return;
        }
          // Encontrar o crear el contacto
        contact = await CreateOrUpdateContactService({
          name: contactNumber, // Usamos el número como nombre si no hay otro disponible
          number: contactNumber,
          profilePicUrl: "",
          isGroup: false // Asumimos que no es grupo para simplificar
        });

        logToFile(`Contacto encontrado/creado: ${contact.name}`);
        
        // Encontrar o crear el ticket
        const ticket = await FindOrCreateTicketService(
          contact,
          whatsappId,
          1,
          undefined // No soportamos grupos en esta implementación simple
        );

        logToFile(`Ticket encontrado/creado: ${ticket.id}`);
        
        // Crear el mensaje en la base de datos
        const messageData = {
          id: msg.id.id,
          ticketId: ticket.id,
          contactId: msg.fromMe ? undefined : contact.id,
          body: msg.body,
          fromMe: msg.fromMe,
          mediaType: "chat", // Simplificado a solo chat
          read: msg.fromMe,
        };

        await CreateMessageService({ messageData });
        logToFile("Mensaje guardado en la base de datos");
      } catch (err) {
        logToFile(`ERROR al guardar mensaje/ticket: ${err}`);
        console.error(err);
      }
      
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
          const sentMessage = await wbot.sendMessage(msg.from, `\u200e${response}`);
          logToFile("Respuesta enviada exitosamente");
            // Guardar la respuesta del bot como mensaje
          try {            // Verificamos que el contacto exista
            if (!contact) {
              logToFile("ERROR: No hay contacto para guardar la respuesta");
              return;
            }
            
            const ticket = await Ticket.findOne({
              where: {
                status: {
                  [Op.or]: ["open", "pending"]
                },
                contactId: contact.id,
                whatsappId: (wbot as any).id
              },
              order: [["updatedAt", "DESC"]]
            });
            
            if (ticket) {
              const messageData = {
                id: sentMessage.id.id,
                ticketId: ticket.id,
                body: response,
                fromMe: true,
                mediaType: "chat",
                read: true
              };
              
              await CreateMessageService({ messageData });
              logToFile("Respuesta guardada en la base de datos");
            }
          } catch (err) {
            logToFile(`ERROR al guardar respuesta: ${err}`);
          }

        } catch (error: any) {
          logToFile(`ERROR al procesar con OpenAI: ${error?.message || 'Error desconocido'}`);
          try {
            await wbot.sendMessage(msg.from, `Error al procesar con IA: ${error?.message || "Error desconocido"}`);
          } catch (sendError: any) {
            logToFile(`ERROR al enviar mensaje de error: ${sendError?.message || 'Error desconocido'}`);
          }
        }
      } else {
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
