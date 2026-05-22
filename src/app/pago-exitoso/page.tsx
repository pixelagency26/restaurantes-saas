'use client'
import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const NOMBRES: Record<string, string> = { basico: 'Básico', pro: 'Pro' }

function PagoExitosoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') || 'basico'
  const tipo = searchParams.get('tipo') || 'nuevo'

  useEffect(() => {
    const timer = setTimeout(() => router.push('/gerencia'), 5000)
    return () => clearTimeout(timer)
  }, [router])

  const mensajeTipo: Record<string, string> = {
    nuevo:   'Tu suscripción quedará activa al terminar el período de prueba. ¡Disfruta los 14 días gratis!',
    upgrade: `Tu cuenta fue actualizada al Plan ${NOMBRES[plan]}. Los días restantes de tu plan anterior fueron aplicados.`,
    renovar: `Tu Plan ${NOMBRES[plan]} fue renovado por 30 días adicionales.`,
  }

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

        {/* Ícono éxito */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <span className="text-4xl">✅</span>
        </div>

        <div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">¡Pago exitoso!</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            {mensajeTipo[tipo] || mensajeTipo.nuevo}
          </p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-sm text-orange-700">
          <p className="font-bold mb-1">Plan {NOMBRES[plan]}</p>
          <p className="text-xs text-orange-600">El estado se actualizará en unos segundos en tu panel.</p>
        </div>

        <Link href="/gerencia"
          className="block w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl transition-colors">
          Ir al panel de gerencia
        </Link>

        <p className="text-xs text-gray-400">Redirigiendo automáticamente en 5 segundos…</p>
      </div>
    </div>
  )
}

export default function PagoExitosoPage() {
  return (
    <Suspense>
      <PagoExitosoContent />
    </Suspense>
  )
}
