# Spec de Sesión — 2026-09-12 — Clientes: scroll y progreso de fidelización

---

## Metadatos

| Campo          | Valor                                      |
| -------------- | ------------------------------------------ |
| Fecha          | 2026-09-12                                 |
| Sprint         | Mantenimiento post-MVP                     |
| Agente         | Codex                                      |
| HUs trabajadas | Mejora operativa Clientes / MOVE ON Club   |
| Estado         | Completada                                 |

---

## 1. Objetivo de la sesión

Diagnosticar y corregir el error de scroll del módulo de clientes, y diseñar e implementar una mejora que permita ver desde el listado cuántos batidos lleva cada cliente y quién está más cerca de obtener un batido gratis sin abrir su detalle.

---

## 2. Lo que se implementó

### 2.1 Archivos creados

- `apps/pos-angular/src/app/features/loyalty/domain/services/customer-progress.ts`.
- `apps/pos-angular/src/app/features/loyalty/presentation/components/customer-loyalty-highlight.component.ts`.
- `apps/pos-angular/src/app/features/loyalty/presentation/components/customer-loyalty-progress.component.ts`.
- `apps/pos-angular/src/app/features/customers/presentation/services/customer-loyalty-overview.store.ts`.
- `tests/unit/features/loyalty/customer-progress.test.ts`.
- `tests/e2e/clientes-scroll.spec.ts`.
- Este spec de sesión.

### 2.2 Archivos modificados

- `apps/pos-angular/src/app/core/layout/shell.component.ts`.
- `apps/pos-angular/src/app/features/customers/presentation/pages/clientes.page.ts`.
- `apps/pos-angular/src/app/features/loyalty/domain/repositories/loyalty.repository.ts`.
- `apps/pos-angular/src/app/features/loyalty/data/repositories/loyalty.repository.ts`.
- `docs/modules/customers.md` y `docs/modules/loyalty.md`.

### 2.3 Archivos eliminados

- Ninguno.

---

## 3. Decisiones tomadas

| Decisión                                                                     | Alternativa descartada                             | Razón                                                                                           |
| ---------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Fijar el host de `mo-shell` al viewport y ocultar su desbordamiento exterior | Parchear solo la tabla de clientes                 | El custom element inline agrandaba el documento; el contenido ya tiene una zona interna de scroll |
| Progreso compacto por fila más un destacado del cliente más cercano         | Mostrar solo el saldo dentro del diálogo existente | Resuelve la consulta sin abrir cada cliente y conserva el detalle completo en el diálogo          |
| Leer cuentas y premios vigentes en dos consultas paginadas                  | Ejecutar una consulta por cliente                  | Evita N+1 y permite degradación independiente si el resumen de fidelización falla                 |
| Ordenar cada consulta paginada por claves estables                          | Confiar en el orden implícito de PostgREST         | Evita registros duplicados u omitidos al superar una página                                       |
| Extraer estado y UI del resumen fuera de `ClientesPage`                     | Concentrar toda la mejora en la página             | Reduce responsabilidades y reutiliza los átomos `mo-badge` y `mo-skeleton`                         |

---

## 4. ADRs creados o actualizados

- Ninguno por ahora.

---

## 5. Tests

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm test` — 79 archivos, 726 pruebas aprobadas.
- [x] `tests/e2e/clientes-scroll.spec.ts` — 1 prueba aprobada.

Detalle: `pnpm typecheck` abortó dentro del sandbox del compilador Angular; repetido con el permiso
de ejecución correspondiente, completó correctamente. El E2E usa Chrome instalado mediante una
configuración temporal porque el binario administrado de Playwright no está presente.

La revisión independiente no encontró asuntos críticos. Antes de cerrar se corrigieron sus
hallazgos principales: orden estable para paginación, extracción de la presentación/estado de
fidelización y contador X/N visible también cuando hay premio listo en móvil.

---

## 6. Bloqueos y preguntas pendientes

- Ninguno.

---

## 7. Próximos pasos

1. Aplicar futuros cambios de configuración o ajustes de sellos y validar que el resumen del
   directorio se actualice al cerrar el diálogo Club.
2. Mantener la prueba E2E de scroll al modificar el shell o la altura de tablas.

---

## 8. Notas adicionales

La solicitud se considera acotada porque modifica flujos ya existentes de clientes y fidelización.

Diagnóstico reproducido en `http://localhost:4200/clientes` con 18 clientes: la tabla tenía su
scroll interno, pero `document.documentElement.scrollHeight` llegaba a 1216 px en un viewport de
720 px. El custom element `mo-shell` no limitaba su caja al viewport; al desplazar la barra exterior
todo el shell subía y quedaba un área blanca. Después del arreglo el documento queda en 720/720 px
y la tabla conserva su scroll interno (1137 px de contenido). Se hizo QA visual en 1280×720 y
390×844; en escritorio todas las acciones quedan visibles y en móvil el progreso aparece junto al
nombre antes del desplazamiento horizontal.
