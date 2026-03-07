FROM node:24-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
ENV npm_config_build_from_source=true
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p data static

EXPOSE 3000
CMD ["node", "src/index.js"]
