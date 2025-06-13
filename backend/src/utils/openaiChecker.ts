import { OpenAI } from 'openai';
import Setting from '../models/Setting';
import fetch from 'node-fetch';
import { logToFile } from './fileLogger';

// Set fetch globally for OpenAI
if (!globalThis.fetch) {
  globalThis.fetch = fetch as any;
}

export const verifyOpenAIConfig = async (): Promise<void> => {
  try {
    logToFile('==============================');
    logToFile('VERIFICANDO CONFIGURACIÓN DE OPENAI');

    const settings = await Setting.findOne({
      where: { key: 'openai' }
    });

    if (!settings) {
      logToFile('ERROR: No se encontró configuración de OpenAI en la base de datos');
      return;
    }

    logToFile(`Configuración encontrada: ${settings.value}`);
    
    try {
      const parsedSettings = JSON.parse(settings.value);
      
      if (!parsedSettings.key) {
        logToFile('ERROR: No se encontró API key de OpenAI');
        return;
      }
      
      logToFile(`API Key encontrada (primeros 5 caracteres): ${parsedSettings.key.substring(0, 5)}...`);
      logToFile(`Modelo configurado: ${parsedSettings.model || 'Predeterminado (gpt-3.5-turbo)'}`);
      
      // Probar conexión
      const openai = new OpenAI({ apiKey: parsedSettings.key });
      logToFile('Probando conexión a OpenAI...');
      
      const completion = await openai.chat.completions.create({
        messages: [
          { role: 'system', content: 'Eres un sistema de prueba.' },
          { role: 'user', content: 'Responde solamente con la palabra "OK" si me escuchas.' }
        ],
        model: parsedSettings.model || 'gpt-3.5-turbo',
        max_tokens: 10
      });
      
      const response = completion.choices[0]?.message?.content || 'Sin respuesta';
      logToFile(`Respuesta de prueba de OpenAI: ${response}`);
      logToFile('Conexión a OpenAI EXITOSA');
      
    } catch (parseError) {
      logToFile(`ERROR al parsear/probar configuración: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
    
  } catch (error) {
    logToFile(`ERROR al verificar configuración: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  logToFile('VERIFICACIÓN COMPLETADA');
  logToFile('==============================');
};
