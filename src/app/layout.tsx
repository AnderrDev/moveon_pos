import type { Metadata } from 'next'
import { DM_Sans, Syne } from 'next/font/google'
import { ToastProvider } from '@/shared/components/feedback/ToastProvider'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--body-font',
  display: 'swap',
})

const syne = Syne({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--heading-font',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MOVEONAPP POS',
  description: 'Sistema de Punto de Venta para tienda de suplementos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${dmSans.variable} ${syne.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
