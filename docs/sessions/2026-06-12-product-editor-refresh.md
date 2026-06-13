# Spec de Sesion - 2026-06-12 - Refresco del editor de productos

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-06-12 |
| Sprint | Ajustes de catalogo |
| Agente | Codex |
| HUs trabajadas | Productos - edicion |
| Estado | Completada |

## 1. Objetivo de la sesion

Corregir el editor de productos, que al abrir un producto despues de otro mostraba temporalmente los valores del producto anterior hasta interactuar con los campos.

## 2. Lo que se implemento

- `productos.page.ts`: el componente del formulario se monta solo mientras el dialogo esta abierto, por lo que cada apertura inicia una instancia limpia.
- `form-currency-input.component.ts`: el valor visible ahora reacciona a `valueChanges` del control y se actualiza inmediatamente despues de `form.reset()`.

## 3. Decisiones tomadas

| Decision | Alternativa descartada | Razon |
|---|---|---|
| Recrear el editor en cada apertura | Forzar deteccion de cambios manual | Evita conservar estado visual interno entre productos. |
| Escuchar `valueChanges` en el input de moneda | Leer `control.value` dentro de un `computed` | `FormControl.value` no es una signal y no invalida el `computed` por si solo. |

## 4. Tests

- [x] `pnpm typecheck` - paso.
- [x] `pnpm lint` - paso.
- [x] Pruebas enfocadas de moneda, mapper y schema de producto - 46/46 pasaron.

## 5. Bloqueos y preguntas pendientes

- Ninguno.

## 6. Proximos pasos

1. Validar manualmente la secuencia editar producto A, cerrar, editar producto B y confirmar que todos los valores cambien al abrir.
