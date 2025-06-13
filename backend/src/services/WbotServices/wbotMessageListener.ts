import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import * as Sentry from "@sentry/node";
import { OpenAI } from "openai";
import fetch from "node-fetch";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Setting from "../../models/Setting";
import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { logger } from "../../utils/logger";
import {
  Contact as WbotContact,
  Message as WbotMessage,
  MessageAck,
  Client
} from "whatsapp-web.js";

type Session = Client;

// Set fetch globally for OpenAI
if (!globalThis.fetch) {
  globalThis.fetch = fetch;
}

const writeFileAsync = promisify(writeFile);

const verifyContact = async (msgContact: WbotContact): Promise<Contact> => {
  const profilePicUrl = await msgContact.getProfilePicUrl();

  const contactData = {
    name: msgContact.name || msgContact.pushname || msgContact.id.user,
    number: msgContact.id.user,
    profilePicUrl,
    isGroup: msgContact.isGroup
  };

  const contact = CreateOrUpdateContactService(contactData);

  return contact;
};

const verifyQuotedMessage = async (
  msg: WbotMessage
): Promise<Message | null> => {
  if (!msg.hasQuotedMsg) return null;

  const wbotQuotedMsg = await msg.getQuotedMessage();

  const quotedMsg = await Message.findOne({
    where: { id: wbotQuotedMsg.id.id }
  });

  if (!quotedMsg) return null;

  return quotedMsg;
};


// generate random id string for file names, function got from: https://stackoverflow.com/a/1349426/1851801
function makeRandomId(length: number) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

const verifyMediaMessage = async (
  msg: WbotMessage,
  ticket: Ticket,
  contact: Contact
): Promise<Message> => {
  const quotedMsg = await verifyQuotedMessage(msg);

  const media = await msg.downloadMedia();

  if (!media) {
    throw new Error("ERR_WAPP_DOWNLOAD_MEDIA");
  }

  let randomId = makeRandomId(5);

  if (!media.filename) {
    const ext = media.mimetype.split("/")[1].split(";")[0];
    media.filename = `${randomId}-${new Date().getTime()}.${ext}`;
  } else {
    media.filename = media.filename.split('.').slice(0,-1).join('.')+'.'+randomId+'.'+media.filename.split('.').slice(-1);
  }

  try {
    await writeFileAsync(
      join(__dirname, "..", "..", "..", "public", media.filename),
      media.data,
      "base64"
    );
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err instanceof Error ? err : { error: String(err) });
  }

  const messageData = {
    id: msg.id.id,
    ticketId: ticket.id,
    contactId: msg.fromMe ? undefined : contact.id,
    body: msg.body || media.filename,
    fromMe: msg.fromMe,
    read: msg.fromMe,
    mediaUrl: media.filename,
    mediaType: media.mimetype.split("/")[0],
    quotedMsgId: quotedMsg?.id
  };

  await ticket.update({ lastMessage: msg.body || media.filename });
  const newMessage = await CreateMessageService({ messageData });

  return newMessage;
};

