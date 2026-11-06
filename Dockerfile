FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN chmod +x bin/heaven.js

ENTRYPOINT ["node", "bin/heaven.js"]
CMD ["help"]
