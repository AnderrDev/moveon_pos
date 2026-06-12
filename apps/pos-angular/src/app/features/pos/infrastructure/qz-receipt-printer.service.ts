import { inject, Injectable } from '@angular/core'
import qz from 'qz-tray'
import {
  buildEscPosReceipt,
  buildEscPosTestReceipt,
  type EscPosReceiptInput,
  type EscPosReceiptStore,
} from './esc-pos-receipt.builder'
import { QzSigningService } from './qz-signing.service'

const CASH_DRAWER_PULSE = '\x1b\x70\x00\x19\xfa'

interface ReceiptOutputOptions {
  openCashDrawer?: boolean
}

@Injectable({ providedIn: 'root' })
export class QzReceiptPrinterService {
  private readonly signing = inject(QzSigningService)
  private connectionPromise: Promise<void> | null = null
  private logoPromise: Promise<string> | null = null

  async print(
    input: EscPosReceiptInput,
    configuredPrinterName: string,
    options: ReceiptOutputOptions = {},
  ): Promise<void> {
    if (options.openCashDrawer) await this.openCashDrawer(configuredPrinterName)
    await this.printRaw(
      buildEscPosReceipt(input),
      configuredPrinterName,
      `MOVEONAPP ${input.sale.saleNumber}`,
    )
  }

  async printTest(store: EscPosReceiptStore, configuredPrinterName: string): Promise<void> {
    await this.printRaw(buildEscPosTestReceipt(store), configuredPrinterName, 'MOVEONAPP prueba')
  }

  async openCashDrawer(configuredPrinterName: string): Promise<void> {
    try {
      await this.ensureConnected()
      const printerName = await this.findPrinter(configuredPrinterName)
      const config = qz.configs.create(printerName, { jobName: 'MOVEONAPP abrir caja' })
      await qz.print(config, [CASH_DRAWER_PULSE])
    } catch (error) {
      throw new Error(this.toUserMessage(error), { cause: error })
    }
  }

  private async printRaw(
    content: string,
    configuredPrinterName: string,
    jobName: string,
  ): Promise<void> {
    try {
      await this.ensureConnected()
      const printerName = await this.findPrinter(configuredPrinterName)
      const config = qz.configs.create(printerName, { jobName })
      const logo = await this.loadLogo()
      await qz.print(config, [
        '\x1b@\x1ba\x01',
        {
          type: 'raw',
          format: 'image',
          flavor: 'base64',
          data: logo,
          options: { language: 'ESCPOS' },
        },
        '\n',
        content,
      ])
    } catch (error) {
      throw new Error(this.toUserMessage(error), { cause: error })
    }
  }

  private async ensureConnected(): Promise<void> {
    if (qz.websocket.isActive()) return
    if (!this.connectionPromise) {
      this.connectionPromise = this.signing
        .configureIfAvailable()
        .then(() => qz.websocket.connect({ retries: 2, delay: 1 }))
        .finally(() => (this.connectionPromise = null))
    }
    await this.connectionPromise
  }

  private async findPrinter(configuredPrinterName: string): Promise<string> {
    const found = await qz.printers.find(configuredPrinterName)
    if (typeof found === 'string') {
      if (found) return found
      throw new Error(`No se encontro la impresora ${configuredPrinterName}`)
    }
    const exact = found.find((name) => name.toLowerCase() === configuredPrinterName.toLowerCase())
    if (exact) return exact
    throw new Error(`No se encontro la impresora ${configuredPrinterName}`)
  }

  private async loadLogo(): Promise<string> {
    if (!this.logoPromise) {
      this.logoPromise = fetch(
        new URL('assets/receipt/moveon-logo-thermal.png', document.baseURI),
      )
        .then((response) => {
          if (!response.ok) throw new Error('No se pudo cargar el logo del comprobante')
          return response.blob()
        })
        .then((blob) => this.blobToBase64(blob))
        .catch((error: unknown) => {
          this.logoPromise = null
          throw error
        })
    }
    return this.logoPromise
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('El logo del comprobante no tiene un formato valido'))
          return
        }
        resolve(reader.result.slice(reader.result.indexOf(',') + 1))
      }
      reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el logo'))
      reader.readAsDataURL(blob)
    })
  }

  private toUserMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error)
    const normalized = message.toLowerCase()

    if (
      normalized.includes('websocket') ||
      normalized.includes('connect') ||
      normalized.includes('qz tray')
    ) {
      return 'QZ Tray no esta instalado o abierto. Abre QZ Tray y vuelve a reimprimir.'
    }
    if (normalized.includes('printer') || normalized.includes('impresora')) {
      return 'No se encontro la impresora POS-58 en Windows.'
    }
    if (normalized.includes('sign')) {
      return 'No se pudo firmar la solicitud de impresion. Verifica la funcion qz-sign en Supabase.'
    }
    return `No se pudo enviar el comando a la POS-58: ${message}`
  }
}
