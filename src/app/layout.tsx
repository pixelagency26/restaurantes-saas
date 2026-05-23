import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Software Restaurante',
  description: 'Sistema de gestión para restaurantes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full bg-gray-50">
        {children}
        <Toaster
          position="top-center"
          containerStyle={{ zIndex: 99998 }}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1f2937',
              color: '#f9fafb',
              borderRadius: '8px',
              fontSize: '14px',
            },
          }}
        />
      </body>
    </html>
  )
}
