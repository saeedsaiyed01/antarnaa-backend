# ---- Build Stage ----
    FROM node:18-alpine AS builder

    WORKDIR /app
    COPY package*.json tsconfig.json ./
    RUN npm install
    
    COPY src ./src
    RUN npx tsc
    
    # ---- Run Stage ----
    FROM node:18-alpine AS runner
    
    WORKDIR /app
    COPY --from=builder /app/dist ./dist
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/package.json ./
    
    # Automatically run admin seeding script on container startup
    CMD ["sh", "-c", "node dist/scripts/seedAdmin.js && node dist/server.js"]
    