import { inject, Injectable } from '@angular/core'
import qz from 'qz-tray'
import { SupabaseClientService } from '../../../core/supabase/supabase-client.service'

interface QzSigningResponse {
  certificate?: string
  signature?: string
}

type QzSigningRequest =
  | { action: 'certificate' }
  | { action: 'sign'; request: string }

@Injectable({ providedIn: 'root' })
export class QzSigningService {
  private readonly supabase = inject(SupabaseClientService)
  private configured = false
  private configurationPromise: Promise<boolean> | null = null

  async configureIfAvailable(): Promise<boolean> {
    if (this.configured) return true

    if (!this.configurationPromise) {
      this.configurationPromise = this.configure().finally(() => {
        this.configurationPromise = null
      })
    }

    return this.configurationPromise
  }

  private async configure(): Promise<boolean> {
    try {
      const response = await this.invoke({ action: 'certificate' })
      const certificate = response.certificate?.trim()
      if (!certificate) throw new Error('Supabase no devolvio el certificado de QZ Tray')

      qz.security.setCertificatePromise(Promise.resolve(certificate), { rejectOnFailure: true })
      qz.security.setSignatureAlgorithm('SHA512')
      qz.security.setSignaturePromise((request) => (resolve, reject) => {
        this.sign(request).then(resolve, reject)
      })

      this.configured = true
      return true
    } catch (error) {
      console.warn(
        'La firma de QZ Tray no esta configurada; se continuara con autorizacion manual.',
        error,
      )
      return false
    }
  }

  private async sign(request: string): Promise<string> {
    const response = await this.invoke({ action: 'sign', request })
    const signature = response.signature?.trim()
    if (!signature) throw new Error('Supabase no devolvio la firma de QZ Tray')
    return signature
  }

  private async invoke(body: QzSigningRequest): Promise<QzSigningResponse> {
    const { data, error } = await this.supabase.supabase.functions.invoke<QzSigningResponse>(
      'qz-sign',
      { body },
    )

    if (error) throw new Error(error.message, { cause: error })
    if (!data) throw new Error('Respuesta vacia de la funcion qz-sign')
    return data
  }
}
