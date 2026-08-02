import type { Provider } from '@angular/core'
import { ProductRepository } from '@angular-app/features/products/domain/repositories/product.repository'
import { ProductImageStorage } from '@angular-app/features/products/domain/repositories/product-image-storage.repository'
import { ProductsRepository } from '@angular-app/features/products/data/repositories/products.repository'
import { ProductImageStorageService } from '@angular-app/features/products/data/datasources/product-image-storage.service'

/** Composition root de la feature (ADR 0015 §6.2). */
export const productsProviders: Provider[] = [
  { provide: ProductRepository, useClass: ProductsRepository },
  { provide: ProductImageStorage, useClass: ProductImageStorageService },
]
