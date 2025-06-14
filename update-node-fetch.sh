#!/bin/bash
# Script para actualizar node-fetch en el contenedor Docker

echo "========================================="
echo "Script de actualización para WhatsApp Ticket System"
echo "========================================="

# Ubicación de trabajo
cd ~/whaticket

# Verificar si los contenedores están funcionando
echo "Verificando estado de los contenedores..."
docker ps | grep whaticket

# Instalar la versión correcta de node-fetch
echo "Instalando node-fetch en el contenedor..."
docker exec -it whaticket_backend_1 npm uninstall node-fetch
docker exec -it whaticket_backend_1 npm install node-fetch@2.6.7

# Crear el archivo de log si no existe
echo "Verificando archivo de log..."
docker exec -it whaticket_backend_1 mkdir -p /usr/src/app/logs
docker exec -it whaticket_backend_1 touch /usr/src/app/logs/debug.log
docker exec -it whaticket_backend_1 chmod 666 /usr/src/app/logs/debug.log

# Verificar la instalación
echo "Verificando instalación de node-fetch..."
docker exec -it whaticket_backend_1 npm list node-fetch

# Reiniciar el contenedor backend
echo "Reiniciando el backend..."
docker restart whaticket_backend_1

# Esperar a que el backend se inicie
echo "Esperando a que el backend se inicie..."
sleep 10

# Verificar los logs
echo "Verificando los logs..."
docker logs whaticket_backend_1 | tail -n 20

echo "========================================="
echo "¡Actualización completada!"
echo "Ahora envía un mensaje desde WhatsApp (595984848082) para probar"
echo "Para ver los logs en tiempo real usa: tail -f ~/whaticket/backend/logs/debug.log"
echo "========================================="
