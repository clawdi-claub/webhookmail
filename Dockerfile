FROM node:22-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
ENV npm_config_build_from_source=true
RUN npm install --omit=dev
COPY . .
RUN mkdir -p data static

EXPOSE 3000
CMD ["node", "src/index.js"]
