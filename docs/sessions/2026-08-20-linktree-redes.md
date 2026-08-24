# Spec de Sesión — 2026-08-20 — Linktree de redes y contacto

> Copia este archivo como `YYYY-MM-DD-<tema-kebab-case>.md` al inicio de cada sesión de trabajo.
> Llénalo durante y al final de la sesión. Es el registro de lo que pasó.

---

## Metadatos

| Campo          | Valor                               |
| -------------- | ----------------------------------- |
| Fecha          | 2026-08-20                          |
| Sprint         | Fuera de sprint — presencia digital |
| Agente         | Codex                               |
| HUs trabajadas | N/A — nueva app de enlaces públicos |
| Estado         | Completada                          |

---

## 1. Objetivo de la sesión

Crear una aplicación independiente dentro de `apps/`, tipo Linktree, que concentre los enlaces de MOVEON a redes sociales, Google Maps, sitio web y WhatsApp, reutilizando el sistema visual y los estándares de la landing existente.

---

## 2. Lo que se implementó

### 2.1 Archivos creados

- `apps/links-web/` — tercera app Angular standalone, estática y sin Router/Supabase/Tailwind.
- `apps/links-web/src/app/links.page.{ts,html,css}` — página responsive de enlaces oficiales.
- `apps/links-web/src/app/links-content.ts` — fuente centralizada para URLs, etiquetas y horarios.
- `apps/links-web/src/app/links-content.test.ts` — invariantes de contenido (IDs/URLs únicos, HTTPS y CTA principal).
- `apps/links-web/netlify.toml` y `public/{_headers,_redirects}` — despliegue independiente.
- `docs/modules/links-web.md` — documentación operativa de la app.
- `docs/adr/0020-app-independiente-enlaces-publicos.md` — decisión arquitectónica.

### 2.2 Archivos modificados

- `angular.json` — registro del proyecto `links-web`, assets de marca compartidos y budgets.
- `package.json` — scripts de desarrollo, build normal/Docker, lint y typecheck de `links-web`.
- `vitest.config.ts` — inclusión de tests de `links-web`.
- `Dockerfile` y `docker/nginx.conf` — build y publicación de la app bajo `/links/`.
- `README.md` — URL Docker de la tercera app.
- `docs/02-architecture.md` — inventario actualizado de apps frontend.

### 2.3 Archivos eliminados

- Ninguno.

---

## 3. Decisiones tomadas

_Decisiones que no quedaron en ADR pero son relevantes para el contexto._

| Decisión                                       | Alternativa descartada       | Razón                                                                                                                          |
| ---------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| App Angular independiente, bootstrap directo   | Ruta dentro de `landing-web` | Evita cargar catálogo/Supabase y permite deploy independiente para bio/QR.                                                     |
| Contenido estático centralizado                | Leer Supabase en runtime     | Los cuatro enlaces cambian poco y la página debe abrir con latencia mínima.                                                    |
| Publicar solo perfiles confirmados             | Inventar TikTok/Facebook     | El repositorio y la búsqueda pública solo confirmaron Instagram oficial.                                                       |
| Reutilizar assets de la landing desde el build | Duplicar PNGs                | Mantiene una sola fuente binaria de marca sin acoplar código entre apps.                                                       |
| Mostrar primero la pila de enlaces             | Hero antes de las acciones   | Los patrones Linktree priorizan los destinos importantes sobre el pliegue.                                                     |
| Suavizar la UI sin cambiar la identidad        | Sustituir el sistema visual  | Bordes redondeados, superficies cálidas y textos cercanos hacen la página más amable conservando negro, amarillo y Montserrat. |

---

## 4. ADRs creados o actualizados

- `docs/adr/0020-app-independiente-enlaces-publicos.md` — separa el link hub del POS y del catálogo.

---

## 5. Tests

- [x] `pnpm typecheck` — pasó (TypeScript + build dev de `pos-angular`).
- [x] `pnpm typecheck:links` — pasó.
- [x] `pnpm lint` — pasó.
- [x] `pnpm lint:links` — pasó.
- [x] `pnpm test` — 78 archivos, 710 tests pasaron.
- [x] `pnpm build:links` — pasó; bundle inicial 121.86 kB raw / 36.56 kB estimados.
- [x] `pnpm build:links:docker` — build con `baseHref` `/links/` para Nginx.
- [x] Verificación Chrome headless — 390×844 y 1440×1200, 4 enlaces renderizados, cero errores de consola.
- [x] Revisión links-first — en 390×844 el primer enlace inicia en 102 px y el cuarto termina en 422 px; cero overflow horizontal.
- [x] Revisión diseño amigable — en 390×844 los enlaces miden 72 px, comienzan en 106 px y terminan en 424 px; cero overflow horizontal y cero errores de consola.

Detalle de fallos (si los hay):

- Angular 21 aborta el build dentro del sandbox de Codex cuando intenta abrir el caché persistente LMDB. Las verificaciones se ejecutaron deshabilitando temporalmente ese caché; no se dejó ese cambio global en `angular.json`.

---

## 6. Bloqueos y preguntas pendientes

- [ ] Crear el tercer sitio Netlify y definir su URL/dominio público requiere acceso al dashboard.
- [ ] Si el negocio tiene TikTok, Facebook u otra red oficial, falta recibir y confirmar sus URLs.

---

## 7. Próximos pasos

_Qué debe hacer el próximo agente o sesión para continuar._

1. Crear el sitio Netlify usando `apps/links-web` como Package directory.
2. Apuntar la bio/QR al dominio asignado y validar los cuatro destinos en producción.
3. Agregar nuevas redes a `links-content.ts` solo cuando existan URLs oficiales confirmadas.

---

## 8. Notas adicionales

Se usaron las skills `ui-ux-pro-max` y `frontend-design`. La dirección final conserva el sistema visual real de la landing (negro, amarillo `#F9D128` y Montserrat), pero reemplaza la rigidez industrial por tarjetas redondeadas, superficies negro cálido, iconos contenidos y microcopy más humana. WhatsApp es la única acción primaria; catálogo, Instagram y Maps quedan al mismo nivel secundario.

Tras revisar ejemplos y recomendaciones oficiales de Linktree, la cabecera se compactó y los cuatro enlaces se movieron antes del manifiesto visual. Fuentes consultadas: `linktr.ee/help/en/articles/8628237-linktree-examples-inspiration`, `linktr.ee/blog/real-estate-agent-link-in-bio-page` y `linktr.ee/blog/new-linktree-features-october-2021-updates`.
