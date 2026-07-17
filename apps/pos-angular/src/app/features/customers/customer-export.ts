import type { Cliente } from '@/modules/customers/domain/entities/cliente.entity'
import type { ExcelWorkbookDefinition } from '../../shared/services/export/excel-export.service'
import { buildExportFilename } from '../../shared/services/export/export-filename'

export function buildCustomersWorkbook(
  customers: readonly Cliente[],
  query: string
): ExcelWorkbookDefinition {
  const normalizedQuery = query.trim()
  return {
    filename: buildExportFilename('clientes'),
    sheets: [
      {
        name: 'Clientes',
        title: 'Directorio de clientes',
        subtitle: normalizedQuery
          ? `${customers.length} clientes · Filtro: ${normalizedQuery}`
          : `${customers.length} clientes`,
        columns: [
          { header: 'Nombre', width: 32 },
          { header: 'Tipo de documento', width: 20 },
          { header: 'Número de documento', width: 22 },
          { header: 'Correo electrónico', width: 32 },
          { header: 'Teléfono', width: 18 },
          { header: 'Creado', width: 18, format: 'date' },
          { header: 'Actualizado', width: 18, format: 'date' },
        ],
        rows: customers.map((customer) => [
          customer.nombre,
          customer.tipoDocumento,
          customer.numeroDocumento,
          customer.email,
          customer.telefono,
          customer.createdAt,
          customer.updatedAt,
        ]),
      },
    ],
  }
}
