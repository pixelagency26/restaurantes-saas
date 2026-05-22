'use client'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

const WA_NUMBER = '573137335448'
const WA_MSG = encodeURIComponent('Hola, quiero renovar mi suscripción de Restaurant Pix 🍽️')

type Plan = 'basico' | 'pro'

export default function SuscripcionExpiradaPage() {
  const router = useRouter()
  const [procesando, setProcesando] = useState<Plan | null>(null)
  const [planSeleccionado, setPlanSeleccionado] = useState<Plan>('basico')

  async function pagar(plan: Plan) {
    setProcesando(plan)
    try {
      const res = await fetch('/api/mp/crear-suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al procesar el pago')
        setProcesando(null)
        return
      }
      // Redirigir al checkout de MercadoPago
      window.location.href = data.checkout_url
    } catch {
      toast.error('Error de conexión')
      setProcesando(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg text-center space-y-6">

        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
          <span className="text-4xl">⏰</span>
        </div>

        <div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Tu prueba ha terminado</h1>
          <p className="text-gray-500 leading-relaxed">
            Los 14 días de prueba gratuita han finalizado. Elige un plan para continuar usando Restaurant Pix.
          </p>
        </div>

        {/* Planes */}
        <div className="grid grid-cols-2 gap-4 text-left">
          {/* Básico */}
          <button onClick={() => setPlanSeleccionado('basico')}
            className={`rounded-2xl border-2 p-5 text-left transition-all ${planSeleccionado === 'basico' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Básico</p>
            <p className="text-2xl font-black text-gray-900">$89.900</p>
            <p className="text-xs text-gray-400 mb-3">COP/mes</p>
            <ul className="space-y-1.5 text-xs text-gray-600">
              <li>✓ Hasta 15 mesas</li>
              <li>✓ Meseras + Cocina + Caja</li>
              <li>✓ QR en mesa</li>
              <li>✓ 2 usuarios</li>
            </ul>
          </button>

          {/* Pro */}
          <button onClick={() => setPlanSeleccionado('pro')}
            className={`rounded-2xl border-2 p-5 text-left transition-all relative ${planSeleccionado === 'pro' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-black px-3 py-0.5 rounded-full">POPULAR</span>
            <p className="text-xs font-black text-orange-500 uppercase tracking-widest mb-1">Pro</p>
            <p className="text-2xl font-black text-gray-900">$149.900</p>
            <p className="text-xs text-gray-400 mb-3">COP/mes</p>
            <ul className="space-y-1.5 text-xs text-gray-600">
              <li>✓ Mesas ilimitadas</li>
              <li>✓ Todo lo del Básico</li>
              <li>✓ Domicilios con QR</li>
              <li>✓ Usuarios ilimitados</li>
              <li>✓ Estadísticas avanzadas</li>
            </ul>
          </button>
        </div>

        {/* Botón de pago */}
        <button
          onClick={() => pagar(planSeleccionado)}
          disabled={!!procesando}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-black py-4 rounded-2xl text-base transition-colors flex items-center justify-center gap-2">
          {procesando
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Preparando pago...</>
            : `💳 Pagar plan ${planSeleccionado === 'pro' ? 'Pro' : 'Básico'} con MercadoPago`
          }
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">o</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <a href={`https://wa.me/${WA_NUMBER}?text=${WA_MSG}`} target="_blank" rel="noopener noreferrer"
          className="block w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-4 rounded-2xl text-base transition-colors">
          💬 Pagar por transferencia (WhatsApp)
        </a>

        <p className="text-xs text-gray-400">
          ¿Ya pagaste y ves este mensaje? Escríbenos al WhatsApp y lo activamos en minutos.
        </p>

        <Link href="/" className="block text-sm text-gray-400 hover:text-gray-600">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
