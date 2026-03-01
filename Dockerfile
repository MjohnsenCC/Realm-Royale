FROM node:20-slim AS builder

WORKDIR /app

# Copy workspace config and all package.json files
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# Install dependencies
RUN npm ci

# Copy source code
COPY tsconfig.base.json ./
COPY packages/ packages/

# Build in order: shared -> client -> server
RUN npm run build -w packages/shared
RUN npm run build -w packages/client
RUN npm run build -w packages/server

# Production image — preserve workspace layout so all paths resolve
FROM node:20-slim

WORKDIR /app

# Root package.json (needed for workspace resolution)
COPY --from=builder /app/package.json ./

# Shared package (dist + package.json)
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Server package (dist + package.json)
COPY --from=builder /app/packages/server/package.json ./packages/server/
COPY --from=builder /app/packages/server/dist ./packages/server/dist

# Client build (static files served by Express)
COPY --from=builder /app/packages/client/dist ./packages/client/dist

# node_modules (Docker COPY follows symlinks, so workspace links become real copies)
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 2567

# Run from the workspace root so relative paths match
CMD ["node", "packages/server/dist/index.js"]
