# Swarm Survival worker — a persistent Node process (NOT serverless). Build context: the repository's `merged/` directory.
#   docker build -f swarm-server/Dockerfile -t swarm-worker .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY lib ./lib
COPY swarm-server ./swarm-server
COPY tsconfig.json ./
RUN npx esbuild swarm-server/index.ts --bundle --platform=node --target=node22 --format=esm --external:pg-native \
    --banner:js="import{createRequire}from'module';const require=createRequire(import.meta.url);" --outfile=swarm-server/dist/server.mjs

FROM node:22-slim
ENV NODE_ENV=production PORT=8787
WORKDIR /app
COPY --from=build /app/swarm-server/dist/server.mjs ./server.mjs
USER node
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# SIGTERM is handled: rooms are checkpointed, sockets get `bye: restart` and clients reconnect to the replacement.
STOPSIGNAL SIGTERM
CMD ["node", "server.mjs"]
