# Build stage
FROM node:20-slim as builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev)
RUN npm install

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy compiled JavaScript from builder
COPY --from=builder /app/*.js ./
COPY --from=builder /app/*.js.map ./

# Cloud Run uses port 8080
EXPOSE 8080

# Start the app
CMD ["npm", "start"]
