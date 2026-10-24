# MOVEONAPP POS

Sistema de Punto de Venta para tienda física de suplementos y batidos para gimnasio en Colombia.

## Estado del proyecto

🚧 **MVP en cierre / QA**

## Visión rápida

- **Stack:** Angular 21 standalone + TypeScript + Tailwind CSS 4 + Supabase.
- **Despliegue:** Netlify para frontend estático + Supabase para backend.
- **Arquitectura:** Clean Architecture por módulos, dominio TypeScript puro y UI Angular en `apps/pos-angular`.
- **Facturación electrónica:** vía proveedor autorizado DIAN (patrón Adapter).
- **Multi-sede:** preparado en datos desde el día uno.

## Documentación

Toda la documentación viva está en `/docs`. Lectura recomendada en orden:

1. [`docs/00-vision.md`](docs/00-vision.md) — por qué existe el proyecto.
2. [`docs/01-mvp-scope.md`](docs/01-mvp-scope.md) — qué entra y qué no en v1.0.
3. [`docs/02-architecture.md`](docs/02-architecture.md) — arquitectura y reglas.
4. [`docs/03-data-model.md`](docs/03-data-model.md) — modelo de datos completo.
5. [`docs/04-roadmap.md`](docs/04-roadmap.md) — sprints y fases.
6. [`docs/05-glossary.md`](docs/05-glossary.md) — términos del dominio.
7. [`docs/adr/`](docs/adr/) — decisiones arquitectónicas registradas.
8. [`docs/modules/`](docs/modules/) — un archivo por módulo.
9. [`docs/user-stories/`](docs/user-stories/) — HUs por sprint.

## Para agentes IA

- **Claude Code:** lee [`CLAUDE.md`](CLAUDE.md).
- **Codex:** lee [`AGENTS.md`](AGENTS.md).
- Ambos apuntan a la misma fuente de verdad en `/docs`.

## Setup local (cuando exista código)

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

## Docker

La imagen de producción compila y sirve las tres aplicaciones Angular:

- POS: `http://localhost:8080/`
- Landing: `http://localhost:8080/catalogo/`
- Enlaces: `http://localhost:8080/links/`

```bash
docker build -t moveonapp-pos .
docker run --rm -p 8080:80 \
  -e SUPABASE_URL=https://tu-proyecto.supabase.co \
  -e SUPABASE_ANON_KEY=tu-clave-publica-anon \
  moveonapp-pos
```

Variables opcionales: `APP_ENV`, `SENTRY_DSN`, `APP_NAME` y
`LANDING_APP_NAME`. La configuración se escribe en `runtime-config.json` al
arrancar el contenedor, por lo que la misma imagen puede promoverse entre
entornos sin recompilarse.

## Licencia

Propietario. Uso interno de MOVEONAPP.
