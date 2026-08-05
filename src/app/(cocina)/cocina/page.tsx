'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Pedido, ItemPedido } from '@/types'
import toast from 'react-hot-toast'
import {
  Clock, ChefHat, CheckCircle, AlertTriangle, UtensilsCrossed,
  Lock, Flame, Zap, User, LogOut, X, Bike, Navigation,
} from 'lucide-react'

const MINUTOS_LIMITE = 20
const LS_KEY = 'cocina_mi_nombre'
function tiempoTranscurrido(fecha: string, ahora: number) {
  return Math.floor((ahora - new Date(fecha).getTime()) / 1000 / 60)
}
function segundosTranscurridos(fecha: string, ahora: number) {
  return Math.floor((ahora - new Date(fecha).getTime()) / 1000)
}

// ── Badge de tiempo ────────────────────────────────────────────────────────────
function BadgeTiempo({ minutos }: { minutos: number }) {
  if (minutos >= MINUTOS_LIMITE) return (
    <span className="flex items-center gap-1 bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-black px-2.5 py-1 rounded-full animate-pulse">
      <AlertTriangle size={11} /> {minutos} min — DEMORADO
    </span>
  )
  if (minutos >= Math.round(MINUTOS_LIMITE * 0.75)) return (
    <span className="flex items-center gap-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold px-2.5 py-1 rounded-full">
      <Clock size={11} /> {minutos} min
    </span>
  )
  return (
    <span className="flex items-center gap-1 bg-green-500/20 border border-green-500/40 text-green-400 text-xs px-2.5 py-1 rounded-full">
      <Clock size={11} /> {minutos} min
    </span>
  )
}

