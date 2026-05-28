FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Download Google Trust Services Root CAs so Node.js trusts all Google certificate chains.
# Re-run `docker build` at least semi-annually to refresh the bundle per https://pki.goog/faq/
RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl ca-certificates \
	&& curl -fsSL -o /usr/local/share/google-trust-services-roots.pem https://pki.goog/roots.pem \
	&& rm -rf /var/lib/apt/lists/*

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/google-trust-services-roots.pem
EXPOSE 8090

CMD ["node", "dist/index.js"]
