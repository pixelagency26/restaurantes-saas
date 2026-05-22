'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

type Negocio = {
  id: string; nombre: string; plan: string
  suscripcion_activa: boolean; suscripcion_hasta: string | null
  mp_subscription_id: string | null; created_at: string
  gerente_email?: string; gerente_nombre?: string
}
type Admin = {
  id: string; email: string; nombre: string
  puede_suscripciones: boolean; puede_crear_admins: boolean
  creado_por: string; created_at: string
}
type Tab = 'negocios' | 'equipo'

function diasRestantes(hasta: string | null, activa: boolean) {
  if (activa && !hasta) return { texto: 'Activo permanente', color: 'text-green-600' }
  if (!hasta) return { texto: 'Sin suscripción', color: 'text-red-500' }
  const diff = Math.ceil((new Date(hasta).getTime() - Date.now()) / 86400000)
  if (diff < 0) return { texto: `Venció hace ${Math.abs(diff)}d`, color: 'text-red-500' }
  if (diff === 0) return { texto: 'Vence hoy', color: 'text-orange-500' }
  if (diff <= 3) return { texto: `Vence en ${diff}d`, color: 'text-orange-500' }
  return { texto: `${diff} días restantes`, color: 'text-green-600' }
}

const esActivo = (n: Negocio) =>
  n.suscripcion_activa || (!!n.suscripcion_hasta && new Date(n.suscripcion_hasta) > new Date())

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('negocios')
  const [puedeCrearAdmins, setPuedeCrearAdmins] = useState(false)

  // Negocios
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [cargandoNegocios, setCargandoNegocios] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  // Admins
  const [admins, setAdmins] = useState<Admin[]>([])
  const [cargandoAdmins, setCargandoAdmins] = useState(false)
  const [nuevoAdmin, setNuevoAdmin] = useState({ nombre: '', email: '', puede_crear_admins: false })
  const [creandoAdmin, setCreandoAdmin] = useState(false)
  const [mostrarFormAdmin, setMostrarFormAdmin] = useState(false)

  useEffect(() => {
    // Verificar acceso y permisos
    fetch('/api/admin/gestionar-admins').then(r => {
      if (r.status === 403) { router.push('/login'); return }
      r.json().then(d => {
        if (d.admins !== undefined) {
          // Si puede listar admins, puede crear admins también (lo verificamos en el form)
          setPuedeCrearAdmins(true)
        }
      })
    })
    cargarNegocios()
  }, [])

  async function cargarNegocios() {
    setCargandoNegocios(true)
    const res = await fetch('/api/admin/negocios')
    if (res.status === 403) { router.push('/login'); return }
    const data = await res.json()
    if (data.negocios) setNegocios(data.negocios)
    setCargandoNegocios(false)
  }

  async function cargarAdmins() {
    setCargandoAdmins(true)
    const res = await fetch('/api/admin/gestionar-admins')
    const data = await res.json()
    if (data.admins) setAdmins(data.admins)
    setCargandoAdmins(false)
  }

  useEffect(() => {
    if (tab === 'equipo') cargarAdmins()
  }, [tab])

  async function accion(negocio_id: string, tipo: string) {
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
    cargarNegocios()
  }

  async function crearAdmin(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevoAdmin.email || !nuevoAdmin.nombre) { toast.error('Completa todos los campos'); return }
    setCreandoAdmin(true)
    const res = await fetch('/api/admin/gestionar-admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...nuevoAdmin, puede_suscripciones: true }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error || 'Error'); setCreandoAdmin(false); return }
    toast.success('Admin creado')
    setNuevoAdmin({ nombre: '', email: '', puede_crear_admins: false })
    setMostrarFormAdmin(false)
    setCreandoAdmin(false)
    cargarAdmins()
  }

  async function eliminarAdmin(id: string) {
    if (!confirm('¿Eliminar este admin?')) return
    const res = await fetch('/api/admin/gestionar-admins', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) { toast.success('Admin eliminado'); cargarAdmins() }
    else toast.error('Error al eliminar')
  }

  const filtrados = negocios.filter(n =>
    n.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (n.gerente_email || '').toLowerCase().includes(busqueda.toLowerCase())
  )
  const activos = negocios.filter(esActivo).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center">
            <span className="text-lg">🍽️</span>
          </div>
          <div>
            <p className="font-black text-gray-900">Restaurant Pix</p>
            <p className="text-xs text-gray-400">Panel de administración</p>
          </div>
        </div>
        <button onClick={() => { supabase.auth.signOut(); router.push('/login') }}
          className="text-sm text-gray-400 hover:text-gray-600">
          Cerrar sesión
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Stats rápidas */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total restaurantes', value: negocios.length, bg: 'bg-gray-900 text-white' },
            { label: 'Activos', value: activos, bg: 'bg-green-500 text-white' },
            { label: 'Inactivos', value: negocios.length - activos, bg: 'bg-red-500 text-white' },
          ].map((s, i) => (
            <div key={i} className={`${s.bg} rounded-2xl p-5 text-center`}>
              <p className="text-3xl font-black">{s.value}</p>
              <p className="text-sm opacity-80 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          {([['negocios', '🏪 Restaurantes'], ['equipo', '👥 Equipo admin']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors ${tab === t ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── TAB: NEGOCIOS ── */}
        {tab === 'negocios' && (
          <div className="space-y-4">
            <input placeholder="Buscar por nombre o correo..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />

            {cargandoNegocios ? (
              <div className="text-center py-16 text-gray-400">Cargando...</div>
            ) : (
              <div className="space-y-3">
                {filtrados.map(neg => {
                  const { texto, color } = diasRestantes(neg.suscripcion_hasta, neg.suscripcion_activa)
                  const activo = esActivo(neg)
                  return (
                    <div key={neg.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${activo ? 'bg-green-500' : 'bg-red-400'}`} />
                            <p className="font-black text-gray-900">{neg.nombre}</p>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${neg.plan === 'pro' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                              {neg.plan === 'pro' ? 'Pro' : 'Básico'}
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
                        <div className="flex flex-wrap gap-2">
                          {!activo ? (
                            <button onClick={() => accion(neg.id, 'activar')} disabled={!!procesando}
                              className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50">
                              ✓ Activar 30d
                            </button>
                          ) : (
                            <button onClick={() => accion(neg.id, 'desactivar')} disabled={!!procesando}
                              className="bg-red-100 hover:bg-red-200 text-red-600 text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50">
                              ✕ Desactivar
                            </button>
                          )}
                          <button onClick={() => accion(neg.id, 'extender30')} disabled={!!procesando}
                            className="bg-orange-100 hover:bg-orange-200 text-orange-600 text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50">
                            +30 días
                          </button>
                          <button onClick={() => accion(neg.id, 'extender365')} disabled={!!procesando}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50">
                            +1 año
                          </button>
                          {neg.plan !== 'pro' ? (
                            <button onClick={() => accion(neg.id, 'pro')} disabled={!!procesando}
                              className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50">
                              → Pro
                            </button>
                          ) : (
                            <button onClick={() => accion(neg.id, 'basico')} disabled={!!procesando}
                              className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50">
                              → Básico
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {filtrados.length === 0 && <div className="text-center py-12 text-gray-400">No hay resultados</div>}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: EQUIPO ADMIN ── */}
        {tab === 'equipo' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Los admins pueden gestionar suscripciones. Solo tú puedes crear admins con permiso de crear más admins.
              </p>
              {puedeCrearAdmins && (
                <button onClick={() => setMostrarFormAdmin(v => !v)}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors shrink-0">
                  + Nuevo admin
                </button>
              )}
            </div>

            {/* Formulario nuevo admin */}
            {mostrarFormAdmin && (
              <form onSubmit={crearAdmin} className="bg-white rounded-2xl border border-orange-200 p-6 space-y-4">
                <p className="font-black text-gray-900">Crear nuevo admin</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Nombre completo *</label>
                    <input required value={nuevoAdmin.nombre} onChange={e => setNuevoAdmin(p => ({ ...p, nombre: e.target.value }))}
                      placeholder="Ej: María González"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Correo electrónico *</label>
                    <input required type="email" value={nuevoAdmin.email} onChange={e => setNuevoAdmin(p => ({ ...p, email: e.target.value }))}
                      placeholder="correo@ejemplo.com"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={nuevoAdmin.puede_crear_admins}
                    onChange={e => setNuevoAdmin(p => ({ ...p, puede_crear_admins: e.target.checked }))}
                    className="w-4 h-4 accent-orange-500" />
                  <span className="text-sm text-gray-700">Puede crear y eliminar otros admins</span>
                </label>
                <div className="flex gap-3">
                  <button type="submit" disabled={creandoAdmin}
                    className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
                    {creandoAdmin ? 'Creando...' : 'Crear admin'}
                  </button>
                  <button type="button" onClick={() => setMostrarFormAdmin(false)}
                    className="text-gray-400 hover:text-gray-600 text-sm px-4 py-3">
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* Lista de admins */}
            {cargandoAdmins ? (
              <div className="text-center py-12 text-gray-400">Cargando...</div>
            ) : (
              <div className="space-y-3">
                {admins.map(adm => (
                  <div key={adm.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-gray-900">{adm.nombre}</p>
                      <p className="text-sm text-gray-400">{adm.email}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-green-100 text-green-600 font-bold px-2 py-0.5 rounded-full">Suscripciones</span>
                        {adm.puede_crear_admins && (
                          <span className="text-xs bg-orange-100 text-orange-600 font-bold px-2 py-0.5 rounded-full">Crear admins</span>
                        )}
                      </div>
                      {adm.creado_por && <p className="text-xs text-gray-300 mt-1">Creado por {adm.creado_por}</p>}
                    </div>
                    {puedeCrearAdmins && (
                      <button onClick={() => eliminarAdmin(adm.id)}
                        className="text-red-400 hover:text-red-600 text-sm font-bold px-3 py-2 rounded-xl hover:bg-red-50 transition-colors shrink-0">
                        Eliminar
                      </button>
                    )}
                  </div>
                ))}
                {admins.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-2xl mb-2">👥</p>
                    <p>No hay admins adicionales aún</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
