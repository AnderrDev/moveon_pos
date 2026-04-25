# Sprint 1 — Auth + Catálogo de Productos

**Duración estimada:** 1 semana full-time / 2 semanas part-time.
**Pre-requisito:** Sprint 0 completo.

---

## Formato de las HUs

Cada HU sigue este formato:

```
ID: HU-XX
Título: ...
Como [rol]
Quiero [acción]
Para [beneficio]

Criterios de aceptación:
- [ ] CA1: ...
- [ ] CA2: ...

Notas técnicas:
- Use case: ...
- Tabla(s) afectada(s): ...
- Permisos: ...
```

Los criterios de aceptación son verificables — un test debe poder validarlos uno por uno.

---

## HU-01 — Login con email y contraseña

**Como** usuario del sistema (admin o cajero)
**Quiero** iniciar sesión con mi email y contraseña
**Para** acceder a las funciones según mi rol

### Criterios de aceptación
- [ ] CA1: Existe la página `/login` accesible sin autenticación.
- [ ] CA2: Al ingresar email + contraseña válidos, soy redirigido a `/pos` (cajero) o `/dashboard` (admin).
- [ ] CA3: Al ingresar credenciales inválidas, veo el mensaje "Email o contraseña incorrectos" sin revelar cuál falló.
- [ ] CA4: Si ya estoy autenticado, visitar `/login` me redirige a la home según mi rol.
- [ ] CA5: Existe link "Olvidé mi contraseña" que abre flujo de recuperación de Supabase Auth.
- [ ] CA6: Si mi usuario está inactivo en `user_tiendas` (todas las tiendas), no puedo entrar y veo "Usuario sin acceso. Contacta al administrador".

### Notas técnicas
- Server Action: `signInWithPassword`.
- Tabla(s): `auth.users`, `user_tiendas`.
- Permisos: público (login).
- Validación: Zod schema con email válido + contraseña mínima 6.

---

## HU-02 — Cierre de sesión

**Como** usuario autenticado
**Quiero** poder cerrar sesión
**Para** proteger mi cuenta cuando termine de trabajar

### Criterios de aceptación
- [ ] CA1: Existe botón "Cerrar sesión" visible en el sidebar.
- [ ] CA2: Al confirmar, mi sesión Supabase termina y soy redirigido a `/login`.
- [ ] CA3: Las cookies de sesión quedan limpias (no puedo "volver atrás" con el botón del navegador).

### Notas técnicas
- Server Action: `signOut`.
- Implementación: limpiar cookies + `supabase.auth.signOut()`.

---

## HU-03 — CRUD de categorías de productos

**Como** admin
**Quiero** crear, editar y desactivar categorías
**Para** organizar mi catálogo

### Criterios de aceptación
- [ ] CA1: Existe página `/productos/categorias` accesible solo a admin.
- [ ] CA2: Veo lista de categorías de mi tienda con: nombre, número de productos, estado activo.
- [ ] CA3: Puedo crear una nueva categoría con nombre obligatorio.
- [ ] CA4: No puedo crear dos categorías con el mismo nombre en la misma tienda (validación visible al usuario).
- [ ] CA5: Puedo editar el nombre de una categoría existente.
- [ ] CA6: Puedo marcar una categoría como inactiva. Al hacerlo, los productos asociados quedan sin categoría pero no se borran.
- [ ] CA7: La lista se ordena por `orden` y luego alfabéticamente.

### Notas técnicas
- Use cases: `CreateCategoria`, `UpdateCategoria`, `DeactivateCategoria`, `ListCategorias`.
- Tabla: `categorias`.
- RLS: solo admin puede insertar/actualizar; todos pueden leer.

---

## HU-04 — CRUD de productos

**Como** admin
**Quiero** gestionar el catálogo de productos
**Para** tener disponibles los productos correctos para venta

### Criterios de aceptación
- [ ] CA1: Existe página `/productos` accesible a admin.
- [ ] CA2: Veo lista paginada de productos con columnas: nombre, SKU, código de barras, categoría, precio venta, IVA, stock actual, estado.
- [ ] CA3: Puedo filtrar por categoría, estado activo, y buscar por nombre/SKU/código de barras.
- [ ] CA4: Puedo crear un producto con campos: nombre*, SKU, código barras, categoría, tipo*, unidad, precio venta*, costo, IVA tasa*, stock mínimo, activo.
- [ ] CA5: Validación: nombre min 2 caracteres, precio venta > 0, IVA en {0, 5, 19}, tipo en {simple, prepared, ingredient}.
- [ ] CA6: SKU y código de barras son únicos por tienda (no puedo duplicarlos).
- [ ] CA7: Puedo editar todos los campos excepto el ID. Cambios de precio quedan en `audit_logs`.
- [ ] CA8: Puedo desactivar un producto. Productos inactivos no aparecen en pantalla de venta.

### Notas técnicas
- Use cases: `CreateProducto`, `UpdateProducto`, `DeactivateProducto`, `ListProductos`, `GetProducto`.
- Tabla: `productos`.
- Snapshot de cambio de precio: registrar en `audit_logs` con `action='product.price_changed'`.

---

## HU-05 — Búsqueda de productos por código de barras o nombre

**Como** cajero
**Quiero** encontrar productos rápidamente
**Para** agregar a la venta sin demoras

### Criterios de aceptación
- [ ] CA1: Existe componente `<ProductSearch>` reutilizable.
- [ ] CA2: Al escribir en el input, se buscan coincidencias en nombre, SKU y código de barras.
- [ ] CA3: Si la entrada coincide exactamente con un código de barras, se selecciona automáticamente el producto (caso scanner).
- [ ] CA4: Si hay múltiples coincidencias, se muestran como dropdown con max 10 resultados.
- [ ] CA5: Solo se muestran productos activos.
- [ ] CA6: La búsqueda es debounced a 200ms.
- [ ] CA7: Los resultados muestran: nombre, precio, stock disponible.

### Notas técnicas
- Use case: `SearchProductos`.
- Performance: índices en `(tienda_id, nombre)` y `(tienda_id, codigo_barras)`.
- Detección scanner: si el input recibe > 6 caracteres en menos de 100ms, asume scanner.

---

## Definición de "Hecho" para Sprint 1

- [ ] Todas las HUs cumplen sus criterios de aceptación.
- [ ] Cada use case tiene tests unitarios.
- [ ] RLS configurado y probado para `categorias` y `productos`.
- [ ] Migrations aplicadas en dev y staging.
- [ ] PR fusionado a `main` con preview deployado en Vercel.
- [ ] Documentación actualizada si hubo cambios al modelo o reglas.
