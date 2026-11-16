FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG PUBLIC_ORIGIN
ENV NEXT_TELEMETRY_DISABLED=1 NEXUS_STANDALONE=true \
    NEXT_PUBLIC_API_URL="" NEXT_PUBLIC_API_BASE_URL="" \
    API_PROXY_TARGET=http://api-gateway:8080 \
    NEXT_PUBLIC_KEYCLOAK_REALM=nexus NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=nexus-web \
    NEXT_PUBLIC_AUTH_STUB=false NEXT_PUBLIC_CART_MOCK=false NEXT_PUBLIC_PRODUCT_DETAIL_MOCK=false \
    NEXT_PUBLIC_GUEST_CART_ENABLED=false NEXT_PUBLIC_ACCOUNT_EXTENSIONS_ENABLED=false \
    NEXT_PUBLIC_SELLER_APPLICATION_ENABLED=false
RUN test -n "$PUBLIC_ORIGIN" && NEXT_PUBLIC_KEYCLOAK_URL="$PUBLIC_ORIGIN/auth" npm run build -- --webpack

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
CMD ["node", "server.js"]
