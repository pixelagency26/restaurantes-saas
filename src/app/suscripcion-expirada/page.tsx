'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

const WA_NUMBER = '573137335448'
const WA_MSG = encodeURIComponent('Hola, quiero renovar mi suscripción de Restaurant sas')

type Plan = 'basico' | 'pro'

export default function SuscripcionExpiradaPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [procesando, setProcesando] = useState<Plan | null>(null)
  const [planSeleccionado, setPlanSeleccionado] = useState<Plan>('basico')
  const [autenticado, setAutenticado] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAutenticado(!!data.user))
  }, [supabase])

  async function pagar(plan: Plan) {
    if (autenticado === false) {
      toast.error('Inicia sesión para renovar tu suscripción')
      router.push('/login')
      return
    }

    setProcesando(plan)
    try {
      const res = await fetch('/api/mp/iniciar-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, tipo: 'renovar' }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          toast.error('Tu sesión venció. Inicia sesión para renovar.')
          router.push('/login')
          return
        }

        toast.error(data.error || 'Error al procesar el pago')
        setProcesando(null)
        return
      }

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
            Los 14 días de prueba gratuita han finalizado. Elige un plan para continuar usando Restaurant sas.
          </p>
        </div>

        {autenticado === false && (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-left">
            <p className="font-bold text-gray-900">Tu sesión no está activa</p>
            <p className="text-sm text-gray-600 mt-1">
              Para renovar tu suscripción, primero inicia sesión con la cuenta del negocio.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="mt-3 w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-xl text-sm transition-colors">
              Iniciar sesión
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-left">
          <button
            onClick={() => setPlanSeleccionado('basico')}
            className={`rounded-2xl border-2 p-5 text-left transition-all ${planSeleccionado === 'basico' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Básico</p>
            <p className="text-2xl font-black text-gray-900">$89.900</p>
            <p className="text-xs text-gray-400 mb-3">COP/mes</p>
            <ul className="space-y-1.5 text-xs text-gray-600">
              <li>Hasta 15 mesas</li>
              <li>Meseras + Cocina + Caja</li>
              <li>QR en mesa</li>
              <li>2 usuarios</li>
            </ul>
          </button>

          <button
            onClick={() => setPlanSeleccionado('pro')}
            className={`rounded-2xl border-2 p-5 text-left transition-all relative ${planSeleccionado === 'pro' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-black px-3 py-0.5 rounded-full">POPULAR</span>
            <p className="text-xs font-black text-orange-500 uppercase tracking-widest mb-1">Pro</p>
            <p className="text-2xl font-black text-gray-900">$149.900</p>
            <p className="text-xs text-gray-400 mb-3">COP/mes</p>
            <ul className="space-y-1.5 text-xs text-gray-600">
              <li>Mesas ilimitadas</li>
              <li>Todo lo del Básico</li>
              <li>Domicilios con QR</li>
              <li>Usuarios ilimitados</li>
              <li>Estadísticas avanzadas</li>
            </ul>
          </button>
        </div>

        <button
          onClick={() => pagar(planSeleccionado)}
          disabled={!!procesando || autenticado === false || autenticado === null}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-black py-4 rounded-2xl text-base transition-colors flex items-center justify-center gap-2">
          {procesando
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Preparando pago...</>
            : autenticado === null
              ? 'Verificando sesión...'
              : `Pagar plan ${planSeleccionado === 'pro' ? 'Pro' : 'Básico'} con MercadoPago`
          }
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">o</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <a
          href={`https://wa.me/${WA_NUMBER}?text=${WA_MSG}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-4 rounded-2xl text-base transition-colors">
          Pagar por transferencia (WhatsApp)
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
