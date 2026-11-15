# syntax=docker/dockerfile:1

# Stage 1: install all dependencies and compile TypeScript.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# Stage 2: runtime only. No sources, no dev tools, no secrets.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# Run as the unprivileged "node" user that the official image provides.
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
