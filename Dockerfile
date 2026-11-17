FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk update && apk upgrade --no-cache openssl && \
    (deluser --remove-home alpine 2>/dev/null || true) && \
    (deluser --remove-home guest 2>/dev/null || true) && \
    mkdir -p /app/data /app/backups && \
    chown -R node:node /app
COPY --chown=node:node package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node . .
RUN chmod 700 /app/data /app/backups

USER node
ENV NODE_ENV=production
ENV PORT=3000
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["npm", "start"]
