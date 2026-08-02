# Estándar: Principios SOLID aplicados al proyecto

> Cómo se aplican los principios SOLID en el contexto de Clean Architecture feature-first (ADR 0015) + Angular + Supabase.
> Tabla resumen con ejemplos reales del proyecto: ADR 0015 §6.4.

---

## S — Single Responsibility Principle

**Cada archivo/función/clase tiene una única razón para cambiar.**

### En Domain
- Una entidad (`sale.entity.ts`) solo encapsula reglas de negocio de esa entidad.
- Un value object (`money.value-object.ts`) solo encapsula invariantes del concepto.

```typescript
// MAL: entidad con responsabilidades mezcladas
class Sale {
  calculateTotal() { ... }
  formatForPDF() { ... }       // ← no es dominio, es presentación
  saveToDatabase() { ... }     // ← no es dominio, es infraestructura
}

// BIEN: entidad con una sola responsabilidad
class Sale {
  calculateTotal(): Money { ... }
  applyDiscount(discount: Discount): Sale { ... }
  void(reason: string): Sale { ... }
  // Solo reglas de negocio
}
```

### En Use-cases (`domain/usecases/`)
- Un use-case = una operación de negocio.
- `create-sale.use-case.ts` solo crea ventas. Si necesita lógica extra, la delega.

```typescript
// MAL: use-case con muchas responsabilidades
async function createSaleUseCase(input) {
  // validar stock
  // crear venta
  // actualizar inventario
  // emitir factura
  // enviar email
  // registrar en caja
}

// BIEN: orquesta, delega
async function createSaleUseCase(input, { saleRepo, inventoryRepo, billingProvider }) {
  const stockCheck = await inventoryRepo.checkAvailability(input.items);
  if (!stockCheck.ok) return stockCheck;

  const sale = Sale.create(input);
  await saleRepo.save(sale);

  // El inventario tiene su propio use-case que se llama aquí
  await decreaseInventoryUseCase({ saleItems: input.items }, { inventoryRepo });

  return { ok: true, value: sale };
}
```

### En Data
- Un repository = un contrato de dominio implementado.
- Un datasource = un sistema externo (PostgREST, RPC, Storage, QZ).
- Un adapter = una integración externa.

---

## O — Open/Closed Principle

**Abierto para extensión, cerrado para modificación.**

### En Adapters

```typescript
// Contrato en dominio (cerrado para modificación)
// features/billing/domain/repositories/billing-provider.ts (futuro)
export abstract class BillingProvider {
  abstract issueInvoice(input: IssueInvoiceInput): Promise<Result<InvoiceResult, BillingError>>
  abstract voidDocument(id: string): Promise<Result<void, BillingError>>
}

// Extensión: nuevo proveedor sin tocar código existente
// features/billing/data/repositories/siigo.adapter.ts
export class SiigoAdapter extends BillingProvider { ... }

// features/billing/data/repositories/factus.adapter.ts
export class FactusAdapter extends BillingProvider { ... }

// features/billing/data/repositories/mock.adapter.ts
export class MockBillingAdapter extends BillingProvider { ... }
```

### En Use-Cases

Los use-cases reciben sus dependencias como argumentos. Para agregar comportamiento nuevo (logging, auditoría), se hace en la capa de llamada sin modificar el use-case.

---

## L — Liskov Substitution Principle

**Las implementaciones deben ser sustituibles por su interfaz sin alterar el comportamiento.**

