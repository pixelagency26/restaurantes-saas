'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

type Negocio = {
  id: string
  nombre: string
  plan: string
  suscripcion_activa: boolean
  suscripcion_hasta: string | null
  mp_subscription_id: string | null
  created_at: string
  gerente_email?: string
  gerente_nombre?: string
}

const PLAN_LABELS: Record<string, string> = { basico: 'Básico', pro: 'Pro' }

function diasRestantes(hasta: string | null, activa: boolean): { texto: string; color: string } {
  if (activa && !hasta) return { texto: 'Activo permanente', color: 'text-green-600' }
  if (!hasta) return { texto: 'Sin suscripción', color: 'text-red-500' }
  const diff = Math.ceil((new Date(hasta).getTime() - Date.now()) / 86400000)
  if (diff < 0) return { texto: `Venció hace ${Math.abs(diff)}d`, color: 'text-red-500' }
  if (diff === 0) return { texto: 'Vence hoy', color: 'text-orange-500' }
  if (diff <= 3) return { texto: `Vence en ${diff}d`, color: 'text-orange-500' }
  return { texto: `${diff} días restantes`, color: 'text-green-600' }
}

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || data.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push('/login')
      }
    })
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    const res = await fetch('/api/admin/negocios')
    const data = await res.json()
    if (data.negocios) setNegocios(data.negocios)
    setCargando(false)
  }

  async function accion(negocio_id: string, tipo: 'activar' | 'desactivar' | 'pro' | 'basico' | 'extender30' | 'extender365') {
    setProcesando(negocio_id + tipo)
    const res = await fetch('/api/admin/actualizar-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocio_id, tipo }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error || 'Error'); setProcesando(null); return }
    toast.success('Actualizado')
    setProcesando(null)
    cargar()
  }

  const filtrados = negocios.filter(n =>
    n.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (n.gerente_email || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  const activos   = negocios.filter(n => {
    const hasta = n.suscripcion_hasta ? new Date(n.suscripcion_hasta) : null
    return n.suscripcion_activa || (hasta && hasta > new Date())
  }).length
  const inactivos = negocios.length - activos

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center">
            <span className="text-lg">🍽️</span>
          </div>
          <div>
            <p className="font-black text-gray-900 text-lg">Restaurant Pix</p>
            <p className="text-xs text-gray-400">Panel de administración</p>
          </div>
        </div>
        <button onClick={() => { supabase.auth.signOut(); router.push('/login') }}
          className="text-sm text-gray-400 hover:text-gray-600">
          Cerrar sesión
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total restaurantes', value: negocios.length, color: 'bg-gray-900 text-white' },
            { label: 'Suscripciones activas', value: activos, color: 'bg-green-500 text-white' },
            { label: 'Inactivos / vencidos', value: inactivos, color: 'bg-red-500 text-white' },
          ].map((s, i) => (
            <div key={i} className={`${s.color} rounded-2xl p-5 text-center`}>
              <p className="text-3xl font-black">{s.value}</p>
              <p className="text-sm opacity-80 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Buscador */}
        <input
          placeholder="Buscar por nombre o correo..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
        />

        {/* Tabla */}
        {cargando ? (
          <div className="text-center py-16 text-gray-400">Cargando...</div>
        ) : (
          <div className="space-y-3">
            {filtrados.map(neg => {
              const { texto, color } = diasRestantes(neg.suscripcion_hasta, neg.suscripcion_activa)
              const isActivo = neg.suscripcion_activa || (neg.suscripcion_hasta && new Date(neg.suscripcion_hasta) > new Date())
              return (
                <div key={neg.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${isActivo ? 'bg-green-500' : 'bg-red-400'}`} />
                        <p className="font-black text-gray-900">{neg.nombre}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${neg.plan === 'pro' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                          {PLAN_LABELS[neg.plan] || neg.plan}
                        </span>
                        {neg.mp_subscription_id && (
                          <span className="text-xs bg-blue-100 text-blue-600 font-bold px-2 py-0.5 rounded-full">MP Auto</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{neg.gerente_email || '—'}</p>
                      <p className={`text-xs font-semibold mt-1 ${color}`}>{texto}</p>
                      {neg.suscripcion_hasta && (
                        <p className="text-xs text-gray-300 mt-0.5">
                          Hasta: {new Date(neg.suscripcion_hasta).toLocaleDateString('es-CO')}
                        </p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex flex-wrap gap-2">
                      {!isActivo ? (
                        <button onClick={() => accion(neg.id, 'activar')}
                          disabled={!!procesando}
                          className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors disabled:opacity-50">
                          ✓ Activar 30d
                        </button>
                      ) : (
                        <button onClick={() => accion(neg.id, 'desactivar')}
                          disabled={!!procesando}
                          className="bg-red-100 hover:bg-red-200 text-red-600 text-xs font-bold px-3 py-2 rounded-xl transition-colors disabled:opacity-50">
                          ✕ Desactivar
                        </button>
                      )}
                      <button onClick={() => accion(neg.id, 'extender30')}
                        disabled={!!procesando}
                        className="bg-orange-100 hover:bg-orange-200 text-orange-600 text-xs font-bold px-3 py-2 rounded-xl transition-colors disabled:opacity-50">
                        +30 días
                      </button>
                      <button onClick={() => accion(neg.id, 'extender365')}
                        disabled={!!procesando}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold px-3 py-2 rounded-xl transition-colors disabled:opacity-50">
                        +1 año
                      </button>
                      {neg.plan !== 'pro' ? (
                        <button onClick={() => accion(neg.id, 'pro')}
                          disabled={!!procesando}
                          className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors disabled:opacity-50">
                          → Pro
                        </button>
                      ) : (
                        <button onClick={() => accion(neg.id, 'basico')}
                          disabled={!!procesando}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold px-3 py-2 rounded-xl transition-colors disabled:opacity-50">
                          → Básico
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {filtrados.length === 0 && (
              <div className="text-center py-12 text-gray-400">No hay resultados</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
