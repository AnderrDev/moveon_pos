export type LinkIcon = 'whatsapp' | 'catalog' | 'instagram' | 'maps'

export interface SocialLink {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly href: string
  readonly icon: LinkIcon
  readonly featured?: boolean
}

export const SOCIAL_LINKS: readonly SocialLink[] = [
  {
    id: 'whatsapp',
    label: 'Escríbenos por WhatsApp',
    description: 'Pedidos, disponibilidad y asesoría',
    href: 'https://wa.me/573012244006?text=Hola%20Move%20On%2C%20quiero%20recibir%20asesor%C3%ADa.',
    icon: 'whatsapp',
    featured: true,
  },
  {
    id: 'catalogo',
    label: 'Explora nuestro catálogo',
    description: 'Suplementos, batidos, café y snacks',
    href: 'https://moveon-client.netlify.app/catalogo',
    icon: 'catalog',
  },
  {
    id: 'instagram',
    label: 'Síguenos en Instagram',
    description: '@moveongear',
    href: 'https://www.instagram.com/moveongear/',
    icon: 'instagram',
  },
  {
    id: 'maps',
    label: 'Encuéntranos en Google Maps',
    description: 'Viva Fontibón · Bogotá',
    href: 'https://maps.app.goo.gl/bkRg1w8si7BK9Rtq8',
    icon: 'maps',
  },
]

export const STORE_SCHEDULE = {
  regular: 'Lun–Vie · 9:00 a.m. – 9:00 p.m.',
  weekend: 'Sáb–Dom · 9:00 a.m. – 5:00 p.m.',
} as const
