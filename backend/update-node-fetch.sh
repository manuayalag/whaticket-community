#!/bin/bash
# Script para arreglar el problema de node-fetch

echo "Instalando node-fetch compatible con CommonJS..."

# Desinstalar node-fetch actual si existe
npm uninstall node-fetch

# Instalar versión compatible con CommonJS
npm install node-fetch@2.6.7

# Crear un archivo de compatibilidad
mkdir -p ./src/utils
cat > ./src/utils/fetchPolyfill.ts << 'EOL'
/**
 * Polyfill para fetch en Node.js
 */
let fetchImplementation: any;

try {
  // Intento 1: Importar como CommonJS
  const nodeFetch = require('node-fetch');
  fetchImplementation = nodeFetch.default || nodeFetch;
} catch (error) {
  console.error("Error al cargar node-fetch con require:", error);
  try {
    // Intento 2: Importación dinámica (fallback)
    const http = require('http');
    const https = require('https');
    const { URL } = require('url');
    
    // Implementación básica de fetch
    fetchImplementation = (url: string, options: any = {}) => {
      return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        
        const req = client.request(url, options, (res: any) => {
          const chunks: any[] = [];
          res.on('data', (chunk: any) => chunks.push(chunk));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString();
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              json: () => Promise.resolve(JSON.parse(body)),
              text: () => Promise.resolve(body)
            });
          });
        });
        
        req.on('error', reject);
        
        if (options.body) {
          req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        
        req.end();
      });
    };
  } catch (error) {
    console.error("Error al crear fetch alternativo:", error);
  }
}

// Exportar la implementación de fetch
export default fetchImplementation;
if (typeof globalThis !== 'undefined' && !globalThis.fetch) {
  (globalThis as any).fetch = fetchImplementation;
}
EOL

echo "Archivo polyfill creado en ./src/utils/fetchPolyfill.ts"

# Crear archivo de tipos
mkdir -p ./src/@types
cat > ./src/@types/node-fetch.d.ts << 'EOL'
declare module 'node-fetch' {
  export default function fetch(url: string | Request, init?: RequestInit): Promise<Response>;
  export class Request {}
  export class Response {
    ok: boolean;
    status: number;
    json(): Promise<any>;
    text(): Promise<string>;
  }
  export class Headers {}
}
EOL

echo "node-fetch instalado y configurado con compatibilidad"
