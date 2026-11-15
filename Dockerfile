# ---- build the web app ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATA_DIR=data
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev -w @kiestudio/server --include-workspace-root=false
COPY apps/server apps/server
COPY --from=build /app/apps/web/dist apps/web/dist
EXPOSE 8787
VOLUME ["/app/data"]
CMD ["node", "apps/server/src/index.ts"]
