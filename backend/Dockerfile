FROM node:22-slim

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 python3-pip curl ca-certificates \
	&& pip3 install --no-cache-dir --break-system-packages yfinance \
	&& curl -fsSL -o /usr/local/share/google-trust-services-roots.pem https://pki.goog/roots.pem \
	&& rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/google-trust-services-roots.pem
EXPOSE 8080

CMD ["node", "dist/index.js"]
