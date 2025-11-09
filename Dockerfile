# Multi-stage build for VibeList Backend Monolith

# Base stage
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Dependencies stage
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Build stage
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Development stage
FROM base AS development
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001
USER nestjs
EXPOSE 3000
CMD ["node", "dist/main.js"]
