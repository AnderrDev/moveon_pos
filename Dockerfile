# syntax=docker/dockerfile:1.7

FROM node:20.19-alpine AS dependencies

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile


FROM dependencies AS build

COPY . .

# Angular requiere runtime-config.json durante el build. Estos valores solo
# permiten compilar; la imagen final los reemplaza al iniciar el contenedor.
ENV SUPABASE_URL=https://build-placeholder.invalid \
    SUPABASE_ANON_KEY=build-placeholder \
    APP_ENV=production

RUN pnpm build && pnpm build:landing && pnpm build:links:docker


FROM nginx:1.27-alpine AS runtime

RUN apk add --no-cache jq

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh

COPY --from=build /app/dist/pos-angular/browser /usr/share/nginx/html
COPY --from=build /app/apps/landing-web/dist/browser /usr/share/nginx/html/catalogo
COPY --from=build /app/apps/links-web/dist/browser /usr/share/nginx/html/links

RUN chmod 755 /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
