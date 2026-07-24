# ADR 0016 — Consulta pública del progreso MOVE ON Club desde el catálogo

| Campo | Valor |
|---|---|
| Fecha | 2026-07-23 |
| Estado | **Propuesto** — pendiente de implementación (PLAN-70) |
| Decisores | Dueño del negocio (directriz de transparencia) + Arquitecto (Claude) |
| Relacionado | ADR 0013 (MOVE ON Club), `docs/modules/loyalty.md`, catálogo público (`apps/landing-web`) |

---

## 1. Contexto

El programa MOVE ON Club (ADR 0013) registra sellos y recompensas de los clientes, visibles
hoy solo desde el POS por usuarios autenticados de la tienda. El dueño quiere transparencia:
que el cliente pueda consultar su propio progreso ("¿cuántos sellos llevo?") sin depender del
cajero, desde el catálogo público (`/catalogo`, app `landing-web`).

**Directriz explícita del dueño (2026-07-23):** la consulta debe ser pública — sin cuentas de
cliente ni autenticación. Cualquier persona con el dato de identificación puede consultar.

Restricciones vigentes:
- No existen cuentas Auth para clientes (solo admin/cajero) y crearlas está fuera del scope MVP.
- Las tablas `loyalty_*` tienen RLS solo-SELECT para `authenticated` de la tienda; `anon` no
  tiene acceso — y así debe seguir a nivel de tabla.
- Los datos de clientes son datos personales (Habeas Data, Ley 1581/2012): la apertura debe
  compensarse con minimización de datos.

## 2. Decisión

### 2.1 Identificador de consulta: el celular

El cliente consulta con su **número de celular** — el mismo dato con el que se registra en caja
y por el que el POS ya lo busca (`phone-co.ts` normaliza formatos: `301...`, `+57 301...`).
Un solo campo, cero fricción, coherente con la cultura WhatsApp del negocio.

### 2.2 Mecanismo: RPC `SECURITY DEFINER` expuesta a `anon`

`storefront_club_progress(p_celular text)` — mismo patrón que la vista
`storefront_productos_publicos` (proyección pública mínima sobre datos con RLS, precedente
aceptado en la auditoría del 2026-07-22):

- `SECURITY DEFINER` + `set search_path = public`; `GRANT EXECUTE TO anon`.
- Normaliza el celular con la misma regla que `celular_normalizado` en `clientes`.
- Solo responde para clientes `activo = true` **y** `autoriza_fidelizacion = true` (el
  consentimiento de participación ya otorgado en el registro cubre esta visualización).
- **Respuesta mínima** (proyección cerrada, nunca `select *`):
  - primer nombre del cliente (solo la primera palabra de `nombre` — suficiente para que la
    persona confirme que es su tarjeta, inútil para un tercero),
  - `stamps_balance` y `sellos_para_recompensa` vigente,
  - recompensas disponibles: cantidad, valor tope y vencimiento más próximo.
  - **Nunca:** documento, teléfono, email, apellidos, historial de compras ni transacciones.
- **Sin oráculo de existencia:** celular no registrado, cliente inactivo o sin autorización
  devuelven exactamente la misma respuesta vacía. La UI muestra un único mensaje genérico
  ("No encontramos una tarjeta activa con ese número — pregunta en la tienda").

### 2.3 UI en el catálogo

Botón/sección "Mi tarjeta MOVE ON Club" en `apps/landing-web` (ruta `/club` o modal): input de
celular → tarjeta de sellos visual (misma metáfora de casillas troqueladas del POS, adaptada a
la identidad del catálogo: negro + amarillo #F9D128, Montserrat). Sin estado persistente: cada
consulta es efímera, no se guarda el celular en localStorage.

## 3. Riesgos aceptados y mitigaciones

| Riesgo | Postura |
|---|---|
| Un tercero que conoce el celular de alguien puede ver su conteo de sellos | **Aceptado por el dueño** en favor de la transparencia. Mitigado por minimización: lo visible (primer nombre + sellos de batidos) es de sensibilidad muy baja |
| Enumeración masiva de celulares para descubrir clientes | Sin oráculo de existencia + respuesta mínima hacen el ataque poco rentable. Si se detecta abuso (logs de PostgREST), la RPC se migra a una Edge Function con rate limit por IP — la firma pública no cambia |
| Deriva de alcance (mostrar historial/compras) | Prohibido por este ADR: cualquier ampliación de la proyección requiere ADR nuevo |

## 4. Alternativas descartadas

- **Solo usuarios autenticados / cuentas de cliente:** descartada por directriz del dueño y
  por el costo de un sistema de cuentas fuera del scope MVP.
- **Enlace personal con token secreto (compartido por WhatsApp):** más privado, pero agrega
  fricción operativa (generar/compartir enlaces) que contradice la intención de autoservicio.
- **OTP por WhatsApp/SMS:** infraestructura y costo por mensaje injustificados para el nivel
  de sensibilidad del dato.
- **Cédula + celular (doble factor de búsqueda):** más fricción sin ganancia real — quien
  conoce el celular de una persona cercana normalmente también conoce su cédula.
