#!/bin/bash
# Script para arreglar el problema de node-fetch

# Desinstalar node-fetch actual si existe
npm uninstall node-fetch

# Instalar versión compatible con CommonJS
npm install node-fetch@2.6.7

echo "node-fetch instalado en versión compatible"
