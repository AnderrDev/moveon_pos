/**
 * Contenido estático de la vitrina: menú de batidos, café, snacks, combos,
 * horarios y datos de contacto por defecto.
 *
 * Vive fuera del componente a propósito: cambiar un precio del menú es la
 * edición más frecuente de esta app y debe ser un diff de datos, no un diff
 * del componente de página. TS puro, sin Angular.
 */

import type { CatalogoContactSettings } from './catalogo.service'

export interface MenuItem {
  nombre: string
  precio: string
}

export interface SnackItem extends MenuItem {
  /** Gramos de proteína destacados en la carta; `null` si no aplica. */
  badge: string | null
}

export interface BatidoBase extends MenuItem {
  codigo: string
}

export interface TrustItem {
  titulo: string
  texto: string
}

/** Fallback cuando `storefront_contact_settings` no responde. */
export const DEFAULT_CONTACT_SETTINGS: CatalogoContactSettings = {
  whatsappNumber: '573012244006',
  whatsappDisplay: '+57 301 224 4006',
  instagramUrl: 'https://www.instagram.com/moveongear/',
  instagramHandle: 'moveongear',
}

export const HORARIO_SEMANA = '9:00 a.m. – 9:00 p.m.'
export const HORARIO_FESTIVOS = '9:00 a.m. – 5:00 p.m.'
export const MAPS_URL = 'https://maps.app.goo.gl/bkRg1w8si7BK9Rtq8'

export const CONFIANZA: readonly TrustItem[] = [
  { titulo: 'Asesoría personalizada', texto: 'Te ayudamos a elegir según tu entrenamiento y tu objetivo. Sin enredos.' },
  { titulo: 'Productos originales', texto: 'Solo marcas reconocidas y producto sellado. Lo que ves es lo que llevas.' },
  { titulo: 'Variedad de marcas', texto: 'Opciones para todos los presupuestos sin sacrificar calidad.' },
  { titulo: 'Para tu objetivo', texto: 'Ganar masa, definición, energía o recuperación: hay opción para ti.' },
]

export const BATIDO_BASES: readonly BatidoBase[] = [
  { codigo: 'Base 01', nombre: 'En agua', precio: '$11.000' },
  { codigo: 'Base 02', nombre: 'En leche', precio: '$13.000' },
]

export const BATIDO_ADICIONALES: readonly string[] = [
  'Fresa 80gr',
  'Banano 80gr',
  'Mora 80gr',
  'Caramelo',
  'Piña 110gr',
  'Mango 150gr',
  'Café 7gr',
  'Arequipe 50gr',
  'Milo 30gr',
  'Mantequilla de maní 30gr',
]

export const BATIDO_TOPPINGS: readonly MenuItem[] = [
  { nombre: 'Salsa de chocolate', precio: '$1.500' },
  { nombre: 'Salsa de fresa', precio: '$1.500' },
  { nombre: 'Salsa de maní', precio: '$1.500' },
  { nombre: 'Granola', precio: '$1.500' },
  { nombre: 'Chips de chocolate', precio: '$1.500' },
]

export const BATIDO_PREMIUM: readonly MenuItem[] = [
  { nombre: 'Arándanos', precio: '$3.500' },
  { nombre: 'Yogurt griego', precio: '$2.000' },
  { nombre: 'Leche de almendras', precio: '$2.000' },
  { nombre: 'Bordeado de temporada', precio: 'Consultar' },
]

export const CAFE_ITEMS: readonly MenuItem[] = [
  { nombre: 'Espresso · 7oz', precio: '$4.000' },
  { nombre: 'Leche caliente · 9oz', precio: '$4.000' },
  { nombre: 'Americano · 9oz', precio: '$4.000' },
  { nombre: 'Latte · 9oz', precio: '$6.000' },
  { nombre: 'Capuchino · 9oz', precio: '$6.000' },
]

export const SNACK_ITEMS: readonly SnackItem[] = [
  { nombre: 'Galleta Oreo', badge: '21G PROTEÍNA', precio: '$12.000' },
  { nombre: 'Galleta Nutella', badge: '21G PROTEÍNA', precio: '$12.000' },
  { nombre: 'Galleta Hangry Boy', badge: '15G PROTEÍNA', precio: '$15.000' },
  { nombre: 'Barra Fitbar', badge: '25G PROTEÍNA', precio: '$15.000' },
  { nombre: 'Cereal Nutrapops', badge: null, precio: '$7.000' },
]

export const COMBOS: readonly MenuItem[] = [
  { nombre: 'Galleta Oreo/Nutella + Americano', precio: '$15.000' },
  { nombre: 'Galleta Oreo/Nutella + Capuchino', precio: '$16.000' },
  { nombre: 'Vaso Cereal Nutrapops + Leche', precio: '$10.000' },
]
