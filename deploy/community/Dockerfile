FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip make g++ ca-certificates \
    && npm ci --omit=dev --ignore-scripts && npm rebuild mediasoup --foreground-scripts \
    && npm cache clean --force && rm -rf /var/lib/apt/lists/*
COPY scripts/community-server.mjs ./scripts/community-server.mjs
COPY scripts/community/ ./scripts/community/
COPY src/roles/permissions.ts src/roles/commands.ts ./src/roles/
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV CONTALK_COMMUNITY_HOST=0.0.0.0 CONTALK_COMMUNITY_PORT=8789 CONTALK_COMMUNITY_DATA=/app/data
EXPOSE 8789 40000/tcp 40000/udp
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:8789/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "scripts/community-server.mjs"]
