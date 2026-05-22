'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { use } from 'react'
import {
  ShoppingCart, Plus, Minus, ChevronLeft, Star, Send,
  CalendarDays, CheckCircle, MessageSquare,
  Bike, UtensilsCrossed, AlertTriangle, ArrowRight, Loader2
} from 'lucide-react'

// ─── TIPOS ─────────────────────────────────────────────────────────────────
interface Negocio { id: string; nombre: string; plan: string }
interface Categoria { id: number; nombre: string; orden: number }
interface Plato { id: string; nombre: string; descripcion: string | null; precio: number; imagen_url: string | null; activo: boolean; categoria_id: number }
interface ItemCarrito { plato: Plato; cantidad: number; notas: string }
interface Resena { id: string; nombre: string; puntuacion: number; comentario: string; created_at: string }

type Tab = 'menu' | 'resenas' | 'pqrs' | 'reservas'
type TipoConsumo = 'consumo' | 'domi' | null
type PasoOrden = 'carrito' | 'tipo' | 'datos' | 'seguimiento'

const PLAN_NIVEL: Record<string, number> = { starter: 0, basico: 1, pro: 2 }
function planGte(plan: string, req: string) {
  return (PLAN_NIVEL[plan] ?? 0) >= (PLAN_NIVEL[req] ?? 0)
}

