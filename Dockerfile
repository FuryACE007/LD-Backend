FROM node:16.20.2-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN rm -rf build

RUN npm ci

COPY . . 

RUN npm run build
CMD ["node", "dist/main.js"]

