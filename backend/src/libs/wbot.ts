import qrCode from "qrcode-terminal";
import { Client, LocalAuth } from "whatsapp-web.js";
import { getIO } from "./socket";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import { logToFile } from "../utils/fileLogger";
import { OpenAI } from "openai";
import Setting from "../models/Setting";
import fetch from "node-fetch";

// Configurar fetch para OpenAI
if (!globalThis.fetch) {
  globalThis.fetch = fetch as any;
}

// Número objetivo para procesar con OpenAI
const TARGET_NUMBER = "595984848082";

interface Session extends Client {
  id?: number;
}

const sessions: Session[] = [];

export const initWbot = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise((resolve, reject) => {
    try {
      const io = getIO();
      const sessionName = whatsapp.name;
      let sessionCfg;

      if (whatsapp && whatsapp.session) {
        sessionCfg = JSON.parse(whatsapp.session);
      }

      const args:String = process.env.CHROME_ARGS || "";

      const wbot: Session = new Client({
        session: sessionCfg,
        authStrategy: new LocalAuth({clientId: 'bd_'+whatsapp.id}),
        puppeteer: {
          executablePath: process.env.CHROME_BIN || undefined,
          // @ts-ignore
          browserWSEndpoint: process.env.CHROME_WS || undefined,
          args: args.split(' ')
        }
      });

      wbot.id = whatsapp.id;

      wbot.on("qr", async qr => {
        logger.info("Session:", sessionName);
        qrCode.generate(qr, { small: true });
        await whatsapp.update({ qrcode: qr, status: "qrcode", retries: 0 });

        io.emit("whatsappSession", {
          action: "update",
          session: whatsapp
        });
      });

      wbot.on("authenticated", async () => {
        logger.info(`Session: ${sessionName} AUTHENTICATED`);
      });

      wbot.on("auth_failure", async msg => {
        logger.error(`Session: ${sessionName} AUTHENTICATION FAILURE! Reason: ${msg}`);
        reject(new Error(msg));
      });

      // IMPORTANTE: Agregar evento de mensaje directamente aquí
      wbot.on("message", async (msg) => {
        try {
          console.log("MENSAJE RECIBIDO:", msg.body);
          logToFile("MENSAJE RECIBIDO: " + msg.body);
          
          // Verificar si es del número objetivo
          const contactNumber = msg.from.replace("@c.us", "");
          
          if (contactNumber === TARGET_NUMBER) {
            console.log("MENSAJE DEL NÚMERO OBJETIVO:", msg.body);
            logToFile("MENSAJE DEL NÚMERO OBJETIVO: " + msg.body);
            
            // Procesar con OpenAI
            try {
              const settings = await Setting.findOne({
                where: { key: 'openai' }
              });

              if (!settings) {
                logToFile("Error: Configuración de OpenAI no encontrada");
                await wbot.sendMessage(msg.from, "Error: OpenAI no está configurado");
                return;
              }

              const parsedSettings = JSON.parse(settings.value);
              
              if (!parsedSettings.key) {
                logToFile("Error: API key de OpenAI no encontrada");
                await wbot.sendMessage(msg.from, "Error: Falta API key de OpenAI");
                return;
              }

              const openai = new OpenAI({ apiKey: parsedSettings.key });
              
              logToFile("Enviando mensaje a OpenAI: " + msg.body);
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
              logToFile("Respuesta de OpenAI: " + response);

              await wbot.sendMessage(msg.from, `\u200e${response}`);
              logToFile("Respuesta enviada exitosamente");
            } catch (error) {
              logToFile("Error procesando mensaje con OpenAI: " + error.message);
              try {
                await wbot.sendMessage(msg.from, `Error al procesar con IA: ${error.message}`);
              } catch (sendError) {
                logToFile("Error al enviar mensaje de error: " + sendError.message);
              }
            }
          }
        } catch (error) {
          console.error("ERROR AL PROCESAR MENSAJE:", error);
          logToFile("ERROR AL PROCESAR MENSAJE: " + error.message);
        }
      });

      wbot.on("ready", async () => {
        logger.info(`Session: ${sessionName} READY`);
        console.log(`SESIÓN WHATSAPP LISTA: ${sessionName}`);
        logToFile(`SESIÓN WHATSAPP LISTA: ${sessionName}`);

        await whatsapp.update({
          status: "CONNECTED",
          qrcode: "",
          retries: 0
        });

        io.emit("whatsappSession", {
          action: "update",
          session: whatsapp
        });

        resolve(wbot);
      });

      wbot.initialize();

      const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
      if (sessionIndex !== -1) {
        sessions[sessionIndex] = wbot;
      } else {
        sessions.push(wbot);
      }

    } catch (err) {
      logger.error(`Error initializing WhatsApp: ${err}`);
      reject(err);
    }
  });
};

export const getWbot = (whatsappId: number): Session => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);

  if (sessionIndex === -1) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  return sessions[sessionIndex];
};

export const removeWbot = (whatsappId: number): void => {
  try {
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex !== -1) {
      sessions[sessionIndex].destroy();
      sessions.splice(sessionIndex, 1);
    }
  } catch (err) {
    logger.error(err instanceof Error ? err : { error: String(err) });
  }
};