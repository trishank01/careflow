# Billing Service Dockerfile
# --- Stage 1: Build / Dependency Installation ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# --- Stage 2: Runtime Environment ---
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY index.js ./

EXPOSE 6000
ENV NODE_ENV=production
CMD ["node", "index.js"]