```typescript
// Contrato (abstract class, ADR 0015 §6.1)
abstract class ProductRepository {
  abstract findById(id: string): Promise<Result<Product, NotFoundError>>;
  abstract save(product: Product): Promise<Result<void, DatabaseError>>;
  abstract findAll(filters: ProductFilters): Promise<Result<Product[], DatabaseError>>;
}

// Implementación real
class SupabaseProductRepository extends ProductRepository {
  async findById(id: string) {
    const { data, error } = await supabase.from('products').select().eq('id', id).single();
    if (error) return { ok: false, error: new DatabaseError(error.message) };
    if (!data) return { ok: false, error: new NotFoundError(id) };
    return { ok: true, value: ProductMapper.toDomain(data) };
  }
  // ...
}

// Implementación para tests — sustituible sin cambiar los use-cases
class InMemoryProductRepository extends ProductRepository {
  private products = new Map<string, Product>();
  async findById(id: string) {
    const product = this.products.get(id);
    if (!product) return { ok: false, error: new NotFoundError(id) };
    return { ok: true, value: product };
  }
  // ...
}
```

**Regla práctica:** si los tests de un use-case funcionan con `InMemoryProductRepository`, la implementación real debe comportarse igual.

---

## I — Interface Segregation Principle

**Los clientes no deben depender de interfaces que no usan.**

```typescript
// MAL: interfaz monolítica
interface ProductRepository {
  findById(id: string): Promise<Product>;
  findAll(): Promise<Product[]>;
  save(product: Product): Promise<void>;
  delete(id: string): Promise<void>;
  findByCategory(categoryId: string): Promise<Product[]>;
  findLowStock(): Promise<Product[]>;         // ← solo lo usa inventory
  exportToCsv(): Promise<string>;             // ← solo lo usa reports
}

// BIEN: interfaces segregadas
interface ProductReader {
  findById(id: string): Promise<Result<Product, NotFoundError>>;
  findAll(filters: ProductFilters): Promise<Result<Product[], DatabaseError>>;
  findByCategory(categoryId: string): Promise<Result<Product[], DatabaseError>>;
}

interface ProductWriter {
  save(product: Product): Promise<Result<void, DatabaseError>>;
  delete(id: string): Promise<Result<void, DatabaseError>>;
}

interface ProductInventoryReader {
  findLowStock(threshold: number): Promise<Result<Product[], DatabaseError>>;
}

// El use-case de products solo necesita ProductReader y ProductWriter
// El use-case de inventory solo necesita ProductInventoryReader
```

---

## D — Dependency Inversion Principle

**Los módulos de alto nivel no dependen de módulos de bajo nivel. Ambos dependen de abstracciones.**

```
domain (alto nivel)
  ↑ define contratos (abstract class) y use-cases que los reciben como deps
presentation (Angular)
  ↑ inyecta la ABSTRACCIÓN con inject(Contrato) y se la pasa al use-case
data (bajo nivel)
  ↑ implementa los contratos del dominio (extends)
```

### Inyección de dependencias en use-cases

```typescript
// features/sales/domain/usecases/create-sale.use-case.ts

// El use-case depende de contratos (dominio), no de Supabase (data)
export async function createSaleUseCase(
  input: CreateSaleInput,
  deps: {
    saleRepository: SaleRepository            // abstract class del dominio
    inventoryRepository: InventoryRepository  // abstract class del dominio
  },
): Promise<Result<Sale, SaleError>> {
  // ...
}

// features/sales/sales.providers.ts — composition root de la feature
// (registrado en app.config.ts; ÚNICO archivo que conoce dominio E implementación)
export const salesProviders: Provider[] = [
  { provide: SaleRepository, useClass: SalesRepository },
]

// features/pos/presentation/services/pos-sale.service.ts — el consumidor
private readonly saleRepository = inject(SaleRepository)   // la abstracción
// ...
const result = await createSaleUseCase(input, {
  saleRepository: this.saleRepository,
  inventoryRepository: this.inventoryRepository,
})
```

---

## Resumen práctico

| Principio | Señal de que se está rompiendo |
|---|---|
| **S** | Un archivo toca más de un "módulo mental" (presentación + negocio + datos) |
| **O** | Necesitas `if (provider === 'factus')` en el use-case |
| **L** | El InMemoryRepository falla tests que el Supabase sí pasa |
| **I** | El use-case importa una interfaz con métodos que nunca usa |
| **D** | El use-case hace `import { supabase } from '@/infrastructure/supabase/client'` |
