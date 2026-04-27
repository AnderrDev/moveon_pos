import type { Config } from 'tailwindcss'

// En Tailwind v4, la configuración de colores, fuentes y radios
// se hace directamente en globals.css con @theme.
// Este archivo se mantiene por compatibilidad con herramientas del IDE.
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}',
    './src/shared/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  plugins: [],
}

export default config
