FROM node:24.0.2-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN rm -rf build

RUN npm ci

COPY . .

RUN npm run build

CMD ["node", "dist/main.js"]
