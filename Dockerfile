# Single-machine deploy: builds the frontend and serves it + the orchestrator
# from one Node process. Suitable for Fly.io / Railway / Render.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm install
COPY . .
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Bring the built server + frontend and the installed deps.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/web/dist ./web/dist
EXPOSE 8787
ENV PORT=8787
WORKDIR /app/server
CMD ["node", "dist/index.js"]
