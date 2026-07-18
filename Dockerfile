# Single-machine deploy: builds the frontend and serves it + the orchestrator
# from one long-running Node process. Suitable for Dokploy, Fly.io, Railway,
# Render — anything that runs a Dockerfile.
FROM node:20-slim AS build
WORKDIR /app
# Install deps first (better layer caching). Workspaces need each package.json.
COPY package.json package-lock.json* ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm install
# Build the frontend (web/dist) and the server (server/dist).
COPY . .
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
# npm workspaces hoist all deps to the root node_modules; Node resolves them
# by walking up from /app/server, so the root install is all the runtime needs.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist
EXPOSE 8787
WORKDIR /app/server
CMD ["node", "dist/index.js"]
