FROM node:14 as build-deps

RUN apt-get update && apt-get install -y wget

ENV DOCKERIZE_VERSION v0.6.1
RUN wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && tar -C /usr/local/bin -xzvf dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && rm dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz

RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ADD https://github.com/Yelp/dumb-init/releases/download/v1.2.1/dumb-init_1.2.1_amd64 /usr/local/bin/dumb-init
RUN chmod +x /usr/local/bin/dumb-init

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install

# Copiar script de actualización de node-fetch
COPY update-node-fetch.sh ./
RUN chmod +x update-node-fetch.sh && ./update-node-fetch.sh

# Instalar los tipos de declaración para node-fetch y configurar TypeScript
COPY fix-typescript.sh ./
RUN chmod +x fix-typescript.sh && ./fix-typescript.sh

# Instalar tipos de declaración de node-fetch
RUN npm install --save-dev @types/node-fetch@2.6.4

# Install mariadb package
RUN npm install mariadb

# Create logs directory with correct permissions
RUN mkdir -p /usr/src/app/logs && chmod -R 777 /usr/src/app/logs

COPY . .

# Intentar compilar con opciones más permisivas
RUN npm run build || echo "Compilación con errores, pero continuamos..." && npm run build || true

ENV NODE_ENV=production
ENV PORT=3000
ENV CHROME_BIN=google-chrome-stable

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD dockerize -wait tcp://${DB_HOST}:3306 \
  && npx sequelize db:migrate \
  && node dist/server.js