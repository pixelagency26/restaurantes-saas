'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'

function CheckoutForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') as 'basico' | 'pro' | null
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!plan) {
      router.push('/gerencia')
      return
    }

    async function redirigirAMP() {
      try {
        const res = await fetch('/api/mp/crear-suscripcion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        })
        const data = await res.json()
        if (!res.ok || !data.checkout_url) {
          setError(data.error || 'No se pudo iniciar el pago. Intenta de nuevo.')
          return
        }
        window.location.href = data.checkout_url
      } catch (e) {
        setError('Error de conexión: ' + String(e))
      }
    }

    redirigirAMP()
  }, [plan])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="text-6xl">⚠️</div>
          <h1 className="text-2xl font-black text-gray-900">Algo salió mal</h1>
          <p className="text-gray-500 text-sm leading-relaxed">{error}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setError(null); window.location.reload() }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl transition-colors">
              Reintentar
            </button>
            <Link href="/gerencia"
              className="w-full block text-center border-2 border-gray-200 hover:border-gray-300 text-gray-600 font-bold py-4 rounded-2xl transition-colors text-sm">
              Ir al panel sin suscribirse
            </Link>
          </div>
          <p className="text-xs text-gray-400">
            ¿Necesitas ayuda?{' '}
            <a href="https://wa.me/573137335448?text=Hola%2C%20tuve%20un%20problema%20al%20pagar%20en%20Restaurant%20Pix"
              target="_blank" rel="noopener noreferrer"
              className="text-orange-500 font-semibold hover:underline">
              Escríbenos por WhatsApp
            </a>
          </p>
        </div>
      </div>
    )
  }

  const planLabel = plan === 'pro' ? 'Pro — $149.900 COP/mes' : 'Básico — $89.900 COP/mes'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
            <span className="text-xl">🍽️</span>
          </div>
          <span className="font-black text-gray-900 text-xl">Restaurant Pix</span>
        </div>

        {/* Spinner */}
        <div className="flex justify-center">
          <div className="w-14 h-14 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>

        <div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Preparando tu pago</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Te estamos redirigiendo a MercadoPago para activar tu plan{' '}
            <span className="font-bold text-gray-700">{planLabel}</span>.
          </p>
        </div>

        <p className="text-xs text-gray-400">
          Si no te redirige automáticamente en unos segundos,{' '}
          <button
            onClick={() => window.location.reload()}
            className="text-orange-500 font-semibold hover:underline">
            haz clic aquí
          </button>
        </p>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutForm />
    </Suspense>
  )
}
