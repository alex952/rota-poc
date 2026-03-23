FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npm run build

EXPOSE 8000

CMD ["sh", "-c", "npm run migration:run:dist && node dist/src/main.js"]
