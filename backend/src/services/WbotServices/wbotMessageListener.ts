import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import * as Sentry from "@sentry/node";
import fetch from "node-fetch";
import { OpenAI } from "openai";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Setting from "../../models/Setting";
import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { debounce } from "../../helpers/Debounce";
import { logger } from "../../utils/logger";
import CreateContactService from "../ContactServices/CreateContactService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import formatBody from "../../helpers/Mustache";
import {
  Contact as WbotContact,
  Message as WbotMessage,
  MessageAck,
  Client
} from "whatsapp-web.js";

type Session = Client;

// Configurar fetch globalmente para OpenAI
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
  console.log('\n=== Starting OpenAI Message Processing ===');
  console.log('Received message:', msg);
  
  try {
    console.log('Fetching OpenAI settings from database...');
    const settings = await Setting.findOne({
      where: { key: 'openai' }
    });

    if (!settings) {
      console.log('No settings found in database');
      return "OpenAI configuration not found";
    }

    console.log('Raw settings from database:', settings.value);
    
    let parsedSettings;
    try {
      parsedSettings = JSON.parse(settings.value);
      console.log('Parsed settings:', {
        hasKey: !!parsedSettings.key,
        model: parsedSettings.model,
        hasSystemMessage: !!parsedSettings.systemMessage
      });
    } catch (parseError) {
      console.error('Error parsing settings:', parseError);
      return "Error parsing OpenAI configuration";
    }

    const { key, model, systemMessage } = parsedSettings;

    if (!key) {
      console.log('API key is missing in settings');
      return "OpenAI API key not configured";
    }

    console.log('Initializing OpenAI with config:', {
      model: model || 'gpt-3.5-turbo',
      messageLength: msg.length,
      keyLength: key.length
    });

    const openai = new OpenAI({ apiKey: key });

    try {
      console.log('Sending request to OpenAI...');
      const completion = await openai.chat.completions.create({
        messages: [
          { role: 'system', content: systemMessage || 'Eres un asistente amable y profesional.' },
          { role: 'user', content: msg }
        ],
        model: model || 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 500
      });

      console.log('Received response from OpenAI:', {
        hasChoices: !!completion.choices,
        choicesLength: completion.choices?.length
      });

      const response = completion.choices[0]?.message?.content || "No response generated";
      console.log('Final response:', response);
      return response;

    } catch (error) {
      console.error('OpenAI API Error:', {
        message: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined
      });
      return `Error calling OpenAI API: ${error instanceof Error ? error.message : String(error)}`;
    }
  } catch (error) {
    console.error('Unexpected error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return `Error processing message with AI: ${error instanceof Error ? error.message : String(error)}`;
  }
};

