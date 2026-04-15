FROM node:20-slim
WORKDIR /app
COPY drive工具/drive-explorer/package*.json ./
RUN npm install --omit=dev
COPY drive工具/drive-explorer/server.js .
EXPOSE 3100
ENV PORT=3100
CMD ["node", "server.js"]
