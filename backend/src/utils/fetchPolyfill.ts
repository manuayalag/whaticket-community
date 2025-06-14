/**
 * Polyfill para fetch en Node.js
 * Este archivo resuelve los problemas de compatibilidad entre ESM y CommonJS para node-fetch
 */

// Intentar diferentes enfoques para importar node-fetch
let fetchImplementation: any;

try {
  // Intentar primero con require
  fetchImplementation = require("node-fetch");
  // node-fetch puede exportar { default } en nuevas versiones
  if (fetchImplementation.default) {
    fetchImplementation = fetchImplementation.default;
  }
} catch (error) {
  console.error("Error al cargar node-fetch con require:", error);
  
  try {
    // Intentar importarlo dinámicamente
    import("node-fetch").then((module) => {
      fetchImplementation = module.default || module;
      if (!globalThis.fetch) {
        globalThis.fetch = fetchImplementation as any;
      }
    }).catch(importError => {
      console.error("Error al cargar node-fetch dinámicamente:", importError);
    });
  } catch (dynamicError) {
    console.error("Error al importar node-fetch dinámicamente:", dynamicError);
  }
}

// Asignar a globalThis solo si fetch no está ya definido
if (fetchImplementation && !globalThis.fetch) {
  globalThis.fetch = fetchImplementation as any;
}

if (fetchImplementation && fetchImplementation.Headers) {
  globalThis.Headers = fetchImplementation.Headers;
}

export default fetchImplementation;
