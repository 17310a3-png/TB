FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js .
EXPOSE 3100
ENV PORT=3100
CMD ["node", "server.js"]
