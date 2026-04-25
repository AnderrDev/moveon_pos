# Cómo arrancar con Claude Code y Codex

Esta guía te explica cómo trabajar con los agentes IA en este repo, paso a paso.

---

## 1. Antes de invocar al agente

1. Asegúrate de estar en la raíz del repo (`moveonapp-pos/`).
2. Verifica que `CLAUDE.md` y `AGENTS.md` existen en la raíz.
3. Verifica que `/docs` está completo (al menos los archivos `00` a `05` y los módulos).

---

## 2. Primer prompt para Claude Code o Codex

Empieza siempre el primer prompt de una sesión nueva con:

> Lee `CLAUDE.md` (o `AGENTS.md` si eres Codex), luego lee `docs/00-vision.md`, `docs/01-mvp-scope.md` y `docs/02-architecture.md` antes de hacer cualquier cosa. Cuando termines, dime "Listo" y espera mi siguiente instrucción.

Esto los pone en contexto. Sin esto, te van a inventar arquitecturas que no encajan.

---

## 3. Para iniciar Sprint 0 (setup del repo)

Cuando ya tengas la estructura clonada, prompt sugerido:

> Vamos a arrancar el Sprint 0. Lee `docs/04-roadmap.md` § Sprint 0. Tu primera tarea es:
> 1. Inicializar el proyecto Next.js 15 con TypeScript, Tailwind y App Router en este repo.
> 2. Configurar ESLint y Prettier.
> 3. Configurar Vitest.
> 4. Crear la estructura de carpetas según `docs/02-architecture.md` § 3.
> 5. Configurar `tsconfig.json` con strict mode y paths absolutos `@/*`.
> 6. Crear el archivo `src/shared/result.ts` con el tipo `Result<T, E>`.
>
> No instales dependencias innecesarias. Sigue el `package.json` que ya está definido. Después de cada paso, hazme un resumen breve y espera mi confirmación.

---

## 4. Para iniciar Sprint 1

Cuando Sprint 0 esté completo:

> Vamos a iniciar Sprint 1. Lee `docs/user-stories/sprint-01.md` y `docs/modules/auth.md` y `docs/modules/products.md`. Tu primera tarea es la HU-01 (login). Implementa los criterios de aceptación uno por uno. No avances a HU-02 hasta que CA1 a CA6 de HU-01 estén cumplidos y tenga tests.

---

## 5. Para tareas puntuales en sprints en curso

> Estoy trabajando en HU-XX del Sprint Y. Lee la HU en `docs/user-stories/sprint-YY.md`, el módulo en `docs/modules/<modulo>.md` y los ADRs relevantes. Implementa solo esa HU sin tocar otras cosas. Después corre `pnpm typecheck && pnpm lint && pnpm test`.

---

## 6. Cuando el agente quiera tomar una decisión arquitectónica nueva

Si propone introducir algo no contemplado en los ADRs:

> Antes de implementar eso, redacta un ADR en `docs/adr/000X-titulo.md` siguiendo el formato de los ADRs existentes. Espera mi aprobación antes de codificar.

---

## 7. Cuando dudes si algo está en scope

Pregúntale al agente:

> ¿Esta funcionalidad está dentro del scope del MVP v1.0 según `docs/01-mvp-scope.md`? Si no, ¿en qué versión va?

Si te dice que no está en scope: **no la construyas todavía**, agrégala al backlog post-MVP.

---

## 8. Tips para trabajar con dos agentes (Claude Code + Codex)

- **Mantén ambos sincronizados con git pull frecuente.**
- **No los dejes trabajando en el mismo módulo a la vez.** Asígnales sprints o módulos distintos.
- **Si uno propone algo y el otro lo refactoriza al revés, párenlo y discútanlo en un ADR.**
- **Confía más en el agente que está leyendo más documentación** (verás en sus respuestas si realmente leyó los archivos o se inventó cosas).

---

## 9. Banderas rojas (cuando un agente está fuera de control)

- Está instalando dependencias no justificadas.
- Está creando archivos fuera de la estructura definida en `docs/02-architecture.md`.
- Está usando `any` en TypeScript.
- Está modificando `productos.stock` directamente en lugar de crear `inventory_movements`.
- Está poniendo lógica de negocio en componentes React.
- Está usando service role en código cliente.

Cuando veas una bandera roja, frena y corrige antes de seguir.
