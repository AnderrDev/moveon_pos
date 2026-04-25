# AGENTS.md — Guía para Codex y agentes IA

Este archivo sigue la convención `AGENTS.md` que Codex (OpenAI) y otros agentes leen automáticamente. **Las reglas son las mismas que en `CLAUDE.md`** — ambos archivos son puntos de entrada equivalentes que apuntan a la misma fuente de verdad: `/docs`.

> Si eres Codex: lee este archivo, luego lee la documentación en `/docs` antes de cualquier tarea no trivial.
> Si eres Claude Code: usa `CLAUDE.md` (idéntico contenido en lo esencial).

---

## 1. Contexto del proyecto

**MOVEONAPP POS** — sistema POS para tienda física de suplementos y batidos en Colombia. Reemplaza Siigo. Stack: Next.js 15 + TypeScript + Supabase + Tailwind + shadcn/ui.

Antes de programar, lee:
1. `/docs/00-vision.md`
2. `/docs/01-mvp-scope.md`
3. `/docs/02-architecture.md`
4. El módulo correspondiente en `/docs/modules/`
5. Las HUs activas en `/docs/user-stories/`

---

## 2. Reglas no negociables

### Arquitectura
- Clean Architecture por módulos (`domain`, `application`, `infrastructure`).
- Dominio en TypeScript puro, sin dependencias de frameworks.
- Patrón Adapter para integraciones externas (facturación, impresión).

### Datos
- Toda tabla operativa lleva `tienda_id`.
- Stock cambia solo vía `inventory_movements`.
- Ventas se anulan, no se borran.
- RLS activado en todas las tablas sensibles.
- Service role solo en server-side.

### Código
- TypeScript estricto, sin `any` injustificado.
- Zod en todos los bordes.
- Errores tipados.
- Idempotencia en operaciones críticas.
- Tests unitarios en dominio.

### Seguridad
- Secretos solo en server.
- Validación de permisos por rol en Server Actions.

---

## 3. Flujo de trabajo

### Antes de escribir código
1. Identifica el módulo afectado.
2. Lee `/docs/modules/<modulo>.md`.
3. Revisa ADRs en `/docs/adr/`.
4. Si la decisión es nueva, propón un ADR antes de implementar.
5. Si la HU no está clara, pregunta.

### Al implementar
- Incrementos pequeños.
- Sigue la estructura existente.
- Tipos compartidos en `/src/shared/types/`.
- Migrations versionadas en `/supabase/migrations/`.

### Después de implementar
- `pnpm typecheck && pnpm lint && pnpm test`.
- Actualiza el archivo del módulo si hay cambios relevantes.
- Crea ADR si tomaste decisión arquitectónica.

### Qué evitar
- No instales dependencias sin justificación.
- No introduzcas patrones nuevos sin ADR.
- No mezcles SQL en componentes React.
- No agregues funcionalidades fuera del MVP v1.0.

---

## 4. Comandos

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm db:migrate
pnpm db:types
```

---

## 5. Convenciones

- Archivos: `kebab-case.ts`.
- Componentes React: `PascalCase.tsx`.
- DB: `snake_case`.
- Imports absolutos desde `@/`.
- Código en inglés, UI y docs en español.

---

## 6. Coordinación con Claude Code

Claude Code también trabaja en este repo (vía `CLAUDE.md`). Las reglas son idénticas. La fuente de verdad única es `/docs`. No edites estos archivos de forma divergente — si una regla cambia, actualízala en `/docs` y refleja en ambos.