const verifyMessage = async (
  msg: WbotMessage,
  ticket: Ticket,
  contact: Contact
) => {
  console.log('\n=== Message Received ===');
  console.log('Message type:', msg.type);
  console.log('From contact:', contact.number);
  console.log('Is fromMe:', msg.fromMe);
  console.log('Body starts with u200e:', msg.body.startsWith("\u200e"));

  if (msg.type === 'location')
    msg = prepareLocation(msg);

  // Process with OpenAI only for specific number and chat messages
  if (
    !msg.fromMe && 
    contact.number === "595984848082" && 
    msg.type === "chat" && 
    !msg.body.startsWith("\u200e")
  ) {
    console.log('\n=== Conditions for AI Processing ===');
    console.log('Not fromMe:', !msg.fromMe);
    console.log('Contact number matches:', contact.number === "595984848082");
    console.log('Message type is chat:', msg.type === "chat");
    console.log('Body does not start with u200e:', !msg.body.startsWith("\u200e"));
    
    try {
      console.log('\n=== Processing message for OpenAI ===');
      console.log('From contact:', contact.number);
      console.log('Message:', msg.body);

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

        // Send the message
        const sentMessage = await wbot.sendMessage(
          chatId,
          `\u200e${aiResponse}`,
          { sendSeen: true }
        );

        console.log('Message sent successfully:', sentMessage.id.id);
      } catch (sendError) {
        console.error('Error sending WhatsApp message:', {
          error: sendError.message,
          stack: sendError.stack
        });
      }
    } catch (error) {
      console.error('Error in AI processing:', {
        error: error.message,
        stack: error.stack
      });
    }
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

const handleMessage = async (
  msg: WbotMessage,
  wbot: Session
): Promise<void> => {
  if (!isValidMsg(msg)) {
    return;
  }

  try {
    console.log('\n=== New Message Handling Started ===');
    let msgContact: WbotContact;
    let groupContact: Contact | undefined;

    if (msg.fromMe) {
      if (/\u200e/.test(msg.body[0])) {
        console.log('Message has u200e prefix, skipping');
        return;
      }

      if (!msg.hasMedia && msg.type !== "location" && msg.type !== "chat" && msg.type !== "vcard") {
        console.log('Message is not media/location/chat/vcard, skipping');
        return;
      }

      msgContact = await wbot.getContactById(msg.to);
    } else {
      msgContact = await msg.getContact();
    }

    const chat = await msg.getChat();

    if (chat.isGroup) {
      let msgGroupContact;

      if (msg.fromMe) {
        msgGroupContact = await wbot.getContactById(msg.to);
      } else {
        msgGroupContact = await wbot.getContactById(msg.from);
      }

      groupContact = await verifyContact(msgGroupContact);
    }
    const whatsapp = await ShowWhatsAppService(wbot.id!);

    const unreadMessages = msg.fromMe ? 0 : chat.unreadCount;

    const contact = await verifyContact(msgContact);

    if (
      unreadMessages === 0 &&
      whatsapp.farewellMessage &&
      formatBody(whatsapp.farewellMessage, contact) === msg.body
    )
      return;

    const ticket = await FindOrCreateTicketService(
      contact,
      wbot.id!,
      unreadMessages,
      groupContact
    );

    if (msg.hasMedia) {
      await verifyMediaMessage(msg, ticket, contact);
    } else {
      await verifyMessage(msg, ticket, contact);
    }

    if (
      !ticket.queue &&
      !chat.isGroup &&
      !msg.fromMe &&
      !ticket.userId &&
      whatsapp.queues.length >= 1
    ) {
      await verifyQueue(wbot, msg, ticket, contact);
    }

    if (msg.type === "vcard") {
      try {
        const array = msg.body.split("\n");
        const obj = [];
        let contact = "";
        for (let index = 0; index < array.length; index++) {
          const v = array[index];
          const values = v.split(":");
          for (let ind = 0; ind < values.length; ind++) {
            if (values[ind].indexOf("+") !== -1) {
              obj.push({ number: values[ind] });
            }
            if (values[ind].indexOf("FN") !== -1) {
              contact = values[ind + 1];
            }
          }
        }
        for await (const ob of obj) {
          const cont = await CreateContactService({
            name: contact,
            number: ob.number.replace(/\D/g, "")
          });
        }
      } catch (error) {
        console.log(error);
      }
    }

    /* if (msg.type === "multi_vcard") {
      try {
        const array = msg.vCards.toString().split("\n");
        let name = "";
        let number = "";
        const obj = [];
        const conts = [];
        for (let index = 0; index < array.length; index++) {
          const v = array[index];
          const values = v.split(":");
          for (let ind = 0; ind < values.length; ind++) {
            if (values[ind].indexOf("+") !== -1) {
              number = values[ind];
            }
            if (values[ind].indexOf("FN") !== -1) {
              name = values[ind + 1];
            }
            if (name !== "" && number !== "") {
              obj.push({
                name,
                number
              });
              name = "";
              number = "";
            }
          }
        }

        // eslint-disable-next-line no-restricted-syntax
        for await (const ob of obj) {
          try {
            const cont = await CreateContactService({
              name: ob.name,
              number: ob.number.replace(/\D/g, "")
            });
            conts.push({
              id: cont.id,
              name: cont.name,
              number: cont.number
            });
          } catch (error) {
            if (error.message === "ERR_DUPLICATED_CONTACT") {
              const cont = await GetContactService({
                name: ob.name,
                number: ob.number.replace(/\D/g, ""),
                email: ""
              });
              conts.push({
                id: cont.id,
                name: cont.name,
                number: cont.number
              });
            }
          }
        }
        msg.body = JSON.stringify(conts);
      } catch (error) {
        console.log(error);
      }
    } */
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err instanceof Error ? err : { error: String(err) });
  }
};

const handleMsgAck = async (msg: WbotMessage, ack: MessageAck) => {
  await new Promise(r => setTimeout(r, 500));

  const io = getIO();

  try {
    console.log('\n=== Handling Message ACK ===');
    console.log('Message ID:', msg.id.id);
    console.log('ACK Status:', ack);

    const messageToUpdate = await Message.findByPk(msg.id.id, {
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });
    if (!messageToUpdate) {
      console.log('Message not found in database');
      return;
    }

    // Asegurarse de que ack sea un número válido
    const validAck = typeof ack === 'number' ? ack : 0;
    
    await messageToUpdate.update({ ack: validAck });

    console.log('Message ACK updated successfully');

    io.to(messageToUpdate.ticketId.toString()).emit("appMessage", {
      action: "update",
      message: messageToUpdate
    });
  } catch (err) {
    console.error('Error updating message ACK:', err);
    Sentry.captureException(err);
    logger.error(err instanceof Error ? err : { error: String(err) });
  }
};

const wbotMessageListener = (wbot: Session): void => {
  console.log('=== Setting up WhatsApp message listeners ===');

  wbot.on("message_create", async (msg: WbotMessage) => {
    console.log('\n=== Message Create Event Triggered ===');
    console.log('Message type:', msg.type);
    console.log('Message body:', msg.body);
    handleMessage(msg, wbot);
  });

  wbot.on("message", async (msg: WbotMessage) => {
    console.log('\n=== Message Event Triggered ===');
    console.log('Message type:', msg.type);
    console.log('Message body:', msg.body);
    handleMessage(msg, wbot);
  });

  wbot.on("media_uploaded", async (msg: WbotMessage) => {
    console.log('\n=== Media Uploaded Event Triggered ===');
    handleMessage(msg, wbot);
  });

  wbot.on("message_ack", async (msg: WbotMessage, ack: MessageAck) => {
    console.log('\n=== Message ACK Event Triggered ===');
    console.log('ACK Status:', ack);
    try {
      await handleMsgAck(msg, ack || 0); // Asegurarse de que ack nunca sea null
    } catch (err) {
      console.error('Error handling message ack:', err);
    }
  });

  console.log('=== WhatsApp message listeners setup complete ===');
};

export { wbotMessageListener, handleMessage };
