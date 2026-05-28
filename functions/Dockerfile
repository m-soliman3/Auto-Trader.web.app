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

# Download Google Trust Services Root CAs so Node.js trusts all Google certificate chains.
# Re-run `docker build` at least semi-annually to refresh the bundle per https://pki.goog/faq/
RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl ca-certificates \
	&& curl -fsSL -o /usr/local/share/google-trust-services-roots.pem https://pki.goog/roots.pem \
	&& rm -rf /var/lib/apt/lists/*

# Copy compiled JavaScript from builder
COPY --from=builder /app/*.js ./
COPY --from=builder /app/*.js.map ./

# Cloud Run uses port 8080
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/google-trust-services-roots.pem
EXPOSE 8080

# Start the app
CMD ["npm", "start"]
