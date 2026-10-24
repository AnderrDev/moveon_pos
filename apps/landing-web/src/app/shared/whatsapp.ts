/**
 * Construcción de enlaces a WhatsApp. Único lugar donde se arma la URL
 * `wa.me`: la página y la cinta de ofertas la duplicaban.
 */

export function whatsappLink(numero: string, mensaje: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}

export const WA_MENSAJES = {
  general: 'Hola Move On 👋 Vi el catálogo y quiero más información.',
  batidos: 'Hola Move On 👋 Quiero pedir un batido de proteína.',
  producto: (nombre: string) =>
    `Hola Move On 👋 Quiero preguntar por: ${nombre}. ¿Está disponible?`,
  productoDestacado: (nombre: string) =>
    `Hola Move On 👋 Me interesa ${nombre}, que vi destacado en el catálogo. ¿Está disponible?`,
} as const
