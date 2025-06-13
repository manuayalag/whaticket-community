import { Request, Response } from 'express';
import { OpenAI } from 'openai';
import AppError from "../errors/AppError";
import Setting from "../models/Setting";

interface OpenAISettings {
  key: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemMessage: string;
}

export const getSettings = async (req: Request, res: Response): Promise<Response> => {
  const settings = await Setting.findOne({
    where: { key: 'openai' }
  });

  if (!settings) {
    return res.status(200).json({
      key: '',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 500,
      systemMessage: 'Eres un asistente amable y profesional.'
    });
  }

  return res.status(200).json(JSON.parse(settings.value));
};

export const saveSettings = async (req: Request, res: Response): Promise<Response> => {
  const { key, model, temperature, maxTokens, systemMessage }: OpenAISettings = req.body;

  const [settings] = await Setting.findOrCreate({
    where: { key: 'openai' },
    defaults: {
      value: JSON.stringify({ key, model, temperature, maxTokens, systemMessage })
    }
  });

  if (settings) {
    settings.value = JSON.stringify({ key, model, temperature, maxTokens, systemMessage });
    await settings.save();
  }

  return res.status(200).json({ message: 'Settings saved successfully' });
};

export const sendMessage = async (req: Request, res: Response): Promise<Response> => {
  const { message } = req.body;
  const settings = await Setting.findOne({
    where: { key: 'openai' }
  });

  if (!settings) {
    throw new AppError('OpenAI settings not found', 404);
  }

  const { key, model, temperature, maxTokens, systemMessage } = JSON.parse(settings.value);

  if (!key) {
    throw new AppError('OpenAI API key not configured', 400);
  }

  const openai = new OpenAI({ apiKey: key });

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: systemMessage || 'Eres un asistente amable y profesional.' },
        { role: 'user', content: message }
      ],
      model: model || 'gpt-3.5-turbo',
      temperature: temperature || 0.7,
      max_tokens: maxTokens || 500
    });

    return res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    throw new AppError('Error calling OpenAI API', 500);
  }
};
