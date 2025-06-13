#!/bin/bash
# Fix script for WhatsApp Ticket System 

# Print start message
echo "========================================="
echo "WhatsApp Ticket System Fix Script"
echo "========================================="

# Set working directory
cd ~/whaticket

# Backup the broken docker-compose file
echo "Creating backup of current docker-compose.yaml..."
cp docker-compose.yaml docker-compose.yaml.backup
echo "Backup created at docker-compose.yaml.backup"

# Create a fixed docker-compose file
echo "Creating new docker-compose.yaml file..."
cat > docker-compose.yaml << 'EOL'
version: '3'

networks:
  whaticket:

services:

  backend:
    build:
      context: ./backend
      dockerfile: ./Dockerfile
    environment:
      - DB_HOST=mysql
      - DB_USER=root
      - DB_PASS=${MYSQL_ROOT_PASSWORD:-strongpassword}
      - DB_NAME=${MYSQL_DATABASE:-whaticket}
      - JWT_SECRET=${JWT_SECRET:-3123123213123}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET:-75756756756}
      - BACKEND_URL=${BACKEND_URL:-http://localhost}
      - FRONTEND_URL=${FRONTEND_URL:-http://localhost:3000}
      - PROXY_PORT=${PROXY_PORT:-8080}
      - CHROME_ARGS=--no-sandbox --disable-setuid-sandbox
      - LOG_FILE_PATH=/usr/src/app/logs/debug.log
    ports:
      - ${BACKEND_PORT:-8082}:3000
    volumes:
      - ./backend/public/:/usr/src/app/public/
      - ./backend/.wwebjs_auth/:/usr/src/app/.wwebjs_auth/
      - ./backend/logs/:/usr/src/app/logs/
    networks:
      - whaticket

  frontend:
    ports:
      - ${FRONTEND_PORT:-3000}:80
      - ${FRONTEND_SSL_PORT:-3001}:443
    build:
      context: ./frontend
      dockerfile: ./Dockerfile
    environment:
      - URL_BACKEND=backend:3000
      - REACT_APP_BACKEND_URL=${BACKEND_URL:-http://localhost}:${PROXY_PORT:-8080}/
      - FRONTEND_SERVER_NAME=${FRONTEND_SERVER_NAME}
      - BACKEND_SERVER_NAME=${BACKEND_SERVER_NAME}
    volumes:
      - ./ssl/certs/:/etc/nginx/ssl/
      - ./ssl/www/:/var/www/letsencrypt/
    networks:
      - whaticket

  mysql:
    image: ${MYSQL_ENGINE:-mariadb}:${MYSQL_VERSION:-10.6}
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_0900_ai_ci
    volumes:
      - ./.docker/data/:/var/lib/mysql
    environment:
      - MYSQL_DATABASE=${MYSQL_DATABASE:-whaticket}
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD:-strongpassword}
      - MYSQL_USER=${MYSQL_USER:-whaticket}
      - MYSQL_PASSWORD=${MYSQL_PASSWORD:-whaticket}
      - TZ=${TZ:-America/Sao_Paulo}
    ports:
      - ${MYSQL_PORT:-3306}:3306
    networks:
      - whaticket
EOL

echo "New docker-compose.yaml file created"

# Create logs directory
echo "Creating logs directory..."
mkdir -p ./backend/logs
chmod -R 777 ./backend/logs
touch ./backend/logs/debug.log
chmod 666 ./backend/logs/debug.log
echo "Log directory and file created with proper permissions"

# Restart services
echo "Stopping all containers..."
docker-compose down || true

echo "Rebuilding backend container..."
docker-compose build --no-cache backend || {
    echo "Error building backend. Please check the error message above."
    exit 1
}

echo "Starting all services..."
docker-compose up -d || {
    echo "Error starting services. Please check the error message above."
    exit 1
}

echo "Waiting for services to start..."
sleep 10

# Check if services are running
echo "Checking container status..."
docker-compose ps

# Display log file
echo "Creating test log entry..."
echo "=== TEST LOG ENTRY: $(date) ===" >> ./backend/logs/debug.log

echo "Checking log file content:"
tail -10 ./backend/logs/debug.log || echo "Cannot access log file yet"

echo "========================================="
echo "Fix completed! To view logs in real-time, use:"
echo "tail -f ~/whaticket/backend/logs/debug.log"
echo "========================================="
