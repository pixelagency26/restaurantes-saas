'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plato, Categoria, Inventario } from '@/types'
import toast from 'react-hot-toast'
import {
  Bike, X, Plus, Minus, ShoppingBag,
  Clock, Package, Navigation, RefreshCw, Banknote, Wallet,
  ChefHat, CheckCircle,
} from 'lucide-react'

type ItemCarrito = { plato: Plato; cantidad: number; notas: string }

interface PedidoDomi {
  id: string
  estado: string
  created_at: string
  cliente_nombre: string | null
  cliente_telefono: string | null
  cliente_direccion: string | null
  metodo_pago_cliente: string | null
  comprobante_url: string | null
  total: number
  items: { nombre: string; cantidad: number }[]
}

interface NotifCocina {
  id: number
  pedidoId: string
  clienteNombre: string
  platoNombre: string
  pendientes: string[]
}

export default function DomiPage() {
  const [vista, setVista] = useState<'pedidos' | 'menu' | 'carrito'>('pedidos')
  const [pedidosActivos, setPedidosActivos] = useState<PedidoDomi[]>([])
  const [pedidosEntregados, setPedidosEntregados] = useState<PedidoDomi[]>([])
  const [notifs, setNotifs] = useState<NotifCocina[]>([])

  // Carrito / nuevo pedido
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [platos, setPlatos] = useState<(Plato & { inventario: Inventario[] })[]>([])
  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null)
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [clienteDomi, setClienteDomi] = useState({ nombre: '', telefono: '', direccion: '', cedula: '' })
  const [notaGeneral, setNotaGeneral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [marcandoId, setMarcandoId] = useState<string | null>(null)

  // Inventario de turno
  const [negocioId, setNegocioId] = useState<string | null>(null)
  const [turnoInventarioIds, setTurnoInventarioIds] = useState<Set<string>>(new Set())

  // Cobro domi
  const [modalPagoDomi, setModalPagoDomi] = useState<string | null>(null)
  const [metodoCobro, setMetodoCobro] = useState<'efectivo' | 'nequi' | 'daviplata' | 'bancolombia'>('efectivo')
  const [cobrando, setCobrando] = useState(false)

  // Mini cuadre
  const [vistaCuadre, setVistaCuadre] = useState(false)
  const [cuadre, setCuadre] = useState<{
    efectivo: number; transfer: number
    lista: { nombre: string; total: number; metodo: string }[]
  }>({ efectivo: 0, transfer: 0, lista: [] })
  const [cargandoCuadre, setCargandoCuadre] = useState(false)

  const supabase = createClient()

  // ── CARGAR PEDIDOS DOMI ACTIVOS ───────────────────────────────
  const cargarPedidos = useCallback(async () => {
    const hoy = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('pedidos')
      .select('id, estado, created_at, cliente_nombre, cliente_telefono, cliente_direccion, metodo_pago_cliente, comprobante_url, items:items_pedido(cantidad, precio_unitario, plato:platos(nombre))')
      .eq('tipo', 'domi')
      .gte('created_at', `${hoy}T00:00:00`)
      .order('created_at', { ascending: true })

    if (!data) return
    const mapear = (p: unknown): PedidoDomi => {
      const ped = p as {
        id: string; estado: string; created_at: string
        cliente_nombre: string | null; cliente_telefono: string | null
        cliente_direccion: string | null; metodo_pago_cliente: string | null
        comprobante_url: string | null
        items: { cantidad: number; precio_unitario: number; plato: { nombre: string } }[]
      }
      return {
        id: ped.id, estado: ped.estado, created_at: ped.created_at,
        cliente_nombre: ped.cliente_nombre, cliente_telefono: ped.cliente_telefono,
        cliente_direccion: ped.cliente_direccion, metodo_pago_cliente: ped.metodo_pago_cliente,
        comprobante_url: ped.comprobante_url,
        total: ped.items?.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0) ?? 0,
        items: ped.items?.map(i => ({ nombre: i.plato?.nombre || '', cantidad: i.cantidad })) ?? [],
      }
    }
    const todos = data.map(mapear)
    setPedidosActivos(todos.filter(p => ['pendiente', 'en_preparacion', 'listo', 'entregado'].includes(p.estado)))
    setPedidosEntregados(todos.filter(p => p.estado === 'pagado').slice(0, 8))
  }, [supabase])

  // ── CARGAR MENÚ ───────────────────────────────────────────────
  const cargarMenu = useCallback(async () => {
    const [{ data: cats }, { data: pls }, { data: inv }, { data: turnoData }, { data: negData }] = await Promise.all([
      supabase.from('categorias').select('*').order('orden'),
      supabase.from('platos').select('*').eq('activo', true),
      supabase.from('inventario').select('*'),
      supabase.from('turnos').select('id, abierto_en').is('cerrado_en', null)
        .order('abierto_en', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('negocios').select('id').single(),
    ])

    // Guardar negocio_id para usar en pedidos (RLS)
    if (negData?.id) setNegocioId(negData.id)

    // Cargar plato_ids con inventario configurado en el turno activo
    let platoIdsConInv = new Set<string>()
    if (turnoData?.id) {
      const td = turnoData as { id: string; abierto_en: string }
      const { data: tiData } = await supabase.from('turnos_inventario')
        .select('plato_id').eq('turno_id', td.id)
      if (tiData && tiData.length > 0) {
        // Fuente única de verdad: solo platos explícitamente configurados en este turno
        platoIdsConInv = new Set(tiData.map((r: { plato_id: string }) => r.plato_id))
      }
      // Sin fallback: si turnos_inventario no tiene registros → sin restricciones de stock
    }
    setTurnoInventarioIds(platoIdsConInv)

    if (cats) { setCategorias(cats); if (!categoriaActiva && cats[0]) setCategoriaActiva(cats[0].id) }
    if (pls) setPlatos(pls.map(p => ({ ...p, inventario: (inv || []).filter((i: Inventario) => i.plato_id === p.id) })) as unknown as (Plato & { inventario: Inventario[] })[])
  }, [supabase, categoriaActiva])

  useEffect(() => {
    cargarPedidos()
    cargarMenu()

    const canal = supabase.channel('domi-pedidos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, cargarPedidos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario' }, cargarMenu)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_inventario' }, cargarMenu)
      // Notificaciones plato a plato cuando cocina marca listo
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items_pedido' }, (payload) => {
        const item = payload.new as { id: string; estado: string; pedido_id: string }
        if (item.estado !== 'listo') return
        supabase
          .from('pedidos')
          .select('tipo, cliente_nombre, items:items_pedido(id, estado, plato:platos(nombre))')
          .eq('id', item.pedido_id)
          .maybeSingle()
          .then(({ data: pedido }) => {
            if (!pedido) return
            const p = pedido as unknown as {
              tipo: string; cliente_nombre: string | null
              items: { id: string; estado: string; plato: { nombre: string } }[]
            }
            if (p.tipo !== 'domi') return

            const itemListo = p.items.find(i => i.id === item.id)
            const platoNombre = itemListo?.plato?.nombre ?? 'Plato'
            // Platos que SIGUEN pendientes (excluir el que acaba de quedar listo)
            const pendientes = p.items
              .filter(i => i.id !== item.id && (i.estado === 'pendiente' || i.estado === 'en_preparacion'))
              .map(i => i.plato.nombre)

            const notifId = Date.now()
            setNotifs(prev => [...prev, {
              id: notifId, pedidoId: item.pedido_id,
              clienteNombre: p.cliente_nombre || 'Cliente',
              platoNombre, pendientes,
            }])
            setTimeout(() => setNotifs(prev => prev.filter(n => n.id !== notifId)), 45000)
          })
      })
      .subscribe()

    // Polling de respaldo cada 20 s (por si algún evento realtime no llega)
    const intervalo = setInterval(cargarPedidos, 20000)

    return () => { supabase.removeChannel(canal); clearInterval(intervalo) }
  }, [cargarPedidos, cargarMenu, supabase])

  // ── REGISTRAR COBRO ──────────────────────────────────────────
  async function registrarCobro() {
    if (!modalPagoDomi) return
    setCobrando(true)
    const ped = [...pedidosActivos, ...pedidosEntregados].find(p => p.id === modalPagoDomi)
    if (!ped) { setCobrando(false); return }
    await supabase.from('pagos').insert({
      pedido_id: modalPagoDomi, metodo: metodoCobro, monto: ped.total, propina: 0,
    })
    await supabase.from('pedidos').update({
      estado: 'pagado', pagado_en: new Date().toISOString(),
    }).eq('id', modalPagoDomi)
    toast.success('✅ Cobro registrado')
    setModalPagoDomi(null)
    setCobrando(false)
    cargarPedidos()
  }

  // ── CARGAR MI CUADRE ─────────────────────────────────────────
  const cargarCuadre = useCallback(async () => {
    setCargandoCuadre(true)
    const { data: { user } } = await supabase.auth.getUser()
    const hoy = new Date().toISOString().split('T')[0]

    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('id, cliente_nombre, estado, items:items_pedido(cantidad, precio_unitario)')
      .eq('tipo', 'domi')
      .eq('mesera_id', user?.id)
      .gte('created_at', `${hoy}T00:00:00`)
      .neq('estado', 'cancelado')

    if (!pedidos || pedidos.length === 0) {
      setCuadre({ efectivo: 0, transfer: 0, lista: [] })
      setCargandoCuadre(false)
      return
    }

    const ids = (pedidos as { id: string }[]).map(p => p.id)
    const { data: pagos } = await supabase
      .from('pagos').select('pedido_id, metodo, monto').in('pedido_id', ids)

    let efectivo = 0, transfer = 0
    const lista: { nombre: string; total: number; metodo: string; pagado: boolean }[] = []

    ;(pedidos as { id: string; cliente_nombre: string | null; estado: string; items: { cantidad: number; precio_unitario: number }[] }[]).forEach(p => {
      const pagosPed = ((pagos || []) as { pedido_id: string; metodo: string; monto: number }[])
        .filter(pg => pg.pedido_id === p.id)
      const totalPed = p.items?.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0) ?? 0

      if (pagosPed.length > 0) {
        const monto = pagosPed.reduce((a, pg) => a + pg.monto, 0)
        const met = pagosPed[0].metodo
        if (met === 'efectivo') efectivo += monto
        else transfer += monto
        lista.push({ nombre: p.cliente_nombre || 'Sin nombre', total: monto, metodo: met, pagado: true })
      } else {
        lista.push({ nombre: p.cliente_nombre || 'Sin nombre', total: totalPed, metodo: '—', pagado: false })
      }
    })

    setCuadre({ efectivo, transfer, lista })
    setCargandoCuadre(false)
  }, [supabase])

  // ── MARCAR "SALIÓ A ENTREGAR" ─────────────────────────────────
  async function salioAEntregar(pedidoId: string) {
    setMarcandoId(pedidoId)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('pedidos').update({
      estado: 'entregado',
      domi_tomado_en: new Date().toISOString(),
      mesera_id: user?.id ?? null,
    }).eq('id', pedidoId)
    toast.success('🛵 ¡En camino!')
    setMarcandoId(null)
    cargarPedidos()
  }

  // ── CARRITO ───────────────────────────────────────────────────
  function stockDisponible(platoId: string): number {
    const p = platos.find(pl => pl.id === platoId)
    return p?.inventario?.[0]?.cantidad_disponible ?? 0
  }

  function agregarAlCarrito(plato: Plato) {
    // Solo limitar si el plato tiene inventario de turno configurado
    if (turnoInventarioIds.has(plato.id)) {
      const disp = stockDisponible(plato.id)
      if (disp === 0) { toast.error(`${plato.nombre} no está disponible`); return }
      const enCarrito = carrito.find(i => i.plato.id === plato.id)?.cantidad ?? 0
      if (enCarrito >= disp) { toast.error(`Solo hay ${disp} unidad(es) de ${plato.nombre}`); return }
    }
    setCarrito(prev => {
      const existe = prev.find(i => i.plato.id === plato.id)
      if (existe) return prev.map(i => i.plato.id === plato.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { plato, cantidad: 1, notas: '' }]
    })
    toast.success(`${plato.nombre} agregado`)
  }

  function cambiarCantidad(id: string, delta: number) {
    if (delta > 0 && turnoInventarioIds.has(id)) {
      const disp = stockDisponible(id)
      if (disp <= 0) { toast.error('No hay más unidades disponibles'); return }
      const enCarrito = carrito.find(i => i.plato.id === id)?.cantidad ?? 0
      if (enCarrito >= disp) { toast.error('No hay más unidades disponibles'); return }
    }
    setCarrito(prev => prev.map(i => i.plato.id === id ? { ...i, cantidad: Math.max(0, i.cantidad + delta) } : i).filter(i => i.cantidad > 0))
  }

  // ── ENVIAR PEDIDO ─────────────────────────────────────────────
  async function enviarPedido() {
    if (carrito.length === 0) return
    if (!clienteDomi.nombre.trim() || !clienteDomi.telefono.trim() || !clienteDomi.direccion.trim()) {
      toast.error('Nombre, teléfono y dirección son obligatorios'); return
    }
    setEnviando(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: turno } = await supabase.from('turnos').select('id').is('cerrado_en', null)
      .order('abierto_en', { ascending: false }).limit(1).single()
    if (!turno) { toast.error('No hay turno abierto. El gerente debe abrir caja.'); setEnviando(false); return }

    // ── VERIFICACIÓN DE STOCK EN DB ──────────────────────────────
    if (turnoInventarioIds.size > 0) {
      const itemsConLimite = carrito.filter(item => turnoInventarioIds.has(item.plato.id))
      if (itemsConLimite.length > 0) {
        const { data: invActual } = await supabase
          .from('inventario').select('plato_id, cantidad_disponible')
          .in('plato_id', itemsConLimite.map(i => i.plato.id))
        const invMap = Object.fromEntries(((invActual || []) as { plato_id: string; cantidad_disponible: number }[]).map(i => [i.plato_id, i.cantidad_disponible]))
        for (const item of itemsConLimite) {
          const disp = invMap[item.plato.id] ?? 0
          if (disp < item.cantidad) {
            toast.error(`Solo quedan ${disp} de "${item.plato.nombre}"`, { duration: 5000 })
            await cargarMenu()
            setEnviando(false)
            return
          }
        }
      }
    }

    // Asegurar negocio_id para RLS
    let myNegocioId = negocioId
    if (!myNegocioId) {
      const { data: neg } = await supabase.from('negocios').select('id').single()
      myNegocioId = neg?.id ?? null
      if (myNegocioId) setNegocioId(myNegocioId)
    }

    const { data: pedido, error } = await supabase.from('pedidos').insert({
      mesera_id: user?.id,
      turno_id: turno.id,
      tipo: 'domi',
      notas: notaGeneral || null,
      cliente_nombre:    clienteDomi.nombre.trim(),
      cliente_cedula:    clienteDomi.cedula.trim() || null,
      cliente_telefono:  clienteDomi.telefono.trim(),
      cliente_direccion: clienteDomi.direccion.trim(),
      ...(myNegocioId ? { negocio_id: myNegocioId } : {}),
    }).select().single()

    if (error || !pedido) { toast.error('Error al crear el pedido'); setEnviando(false); return }

    await supabase.from('items_pedido').insert(
      carrito.map(item => ({
        pedido_id: pedido.id,
        plato_id: item.plato.id,
        cantidad: item.cantidad,
        precio_unitario: item.plato.precio,
        notas: item.notas || null,
      }))
    )
    toast.success('🛵 ¡Domi enviado a cocina!')
    setCarrito([]); setClienteDomi({ nombre: '', telefono: '', direccion: '', cedula: '' })
    setNotaGeneral(''); setVista('pedidos')
    cargarPedidos()
    cargarMenu()   // refresca el stock local después de pedido
    setEnviando(false)
  }

  const totalCarrito = carrito.reduce((a, i) => a + i.plato.precio * i.cantidad, 0)
  const platosFiltrados = platos.filter(p => p.categoria_id === categoriaActiva)

  // ── VISTA: MENÚ ───────────────────────────────────────────────
  if (vista === 'menu') return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setVista('pedidos'); setCarrito([]) }}
            className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-500/20 border border-orange-500/30 rounded-lg flex items-center justify-center">
              <Bike size={14} className="text-orange-400" />
            </div>
            <span className="text-white font-black text-sm">Nuevo domi</span>
          </div>
        </div>
        <button
          onClick={() => setVista('carrito')}
          className="relative bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-orange-900/30">
          <ShoppingBag size={16} /> Ver pedido
          {carrito.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-black animate-bounce">
              {carrito.length}
            </span>
          )}
        </button>
      </div>

      {/* Categorías */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-gray-900/60 border-b border-gray-800 shrink-0">
        {categorias.map(cat => (
          <button key={cat.id} onClick={() => setCategoriaActiva(cat.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              categoriaActiva === cat.id
                ? 'bg-orange-500 text-white shadow-md shadow-orange-900/30'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}>
            {cat.nombre}
          </button>
        ))}
      </div>

      {/* Platos */}
      <div className="flex-1 p-4 space-y-2.5">
        {platosFiltrados.map(plato => {
          const invRow = plato.inventario?.[0] as { cantidad_disponible: number; alerta_minima: number } | undefined
          const tieneInv = turnoInventarioIds.has(plato.id)
          const disp = tieneInv ? (invRow?.cantidad_disponible ?? 0) : Infinity
          const alerta = invRow?.alerta_minima ?? 3
          const sinStock = tieneInv && disp === 0
          const stockBajo = tieneInv && !sinStock && disp <= alerta
          const enCarrito = carrito.find(i => i.plato.id === plato.id)
          return (
            <div key={plato.id}
              className={`rounded-2xl border flex items-center gap-3 p-3 transition-all ${
                sinStock
                  ? 'opacity-40 border-gray-800 bg-gray-900/40'
                  : enCarrito
                  ? 'border-orange-500/40 bg-orange-500/5'
                  : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
              }`}>
              {plato.imagen_url
                ? <img src={plato.imagen_url} alt={plato.nombre} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                : <div className="w-14 h-14 rounded-xl bg-gray-800 flex items-center justify-center text-2xl shrink-0">🍽️</div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">{plato.nombre}</p>
                <p className="text-orange-400 font-black text-sm mt-0.5">${plato.precio.toLocaleString('es-CO')}</p>
                {sinStock  && <p className="text-red-400 text-xs font-bold mt-0.5">Sin disponibilidad</p>}
                {stockBajo && <p className="text-amber-400 text-xs font-bold mt-0.5">⚠️ Quedan {disp}</p>}
                {tieneInv && !sinStock && !stockBajo && <p className="text-green-400 text-xs font-semibold mt-0.5">{disp} disponibles</p>}
              </div>
              {!sinStock && (enCarrito ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => cambiarCantidad(plato.id, -1)}
                    className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-white transition-colors">
                    <Minus size={14} />
                  </button>
                  <span className="font-black text-white w-5 text-center">{enCarrito.cantidad}</span>
                  <button onClick={() => cambiarCantidad(plato.id, 1)}
                    className="w-8 h-8 bg-orange-500 hover:bg-orange-400 text-white rounded-full flex items-center justify-center transition-colors">
                    <Plus size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => agregarAlCarrito(plato)}
                  className="w-10 h-10 bg-orange-500 hover:bg-orange-400 active:scale-90 text-white rounded-full flex items-center justify-center transition-all shadow-md shadow-orange-900/30 shrink-0">
                  <Plus size={20} />
                </button>
              ))}
            </div>
          )
        })}
        {platosFiltrados.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-sm">No hay platos en esta categoría</p>
          </div>
        )}
      </div>
    </div>
  )

  // ── VISTA: CARRITO ────────────────────────────────────────────
  if (vista === 'carrito') return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => setVista('menu')}
          className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors">
          <X size={18} />
        </button>
        <h2 className="font-black text-white">Confirmar domi</h2>
      </div>

      <div className="flex-1 p-4 space-y-3 pb-36">
        {/* Items carrito */}
        {carrito.map(item => {
          const dispCarrito = stockDisponible(item.plato.id)
          return (
            <div key={item.plato.id} className="bg-gray-900/70 rounded-2xl p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-white">{item.plato.nombre}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => cambiarCantidad(item.plato.id, -1)}
                    className="w-7 h-7 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-300 transition-colors">
                    <Minus size={12} />
                  </button>
                  <span className="font-black text-white w-5 text-center">{item.cantidad}</span>
                  <button onClick={() => cambiarCantidad(item.plato.id, 1)}
                    disabled={item.cantidad >= dispCarrito}
                    className="w-7 h-7 bg-orange-500 hover:bg-orange-400 text-white rounded-full flex items-center justify-center disabled:opacity-40 transition-colors">
                    <Plus size={12} />
                  </button>
                </div>
              </div>
              <p className="text-orange-400 text-sm font-bold">${(item.plato.precio * item.cantidad).toLocaleString('es-CO')}</p>
              <input type="text" placeholder="Nota (ej: sin sal)" value={item.notas}
                onChange={e => setCarrito(prev => prev.map(i => i.plato.id === item.plato.id ? { ...i, notas: e.target.value } : i))}
                className="mt-2 w-full text-sm bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50" />
            </div>
          )
        })}

        {/* Datos del cliente */}
        <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Bike size={13} className="text-orange-400" />
            </div>
            <p className="text-sm font-black text-white">Datos del cliente</p>
          </div>
          <input type="text" placeholder="Nombre *" value={clienteDomi.nombre}
            onChange={e => setClienteDomi(p => ({ ...p, nombre: e.target.value }))}
            className="w-full text-sm bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50" />
          <input type="tel" placeholder="Teléfono *" value={clienteDomi.telefono}
            onChange={e => setClienteDomi(p => ({ ...p, telefono: e.target.value }))}
            className="w-full text-sm bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50" />
          <input type="text" placeholder="Dirección de entrega *" value={clienteDomi.direccion}
            onChange={e => setClienteDomi(p => ({ ...p, direccion: e.target.value }))}
            className="w-full text-sm bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50" />
          <input type="text" placeholder="Cédula (opcional)" value={clienteDomi.cedula}
            onChange={e => setClienteDomi(p => ({ ...p, cedula: e.target.value }))}
            className="w-full text-sm bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50" />
          <textarea placeholder="Nota general..." value={notaGeneral} onChange={e => setNotaGeneral(e.target.value)} rows={2}
            className="w-full text-sm bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 resize-none" />
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 p-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-gray-400 font-medium text-sm">Total estimado</span>
          <span className="text-xl font-black text-white">${totalCarrito.toLocaleString('es-CO')}</span>
        </div>
        <button onClick={enviarPedido} disabled={enviando || carrito.length === 0}
          className="w-full bg-orange-500 hover:bg-orange-400 active:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-base transition-all shadow-lg shadow-orange-900/30">
          <Bike size={20} /> {enviando ? 'Enviando...' : 'Enviar domi a cocina'}
        </button>
      </div>
    </div>
  )

  // ── VISTA: PEDIDOS (principal) ────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 pb-8">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-md border-b border-gray-800 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Bike size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight">Panel Domi</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <p className="text-gray-500 text-xs">{pedidosActivos.length} activo(s) hoy</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setVistaCuadre(true); cargarCuadre() }}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-bold px-3 py-2.5 rounded-xl text-sm transition-all">
              <Wallet size={15} /> Cuadre
            </button>
            <button
              onClick={() => { setCarrito([]); setClienteDomi({ nombre: '', telefono: '', direccion: '', cedula: '' }); setVista('menu') }}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-md shadow-orange-900/30">
              <Plus size={16} /> Nuevo domi
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Notificaciones de cocina */}
        {notifs.length > 0 && (
          <div className="space-y-2">
            {notifs.map(n => (
              <div key={n.id} className="bg-green-500/10 border-2 border-green-500/40 rounded-2xl px-4 py-3 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-black text-green-300">
                    🍽️ <span className="text-orange-400">{n.platoNombre}</span> del pedido de {n.clienteNombre} está listo
                  </p>
                  {n.pendientes.length > 0
                    ? <p className="text-xs text-amber-400 font-semibold mt-1">⏳ Faltan: {n.pendientes.join(', ')}</p>
                    : <p className="text-xs text-green-400 font-bold mt-1">✅ ¡Pedido completo! Ya puedes salir</p>
                  }
                </div>
                <button onClick={() => setNotifs(prev => prev.filter(x => x.id !== n.id))}
                  className="text-gray-600 hover:text-gray-400 shrink-0">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pedidos activos */}
        {pedidosActivos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-800/60 border border-gray-700 rounded-3xl flex items-center justify-center mb-4">
              <Package size={36} className="text-gray-600" />
            </div>
            <p className="text-gray-300 font-bold text-lg mb-1">Sin pedidos activos</p>
            <p className="text-gray-600 text-sm">Los pedidos aparecerán aquí en tiempo real</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-500 px-1">Pedidos activos</p>
            {pedidosActivos.map(ped => {
              const mins      = Math.floor((Date.now() - new Date(ped.created_at).getTime()) / 60000)
              const esListo   = ped.estado === 'listo'
              const esPend    = ped.estado === 'pendiente'
              const esEnPrep  = ped.estado === 'en_preparacion'
              const esEntrego = ped.estado === 'entregado'

              const cardBg = esListo
                ? 'bg-green-500/10 border-2 border-green-500/40'
                : esEntrego
                ? 'bg-sky-500/10 border-2 border-sky-500/30'
                : esPend
                ? 'bg-gray-900/60 border-2 border-gray-700'
                : 'bg-orange-500/10 border-2 border-orange-500/25'

              const badgeClases = esListo
                ? 'bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse'
                : esEntrego
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : esPend
                ? 'bg-gray-800 text-gray-500 border border-gray-700'
                : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'

              const badgeLabel = esListo ? '✅ LISTO' : esEntrego ? '🛵 En camino' : esPend ? '⏳ Espera' : '🔥 Prep.'

              return (
                <div key={ped.id} className={`rounded-2xl p-4 ${cardBg}`}>
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-base truncate">{ped.cliente_nombre || 'Sin nombre'}</p>
                      {ped.cliente_telefono && <p className="text-xs text-gray-400 mt-0.5">📞 {ped.cliente_telefono}</p>}
                      {ped.cliente_direccion && <p className="text-xs text-gray-400 mt-0.5">📍 {ped.cliente_direccion}</p>}
                      {ped.metodo_pago_cliente && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {ped.metodo_pago_cliente === 'efectivo' ? '💵 Efectivo' : `📲 ${ped.metodo_pago_cliente}`}
                          {ped.comprobante_url && <span className="ml-1 text-green-400 font-semibold">· Comprobante ✓</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeClases}`}>
                        {badgeLabel}
                      </span>
                      <span className={`text-xs font-bold ${mins >= 40 ? 'text-red-400' : mins >= 20 ? 'text-amber-400' : 'text-gray-500'}`}>
                        <Clock size={10} className="inline mr-0.5" />{mins} min
                      </span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {ped.items.map((it, i) => (
                      <span key={i} className="bg-gray-800 border border-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                        {it.cantidad}× {it.nombre}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-white">${ped.total.toLocaleString('es-CO')}</span>
                    <div className="flex gap-2">
                      {esListo && (
                        <button
                          onClick={() => salioAEntregar(ped.id)}
                          disabled={marcandoId === ped.id}
                          className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 active:bg-orange-600 disabled:opacity-50 text-white font-bold px-3 py-2.5 rounded-xl text-sm transition-all shadow-md shadow-orange-900/30">
                          <Navigation size={15} />
                          {marcandoId === ped.id ? '...' : '🛵 Salió'}
                        </button>
                      )}
                      {(esListo || esEntrego) && (
                        <button
                          onClick={() => { setModalPagoDomi(ped.id); setMetodoCobro('efectivo') }}
                          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white font-bold px-3 py-2.5 rounded-xl text-sm transition-all">
                          <Banknote size={15} /> Cobrar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Historial del día */}
        {pedidosEntregados.length > 0 && (
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-500 px-1 mb-2">Entregados hoy</p>
            <div className="space-y-2">
              {pedidosEntregados.map(ped => (
                <div key={ped.id} className="bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white/80 text-sm">{ped.cliente_nombre || 'Sin nombre'}</p>
                    <p className="text-xs text-gray-500">{ped.cliente_direccion}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-white text-sm">${ped.total.toLocaleString('es-CO')}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      ped.estado === 'pagado'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-sky-500/20 text-sky-400'
                    }`}>
                      {ped.estado === 'pagado' ? 'Pagado' : 'Entregado'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FAB refrescar */}
      <button onClick={cargarPedidos}
        className="fixed bottom-6 right-6 w-12 h-12 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-orange-400 rounded-full flex items-center justify-center shadow-lg transition-all">
        <RefreshCw size={20} />
      </button>

      {/* ── MODAL COBRAR ────────────────────────────────────────── */}
      {modalPagoDomi && (() => {
        const ped = [...pedidosActivos, ...pedidosEntregados].find(p => p.id === modalPagoDomi)
        const METODOS = [
          { id: 'efectivo' as const,    label: 'Efectivo',    emoji: '💵', color: 'bg-green-600' },
          { id: 'nequi' as const,       label: 'Nequi',       emoji: '💜', color: 'bg-purple-600' },
          { id: 'daviplata' as const,   label: 'Daviplata',   emoji: '❤️', color: 'bg-red-600' },
          { id: 'bancolombia' as const, label: 'Bancolombia', emoji: '🟡', color: 'bg-yellow-600' },
        ]
        return (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-end justify-center" onClick={() => setModalPagoDomi(null)}>
            <div className="bg-gray-900 w-full max-w-lg rounded-t-3xl p-6 space-y-4 border-t border-gray-700" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="font-black text-white text-lg">Registrar cobro</h2>
                <button onClick={() => setModalPagoDomi(null)}
                  className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700">
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
              {ped && (
                <div className="bg-gray-800 rounded-2xl p-4">
                  <p className="font-semibold text-white/70 text-sm">{ped.cliente_nombre || 'Sin nombre'}</p>
                  <p className="text-2xl font-black text-white mt-1">${ped.total.toLocaleString('es-CO')}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">¿Cómo pagó el cliente?</p>
                <div className="grid grid-cols-2 gap-2">
                  {METODOS.map(m => (
                    <button key={m.id} onClick={() => setMetodoCobro(m.id)}
                      className={`py-3 rounded-2xl font-bold text-sm border-2 transition-all flex items-center justify-center gap-2 ${
                        metodoCobro === m.id
                          ? `${m.color} text-white border-transparent`
                          : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600'
                      }`}>
                      {m.emoji} {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={registrarCobro} disabled={cobrando}
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-black py-4 rounded-2xl text-base transition-all">
                {cobrando ? 'Registrando...' : `✅ Confirmar cobro — ${metodoCobro}`}
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── MODAL MI CUADRE ─────────────────────────────────────── */}
      {vistaCuadre && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-end justify-center">
          <div className="bg-gray-900 w-full max-w-lg rounded-t-3xl max-h-[85vh] flex flex-col border-t border-gray-700">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-2">
                <Wallet size={18} className="text-orange-400" />
                <h2 className="font-black text-white text-lg">Mi cuadre del día</h2>
              </div>
              <button onClick={() => setVistaCuadre(false)}
                className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {cargandoCuadre ? (
                <div className="flex justify-center py-8">
                  <RefreshCw size={28} className="animate-spin text-orange-400" />
                </div>
              ) : (<>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 text-center">
                    <p className="text-2xl">💵</p>
                    <p className="text-xl font-black text-green-400 mt-1">${cuadre.efectivo.toLocaleString('es-CO')}</p>
                    <p className="text-xs text-green-500/70 font-semibold mt-0.5">Efectivo</p>
                  </div>
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 text-center">
                    <p className="text-2xl">📲</p>
                    <p className="text-xl font-black text-orange-400 mt-1">${cuadre.transfer.toLocaleString('es-CO')}</p>
                    <p className="text-xs text-orange-500/70 font-semibold mt-0.5">Transferencia</p>
                  </div>
                </div>
                <div className="bg-gray-800 rounded-2xl p-4 text-center border border-gray-700">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">Total recolectado</p>
                  <p className="text-2xl font-black text-white mt-1">${(cuadre.efectivo + cuadre.transfer).toLocaleString('es-CO')}</p>
                </div>

                {cuadre.lista.length > 0 && (
                  <div className="bg-gray-900/60 rounded-2xl border border-gray-800 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-800">
                      <p className="font-bold text-white text-sm">Mis entregas hoy</p>
                    </div>
                    <div className="divide-y divide-gray-800">
                      {cuadre.lista.map((item, i) => {
                        const EMOJIS: Record<string, string> = { efectivo: '💵', nequi: '💜', daviplata: '❤️', bancolombia: '🟡' }
                        return (
                          <div key={i} className="flex items-center justify-between px-4 py-3">
                            <div>
                              <p className="font-semibold text-white/80 text-sm">{item.nombre}</p>
                              <p className="text-xs text-gray-500">{EMOJIS[item.metodo] || '—'} {item.metodo !== '—' ? item.metodo : 'Sin cobrar'}</p>
                            </div>
                            <p className={`font-black text-sm ${item.pagado ? 'text-white' : 'text-orange-400'}`}>
                              ${item.total.toLocaleString('es-CO')}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {cuadre.lista.length === 0 && (
                  <div className="text-center py-8">
                    <Wallet size={36} className="mx-auto mb-2 text-gray-700" />
                    <p className="text-sm text-gray-600">Sin entregas asignadas hoy</p>
                  </div>
                )}
              </>)}
            </div>
            <div className="px-5 py-4 border-t border-gray-800 shrink-0">
              <button onClick={cargarCuadre} disabled={cargandoCuadre}
                className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all">
                <RefreshCw size={15} /> Actualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
