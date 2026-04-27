# Estándar: Patrones de Diseño en el Proyecto

> Catálogo de patrones usados en MOVEONAPP POS. Solo añadir patrones aquí cuando haya un ADR que los justifique.

---

## 1. Repository Pattern

**Qué resuelve:** desacopla la lógica de negocio del acceso a datos.

**Dónde:** `src/modules/<modulo>/domain/repositories/` (interfaz) y `src/modules/<modulo>/infrastructure/repositories/` (implementación).

```
ProductRepository (interfaz en domain)
    ↑
SupabaseProductRepository (implementación en infrastructure)
InMemoryProductRepository (implementación para tests)
```

**Reglas:**
- La interfaz solo define operaciones de negocio, no operaciones SQL.
- El método de retorno es siempre `Promise<Result<T, E>>`.
- Los repositories nunca devuelven tipos de Supabase (`PostgrestError`, etc.). Mapean a errores de dominio.

---

## 2. Adapter Pattern

**Qué resuelve:** conecta el sistema con servicios externos sin contaminar el dominio.

**Dónde:** `src/modules/<modulo>/infrastructure/adapters/`.

```typescript
// Interfaz en dominio
interface BillingProvider {
  issueInvoice(input: IssueInvoiceInput): Promise<Result<InvoiceResult, BillingError>>;
}

// Adapter en infraestructura
class FactusAdapter implements BillingProvider {
  async issueInvoice(input) {
    // Traduce el dominio a la API de Factus
    const factusPayload = FactusMapper.fromDomain(input);
    const response = await this.factusClient.post('/invoices', factusPayload);
    // Traduce la respuesta de Factus al dominio
    return FactusMapper.toResult(response);
  }
}
```

**Adapters a implementar en MVP:**
- `FactusAdapter` — facturación electrónica DIAN
- `ThermalPrinterAdapter` — impresión de tickets
- `MockBillingAdapter` — para tests y modo offline

---

## 3. Result Pattern (ya implementado)

**Qué resuelve:** errores de negocio tipados sin `throw`.

**Dónde:** `src/shared/result.ts`.

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Helpers
const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

**Reglas:**
- Usar `Result` para errores de **dominio** (stock insuficiente, caja cerrada, descuento no autorizado).
- Usar `throw` solo para errores **técnicos** (conexión caída, timeout).
- No anidar `Result` dentro de `Result`.

---

## 4. Factory Pattern

**Qué resuelve:** centraliza la creación de entidades con sus invariantes.

**Dónde:** método estático `create()` en las entidades del dominio.

```typescript
// src/modules/sales/domain/entities/sale.entity.ts
export class Sale {
  private constructor(
    public readonly id: string,
    public readonly items: SaleItem[],
    public readonly total: Money,
    public readonly status: SaleStatus,
    public readonly createdAt: Date,
  ) {}

  // Factory: única forma válida de crear una venta
  static create(input: CreateSaleInput): Result<Sale, SaleValidationError> {
    if (input.items.length === 0) {
      return err(new SaleValidationError('La venta debe tener al menos un producto'));
    }
    const total = input.items.reduce((acc, item) => acc + item.subtotal, 0);
    return ok(new Sale(
      crypto.randomUUID(),
      input.items,
      total,
      'pending',
      new Date(),
    ));
  }

  // Reconstitución desde DB (no valida, confía en que el dato es válido)
  static reconstitute(data: SaleData): Sale {
    return new Sale(data.id, data.items, data.total, data.status, data.createdAt);
  }
}
```

**Reglas:**
- El constructor es `private`. Toda creación pasa por `Sale.create()`.
- `create()` valida invariantes y devuelve `Result`.
- `reconstitute()` (o `fromPersistence()`) recrea desde DB sin validar (se confía en que la DB tiene datos válidos).

---

## 5. Mapper Pattern

**Qué resuelve:** traduce entre la representación de DB y la entidad de dominio.

**Dónde:** `src/modules/<modulo>/infrastructure/mappers/`.

```typescript
// src/modules/products/infrastructure/mappers/product.mapper.ts
import type { Database } from '@/infrastructure/supabase/database.types';
import { Product } from '../../domain/entities/product.entity';

type ProductRow = Database['public']['Tables']['products']['Row'];

export const ProductMapper = {
  toDomain(row: ProductRow): Product {
    return Product.reconstitute({
      id: row.id,
      nombre: row.nombre,
      sku: row.sku,
      precioVenta: row.precio_venta,  // snake_case → camelCase
      categoriaId: row.categoria_id,
      activo: row.activo,
      creadoEn: new Date(row.created_at),
    });
  },

  toPersistence(product: Product): Omit<ProductRow, 'id' | 'created_at'> {
    return {
      nombre: product.nombre,
      sku: product.sku,
      precio_venta: product.precioVenta,  // camelCase → snake_case
      categoria_id: product.categoriaId,
      activo: product.activo,
      tienda_id: product.tiendaId,
    };
  },
};
```

---

## 6. Command Pattern (Use-Cases como comandos)

**Qué resuelve:** cada operación de negocio es un comando con input y output claros.

Los use-cases ya son commands implícitamente. La convención:

```typescript
// Nombre: verbo en infinitivo + entidad + "UseCase"
// Input: tipado con Zod schema del DTO
// Output: Result<Entidad, Error>

createSaleUseCase(input: CreateSaleInput, deps): Promise<Result<Sale, SaleError>>
closeCashSessionUseCase(input: CloseCashInput, deps): Promise<Result<CashSession, CashError>>
issueInvoiceUseCase(input: IssueInvoiceInput, deps): Promise<Result<Invoice, BillingError>>
```

---

## 7. Observer/Event Pattern (post-MVP)

**Qué resuelve:** desacopla acciones secundarias (enviar email, actualizar dashboard) del flujo principal.

**En MVP:** no se implementa. El use-case llama directamente a lo que necesita.

**Post-MVP:** se puede implementar con un EventBus simple si los side effects crecen:

```typescript
// Cuando se crea una venta, emitir evento
eventBus.emit('sale.created', { saleId: sale.id, total: sale.total });

// El módulo de reportes escucha sin que ventas lo sepa
eventBus.on('sale.created', updateDailySalesReport);
```

---

## 8. Strategy Pattern (para descuentos y precios)

**Qué resuelve:** permite intercambiar algoritmos de cálculo de precios/descuentos.

```typescript
interface DiscountStrategy {
  apply(price: Money, context: SaleContext): Money;
}

class PercentageDiscount implements DiscountStrategy {
  constructor(private readonly percentage: number) {}
  apply(price: Money): Money { return price * (1 - this.percentage / 100); }
}

class FixedAmountDiscount implements DiscountStrategy {
  constructor(private readonly amount: Money) {}
  apply(price: Money): Money { return Math.max(0, price - this.amount); }
}
```

---

## Cuándo agregar un patrón nuevo

1. Identificar el problema concreto que resuelve.
2. Verificar que ninguno de los patrones existentes lo resuelve.
3. Redactar un ADR en `/docs/adr/` con justificación.
4. Agregar el patrón a este documento con ejemplo concreto del proyecto.
5. No agregar patrones "por si acaso" — solo cuando hay un caso de uso real.