// ─── ESTRELLAS ─────────────────────────────────────────────────────────────
function Estrellas({ valor, onChange }: { valor: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(n)}
          className={`text-2xl transition-transform ${onChange ? 'hover:scale-110 cursor-pointer' : 'cursor-default'} ${n <= valor ? 'text-amber-400' : 'text-gray-200'}`}>
          ★
        </button>
      ))}
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────
export default function RestaurantePublicoPage({ params }: { params: Promise<{ negocioId: string }> }) {
  const { negocioId } = use(params)
  const supabase = createClient()

  // ── Estado global ──────────────────────────────────────────────────────
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [cargando, setCargando] = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [tab, setTab] = useState<Tab>('menu')

  // Config QR
  const [qrConsumo, setQrConsumo] = useState(false)
  const [qrDomi, setQrDomi] = useState(false)

  // Menú
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [platos, setPlatos] = useState<Plato[]>([])
  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null)
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [paso, setPaso] = useState<PasoOrden>('carrito')
  const [tipoConsumo, setTipoConsumo] = useState<TipoConsumo>(null)

  // Datos del cliente para ordenar
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [cedula, setCedula] = useState('')
  const [mesa, setMesa] = useState('')
  const [direccion, setDireccion] = useState('')
  const [notasPedido, setNotasPedido] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pedidoId, setPedidoId] = useState<string | null>(null)
  const [itemsSeguimiento, setItemsSeguimiento] = useState<{ id: string; nombre: string; cantidad: number; estado: string }[]>([])

  // Reseñas
  const [resenas, setResenas] = useState<Resena[]>([])
  const [formResena, setFormResena] = useState({ nombre: '', puntuacion: 5, comentario: '' })
  const [enviandoResena, setEnviandoResena] = useState(false)

  // PQRS
  const [formPqrs, setFormPqrs] = useState({ nombre: '', telefono: '', tipo: 'peticion', mensaje: '' })
  const [enviandoPqrs, setEnviandoPqrs] = useState(false)
  const [pqrsEnviado, setPqrsEnviado] = useState(false)

  // Reservas
  const [formReserva, setFormReserva] = useState({ nombre: '', telefono: '', fecha: '', hora: '12:00', personas: 2, notas: '' })
  const [enviandoReserva, setEnviandoReserva] = useState(false)
  const [reservaEnviada, setReservaEnviada] = useState(false)

  // ── Carga inicial ──────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: negData }, { data: cats }, { data: pls }, { data: cfg }, { data: res }] = await Promise.all([
      supabase.from('negocios').select('id, nombre, plan').eq('id', negocioId).single(),
      supabase.from('categorias').select('*').order('orden'),
      supabase.from('platos').select('*').eq('activo', true),
      supabase.from('configuracion').select('clave, valor').in('clave', ['qr_consumo_activo', 'qr_domi_activo']),
      supabase.from('resenas').select('*').eq('negocio_id', negocioId).order('created_at', { ascending: false }),
    ])

    if (!negData) { setNoEncontrado(true); setCargando(false); return }
    setNegocio(negData as Negocio)

    if (cats) {
      setCategorias(cats as Categoria[])
      if (cats[0]) setCategoriaActiva(cats[0].id)
    }
    if (pls) setPlatos(pls as Plato[])
    if (cfg) {
      const map: Record<string, string> = {}
      cfg.forEach((r: { clave: string; valor: string }) => { map[r.clave] = r.valor })
      setQrConsumo(map['qr_consumo_activo'] === 'true')
      setQrDomi(map['qr_domi_activo'] === 'true')
    }
    if (res) setResenas(res as Resena[])

    setCargando(false)
  }, [supabase, negocioId])

  useEffect(() => { cargar() }, [cargar])

  // Seguimiento en tiempo real
  useEffect(() => {
    if (!pedidoId) return
    const canal = supabase.channel(`pub-seg-${pedidoId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items_pedido', filter: `pedido_id=eq.${pedidoId}` },
        (payload) => {
          const n = payload.new as { id: string; estado: string }
          setItemsSeguimiento(prev => prev.map(i => i.id === n.id ? { ...i, estado: n.estado } : i))
        })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [pedidoId, supabase])

  // ── Carrito ────────────────────────────────────────────────────────────
  const totalCarrito = carrito.reduce((s, i) => s + i.cantidad * i.plato.precio, 0)
  const cantidadTotal = carrito.reduce((s, i) => s + i.cantidad, 0)

  function agregar(plato: Plato) {
    setCarrito(prev => {
      const ex = prev.find(i => i.plato.id === plato.id)
      if (ex) return prev.map(i => i.plato.id === plato.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { plato, cantidad: 1, notas: '' }]
    })
  }
  function cambiarCantidad(id: string, delta: number) {
    setCarrito(prev => prev.map(i => i.plato.id === id ? { ...i, cantidad: Math.max(0, i.cantidad + delta) } : i).filter(i => i.cantidad > 0))
  }

  function cantidadEnCarrito(id: string) {
    return carrito.find(i => i.plato.id === id)?.cantidad ?? 0
  }

  function irAlCarrito() {
    if (carrito.length === 0) { toast.error('Agrega algo al carrito primero'); return }
    const puedeOrdenar = planGte(negocio?.plan || 'starter', 'basico') && (qrConsumo || qrDomi)
    if (!puedeOrdenar) { toast.error('Los pedidos online no están habilitados en este restaurante'); return }
    if (qrConsumo && qrDomi) {
      setPaso('tipo')
    } else {
      setTipoConsumo(qrConsumo ? 'consumo' : 'domi')
      setPaso('datos')
    }
    setTab('menu')
  }

  // ── Enviar pedido ──────────────────────────────────────────────────────
  async function enviarPedido() {
    if (!nombre.trim() || !telefono.trim()) { toast.error('Completa nombre y teléfono'); return }
    if (tipoConsumo === 'consumo' && !mesa.trim()) { toast.error('Indica tu número de mesa'); return }
    if (tipoConsumo === 'domi' && !direccion.trim()) { toast.error('Indica tu dirección'); return }
    setEnviando(true)

    const { data: turno } = await supabase.from('turnos').select('id').is('cerrado_en', null)
      .order('abierto_en', { ascending: false }).limit(1).single()
    if (!turno) {
      toast.error('El restaurante no está recibiendo pedidos en este momento')
      setEnviando(false); return
    }

    // Buscar mesa si es consumo en lugar
    let mesaId: number | null = null
    if (tipoConsumo === 'consumo' && mesa.trim()) {
      const { data: mesaData } = await supabase.from('mesas').select('id').eq('numero', parseInt(mesa)).single()
      mesaId = mesaData?.id ?? null
    }

    // Crear o encontrar cliente
    let clienteId: string | null = null
    if (cedula.trim()) {
      const { data: clData } = await supabase.from('clientes').select('id').eq('cedula', cedula.trim()).single()
      if (clData) {
        clienteId = clData.id
      } else {
        const { data: nuevo } = await supabase.from('clientes').insert({
          cedula: cedula.trim(), nombre: nombre.trim(), telefono: telefono.trim(),
        }).select('id').single()
        clienteId = nuevo?.id ?? null
      }
    }

    const { data: pedido, error } = await supabase.from('pedidos').insert({
      mesa_id:          mesaId,
      cliente_id:       clienteId,
      cliente_nombre:   nombre.trim(),
      cliente_cedula:   cedula.trim() || null,
      cliente_telefono: telefono.trim(),
      cliente_direccion: tipoConsumo === 'domi' ? direccion.trim() : null,
      turno_id:         turno.id,
      tipo:             tipoConsumo === 'domi' ? 'domi' : 'cliente_qr',
      notas:            notasPedido.trim() || null,
    }).select().single()

    if (error || !pedido) {
      toast.error('Error al enviar el pedido. Intenta de nuevo.')
      setEnviando(false); return
    }

    await supabase.from('items_pedido').insert(
      carrito.map(i => ({
        pedido_id: pedido.id, plato_id: i.plato.id,
        cantidad: i.cantidad, precio_unitario: i.plato.precio,
        notas: i.notas || null,
      }))
    )

    if (mesaId) await supabase.from('mesas').update({ estado: 'ocupada' }).eq('id', mesaId)

    // Cargar items para seguimiento
    const { data: items } = await supabase.from('items_pedido')
      .select('id, cantidad, estado, plato:platos(nombre)').eq('pedido_id', pedido.id)
    if (items) {
      setItemsSeguimiento(items.map(i => ({
        id: i.id, nombre: (i.plato as unknown as { nombre: string })?.nombre || '',
        cantidad: i.cantidad, estado: i.estado,
      })))
    }

    setPedidoId(pedido.id)
    setPaso('seguimiento')
    setCarrito([])
    setEnviando(false)
    toast.success('✅ ¡Pedido enviado a cocina!')
  }

  // ── Reseña ─────────────────────────────────────────────────────────────
  async function enviarResena() {
    if (!formResena.nombre.trim() || !formResena.comentario.trim()) {
      toast.error('Completa tu nombre y comentario'); return
    }
    setEnviandoResena(true)
    const { error } = await supabase.from('resenas').insert({
      negocio_id: negocioId,
      nombre: formResena.nombre.trim(),
      puntuacion: formResena.puntuacion,
      comentario: formResena.comentario.trim(),
    })
    if (!error) {
      toast.success('¡Gracias por tu reseña!')
      setFormResena({ nombre: '', puntuacion: 5, comentario: '' })
      cargar()
    } else {
      toast.error('Error al enviar la reseña')
    }
    setEnviandoResena(false)
  }

  // ── PQRS ───────────────────────────────────────────────────────────────
  async function enviarPqrs() {
    if (!formPqrs.nombre.trim() || !formPqrs.mensaje.trim()) {
      toast.error('Completa nombre y mensaje'); return
    }
    setEnviandoPqrs(true)
    const { error } = await supabase.from('pqrs').insert({
      negocio_id: negocioId,
      nombre: formPqrs.nombre.trim(),
      telefono: formPqrs.telefono.trim() || null,
      tipo: formPqrs.tipo,
      mensaje: formPqrs.mensaje.trim(),
    })
    if (!error) {
      setPqrsEnviado(true)
    } else {
      toast.error('Error al enviar. Intenta de nuevo.')
    }
    setEnviandoPqrs(false)
  }

  // ── Reserva ────────────────────────────────────────────────────────────
  async function enviarReserva() {
    if (!formReserva.nombre.trim() || !formReserva.telefono.trim() || !formReserva.fecha || !formReserva.hora) {
      toast.error('Completa todos los campos requeridos'); return
    }
    if (new Date(formReserva.fecha) < new Date(new Date().toDateString())) {
      toast.error('La fecha no puede ser en el pasado'); return
    }
    setEnviandoReserva(true)
    const { error } = await supabase.from('reservas').insert({
      negocio_id: negocioId,
      nombre: formReserva.nombre.trim(),
      telefono: formReserva.telefono.trim(),
      fecha: formReserva.fecha,
      hora: formReserva.hora,
      personas: formReserva.personas,
      notas: formReserva.notas.trim() || null,
      estado: 'pendiente',
    })
    if (!error) {
      setReservaEnviada(true)
    } else {
      toast.error('Error al enviar la reserva. Intenta de nuevo.')
    }
    setEnviandoReserva(false)
  }

  // ── Estado de carga / error ────────────────────────────────────────────
  if (cargando) return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
          <UtensilsCrossed size={32} className="text-orange-500 animate-pulse" />
        </div>
        <p className="text-gray-500 text-sm">Cargando…</p>
      </div>
    </div>
  )

  if (noEncontrado) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4 px-6">
        <AlertTriangle size={48} className="text-gray-400 mx-auto" />
        <p className="font-bold text-gray-700 text-xl">Restaurante no encontrado</p>
        <p className="text-gray-400 text-sm">El enlace puede ser incorrecto o el restaurante ya no está disponible.</p>
      </div>
    </div>
  )

  const puedeOrdenar = planGte(negocio?.plan || 'starter', 'basico') && (qrConsumo || qrDomi)
  const puedeReservar = planGte(negocio?.plan || 'starter', 'basico')
  const promedioResenas = resenas.length > 0 ? resenas.reduce((s, r) => s + r.puntuacion, 0) / resenas.length : 0

  const ESTADO_CONFIG: Record<string, { label: string; dot: string; texto: string }> = {
    pendiente:      { label: 'En espera',   dot: 'bg-gray-300',                 texto: 'text-gray-400'   },
    en_preparacion: { label: 'Preparando…', dot: 'bg-orange-400 animate-pulse', texto: 'text-orange-600' },
    listo:          { label: '¡Listo!',     dot: 'bg-green-500',                texto: 'text-green-600'  },
    entregado:      { label: 'Entregado',   dot: 'bg-green-300',                texto: 'text-gray-400'   },
  }

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <div className="bg-white border-b px-4 pt-safe-top sticky top-0 z-30">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between py-3">
            <div>
              <h1 className="font-black text-gray-900 text-lg leading-tight">{negocio?.nombre}</h1>
              {resenas.length > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-amber-400 text-sm">★</span>
                  <span className="text-sm font-bold text-gray-700">{promedioResenas.toFixed(1)}</span>
                  <span className="text-xs text-gray-400">({resenas.length} reseñas)</span>
                </div>
              )}
            </div>
            {puedeOrdenar && cantidadTotal > 0 && paso === 'carrito' && (
              <button onClick={irAlCarrito}
                className="relative bg-orange-500 text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm text-sm">
                <ShoppingCart size={16} />
                Ver carrito
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black">
                  {cantidadTotal}
                </span>
              </button>
            )}
          </div>

          {/* Tabs */}
          {paso === 'carrito' && (
            <div className="flex border-b border-gray-100 -mb-px">
              {([
                { id: 'menu' as Tab, label: '🍽️ Menú' },
                { id: 'resenas' as Tab, label: '⭐ Reseñas' },
                { id: 'pqrs' as Tab, label: '📋 PQRS' },
                ...(puedeReservar ? [{ id: 'reservas' as Tab, label: '📅 Reservas' }] : []),
              ]).map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-3 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                    tab === t.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto">

        {/* ══ MENÚ ══════════════════════════════════════════════════════ */}
        {tab === 'menu' && paso === 'carrito' && (
          <>
            {/* Categorías */}
            <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b bg-white">
              {categorias.map(c => (
                <button key={c.id} onClick={() => setCategoriaActiva(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    categoriaActiva === c.id ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {c.nombre}
                </button>
              ))}
            </div>

            {/* Platos */}
            <div className="p-4 space-y-3">
              {platos.filter(p => p.categoria_id === categoriaActiva).map(plato => {
                const cant = cantidadEnCarrito(plato.id)
                return (
                  <div key={plato.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
                    {plato.imagen_url ? (
                      <img src={plato.imagen_url} alt={plato.nombre}
                        className="w-16 h-16 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                        <UtensilsCrossed size={24} className="text-orange-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{plato.nombre}</p>
                      {plato.descripcion && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{plato.descripcion}</p>
                      )}
                      <p className="text-orange-600 font-black text-sm mt-1">
                        ${plato.precio.toLocaleString('es-CO')}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {puedeOrdenar ? (
                        cant > 0 ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => cambiarCantidad(plato.id, -1)}
                              className="w-7 h-7 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-black">
                              <Minus size={14} />
                            </button>
                            <span className="w-5 text-center font-black text-gray-900">{cant}</span>
                            <button onClick={() => agregar(plato)}
                              className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center">
                              <Plus size={14} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => agregar(plato)}
                            className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-orange-600 transition-colors">
                            <Plus size={16} />
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Solo vista</span>
                      )}
                    </div>
                  </div>
                )
              })}

              {platos.filter(p => p.categoria_id === categoriaActiva).length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <UtensilsCrossed size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Sin platos en esta categoría</p>
                </div>
              )}
            </div>

            {/* Banner pedido no habilitado */}
            {!puedeOrdenar && (
              <div className="mx-4 mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 leading-relaxed">
                  Los pedidos online no están habilitados en este restaurante actualmente. Acércate al mostrador para ordenar.
                </p>
              </div>
            )}

            {/* Botón flotante de carrito */}
            {puedeOrdenar && cantidadTotal > 0 && (
              <div className="sticky bottom-4 px-4 pb-4">
                <button onClick={irAlCarrito}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl flex items-center justify-between px-5 shadow-lg shadow-orange-200 transition-colors">
                  <span className="bg-orange-400 text-white text-xs font-black px-2 py-0.5 rounded-full">{cantidadTotal}</span>
                  <span>Ver carrito ({cantidadTotal} ítem{cantidadTotal !== 1 ? 's' : ''})</span>
                  <span className="font-black">${totalCarrito.toLocaleString('es-CO')}</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* ══ CARRITO ════════════════════════════════════════════════════ */}
        {tab === 'menu' && paso === 'carrito' && cantidadTotal > 0 && false && null}

        {/* ══ PASO TIPO CONSUMO ══════════════════════════════════════════ */}
        {paso === 'tipo' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3 mb-6 mt-2">
              <button onClick={() => setPaso('carrito')} className="p-2 rounded-xl bg-white border border-gray-200">
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
              <h2 className="font-black text-gray-900 text-xl">¿Cómo deseas tu pedido?</h2>
            </div>

            {qrConsumo && (
              <button onClick={() => { setTipoConsumo('consumo'); setPaso('datos') }}
                className="w-full bg-white border-2 border-gray-200 hover:border-orange-400 rounded-2xl p-5 flex items-center gap-4 transition-all text-left group">
                <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-orange-200 transition-colors">
                  <UtensilsCrossed size={26} className="text-orange-500" />
                </div>
                <div className="flex-1">
                  <p className="font-black text-gray-900 text-lg">Consumir aquí</p>
                  <p className="text-sm text-gray-400">En el restaurante, en tu mesa</p>
                </div>
                <ArrowRight size={20} className="text-gray-300 group-hover:text-orange-500 transition-colors" />
              </button>
            )}

            {qrDomi && (
              <button onClick={() => { setTipoConsumo('domi'); setPaso('datos') }}
                className="w-full bg-white border-2 border-gray-200 hover:border-orange-400 rounded-2xl p-5 flex items-center gap-4 transition-all text-left group">
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                  <Bike size={26} className="text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="font-black text-gray-900 text-lg">Domicilio</p>
                  <p className="text-sm text-gray-400">Te lo llevamos a tu dirección</p>
                </div>
                <ArrowRight size={20} className="text-gray-300 group-hover:text-orange-500 transition-colors" />
              </button>
            )}
          </div>
        )}

        {/* ══ PASO DATOS ════════════════════════════════════════════════ */}
        {paso === 'datos' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3 mb-4 mt-2">
              <button onClick={() => setPaso(qrConsumo && qrDomi ? 'tipo' : 'carrito')} className="p-2 rounded-xl bg-white border border-gray-200">
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
              <div>
                <h2 className="font-black text-gray-900 text-xl">Tus datos</h2>
                <p className="text-xs text-gray-400">
                  {tipoConsumo === 'consumo' ? '🍽️ Consumir en el restaurante' : '🛵 Domicilio'}
                </p>
              </div>
            </div>

            {/* Resumen del carrito */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Tu pedido</p>
              {carrito.map(i => (
                <div key={i.plato.id} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">{i.cantidad}× {i.plato.nombre}</span>
                  <span className="text-sm font-bold text-gray-900">${(i.cantidad * i.plato.precio).toLocaleString('es-CO')}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between items-center">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-black text-orange-600 text-lg">${totalCarrito.toLocaleString('es-CO')}</span>
              </div>
            </div>

            {/* Formulario */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <input placeholder="Nombre *" value={nombre} onChange={e => setNombre(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              <input placeholder="Teléfono *" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              <input placeholder="Cédula (opcional — para puntos de fidelidad)" value={cedula} onChange={e => setCedula(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              {tipoConsumo === 'consumo' && (
                <input placeholder="Número de mesa *" type="number" value={mesa} onChange={e => setMesa(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              )}
              {tipoConsumo === 'domi' && (
                <input placeholder="Dirección de entrega *" value={direccion} onChange={e => setDireccion(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              )}
              <textarea placeholder="Notas adicionales (alergias, instrucciones…)" value={notasPedido}
                onChange={e => setNotasPedido(e.target.value)} rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none" />
            </div>

            <button onClick={enviarPedido} disabled={enviando}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-100 transition-colors">
              {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {enviando ? 'Enviando…' : 'Confirmar pedido'}
            </button>
          </div>
        )}

        {/* ══ SEGUIMIENTO ═══════════════════════════════════════════════ */}
        {paso === 'seguimiento' && (
          <div className="p-4 space-y-4">
            <div className="bg-gradient-to-b from-green-500 to-green-600 rounded-3xl p-6 text-center text-white">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle size={28} />
              </div>
              <p className="font-black text-xl mb-1">¡Pedido enviado!</p>
              <p className="text-white/80 text-sm">
                {tipoConsumo === 'domi' ? '🛵 Domicilio en camino' : '🍽️ Sigue el estado de tu pedido abajo'}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Estado de tu pedido</p>
              {itemsSeguimiento.map(item => {
                const cfg = ESTADO_CONFIG[item.estado] ?? ESTADO_CONFIG['pendiente']
                return (
                  <div key={item.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm">
                    <p className="text-sm font-semibold text-gray-800">{item.cantidad}× {item.nombre}</p>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className={`text-xs font-bold ${cfg.texto}`}>{cfg.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <button onClick={() => { setPaso('carrito'); setCarrito([]); setNombre(''); setTelefono(''); setCedula(''); setMesa(''); setDireccion(''); setNotasPedido(''); setPedidoId(null); setItemsSeguimiento([]); setTipoConsumo(null) }}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-2xl text-sm transition-colors">
              Hacer otro pedido →
            </button>
          </div>
        )}

        {/* ══ RESEÑAS ═══════════════════════════════════════════════════ */}
        {tab === 'resenas' && paso === 'carrito' && (
          <div className="p-4 space-y-4">
            {/* Formulario nueva reseña */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
              <h3 className="font-bold text-gray-900">Deja tu reseña</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Tu calificación:</span>
                <Estrellas valor={formResena.puntuacion} onChange={n => setFormResena(p => ({ ...p, puntuacion: n }))} />
              </div>
              <input placeholder="Tu nombre" value={formResena.nombre} onChange={e => setFormResena(p => ({ ...p, nombre: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              <textarea placeholder="Cuéntanos tu experiencia…" value={formResena.comentario}
                onChange={e => setFormResena(p => ({ ...p, comentario: e.target.value }))} rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none" />
              <button onClick={enviarResena} disabled={enviandoResena}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                {enviandoResena ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
                Publicar reseña
              </button>
            </div>

            {/* Lista de reseñas */}
            {resenas.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Star size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Sé el primero en dejar una reseña</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                  {resenas.length} reseña{resenas.length !== 1 ? 's' : ''} · ★ {promedioResenas.toFixed(1)}
                </p>
                {resenas.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-gray-900 text-sm">{r.nombre}</p>
                      <Estrellas valor={r.puntuacion} />
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{r.comentario}</p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(r.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ PQRS ═══════════════════════════════════════════════════════ */}
        {tab === 'pqrs' && paso === 'carrito' && (
          <div className="p-4">
            {pqrsEnviado ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle size={32} className="text-green-500" />
                </div>
                <p className="font-black text-gray-900 text-xl mb-2">¡Mensaje enviado!</p>
                <p className="text-gray-400 text-sm mb-6">El restaurante revisará tu solicitud y se pondrá en contacto.</p>
                <button onClick={() => { setPqrsEnviado(false); setFormPqrs({ nombre: '', telefono: '', tipo: 'peticion', mensaje: '' }) }}
                  className="bg-orange-500 text-white font-bold px-6 py-3 rounded-xl text-sm">
                  Enviar otra solicitud
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                  <h3 className="font-bold text-gray-900">Peticiones, Quejas, Reclamos y Sugerencias</h3>
                  <p className="text-sm text-gray-400">Tu opinión es importante para nosotros. Completa el formulario y nos comunicaremos contigo.</p>

                  <div className="grid grid-cols-2 gap-2">
                    {(['peticion', 'queja', 'reclamo', 'sugerencia'] as const).map(t => (
                      <button key={t} onClick={() => setFormPqrs(p => ({ ...p, tipo: t }))}
                        className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all capitalize ${
                          formPqrs.tipo === t ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                        }`}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>

                  <input placeholder="Tu nombre *" value={formPqrs.nombre} onChange={e => setFormPqrs(p => ({ ...p, nombre: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                  <input placeholder="Teléfono (opcional)" type="tel" value={formPqrs.telefono} onChange={e => setFormPqrs(p => ({ ...p, telefono: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                  <textarea placeholder="Describe tu solicitud *" value={formPqrs.mensaje} onChange={e => setFormPqrs(p => ({ ...p, mensaje: e.target.value }))} rows={4}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none" />

                  <button onClick={enviarPqrs} disabled={enviandoPqrs}
                    className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                    {enviandoPqrs ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
                    Enviar solicitud
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ RESERVAS ══════════════════════════════════════════════════ */}
        {tab === 'reservas' && paso === 'carrito' && (
          <div className="p-4">
            {!puedeReservar ? (
              <div className="text-center py-20">
                <CalendarDays size={40} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Las reservas no están disponibles en este restaurante.</p>
              </div>
            ) : reservaEnviada ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CalendarDays size={32} className="text-green-500" />
                </div>
                <p className="font-black text-gray-900 text-xl mb-2">¡Reserva solicitada!</p>
                <p className="text-gray-400 text-sm mb-6">El restaurante confirmará tu reserva por teléfono. Verifica tu número.</p>
                <button onClick={() => { setReservaEnviada(false); setFormReserva({ nombre: '', telefono: '', fecha: '', hora: '12:00', personas: 2, notas: '' }) }}
                  className="bg-orange-500 text-white font-bold px-6 py-3 rounded-xl text-sm">
                  Hacer otra reserva
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                  <h3 className="font-bold text-gray-900">Reservar mesa</h3>
                  <p className="text-sm text-gray-400">Completa el formulario y te confirmaremos por teléfono.</p>

                  <input placeholder="Tu nombre *" value={formReserva.nombre} onChange={e => setFormReserva(p => ({ ...p, nombre: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                  <input placeholder="Teléfono *" type="tel" value={formReserva.telefono} onChange={e => setFormReserva(p => ({ ...p, telefono: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-400 mb-1 block">Fecha *</label>
                      <input type="date" value={formReserva.fecha}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setFormReserva(p => ({ ...p, fecha: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 mb-1 block">Hora *</label>
                      <input type="time" value={formReserva.hora} onChange={e => setFormReserva(p => ({ ...p, hora: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-2 block">Número de personas</label>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setFormReserva(p => ({ ...p, personas: Math.max(1, p.personas - 1) }))}
                        className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center font-black text-gray-600 hover:bg-gray-200 transition-colors">
                        <Minus size={16} />
                      </button>
                      <span className="text-2xl font-black text-gray-900 w-10 text-center">{formReserva.personas}</span>
                      <button type="button" onClick={() => setFormReserva(p => ({ ...p, personas: Math.min(20, p.personas + 1) }))}
                        className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white hover:bg-orange-600 transition-colors">
                        <Plus size={16} />
                      </button>
                      <span className="text-sm text-gray-400">persona{formReserva.personas !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  <textarea placeholder="Notas especiales (cumpleaños, alergias, decoración…)" value={formReserva.notas}
                    onChange={e => setFormReserva(p => ({ ...p, notas: e.target.value }))} rows={2}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none" />

                  <button onClick={enviarReserva} disabled={enviandoReserva}
                    className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors">
                    {enviandoReserva ? <Loader2 size={16} className="animate-spin" /> : <CalendarDays size={16} />}
                    Solicitar reserva
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  )
}