const processOpenAIMessage = async (msg: string): Promise<string> => {
  console.log('\n********************');
  console.log('INICIANDO PROCESAMIENTO DE IA');
  console.log('Mensaje recibido:', msg);
  
  try {
    console.log('Buscando configuración de OpenAI...');
    const settings = await Setting.findOne({
      where: { key: 'openai' }
    });

    if (!settings) {
      console.error('ERROR: No se encontró configuración de OpenAI en la base de datos');
      return "OpenAI no está configurado";
    }

    console.log('Configuración encontrada, parseando...');
    let parsedSettings;
    try {
      parsedSettings = JSON.parse(settings.value);
      console.log('Configuración parseada:', {
        tieneKey: !!parsedSettings.key,
        modelo: parsedSettings.model,
        longitudKey: parsedSettings.key?.length
      });
    } catch (parseError) {
      console.error('ERROR al parsear configuración:', parseError);
      return "Error en configuración de OpenAI";
    }

    const { key, model, systemMessage } = parsedSettings;

    if (!key) {
      console.error('ERROR: No se encontró API key de OpenAI');
      return "Falta API key de OpenAI";
    }

    console.log('Inicializando cliente de OpenAI...');
    const openai = new OpenAI({ apiKey: key });

    try {
      console.log('Enviando solicitud a OpenAI...');
      const completion = await openai.chat.completions.create({
        messages: [
          { 
            role: 'system', 
            content: systemMessage || 'Eres un asistente amable y profesional.' 
          },
          { 
            role: 'user', 
            content: msg 
          }
        ],
        model: model || 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 500
      });

      console.log('Respuesta recibida de OpenAI');
      const response = completion.choices[0]?.message?.content || "No se generó respuesta";
      console.log('Respuesta de IA:', response);
      return response;

    } catch (error) {
      console.error('ERROR al llamar a OpenAI API:', error);
      console.error('Detalles del error:', {
        mensaje: error instanceof Error ? error.message : String(error),
        tipo: error instanceof Error ? error.constructor.name : typeof error
      });
      return `Error al llamar a OpenAI: ${error instanceof Error ? error.message : String(error)}`;
    }
  } catch (error) {
    console.error('ERROR inesperado:', error);
    return `Error al procesar mensaje: ${error instanceof Error ? error.message : String(error)}`;
  }
};

