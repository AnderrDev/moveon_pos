# Sesión — 2026-10-17 — Revisión de IVA en ganancias

- Agente: Codex.
- Estado: completada (revisión de código, sin cambios funcionales).
- Objetivo: verificar si Finanzas descuenta el IVA al calcular ganancias.

## Hallazgos

- `/finanzas` alimenta `entradasTotales` con `report.totalVentas`, que suma el total cobrado de ventas completadas e incluye IVA.
- `buildFinancialSummary` calcula utilidad neta como entradas menos costo de productos menos gastos activos. No recibe ni resta IVA.
- `/reportes`, pestaña Financiero, muestra IVA por separado, pero la utilidad por producto se calcula como total de línea menos costo, sin restar IVA (`reports.repository.ts`).
- La exportación usa esas mismas utilidades.

## Validación

Inspección de la cadena página → resumen de dominio y repositorio de reportes → agregación por producto; contraste con `sale-calculator.ts`, donde el IVA está contenido en el total. No se ejecutaron tests: no se modificó código.

## Próximos pasos

Si se solicita corregirlo, incorporar el IVA al resumen de Finanzas y excluirlo de las utilidades de reportes, con pruebas y actualización de UI/exportaciones. Revisar también la comparativa mensual.


## Cambio solicitado después de la revisión: ocultar IVA de todo el POS

El usuario confirmó retirar las menciones visibles de todo el POS. Se quitaron etiquetas y desgloses de catálogo/carrito, formulario/listado de productos, historial y detalle compartido de ventas, tarjetas y pestaña Financiero, configuración/vista previa, tirillas y Excel de productos/reportes/turno. Se conservaron cálculos, contratos, datos históricos e importación Siigo. No se cambió la fórmula de ganancias.

Se eliminaron las columnas junto con sus valores en las exportaciones y se retiró la hoja de desglose. Se ajustó la cuadrícula de KPI a cinco tarjetas. Las tirillas omiten el desglose incluso con la preferencia antigua activa.

Validación: `pnpm lint` OK; `pnpm test` 729 tests en 80 archivos OK; `CI=1 NG_BUILD_MAX_WORKERS=2 pnpm typecheck` OK. La primera ejecución de typecheck abortó por deadlock de esbuild; limitar workers permitió completar la compilación. Se añadieron comprobaciones de tirilla con configuración antigua activa y de alineación/totales de Excel. `git diff --check` OK. Sin publicación ni migraciones.


## Publicación autorizada por el usuario

Publicado en https://moveon-client.netlify.app el 2026-10-17. Deploy Netlify `6ad419261e7631e9bb268b91`; anterior `6acc61e6a200f20008501b6a`. Sitio `moveon-client` (`2e57c722-7c81-4bdc-8d2d-342365608b11`).

Se preparó `/private/tmp/moveon-hide-iva-release` desde `origin/main` (`92ebfdc`) y se aplicó únicamente `/private/tmp/moveon-hide-iva.patch`, con archivos de esta tarea. No se incluyeron los demás cambios pendientes del workspace. Se reutilizó la configuración pública de producción y se conservaron redirects de catálogo/SPA y headers de runtime. Publicación directa por API Netlify, sin push ni migraciones.

Validación sobre el árbol exacto publicado: typecheck, lint, 726 tests (83 archivos) y build optimizado OK. Advertencias existentes de tamaño inicial y CommonJS. Netlify confirmó estado ready y published_deploy. Smoke HTTP en `/`, `/pos`, `/reportes` y `/productos`: 200; HTML coincide salvo comentario de hosting añadido por Netlify; 14 assets de entrada coinciden por SHA-256; runtime Supabase y environment production verificados. No se hicieron transacciones ni se modificaron datos del negocio para probar.
