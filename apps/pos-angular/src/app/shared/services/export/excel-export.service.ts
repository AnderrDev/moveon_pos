import { Injectable } from '@angular/core'

export type ExcelCellValue = string | number | boolean | Date | null

export type ExcelColumnFormat =
  | 'text'
  | 'integer'
  | 'decimal'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'

export interface ExcelColumnDefinition {
  header: string
  width?: number
  format?: ExcelColumnFormat
}

export interface ExcelSheetDefinition {
  name: string
  title: string
  subtitle?: string
  columns: readonly ExcelColumnDefinition[]
  rows: readonly (readonly ExcelCellValue[])[]
}

export interface ExcelWorkbookDefinition {
  filename: string
  sheets: readonly ExcelSheetDefinition[]
}

const HEADER_ROW = 5
const DATA_ROW = HEADER_ROW + 1
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const NUMBER_FORMATS: Record<ExcelColumnFormat, string | null> = {
  text: null,
  integer: '#,##0',
  decimal: '#,##0.00',
  currency: '[$$-es-CO] #,##0',
  percent: '0.##"%"',
  date: 'yyyy-mm-dd',
  datetime: 'yyyy-mm-dd hh:mm',
}

@Injectable({ providedIn: 'root' })
export class ExcelExportService {
  async download(definition: ExcelWorkbookDefinition): Promise<void> {
    if (definition.sheets.length === 0) {
      throw new Error('El libro debe contener al menos una hoja')
    }

    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()

    workbook.creator = 'MOVEONAPP POS'
    workbook.lastModifiedBy = 'MOVEONAPP POS'
    workbook.created = new Date()
    workbook.modified = new Date()

    for (const sheetDefinition of definition.sheets) {
      if (sheetDefinition.columns.length === 0) continue

      const worksheet = workbook.addWorksheet(this.sanitizeSheetName(sheetDefinition.name), {
        views: [{ state: 'frozen', ySplit: HEADER_ROW }],
        properties: { defaultRowHeight: 20 },
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
      })

      const lastColumn = sheetDefinition.columns.length
      worksheet.mergeCells(1, 1, 1, lastColumn)
      worksheet.getCell(1, 1).value = sheetDefinition.title
      worksheet.getCell(1, 1).font = { bold: true, size: 18, color: { argb: 'FF172033' } }
      worksheet.getCell(1, 1).alignment = { vertical: 'middle' }
      worksheet.getRow(1).height = 30

      worksheet.mergeCells(2, 1, 2, lastColumn)
      worksheet.getCell(2, 1).value = sheetDefinition.subtitle ?? 'MOVEONAPP POS'
      worksheet.getCell(2, 1).font = { size: 10, color: { argb: 'FF667085' } }

      worksheet.mergeCells(3, 1, 3, lastColumn)
      worksheet.getCell(3, 1).value = `Generado: ${new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date())}`
      worksheet.getCell(3, 1).font = { size: 9, italic: true, color: { argb: 'FF98A2B3' } }

      const header = worksheet.getRow(HEADER_ROW)
      header.values = sheetDefinition.columns.map((column) => column.header)
      header.height = 24
      header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      header.alignment = { vertical: 'middle' }
      header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF47B20' } }

      worksheet.addRows(sheetDefinition.rows.map((row) => [...row]))
      worksheet.autoFilter = {
        from: { row: HEADER_ROW, column: 1 },
        to: { row: HEADER_ROW, column: lastColumn },
      }

      sheetDefinition.columns.forEach((column, index) => {
        const worksheetColumn = worksheet.getColumn(index + 1)
        worksheetColumn.width = Math.min(Math.max(column.width ?? 16, 8), 48)

        const format = NUMBER_FORMATS[column.format ?? 'text']
        if (format) worksheetColumn.numFmt = format

        worksheetColumn.alignment = {
          vertical: 'top',
          wrapText: (column.width ?? 16) >= 28,
          horizontal: this.isNumeric(column.format) ? 'right' : 'left',
        }
      })

      const lastDataRow = DATA_ROW + sheetDefinition.rows.length - 1
      for (let rowIndex = DATA_ROW; rowIndex <= lastDataRow; rowIndex += 1) {
        const row = worksheet.getRow(rowIndex)
        if (rowIndex % 2 === 0) {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8F2' } }
        }
        row.eachCell((cell) => {
          cell.border = { bottom: { style: 'hair', color: { argb: 'FFE4E7EC' } } }
        })
      }

      worksheet.pageSetup.printTitlesRow = `${HEADER_ROW}:${HEADER_ROW}`
      worksheet.headerFooter.oddFooter = '&LMOVEONAPP POS&C&A&RPagina &P de &N'
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const bytes = new Uint8Array(buffer)
    const url = URL.createObjectURL(new Blob([bytes], { type: MIME_XLSX }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = this.sanitizeFilename(definition.filename)
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  private isNumeric(format: ExcelColumnFormat | undefined): boolean {
    return ['integer', 'decimal', 'currency', 'percent'].includes(format ?? '')
  }

  private sanitizeFilename(filename: string): string {
    const base = filename.replace(/\.xlsx$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '-')
    return `${base || 'moveonapp-exportacion'}.xlsx`
  }

  private sanitizeSheetName(name: string): string {
    return (
      name
        .replace(/[\\/*?:[\]]/g, ' ')
        .trim()
        .slice(0, 31) || 'Datos'
    )
  }
}
