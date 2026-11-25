# ---- build the single-page app ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- production runtime ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    DATA_DIR=/app/data \
    UPLOAD_DIR=/app/data/uploads
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# The server reuses the shared field definitions and header-detection logic.
COPY src/lib/fields.js ./src/lib/fields.js
COPY src/lib/excel.js ./src/lib/excel.js
COPY server ./server
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/data/uploads && chown -R node:node /app/data
USER node

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