const verifyMessage = async (
  msg: WbotMessage,
  ticket: Ticket,
  contact: Contact
) => {
  console.log('\n=== Verify Message Start ===');
  console.log('Contact number:', contact.number);
  console.log('Message type:', msg.type);
  console.log('Is fromMe:', msg.fromMe);
  console.log('Message body:', msg.body);

  if (msg.type === 'location')
    msg = prepareLocation(msg);

  // Process with OpenAI only for specific number and chat messages
  if (
    !msg.fromMe && 
    contact.number === "595984848082" && 
    msg.type === "chat" && 
    !msg.body.startsWith("\u200e")
  ) {
    try {
      console.log('\n=== OpenAI Processing Conditions Met ===');
      console.log('From contact:', contact.number);
      console.log('Message:', msg.body);

      const settings = await Setting.findOne({
        where: { key: 'openai' }
      });

      if (!settings) {
        console.error('OpenAI settings not found in database');
        return;
      }

      console.log('Found OpenAI settings:', {
        hasSettings: !!settings,
        settingsValue: settings.value
      });

      const aiResponse = await processOpenAIMessage(msg.body);
      console.log('AI Response received:', aiResponse);

      // Get the WhatsApp instance
      const wbot = await GetTicketWbot(ticket);
      
      if (!wbot) {
        console.error('Could not get WhatsApp instance');
        return;
      }

      try {
        // Construct the chat ID properly
        const chatId = `${contact.number}@${ticket.isGroup ? "g" : "c"}.us`;
        console.log('Attempting to send message to:', chatId);
        console.log('Message to send:', aiResponse);

        // Send the message
        const sentMessage = await wbot.sendMessage(
          chatId,
          `\u200e${aiResponse}`,
          { sendSeen: true }
        );

        console.log('Message sent successfully:', sentMessage.id.id);
      } catch (sendError) {
        console.error('Error sending WhatsApp message:', {
          error: sendError instanceof Error ? sendError.message : String(sendError),
          stack: sendError instanceof Error ? sendError.stack : undefined
        });
      }
    } catch (error) {
      console.error('Error in AI processing:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  } else {
    console.log('Message did not meet OpenAI processing conditions:');
    console.log('- Not fromMe:', !msg.fromMe);
    console.log('- Contact number matches:', contact.number === "595984848082");
    console.log('- Message type is chat:', msg.type === "chat");
    console.log('- Does not start with u200e:', !msg.body.startsWith("\u200e"));
  }

  const quotedMsg = await verifyQuotedMessage(msg);
  const messageData = {
    id: msg.id.id,
    ticketId: ticket.id,
    contactId: msg.fromMe ? undefined : contact.id,
    body: msg.body,
    fromMe: msg.fromMe,
    mediaType: msg.type,
    read: msg.fromMe,
    quotedMsgId: quotedMsg?.id
  };

  await ticket.update({ lastMessage: msg.type === "location" ? msg.location.description ? "Localization - " + msg.location.description.split('\\n')[0] : "Localization" : msg.body });

  await CreateMessageService({ messageData });
};

const prepareLocation = (msg: WbotMessage): WbotMessage => {
  let gmapsUrl = "https://maps.google.com/maps?q=" + msg.location.latitude + "%2C" + msg.location.longitude + "&z=17&hl=pt-BR";

  msg.body = "data:image/png;base64," + msg.body + "|" + gmapsUrl;

  // temporaryly disable ts checks because of type definition bug for Location object
  // @ts-ignore
  msg.body += "|" + (msg.location.description ? msg.location.description : (msg.location.latitude + ", " + msg.location.longitude))

  return msg;
};

const verifyQueue = async (
  wbot: Session,
  msg: WbotMessage,
  ticket: Ticket,
  contact: Contact
) => {
  const { queues, greetingMessage } = await ShowWhatsAppService(wbot.id!);

  if (queues.length === 1) {
    await UpdateTicketService({
      ticketData: { queueId: queues[0].id },
      ticketId: ticket.id
    });

    return;
  }

  const selectedOption = msg.body;

  const choosenQueue = queues[+selectedOption - 1];

  if (choosenQueue) {
    await UpdateTicketService({
      ticketData: { queueId: choosenQueue.id },
      ticketId: ticket.id
    });

    const body = formatBody(`\u200e${choosenQueue.greetingMessage}`, contact);

    const sentMessage = await wbot.sendMessage(`${contact.number}@c.us`, body);

    await verifyMessage(sentMessage, ticket, contact);
  } else {
    let options = "";

    queues.forEach((queue, index) => {
      options += `*${index + 1}* - ${queue.name}\n`;
    });

    const body = formatBody(`\u200e${greetingMessage}\n${options}`, contact);

    const debouncedSentMessage = debounce(
      async () => {
        const sentMessage = await wbot.sendMessage(
          `${contact.number}@c.us`,
          body
        );
        verifyMessage(sentMessage, ticket, contact);
      },
      3000,
      ticket.id
    );

    debouncedSentMessage();
  }
};

const isValidMsg = (msg: WbotMessage): boolean => {
  if (msg.from === "status@broadcast") return false;
  if (
    msg.type === "chat" ||
    msg.type === "audio" ||
    msg.type === "ptt" ||
    msg.type === "video" ||
    msg.type === "image" ||
    msg.type === "document" ||
    msg.type === "vcard" ||
    //msg.type === "multi_vcard" ||
    msg.type === "sticker" ||
    msg.type === "location"
  )
    return true;
  return false;
};

export const wbotMessageListener = (wbot: Session): void => {
  console.log('\n=== Iniciando listener de mensajes ===');

  wbot.on("message", async (msg: WbotMessage) => {
    try {
      console.log('\n=== Mensaje Nuevo Recibido ===');
      console.log('De:', msg.from);
      console.log('Tipo:', msg.type);
      console.log('Contenido:', msg.body);

      const contact = await msg.getContact();
      console.log('Número de contacto:', contact.id.user);

      if (contact.id.user === "595984848082") {
        console.log('¡NÚMERO OBJETIVO DETECTADO! Procesando con IA...');
        
        try {
          console.log('Llamando a processOpenAIMessage...');
          const aiResponse = await processOpenAIMessage(msg.body);
          console.log('Respuesta de IA recibida:', aiResponse);

          // Enviar respuesta
          const chatId = `${contact.id.user}@c.us`;
          console.log('Intentando enviar respuesta a:', chatId);
          
          await wbot.sendMessage(chatId, `\u200e${aiResponse}`);
          console.log('¡Respuesta enviada exitosamente!');
        } catch (error) {
          console.error('ERROR al procesar/enviar mensaje de IA:', error);
        }
      } else {
        console.log('Mensaje no es del número objetivo, ignorando');
      }

    } catch (err) {
      console.error('ERROR al procesar mensaje:', err);
    }
  });

  console.log('Listener de mensajes inicializado correctamente');
};