// ── Barra de progreso ──────────────────────────────────────────────────────────
function BarraProgreso({ fecha, ahora }: { fecha: string; ahora: number }) {
  const totalSegs  = MINUTOS_LIMITE * 60
  const segsTransc = Math.min(segundosTranscurridos(fecha, ahora), totalSegs * 1.5)
  const pct        = Math.min((segsTransc / totalSegs) * 100, 100)
  const minutos    = Math.floor(segsTransc / 60)
  const segundos   = segsTransc % 60
  const pasado     = segsTransc >= totalSegs

  const gradiente = pct < 50
    ? 'from-green-500 to-green-400'
    : pct < 75
    ? 'from-amber-500 to-yellow-400'
    : 'from-red-600 to-red-500'

  const colorTexto = pct < 50 ? 'text-green-400' : pct < 75 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="mt-3 mb-2">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Tiempo</span>
        <span className={`text-xs font-black tabular-nums ${colorTexto} ${pasado ? 'animate-pulse' : ''}`}>
          {minutos}:{String(segundos).padStart(2, '0')} / {MINUTOS_LIMITE}:00
        </span>
      </div>
      <div className="w-full h-2.5 bg-gray-700/50 rounded-full overflow-hidden border border-gray-700">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradiente} transition-all duration-1000 ${pasado ? 'animate-pulse' : ''}`}
          style={{ width: `${pct}%`, boxShadow: pct >= 75 ? '0 0 8px rgba(239,68,68,0.6)' : pct >= 50 ? '0 0 6px rgba(245,158,11,0.4)' : '0 0 4px rgba(34,197,94,0.3)' }}
        />
      </div>
      {pasado && (
        <p className="text-red-400 text-[10px] font-bold mt-1 flex items-center gap-1">
          <AlertTriangle size={10} /> Superó el límite de {MINUTOS_LIMITE} min
        </p>
      )}
    </div>
  )
}

interface ItemPlatoExtended extends Omit<ItemPedido, 'plato' | 'modificadores'> {
  plato: { nombre: string }
  cocinero?: string | null
  pedido_por_usuario?: { nombre: string } | null
  opcion_nombre?: string | null
  acompanantes?: string[] | null
  modificadores?: {
    nombre_grupo: string
    nombre_opcion: string
    descuenta_inventario: boolean
  }[] | null
}

// ── Pantalla de selección de cocinero (login) ──────────────────────────────────
function SelectorCocinero({
  nombres,
  onSeleccionar,
}: {
  nombres: string[]
  onSeleccionar: (nombre: string) => void
}) {
  const [nombreManual, setNombreManual] = useState('')
  const [modoManual, setModoManual]     = useState(false)

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-orange-500/10 border border-orange-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <ChefHat size={40} className="text-orange-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-1">¿Quién eres?</h1>
          <p className="text-gray-500 text-sm">Selecciona tu nombre para comenzar</p>
        </div>

        {nombres.length > 0 && !modoManual ? (
          <div className="space-y-2 mb-4">
            {nombres.map(nombre => (
              <button
                key={nombre}
                onClick={() => onSeleccionar(nombre)}
                className="w-full bg-gray-800/60 hover:bg-orange-500/10 active:scale-95 border border-gray-700 hover:border-orange-500/40 rounded-2xl px-5 py-4 text-left transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center group-hover:bg-orange-500/20 transition-all">
                    <User size={18} className="text-orange-400" />
                  </div>
                  <span className="text-white font-bold">{nombre}</span>
                </div>
              </button>
            ))}
            <button
              onClick={() => setModoManual(true)}
              className="w-full text-center text-xs text-gray-600 hover:text-gray-400 py-2 transition-colors">
              Escribir nombre manualmente
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={nombreManual}
              onChange={e => setNombreManual(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && nombreManual.trim()) onSeleccionar(nombreManual.trim()) }}
              placeholder="Tu nombre..."
              autoFocus
              className="w-full bg-gray-800/60 border border-gray-700 focus:border-orange-500/50 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none text-sm"
            />
            <button
              onClick={() => { if (nombreManual.trim()) onSeleccionar(nombreManual.trim()) }}
              disabled={!nombreManual.trim()}
              className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-all">
              Entrar a cocina
            </button>
            {nombres.length > 0 && (
              <button onClick={() => setModoManual(false)} className="w-full text-center text-xs text-gray-600 hover:text-gray-400 py-1 transition-colors">
                ← Volver a la lista
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal selector de cocinero al preparar un ítem ────────────────────────────
function ModalAsignarCocinero({
  nombres,
  miNombre,
  onAsignar,
  onCerrar,
}: {
  nombres: string[]
  miNombre: string
  onAsignar: (nombre: string) => void
  onCerrar: () => void
}) {
  // Construir lista: miNombre primero, luego el resto sin duplicados
  const lista = [miNombre, ...nombres.filter(n => n !== miNombre)]
  const [nombreManual, setNombreManual] = useState('')
  const [modoManual, setModoManual]     = useState(false)

  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex items-end justify-center"
      onClick={onCerrar}
    >
      <div
        className="bg-gray-900 w-full max-w-lg rounded-t-3xl p-5 border-t border-gray-700 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-black text-base">¿Quién prepara este plato?</h2>
            <p className="text-gray-500 text-xs mt-0.5">Selecciona al cocinero asignado</p>
          </div>
          <button
            onClick={onCerrar}
            className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors">
            <X size={14} className="text-gray-400" />
          </button>
        </div>

        {!modoManual ? (
          <div className="space-y-2">
            {lista.map((nombre, idx) => (
              <button
                key={nombre}
                onClick={() => onAsignar(nombre)}
                className={`w-full rounded-xl flex items-center gap-3 px-4 py-3.5 font-bold transition-all active:scale-95 ${
                  idx === 0
                    ? 'bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300'
                    : 'bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700 text-white'
                }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  idx === 0 ? 'bg-orange-500/20' : 'bg-gray-700/60'
                }`}>
                  <ChefHat size={16} className={idx === 0 ? 'text-orange-400' : 'text-gray-400'} />
                </div>
                <span>{nombre}</span>
                {idx === 0 && (
                  <span className="ml-auto text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-bold">
                    Tú
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => setModoManual(true)}
              className="w-full text-center text-xs text-gray-600 hover:text-gray-400 py-2 transition-colors">
              Otro nombre...
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={nombreManual}
              onChange={e => setNombreManual(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && nombreManual.trim()) onAsignar(nombreManual.trim()) }}
              placeholder="Nombre del cocinero..."
              autoFocus
              className="w-full bg-gray-800/60 border border-gray-700 focus:border-orange-500/50 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setModoManual(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 font-bold py-3 rounded-xl text-sm transition-all">
                ← Volver
              </button>
              <button
                onClick={() => { if (nombreManual.trim()) onAsignar(nombreManual.trim()) }}
                disabled={!nombreManual.trim()}
                className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm transition-all">
                Asignar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CocinaPage() {
  const [pedidos, setPedidos]               = useState<Pedido[]>([])
  const [cargando, setCargando]             = useState(true)
  const [ahora, setAhora]                   = useState(Date.now())
  const [bloqueoConfig, setBloqueoConfig]   = useState<{ activo: boolean; cantidad: number }>({ activo: false, cantidad: 3 })
  const [miNombre, setMiNombre]             = useState<string>('Cocina')
  const [nombresConfig, setNombresConfig]   = useState<string[]>([])
  const [nombresCargados, setNombresCargados] = useState(false)
  const [complEstados, setComplEstados]     = useState<Record<string, 'pendiente' | 'en_preparacion' | 'listo'>>({})

  function marcarComplemento(key: string, estado: 'en_preparacion' | 'listo') {
    setComplEstados(prev => ({ ...prev, [key]: estado }))
  }

  const supabase = createClient()

  const cargarConfig = useCallback(async () => {
    const { data } = await supabase.from('configuracion').select('clave, valor')
      .in('clave', ['bloqueo_cocina_activo', 'bloqueo_cocina_cantidad', 'nombres_cocineros'])
    if (data) {
      const cfg: Record<string, string> = {}
      data.forEach((r: { clave: string; valor: string }) => { cfg[r.clave] = r.valor })
      setBloqueoConfig({
        activo:   cfg['bloqueo_cocina_activo'] === 'true',
        cantidad: parseInt(cfg['bloqueo_cocina_cantidad'] || '3') || 3,
      })
      try {
        const nombres = cfg['nombres_cocineros'] ? JSON.parse(cfg['nombres_cocineros']) as string[] : []
        setNombresConfig(nombres)
      } catch { setNombresConfig([]) }
    }
    setNombresCargados(true)
  }, [supabase])

  // Cargar nombre del usuario autenticado al montar
  useEffect(() => {
    const guardado = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null
    if (guardado) { setMiNombre(guardado); return }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('usuarios').select('nombre').eq('id', user.id).single()
        .then(({ data }) => {
          const nombre = data?.nombre || 'Cocina'
          setMiNombre(nombre)
          if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, nombre)
        })
    })
  }, [supabase])

  const salirDeNombre = async () => {
    if (typeof window !== 'undefined') localStorage.removeItem(LS_KEY)
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const cargarPedidos = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos')
      .select(`*, mesa:mesas(numero), mesera:usuarios!mesera_id(nombre), items:items_pedido(*, plato:platos(nombre), pedido_por_usuario:usuarios!pedido_por(nombre), modificadores:items_pedido_modificadores(nombre_grupo, nombre_opcion, descuenta_inventario))`)
      .in('estado', ['pendiente', 'en_preparacion'])
      .order('created_at', { ascending: true })
    if (data) {
      const visibles = (data as unknown as Pedido[]).filter(p =>
        p.tipo !== 'domi' || p.pago_domi_aprobado === true
      )
      setPedidos(visibles)
    }
    setCargando(false)
  }, [supabase])

  useEffect(() => {
    cargarPedidos(); cargarConfig()
    const canal = supabase.channel('cocina-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, cargarPedidos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items_pedido' }, cargarPedidos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items_pedido_modificadores' }, cargarPedidos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion' }, cargarConfig)
      .subscribe()
    const intervalo = setInterval(cargarPedidos, 15000)
    const tick      = setInterval(() => setAhora(Date.now()), 1000)
    return () => { supabase.removeChannel(canal); clearInterval(intervalo); clearInterval(tick) }
  }, [cargarPedidos, cargarConfig, supabase])

  // ── Preparar ítem — asignar directamente con nombre del usuario autenticado ──
  async function marcarPreparando(itemId: string, pedidoId: string, cocineroNombre: string) {
    await supabase.from('items_pedido').update({
      estado: 'en_preparacion',
      tiempo_inicio_prep: new Date().toISOString(),
      cocinero: cocineroNombre,
    }).eq('id', itemId)
    await supabase.from('pedidos').update({ estado: 'en_preparacion' }).eq('id', pedidoId).eq('estado', 'pendiente')
    toast.success(`🔥 ${cocineroNombre} está preparando`)
    cargarPedidos()
  }

  // ── Marcar listo — con routing según tipo de pedido ───────────────────────
  async function marcarListo(itemId: string, pedidoId: string) {
    await supabase.from('items_pedido').update({
      estado: 'listo',
      tiempo_listo: new Date().toISOString(),
    }).eq('id', itemId)

    const { data: items } = await supabase
      .from('items_pedido').select('estado').eq('pedido_id', pedidoId)

    const todosListos = items?.every(i => i.estado === 'listo' || i.estado === 'entregado')

    if (todosListos) {
      // Obtener tipo y mesera para el mensaje de routing
      const { data: ped } = await supabase
        .from('pedidos')
        .select('tipo, mesera_id, cliente_nombre, mesa:mesas(numero)')
        .eq('id', pedidoId)
        .maybeSingle()

      await supabase.from('pedidos').update({ estado: 'listo' }).eq('id', pedidoId)

      if (!ped) {
        toast.success('✅ ¡Pedido completo!')
      } else if (ped.tipo === 'domi') {
        toast.success('✅ ¡Listo! Domi y Gerencia fueron notificados 🛵', { duration: 4000 })
      } else if (ped.tipo === 'cliente_qr') {
        const mesa = (ped.mesa as unknown as { numero: number } | null)
        toast.success(`✅ ¡Listo! La mesera recoge en mesa ${mesa?.numero ?? '?'} 📢`, { duration: 4000 })
      } else {
        // Pedido creado por mesera — solo ella recibe notificación
        toast.success('✅ ¡Listo! La mesera fue notificada 📢', { duration: 4000 })
      }
    } else {
      toast.success('✅ Plato listo')
    }
    cargarPedidos()
  }

  // ── Preparar: asignar directamente sin modal ──────────────────────────────
  function abrirSelector(itemId: string, pedidoId: string) {
    marcarPreparando(itemId, pedidoId, miNombre)
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (cargando || !nombresCargados) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto">
          <ChefHat size={40} className="text-orange-400 animate-pulse" />
        </div>
        <p className="text-gray-400 text-sm">Cargando pedidos…</p>
      </div>
    </div>
  )

  const pedidosMostrados  = bloqueoConfig.activo ? pedidos.slice(0, bloqueoConfig.cantidad) : pedidos
  const pedidosBloqueados = bloqueoConfig.activo ? Math.max(0, pedidos.length - bloqueoConfig.cantidad) : 0
  const demorados         = pedidosMostrados.filter(p => {
    const items  = (p.items as unknown as ItemPlatoExtended[]) ?? []
    const fechas = items.map(i => new Date(i.created_at).getTime())
    const ref    = fechas.length > 0 ? new Date(Math.max(...fechas)).toISOString() : p.created_at
    return tiempoTranscurrido(ref, ahora) >= MINUTOS_LIMITE
  }).length

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── HEADER ─────────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-md border-b border-gray-800">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <ChefHat size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white tracking-tight">Panel de Cocina</h1>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <p className="text-gray-400 text-xs">En tiempo real</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Chip de cocinero activo */}
              <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-1.5">
                <User size={12} className="text-orange-400" />
                <span className="text-orange-300 font-bold text-xs">{miNombre}</span>
                <button onClick={salirDeNombre} title="Cerrar sesión" className="ml-1 text-gray-600 hover:text-red-400 transition-colors">
                  <LogOut size={11} />
                </button>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Límite</p>
                <p className="text-red-400 font-black text-lg">{MINUTOS_LIMITE} min</p>
              </div>
            </div>
          </div>

          {/* Stats chips */}
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700 rounded-xl px-3 py-2 shrink-0">
              <div className="w-2 h-2 bg-blue-400 rounded-full" />
              <span className="text-xs font-bold text-gray-300">{pedidosMostrados.length} activos</span>
            </div>
            {demorados > 0 && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 shrink-0 animate-pulse">
                <AlertTriangle size={12} className="text-red-400" />
                <span className="text-xs font-bold text-red-400">{demorados} demorado{demorados > 1 ? 's' : ''}</span>
              </div>
            )}
            {bloqueoConfig.activo && (
              <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2 shrink-0">
                <Lock size={12} className="text-orange-400" />
                <span className="text-xs font-bold text-orange-400">Modo bloqueo</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Banner bloqueados */}
        {pedidosBloqueados > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl px-4 py-3.5 flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center shrink-0">
              <Lock size={16} className="text-orange-400" />
            </div>
            <p className="text-orange-300 text-sm leading-snug">
              <span className="font-black">{pedidosBloqueados} pedido{pedidosBloqueados !== 1 ? 's' : ''}</span> en espera —
              termina los actuales para que aparezcan
            </p>
          </div>
        )}

        {/* Estado vacío */}
        {pedidos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-800/60 border border-gray-700 rounded-3xl flex items-center justify-center mb-4">
              <UtensilsCrossed size={36} className="text-gray-600" />
            </div>
            <p className="text-gray-300 font-bold text-lg mb-1">Todo listo</p>
            <p className="text-gray-600 text-sm">Los nuevos pedidos aparecerán aquí en tiempo real</p>
          </div>
        )}

        {/* ── CARDS DE PEDIDOS ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pedidosMostrados.map(pedido => {
            const itemsPedido = (pedido.items as unknown as ItemPlatoExtended[]) ?? []
            const fechas      = itemsPedido.map(i => new Date(i.created_at).getTime())
            const fechaRef    = fechas.length > 0
              ? new Date(Math.max(...fechas)).toISOString()
              : pedido.created_at
            const minutos     = tiempoTranscurrido(fechaRef, ahora)
            const esDemorado  = minutos >= MINUTOS_LIMITE
            const mesa        = (pedido.mesa as unknown as { numero: number } | null)
            const UMBRAL_ADICIONAL_MS = 2 * 60 * 1000

            // Quién tomó el pedido: primero mesera_id del pedido, luego pedido_por de ítems como fallback
            const pedidoMesera = (pedido as unknown as { mesera?: { nombre: string } | null }).mesera
            const tomadoPor = pedidoMesera?.nombre
              || itemsPedido.find(i => i.pedido_por_usuario)?.pedido_por_usuario?.nombre
              || null

            return (
              <div key={pedido.id}
                className={`rounded-2xl border overflow-hidden transition-all ${
                  esDemorado
                    ? 'border-red-500/50 bg-gradient-to-b from-red-950/80 to-gray-900'
                    : 'border-gray-700/60 bg-gradient-to-b from-gray-800/80 to-gray-900'
                }`}
                style={esDemorado
                  ? { boxShadow: '0 0 20px rgba(239,68,68,0.15), inset 0 1px 0 rgba(239,68,68,0.1)' }
                  : { boxShadow: '0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.04)' }
                }>

                {/* Card header */}
                <div className={`px-4 pt-3.5 pb-3 border-b ${esDemorado ? 'border-red-500/20' : 'border-gray-700/40'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {pedido.tipo === 'domi' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center justify-center">
                            <Bike size={16} className="text-blue-400" />
                          </div>
                          <div>
                            <span className="text-blue-400 font-black text-lg">DOMI</span>
                            {pedido.cliente_nombre && (
                              <p className="text-[10px] text-gray-500 leading-none truncate max-w-[120px]">
                                {pedido.cliente_nombre}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : pedido.tipo === 'cliente_qr' ? (
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${esDemorado ? 'bg-red-500/20 border border-red-500/30 text-red-400' : 'bg-orange-500/20 border border-orange-500/30 text-orange-400'}`}>
                            {mesa?.numero ?? '?'}
                          </div>
                          <div>
                            <span className={`font-black text-lg ${esDemorado ? 'text-red-400' : 'text-orange-400'}`}>
                              Mesa {mesa?.numero}
                            </span>
                            <p className="text-[10px] text-gray-500 leading-none">
                              📱 Pedido QR — entrega mesera
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${esDemorado ? 'bg-red-500/20 border border-red-500/30 text-red-400' : 'bg-orange-500/20 border border-orange-500/30 text-orange-400'}`}>
                            {mesa?.numero ?? '?'}
                          </div>
                          <div>
                            <span className={`font-black text-lg ${esDemorado ? 'text-red-400' : 'text-orange-400'}`}>
                              Mesa {mesa?.numero}
                            </span>
                            <p className="text-[10px] text-gray-500 leading-none">
                              {tomadoPor ? `👩 ${tomadoPor}` : '👩 Mesera'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <BadgeTiempo minutos={minutos} />
                  </div>

                  {/* Badge de destino */}
                  <div className="mt-2 flex items-center gap-1.5">
                    {pedido.tipo === 'domi' ? (
                      <span className="flex items-center gap-1 text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-semibold">
                        <Navigation size={9} /> Listo → Domi + Gerencia
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] bg-orange-500/10 border border-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-semibold">
                        🍽️ Listo → {tomadoPor ? `Mesera (${tomadoPor})` : 'Mesera disponible'}
                      </span>
                    )}
                  </div>

                  <BarraProgreso fecha={fechaRef} ahora={ahora} />
                </div>

                {/* Notas del pedido */}
                {pedido.notas && (
                  <div className="mx-3 mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                    <p className="text-amber-300 text-xs">📝 {pedido.notas}</p>
                  </div>
                )}

                {/* Items */}
                <div className="p-3 space-y-2">
                  {itemsPedido.flatMap(item => {
                    const esAdicional      = (new Date(item.created_at).getTime() - new Date(pedido.created_at).getTime()) > UMBRAL_ADICIONAL_MS
                    const bloqueadoPorOtro = item.cocinero && item.cocinero !== miNombre && item.estado === 'en_preparacion'
                    const esMio            = item.cocinero === miNombre

                    const filaItem = (
                      <div key={item.id}
                        className={`rounded-xl border p-3 transition-all ${
                          item.estado === 'listo'
                            ? 'bg-green-950/40 border-green-500/25'
                            : bloqueadoPorOtro
                            ? 'bg-gray-900/60 border-gray-700/40 opacity-70'
                            : item.estado === 'en_preparacion'
                            ? 'bg-blue-950/40 border-blue-500/25'
                            : esAdicional
                            ? 'bg-purple-950/40 border-purple-500/25'
                            : 'bg-gray-800/40 border-gray-700/40'
                        }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              <p className="font-bold text-sm text-white">
                                {item.cantidad}× {item.plato?.nombre}
                              </p>
                              {item.opcion_nombre && (
                                <span className="text-[10px] bg-orange-500/15 border border-orange-500/25 text-orange-300 px-1.5 py-0.5 rounded-full font-bold">
                                  {item.opcion_nombre}
                                </span>
                              )}
                              {esAdicional && item.estado !== 'listo' && (
                                <span className="text-[10px] bg-purple-500/20 border border-purple-500/30 text-purple-400 px-1.5 py-0.5 rounded-full font-bold">
                                  ➕ Adicional
                                </span>
                              )}
                            </div>
                            {item.modificadores && item.modificadores.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {Object.entries(
                                  item.modificadores.reduce<Record<string, string[]>>((acc, mod) => {
                                    acc[mod.nombre_grupo] = [...(acc[mod.nombre_grupo] || []), mod.nombre_opcion]
                                    return acc
                                  }, {})
                                ).map(([grupo, opciones]) => (
                                  <p key={grupo} className="text-xs text-gray-300">
                                    <span className="text-orange-300 font-bold">{grupo}:</span> {opciones.join(', ')}
                                  </p>
                                ))}
                              </div>
                            )}
                            {item.notas && (
                              <p className="text-xs text-amber-400 mt-0.5">⚠️ {item.notas}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {item.estado === 'pendiente' && (
                                <span className="flex items-center gap-1 text-[10px] text-gray-500 font-semibold">
                                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full" /> Pendiente
                                </span>
                              )}
                              {item.estado === 'en_preparacion' && (
                                <span className="flex items-center gap-1 text-[10px] text-blue-400 font-bold">
                                  <Flame size={10} className="animate-pulse" /> En preparación
                                </span>
                              )}
                              {item.estado === 'listo' && (
                                <span className="flex items-center gap-1 text-[10px] text-green-400 font-bold">
                                  <CheckCircle size={10} /> Listo
                                </span>
                              )}
                              {item.cocinero && item.estado !== 'listo' && (
                                <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                  esMio
                                    ? 'bg-orange-500/20 border border-orange-500/30 text-orange-300'
                                    : 'bg-gray-700/40 border border-gray-600/40 text-gray-400'
                                }`}>
                                  <ChefHat size={9} /> {item.cocinero}
                                </span>
                              )}
                              {item.cocinero && item.estado === 'listo' && (
                                <span className="flex items-center gap-1 text-[10px] text-gray-600">
                                  <ChefHat size={9} /> {item.cocinero}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5 shrink-0">
                            {item.estado === 'pendiente' && (
                              <button
                                onClick={() => abrirSelector(item.id, pedido.id)}
                                className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs px-3 py-2 rounded-lg font-bold transition-all shadow-md shadow-blue-900/30 flex items-center gap-1.5">
                                <Flame size={12} /> Preparar
                              </button>
                            )}
                            {item.estado === 'en_preparacion' && !bloqueadoPorOtro && (
                              <button
                                onClick={() => marcarListo(item.id, pedido.id)}
                                className="bg-green-600 hover:bg-green-500 active:scale-95 text-white text-xs px-3 py-2 rounded-lg font-bold transition-all shadow-md shadow-green-900/30 flex items-center gap-1.5">
                                <Zap size={12} /> Listo
                              </button>
                            )}
                            {item.estado === 'en_preparacion' && bloqueadoPorOtro && (
                              <span className="flex items-center gap-1 text-[10px] text-gray-500 px-2 py-1.5 bg-gray-800 rounded-lg border border-gray-700">
                                <Lock size={10} /> {item.cocinero}
                              </span>
                            )}
                            {item.estado === 'listo' && (
                              <span className="text-green-400 text-xs font-black flex items-center gap-1">
                                <CheckCircle size={12} /> Listo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )

                    // Complementos (acompañantes) como filas independientes en color teal
                    const filasCompl = (item.acompanantes ?? []).map((ac, idx) => {
                      const cKey = `${item.id}::${idx}`
                      const est  = complEstados[cKey] ?? 'pendiente'
                      return (
                        <div key={cKey}
                          className={`rounded-xl border p-3 ml-4 border-l-2 transition-all ${
                            est === 'listo'
                              ? 'bg-teal-950/40 border-teal-500/25 border-l-teal-500/60'
                              : est === 'en_preparacion'
                              ? 'bg-teal-900/30 border-teal-500/35 border-l-teal-400'
                              : 'bg-teal-950/20 border-teal-700/30 border-l-teal-700/50'
                          }`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className={`font-bold text-sm ${est === 'listo' ? 'text-teal-400' : 'text-teal-300'}`}>
                                  {item.cantidad > 1 ? `${item.cantidad}× ` : ''}{ac}
                                </p>
                                <span className="text-[10px] bg-teal-500/15 border border-teal-500/25 text-teal-400 px-1.5 py-0.5 rounded-full font-bold">
                                  Complemento
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {est === 'pendiente' && (
                                  <span className="flex items-center gap-1 text-[10px] text-gray-500 font-semibold">
                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full" /> Pendiente
                                  </span>
                                )}
                                {est === 'en_preparacion' && (
                                  <span className="flex items-center gap-1 text-[10px] text-teal-400 font-bold">
                                    <Flame size={10} className="animate-pulse" /> En preparación
                                  </span>
                                )}
                                {est === 'listo' && (
                                  <span className="flex items-center gap-1 text-[10px] text-teal-400 font-bold">
                                    <CheckCircle size={10} /> Listo
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0">
                              {est === 'pendiente' && (
                                <button
                                  onClick={() => marcarComplemento(cKey, 'en_preparacion')}
                                  className="bg-teal-700 hover:bg-teal-600 active:scale-95 text-white text-xs px-3 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5">
                                  <Flame size={12} /> Preparar
                                </button>
                              )}
                              {est === 'en_preparacion' && (
                                <button
                                  onClick={() => marcarComplemento(cKey, 'listo')}
                                  className="bg-teal-600 hover:bg-teal-500 active:scale-95 text-white text-xs px-3 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5">
                                  <Zap size={12} /> Listo
                                </button>
                              )}
                              {est === 'listo' && (
                                <span className="text-teal-400 text-xs font-black flex items-center gap-1">
                                  <CheckCircle size={12} /> Listo
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })

                    return [filaItem, ...filasCompl]
                  })}
                </div>

                {/* Resumen final de la comanda */}
                {(() => {
                  const resumen: Record<string, number> = {}
                  itemsPedido.forEach(item => {
                    const nombre = item.plato?.nombre ?? '?'
                    resumen[nombre] = (resumen[nombre] ?? 0) + item.cantidad
                  })
                  itemsPedido.forEach(item => {
                    ;(item.acompanantes ?? []).forEach(ac => {
                      const m = ac.match(/^(.+?)\s+x(\d+)$/i)
                      const nombre = m ? m[1].trim() : ac
                      const cant   = m ? parseInt(m[2]) : 1
                      resumen[nombre] = (resumen[nombre] ?? 0) + cant * item.cantidad
                    })
                  })
                  const entradas = Object.entries(resumen)
                  if (entradas.length === 0) return null
                  return (
                    <div className="border-t border-gray-700/40 px-3 pb-3 pt-2.5">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1.5">Resumen final</p>
                      <div className="flex flex-wrap gap-1.5">
                        {entradas.map(([nombre, cant]) => (
                          <span key={nombre} className="inline-flex items-center gap-1 text-xs bg-gray-800/70 border border-gray-600/40 text-gray-300 px-2.5 py-1 rounded-full">
                            <span className="font-black text-white">{cant}×</span> {nombre}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
