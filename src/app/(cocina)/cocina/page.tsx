'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Pedido, ItemPedido } from '@/types'
import toast from 'react-hot-toast'
import { Clock, ChefHat, CheckCircle, AlertTriangle, UtensilsCrossed, Lock, Flame, Zap } from 'lucide-react'

const MINUTOS_LIMITE = 20

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

interface ItemPlato extends Omit<ItemPedido, 'plato'> {
  plato: { nombre: string }
}

export default function CocinaPage() {
  const [pedidos, setPedidos]       = useState<Pedido[]>([])
  const [cargando, setCargando]     = useState(true)
  const [ahora, setAhora]           = useState(Date.now())
  const [bloqueoConfig, setBloqueoConfig] = useState<{ activo: boolean; cantidad: number }>({ activo: false, cantidad: 3 })

  const supabase = createClient()

  const cargarConfig = useCallback(async () => {
    const { data } = await supabase.from('configuracion').select('clave, valor')
      .in('clave', ['bloqueo_cocina_activo', 'bloqueo_cocina_cantidad'])
    if (data) {
      const cfg: Record<string, string> = {}
      data.forEach((r: { clave: string; valor: string }) => { cfg[r.clave] = r.valor })
      setBloqueoConfig({
        activo:   cfg['bloqueo_cocina_activo'] === 'true',
        cantidad: parseInt(cfg['bloqueo_cocina_cantidad'] || '3') || 3,
      })
    }
  }, [supabase])

  const cargarPedidos = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos')
      .select(`*, mesa:mesas(numero), items:items_pedido(*, plato:platos(nombre))`)
      .in('estado', ['pendiente', 'en_preparacion'])
      .order('created_at', { ascending: true })
    if (data) setPedidos(data as unknown as Pedido[])
    setCargando(false)
  }, [supabase])

  useEffect(() => {
    cargarPedidos(); cargarConfig()
    const canal = supabase.channel('cocina-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, cargarPedidos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items_pedido' }, cargarPedidos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion' }, cargarConfig)
      .subscribe()
    const intervalo = setInterval(cargarPedidos, 60000)
    const tick      = setInterval(() => setAhora(Date.now()), 1000)
    return () => { supabase.removeChannel(canal); clearInterval(intervalo); clearInterval(tick) }
  }, [cargarPedidos, cargarConfig, supabase])

  async function marcarPreparando(itemId: string, pedidoId: string) {
    await supabase.from('items_pedido').update({ estado: 'en_preparacion', tiempo_inicio_prep: new Date().toISOString() }).eq('id', itemId)
    await supabase.from('pedidos').update({ estado: 'en_preparacion' }).eq('id', pedidoId).eq('estado', 'pendiente')
    toast.success('🔥 En preparación')
    cargarPedidos()
  }

  async function marcarListo(itemId: string, pedidoId: string) {
    await supabase.from('items_pedido').update({ estado: 'listo', tiempo_listo: new Date().toISOString() }).eq('id', itemId)
    const { data: items } = await supabase.from('items_pedido').select('estado').eq('pedido_id', pedidoId)
    const todosListos = items?.every(i => i.estado === 'listo' || i.estado === 'entregado')
    if (todosListos) {
      await supabase.from('pedidos').update({ estado: 'listo' }).eq('id', pedidoId)
      toast.success('✅ ¡Pedido completo! La mesera fue notificada.')
    } else {
      toast.success('✅ Plato listo')
    }
    cargarPedidos()
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (cargando) return (
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
    const items  = (p.items as unknown as ItemPlato[]) ?? []
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
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Límite</p>
              <p className="text-red-400 font-black text-lg">{MINUTOS_LIMITE} min</p>
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
            const itemsPedido = (pedido.items as unknown as ItemPlato[]) ?? []
            const fechas      = itemsPedido.map(i => new Date(i.created_at).getTime())
            const fechaRef    = fechas.length > 0
              ? new Date(Math.max(...fechas)).toISOString()
              : pedido.created_at
            const minutos     = tiempoTranscurrido(fechaRef, ahora)
            const esDemorado  = minutos >= MINUTOS_LIMITE
            const mesa        = (pedido.mesa as unknown as { numero: number } | null)
            const UMBRAL_ADICIONAL_MS = 2 * 60 * 1000

            return (
              <div key={pedido.id}
                className={`rounded-2xl border overflow-hidden transition-all ${
                  esDemorado
                    ? 'border-red-500/50 bg-gradient-to-b from-red-950/80 to-gray-900'
                    : 'border-gray-700/60 bg-gradient-to-b from-gray-800/80 to-gray-900'
                }`}
                style={esDemorado ? { boxShadow: '0 0 20px rgba(239,68,68,0.15), inset 0 1px 0 rgba(239,68,68,0.1)' } : { boxShadow: '0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.04)' }}>

                {/* Card header */}
                <div className={`px-4 pt-3.5 pb-3 border-b ${esDemorado ? 'border-red-500/20' : 'border-gray-700/40'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {pedido.tipo === 'domi' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center justify-center">
                            <span className="text-sm">🛵</span>
                          </div>
                          <span className="text-blue-400 font-black text-lg">DOMI</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${esDemorado ? 'bg-red-500/20 border border-red-500/30 text-red-400' : 'bg-orange-500/20 border border-orange-500/30 text-orange-400'}`}>
                            {mesa?.numero}
                          </div>
                          <div>
                            <span className={`font-black text-lg ${esDemorado ? 'text-red-400' : 'text-orange-400'}`}>Mesa {mesa?.numero}</span>
                            {pedido.tipo !== 'domi' && (
                              <p className="text-[10px] text-gray-500 leading-none">{pedido.tipo === 'cliente_qr' ? '📱 Pedido QR' : '👩 Mesera'}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <BadgeTiempo minutos={minutos} />
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
                  {itemsPedido.map(item => {
                    const esAdicional = (new Date(item.created_at).getTime() - new Date(pedido.created_at).getTime()) > UMBRAL_ADICIONAL_MS
                    return (
                      <div key={item.id}
                        className={`rounded-xl border p-3 transition-all ${
                          item.estado === 'listo'
                            ? 'bg-green-950/40 border-green-500/25'
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
                              {esAdicional && item.estado !== 'listo' && (
                                <span className="text-[10px] bg-purple-500/20 border border-purple-500/30 text-purple-400 px-1.5 py-0.5 rounded-full font-bold">
                                  ➕ Adicional
                                </span>
                              )}
                            </div>
                            {item.notas && (
                              <p className="text-xs text-amber-400 mt-0.5">⚠️ {item.notas}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1.5">
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
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5 shrink-0">
                            {item.estado === 'pendiente' && (
                              <button onClick={() => marcarPreparando(item.id, pedido.id)}
                                className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs px-3 py-2 rounded-lg font-bold transition-all shadow-md shadow-blue-900/30 flex items-center gap-1.5">
                                <Flame size={12} /> Preparar
                              </button>
                            )}
                            {item.estado === 'en_preparacion' && (
                              <button onClick={() => marcarListo(item.id, pedido.id)}
                                className="bg-green-600 hover:bg-green-500 active:scale-95 text-white text-xs px-3 py-2 rounded-lg font-bold transition-all shadow-md shadow-green-900/30 flex items-center gap-1.5">
                                <Zap size={12} /> Listo
                              </button>
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
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
