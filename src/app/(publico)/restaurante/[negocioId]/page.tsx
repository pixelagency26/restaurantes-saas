'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { use } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ShoppingCart, Plus, Minus, ChevronLeft, Star,
  CalendarDays, CheckCircle, MessageSquare,
  Bike, UtensilsCrossed, AlertTriangle, ArrowRight,
  Loader2, Send, ChevronRight
} from 'lucide-react'

// ─── TIPOS ─────────────────────────────────────────────────────────────────
interface Negocio { id: string; nombre: string; plan: string }
interface Categoria { id: number; nombre: string; orden: number }
interface Plato {
  id: string; nombre: string; descripcion: string | null
  precio: number; imagen_url: string | null; activo: boolean; categoria_id: number
}
interface ItemCarrito { plato: Plato; cantidad: number; notas: string }
interface Resena { id: string; nombre: string; puntuacion: number; comentario: string; created_at: string }

type Vista = 'home' | 'menu' | 'resenas' | 'pqrs' | 'reservas'
type TipoConsumo = 'consumo' | 'domi' | null
type PasoOrden = 'browse' | 'tipo' | 'datos' | 'seguimiento'

const PLAN_NIVEL: Record<string, number> = { starter: 0, basico: 1, pro: 2 }
function planGte(plan: string, req: string) {
  return (PLAN_NIVEL[plan] ?? 0) >= (PLAN_NIVEL[req] ?? 0)
}

// ─── ESTRELLAS ─────────────────────────────────────────────────────────────
function Estrellas({ valor, onChange, size = 'md' }: { valor: number; onChange?: (n: number) => void; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-3xl' : 'text-xl'
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(n)}
          className={`${sz} transition-transform ${onChange ? 'hover:scale-110 cursor-pointer' : 'cursor-default'} ${n <= valor ? 'text-amber-400' : 'text-gray-200'}`}>
          ★
        </button>
      ))}
    </div>
  )
}

// ─── COMPONENTE INNER ───────────────────────────────────────────────────────
function RestaurantePublicoInner({ params }: { params: Promise<{ negocioId: string }> }) {
  const { negocioId } = use(params)
  const searchParams = useSearchParams()
  const supabase = createClient()

  // ── Estado global ────────────────────────────────────────────
  const [negocio, setNegocio]       = useState<Negocio | null>(null)
  const [cargando, setCargando]     = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [vista, setVista]           = useState<Vista>('home')

  // Config
  const [qrConsumo, setQrConsumo]   = useState(false)
  const [qrDomi, setQrDomi]         = useState(false)
  const [socialWa, setSocialWa]     = useState('')

  // Sugerido del mes
  const [sugeridoPopup, setSugeridoPopup] = useState(false)
  const [sugeridoNombre, setSugeridoNombre] = useState('')
  const [sugeridoPrecio, setSugeridoPrecio] = useState('')
  const [sugeridoDescripcion, setSugeridoDescripcion] = useState('')
  const [sugeridoImagenUrl, setSugeridoImagenUrl] = useState('')

  // Menú
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [platos, setPlatos]         = useState<Plato[]>([])
  const [catActiva, setCatActiva]   = useState<number | null>(null)
  const [carrito, setCarrito]       = useState<ItemCarrito[]>([])
  const [pasoOrden, setPasoOrden]   = useState<PasoOrden>('browse')
  const [tipoConsumo, setTipoConsumo] = useState<TipoConsumo>(null)

  // Datos cliente
  const [nombre, setNombre]         = useState('')
  const [telefono, setTelefono]     = useState('')
  const [cedula, setCedula]         = useState('')
  const [mesa, setMesa]             = useState(() => searchParams.get('mesa') ?? '')
  const [direccion, setDireccion]   = useState('')
  const [notasPedido, setNotasPedido] = useState('')
  const [enviando, setEnviando]     = useState(false)
  const [pedidoId, setPedidoId]     = useState<string | null>(null)
  const [itemsSeg, setItemsSeg]     = useState<{ id: string; nombre: string; cantidad: number; estado: string }[]>([])

  // Reseñas
  const [resenas, setResenas]       = useState<Resena[]>([])
  const [formResena, setFormResena] = useState({ nombre: '', puntuacion: 5, comentario: '' })
  const [enviandoResena, setEnviandoResena] = useState(false)

  // PQRS
  const [formPqrs, setFormPqrs]     = useState({ nombre: '', telefono: '', tipo: 'peticion', mensaje: '' })
  const [enviandoPqrs, setEnviandoPqrs] = useState(false)
  const [pqrsOk, setPqrsOk]         = useState(false)

  // Reservas
  const [formRes, setFormRes]       = useState({ nombre: '', telefono: '', fecha: '', hora: '12:00', personas: 2, notas: '' })
  const [enviandoRes, setEnviandoRes] = useState(false)
  const [resOk, setResOk]           = useState(false)

  // ── Carga ────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: neg }, { data: cats }, { data: pls }, { data: cfg }, { data: res }] = await Promise.all([
      supabase.from('negocios').select('id, nombre, plan').eq('id', negocioId).single(),
      supabase.from('categorias').select('*').eq('negocio_id', negocioId).order('orden'),
      supabase.from('platos').select('*').eq('negocio_id', negocioId).eq('activo', true),
      supabase.from('configuracion').select('clave, valor')
        .eq('negocio_id', negocioId)
        .in('clave', ['qr_consumo_activo', 'qr_domi_activo', 'social_whatsapp',
                      'sugerido_activo', 'sugerido_nombre', 'sugerido_precio', 'sugerido_descripcion', 'sugerido_imagen_url']),
      supabase.from('resenas').select('*').eq('negocio_id', negocioId)
        .order('created_at', { ascending: false }),
    ])
    if (!neg) { setNoEncontrado(true); setCargando(false); return }
    setNegocio(neg as Negocio)
    if (cats) { setCategorias(cats as Categoria[]); if (cats[0]) setCatActiva(cats[0].id) }
    if (pls) setPlatos(pls as Plato[])
    if (cfg) {
      const m: Record<string, string> = {}
      cfg.forEach((r: { clave: string; valor: string }) => { m[r.clave] = r.valor })
      setQrConsumo(m['qr_consumo_activo'] === 'true')
      setQrDomi(m['qr_domi_activo'] === 'true')
      if (m['social_whatsapp']) setSocialWa(m['social_whatsapp'])
      if (m['sugerido_activo'] === 'true' && m['sugerido_nombre']) {
        setSugeridoNombre(m['sugerido_nombre'] || '')
        setSugeridoPrecio(m['sugerido_precio'] || '')
        setSugeridoDescripcion(m['sugerido_descripcion'] || '')
        setSugeridoImagenUrl(m['sugerido_imagen_url'] || '')
        setSugeridoPopup(true)
      }
    }
    if (res) setResenas(res as Resena[])
    setCargando(false)
  }, [supabase, negocioId])

  useEffect(() => { cargar() }, [cargar])

  // Realtime seguimiento
  useEffect(() => {
    if (!pedidoId) return
    const canal = supabase.channel(`pub-seg-${pedidoId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items_pedido', filter: `pedido_id=eq.${pedidoId}` },
        (payload) => {
          const n = payload.new as { id: string; estado: string }
          setItemsSeg(prev => prev.map(i => i.id === n.id ? { ...i, estado: n.estado } : i))
        })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [pedidoId, supabase])

  // ── Helpers carrito ──────────────────────────────────────────
  const totalCarrito  = carrito.reduce((s, i) => s + i.cantidad * i.plato.precio, 0)
  const cantTotal     = carrito.reduce((s, i) => s + i.cantidad, 0)
  const cantPlato     = (id: string) => carrito.find(i => i.plato.id === id)?.cantidad ?? 0

  function agregar(plato: Plato) {
    setCarrito(prev => {
      const ex = prev.find(i => i.plato.id === plato.id)
      if (ex) return prev.map(i => i.plato.id === plato.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { plato, cantidad: 1, notas: '' }]
    })
  }
  function cambiarCant(id: string, delta: number) {
    setCarrito(prev => prev.map(i => i.plato.id === id ? { ...i, cantidad: Math.max(0, i.cantidad + delta) } : i).filter(i => i.cantidad > 0))
  }

  const puedeOrdenar = planGte(negocio?.plan || 'starter', 'basico') && (qrConsumo || qrDomi)
  const puedeReservar = planGte(negocio?.plan || 'starter', 'basico')
  const promedioResenas = resenas.length > 0 ? resenas.reduce((s, r) => s + r.puntuacion, 0) / resenas.length : 0

  // ── Ir al checkout ───────────────────────────────────────────
  function irACheckout() {
    if (carrito.length === 0) { toast.error('Agrega algo primero'); return }
    if (mesa && qrConsumo) { setTipoConsumo('consumo'); setPasoOrden('datos'); return }
    if (qrConsumo && qrDomi) { setPasoOrden('tipo'); return }
    setTipoConsumo(qrConsumo ? 'consumo' : 'domi')
    setPasoOrden('datos')
  }

  // ── Enviar pedido ────────────────────────────────────────────
  async function enviarPedido() {
    if (!nombre.trim() || !telefono.trim()) { toast.error('Completa nombre y teléfono'); return }
    if (tipoConsumo === 'consumo' && !mesa.trim()) { toast.error('Indica tu número de mesa'); return }
    if (tipoConsumo === 'domi' && !direccion.trim()) { toast.error('Indica tu dirección'); return }
    setEnviando(true)
    const { data: turno } = await supabase.from('turnos').select('id').eq('negocio_id', negocioId).is('cerrado_en', null)
      .order('abierto_en', { ascending: false }).limit(1).single()
    if (!turno) { toast.error('El restaurante no está recibiendo pedidos ahora'); setEnviando(false); return }
    let mesaId: number | null = null
    if (tipoConsumo === 'consumo' && mesa.trim()) {
      const { data: md } = await supabase.from('mesas').select('id').eq('negocio_id', negocioId).eq('numero', parseInt(mesa)).single()
      mesaId = md?.id ?? null
    }
    let clienteId: string | null = null
    if (cedula.trim()) {
      const { data: cl } = await supabase.from('clientes').select('id').eq('cedula', cedula.trim()).single()
      if (cl) { clienteId = cl.id }
      else {
        const { data: nc } = await supabase.from('clientes').insert({ cedula: cedula.trim(), nombre: nombre.trim(), telefono: telefono.trim() }).select('id').single()
        clienteId = nc?.id ?? null
      }
    }
    const { data: pedido, error } = await supabase.from('pedidos').insert({
      mesa_id: mesaId, cliente_id: clienteId,
      cliente_nombre: nombre.trim(), cliente_cedula: cedula.trim() || null,
      cliente_telefono: telefono.trim(),
      cliente_direccion: tipoConsumo === 'domi' ? direccion.trim() : null,
      turno_id: turno.id, tipo: tipoConsumo === 'domi' ? 'domi' : 'cliente_qr',
      notas: notasPedido.trim() || null,
    }).select().single()
    if (error || !pedido) { toast.error('Error al enviar. Intenta de nuevo.'); setEnviando(false); return }
    await supabase.from('items_pedido').insert(
      carrito.map(i => ({ pedido_id: pedido.id, plato_id: i.plato.id, cantidad: i.cantidad, precio_unitario: i.plato.precio, notas: i.notas || null }))
    )
    if (mesaId) await supabase.from('mesas').update({ estado: 'ocupada' }).eq('id', mesaId)
    const { data: items } = await supabase.from('items_pedido').select('id, cantidad, estado, plato:platos(nombre)').eq('pedido_id', pedido.id)
    if (items) setItemsSeg(items.map(i => ({ id: i.id, nombre: (i.plato as { nombre: string })?.nombre || '', cantidad: i.cantidad, estado: i.estado })))
    setPedidoId(pedido.id); setPasoOrden('seguimiento'); setCarrito([])
    setEnviando(false); toast.success('✅ ¡Pedido enviado a cocina!')
  }

  async function enviarResena() {
    if (!formResena.nombre.trim() || !formResena.comentario.trim()) { toast.error('Completa nombre y comentario'); return }
    setEnviandoResena(true)
    const { error } = await supabase.from('resenas').insert({ negocio_id: negocioId, nombre: formResena.nombre.trim(), puntuacion: formResena.puntuacion, comentario: formResena.comentario.trim() })
    if (!error) { toast.success('¡Gracias por tu reseña!'); setFormResena({ nombre: '', puntuacion: 5, comentario: '' }); cargar() }
    else toast.error('Error al enviar')
    setEnviandoResena(false)
  }

  async function enviarPqrs() {
    if (!formPqrs.nombre.trim() || !formPqrs.mensaje.trim()) { toast.error('Completa nombre y mensaje'); return }
    setEnviandoPqrs(true)
    const { error } = await supabase.from('pqrs').insert({ negocio_id: negocioId, nombre: formPqrs.nombre.trim(), telefono: formPqrs.telefono.trim() || null, tipo: formPqrs.tipo, mensaje: formPqrs.mensaje.trim() })
    if (!error) setPqrsOk(true)
    else toast.error('Error al enviar')
    setEnviandoPqrs(false)
  }

  async function enviarReserva() {
    if (!formRes.nombre.trim() || !formRes.telefono.trim() || !formRes.fecha || !formRes.hora) { toast.error('Completa todos los campos'); return }
    setEnviandoRes(true)
    const { error } = await supabase.from('reservas').insert({ negocio_id: negocioId, nombre: formRes.nombre.trim(), telefono: formRes.telefono.trim(), fecha: formRes.fecha, hora: formRes.hora, personas: formRes.personas, notas: formRes.notas.trim() || null, estado: 'pendiente' })
    if (!error) setResOk(true)
    else toast.error('Error al enviar')
    setEnviandoRes(false)
  }

  // ── ESTADOS DE CARGA ─────────────────────────────────────────
  if (cargando) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mx-auto">
          <UtensilsCrossed size={32} className="text-orange-400 animate-pulse" />
        </div>
        <p className="text-gray-500 text-sm">Cargando…</p>
      </div>
    </div>
  )

  if (noEncontrado) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center space-y-4 px-6">
        <AlertTriangle size={48} className="text-gray-600 mx-auto" />
        <p className="font-bold text-gray-300 text-xl">Restaurante no encontrado</p>
        <p className="text-gray-500 text-sm">El enlace puede ser incorrecto.</p>
      </div>
    </div>
  )

  const ESTADO_CFG: Record<string, { label: string; dot: string; texto: string }> = {
    pendiente:      { label: 'En espera',   dot: 'bg-gray-400',                 texto: 'text-gray-400'   },
    en_preparacion: { label: 'Preparando…', dot: 'bg-orange-400 animate-pulse', texto: 'text-orange-400' },
    listo:          { label: '¡Listo! ✓',   dot: 'bg-green-400',                texto: 'text-green-400'  },
    entregado:      { label: 'Entregado',   dot: 'bg-green-300',                texto: 'text-gray-400'   },
  }

  // ═══════════════════════════════════════════════════════════════
  // ── VISTA: HOME ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════
  if (vista === 'home') return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* ── POPUP SUGERIDO DEL MES ───────────────────────────── */}
      {sugeridoPopup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-5" onClick={() => setSugeridoPopup(false)}>
          <div className="bg-white rounded-3xl overflow-hidden max-w-xs w-full shadow-2xl shadow-black/50 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            {/* Imagen / emoji */}
            {sugeridoImagenUrl ? (
              <img src={sugeridoImagenUrl} alt={sugeridoNombre} className="w-full h-40 object-cover" />
            ) : (
              <div className="h-36 bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-6xl">
                🍽️
              </div>
            )}
            <div className="p-5 text-center space-y-2">
              <span className="inline-block bg-orange-100 text-orange-600 text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wide">
                ⭐ Sugerido del mes
              </span>
              <h3 className="font-black text-gray-900 text-xl leading-tight">{sugeridoNombre}</h3>
              {sugeridoDescripcion && (
                <p className="text-gray-500 text-sm leading-relaxed">{sugeridoDescripcion}</p>
              )}
              {sugeridoPrecio && (
                <p className="text-orange-600 font-black text-2xl">
                  ${parseFloat(sugeridoPrecio).toLocaleString('es-CO')}
                </p>
              )}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => { setSugeridoPopup(false); setVista('menu') }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-2xl text-sm transition-colors">
                  Ver en el menú →
                </button>
                <button
                  onClick={() => setSugeridoPopup(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors">
                  Ver el menú completo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Fondo degradado */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500" />
        {/* Patrón decorativo */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Círculo decorativo */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-white/10 rounded-full" />

        <div className="relative px-6 pt-16 pb-12 text-center">
          {/* Avatar restaurante */}
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-5 border-2 border-white/30 shadow-2xl">
            <UtensilsCrossed size={36} className="text-white" />
          </div>

          <h1 className="text-3xl font-black text-white leading-tight mb-2 drop-shadow-sm">
            {negocio?.nombre}
          </h1>

          {resenas.length > 0 && (
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="flex">
                {[1,2,3,4,5].map(n => (
                  <span key={n} className={`text-lg ${n <= Math.round(promedioResenas) ? 'text-white' : 'text-white/30'}`}>★</span>
                ))}
              </div>
              <span className="text-white/90 font-bold text-sm">{promedioResenas.toFixed(1)}</span>
              <span className="text-white/60 text-xs">({resenas.length} reseña{resenas.length !== 1 ? 's' : ''})</span>
            </div>
          )}
          <p className="text-white/70 text-sm mt-1">Bienvenido · ¿En qué te ayudamos?</p>
        </div>
      </div>

      {/* ── BOTONES PRINCIPALES ────────────────────────────────── */}
      <div className="flex-1 px-4 py-6 space-y-3 -mt-4 relative z-10">

        {/* Ver Menú */}
        <button onClick={() => setVista('menu')}
          className="w-full bg-white rounded-2xl p-5 flex items-center gap-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform text-left group">
          <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center shrink-0 group-active:bg-orange-200 transition-colors">
            <UtensilsCrossed size={26} className="text-orange-500" />
          </div>
          <div className="flex-1">
            <p className="font-black text-gray-900 text-lg leading-tight">
              {puedeOrdenar ? 'Pedir' : 'Ver Menú'}
            </p>
            <p className="text-sm text-gray-400 mt-0.5">
              {puedeOrdenar
                ? (qrConsumo && qrDomi ? 'Consumo en lugar o domicilio'
                   : qrConsumo ? 'Consumo en el restaurante'
                   : 'Pedido a domicilio')
                : 'Conoce nuestra carta'}
            </p>
          </div>
          <ChevronRight size={20} className="text-gray-300 shrink-0" />
        </button>

        {/* Reservas — solo basico+ */}
        {puedeReservar && (
          <button onClick={() => setVista('reservas')}
            className="w-full bg-white rounded-2xl p-5 flex items-center gap-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform text-left group">
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
              <CalendarDays size={26} className="text-purple-500" />
            </div>
            <div className="flex-1">
              <p className="font-black text-gray-900 text-lg leading-tight">Reservas</p>
              <p className="text-sm text-gray-400 mt-0.5">Reserva tu mesa con anticipación</p>
            </div>
            <ChevronRight size={20} className="text-gray-300 shrink-0" />
          </button>
        )}

        {/* Reseñas */}
        <button onClick={() => setVista('resenas')}
          className="w-full bg-white rounded-2xl p-5 flex items-center gap-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform text-left group">
          <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <Star size={26} className="text-amber-500" />
          </div>
          <div className="flex-1">
            <p className="font-black text-gray-900 text-lg leading-tight">Reseñas</p>
            <p className="text-sm text-gray-400 mt-0.5">
              {resenas.length > 0 ? `★ ${promedioResenas.toFixed(1)} · Deja tu opinión` : 'Sé el primero en opinar'}
            </p>
          </div>
          <ChevronRight size={20} className="text-gray-300 shrink-0" />
        </button>

        {/* PQRS */}
        <button onClick={() => setVista('pqrs')}
          className="w-full bg-white rounded-2xl p-5 flex items-center gap-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform text-left group">
          <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
            <MessageSquare size={26} className="text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="font-black text-gray-900 text-lg leading-tight">Contáctanos</p>
            <p className="text-sm text-gray-400 mt-0.5">Peticiones, quejas y sugerencias</p>
          </div>
          <ChevronRight size={20} className="text-gray-300 shrink-0" />
        </button>

        {/* WhatsApp si está configurado */}
        {socialWa && (
          <a href={`https://wa.me/${socialWa.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
            className="w-full bg-green-500 rounded-2xl p-5 flex items-center gap-4 active:scale-[0.98] transition-transform text-left">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-3xl">💬</span>
            </div>
            <div className="flex-1">
              <p className="font-black text-white text-lg leading-tight">WhatsApp</p>
              <p className="text-sm text-green-100 mt-0.5">Escríbenos directamente</p>
            </div>
            <ChevronRight size={20} className="text-white/60 shrink-0" />
          </a>
        )}
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <div className="px-4 pb-8 text-center">
        <p className="text-gray-600 text-xs">Powered by <span className="font-bold text-gray-500">Restaurant Pix</span></p>
      </div>
    </div>
  )

  // ── Sub-página wrapper ──────────────────────────────────────
  function Header({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
    return (
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-4 max-w-2xl mx-auto">
          <button onClick={() => { setVista('home'); setPasoOrden('browse'); setCarrito([]) }}
            className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 hover:bg-gray-200 transition-colors">
            <ChevronLeft size={20} className="text-gray-700" />
          </button>
          <div>
            <p className="font-black text-gray-900 text-lg leading-tight">{titulo}</p>
            {subtitulo && <p className="text-xs text-gray-400">{subtitulo}</p>}
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // ── VISTA: MENÚ ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════
  if (vista === 'menu') return (
    <div className="min-h-screen bg-gray-50">
      {/* ── POPUP SUGERIDO DEL MES ───────────────────────────── */}
      {sugeridoPopup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-5" onClick={() => setSugeridoPopup(false)}>
          <div className="bg-white rounded-3xl overflow-hidden max-w-xs w-full shadow-2xl shadow-black/50" onClick={e => e.stopPropagation()}>
            {sugeridoImagenUrl ? (
              <img src={sugeridoImagenUrl} alt={sugeridoNombre} className="w-full h-40 object-cover" />
            ) : (
              <div className="h-36 bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-6xl">
                🍽️
              </div>
            )}
            <div className="p-5 text-center space-y-2">
              <span className="inline-block bg-orange-100 text-orange-600 text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wide">
                ⭐ Sugerido del mes
              </span>
              <h3 className="font-black text-gray-900 text-xl leading-tight">{sugeridoNombre}</h3>
              {sugeridoDescripcion && <p className="text-gray-500 text-sm leading-relaxed">{sugeridoDescripcion}</p>}
              {sugeridoPrecio && <p className="text-orange-600 font-black text-2xl">${parseFloat(sugeridoPrecio).toLocaleString('es-CO')}</p>}
              <button onClick={() => setSugeridoPopup(false)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-2xl text-sm transition-colors mt-2">
                Ver el menú completo →
              </button>
            </div>
          </div>
        </div>
      )}
      <Header titulo={negocio?.nombre || ''} subtitulo={puedeOrdenar ? 'Toca + para agregar al carrito' : 'Solo lectura'} />

      {/* ── BROWSE ─────────────────────────────────────────────── */}
      {pasoOrden === 'browse' && (
        <>
          {/* Categorías */}
          <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white border-b sticky top-[69px] z-10">
            {categorias.map(c => (
              <button key={c.id} onClick={() => setCatActiva(c.id)}
                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${catActiva === c.id ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600'}`}>
                {c.nombre}
              </button>
            ))}
          </div>

          {/* Platos */}
          <div className="p-4 max-w-2xl mx-auto space-y-3 pb-32">
            {platos.filter(p => p.categoria_id === catActiva).map(plato => {
              const cant = cantPlato(plato.id)
              return (
                <div key={plato.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                  <div className="flex items-center gap-4 p-4">
                    {plato.imagen_url ? (
                      <img src={plato.imagen_url} alt={plato.nombre} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-20 h-20 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                        <UtensilsCrossed size={28} className="text-orange-200" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{plato.nombre}</p>
                      {plato.descripcion && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{plato.descripcion}</p>}
                      <p className="text-orange-500 font-black mt-2">${plato.precio.toLocaleString('es-CO')}</p>
                    </div>
                    <div className="shrink-0">
                      {puedeOrdenar ? (
                        cant > 0 ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => cambiarCant(plato.id, -1)}
                              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 font-black hover:bg-gray-200 transition-colors">
                              <Minus size={14} />
                            </button>
                            <span className="w-6 text-center font-black text-gray-900 text-lg">{cant}</span>
                            <button onClick={() => agregar(plato)}
                              className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white hover:bg-orange-600 transition-colors">
                              <Plus size={14} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => agregar(plato)}
                            className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-md shadow-orange-200 hover:bg-orange-600 transition-colors active:scale-95">
                            <Plus size={18} />
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">Vista</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {platos.filter(p => p.categoria_id === catActiva).length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <UtensilsCrossed size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin platos en esta categoría</p>
              </div>
            )}
          </div>

          {/* Botón carrito flotante */}
          {puedeOrdenar && cantTotal > 0 && (
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent">
              <button onClick={irACheckout}
                className="w-full max-w-2xl mx-auto bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl flex items-center justify-between px-5 shadow-xl shadow-orange-300/50 transition-colors active:scale-[0.98]">
                <span className="bg-orange-400 text-white text-xs font-black w-7 h-7 rounded-full flex items-center justify-center shrink-0">{cantTotal}</span>
                <span className="text-base">Ver carrito</span>
                <span className="font-black text-lg">${totalCarrito.toLocaleString('es-CO')}</span>
              </button>
            </div>
          )}

          {!puedeOrdenar && (
            <div className="mx-4 mb-4 max-w-2xl mx-auto bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">Los pedidos online no están disponibles actualmente. Acércate al mostrador.</p>
            </div>
          )}
        </>
      )}

      {/* ── ELEGIR TIPO ─────────────────────────────────────────── */}
      {pasoOrden === 'tipo' && (
        <div className="p-4 max-w-2xl mx-auto space-y-4 pt-6">
          <div className="text-center mb-8">
            <p className="font-black text-gray-900 text-2xl">¿Cómo lo quieres?</p>
            <p className="text-gray-400 text-sm mt-1">Elige una opción para continuar</p>
          </div>
          {qrConsumo && (
            <button onClick={() => { setTipoConsumo('consumo'); setPasoOrden('datos') }}
              className="w-full bg-white border-2 border-gray-200 hover:border-orange-400 rounded-2xl p-5 flex items-center gap-4 transition-all text-left active:scale-[0.98] group">
              <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                <UtensilsCrossed size={28} className="text-orange-500" />
              </div>
              <div className="flex-1">
                <p className="font-black text-gray-900 text-xl">Para comer aquí</p>
                <p className="text-sm text-gray-400 mt-0.5">Consumo en el restaurante</p>
              </div>
              <ArrowRight size={22} className="text-gray-300 group-hover:text-orange-500 transition-colors" />
            </button>
          )}
          {qrDomi && (
            <button onClick={() => { setTipoConsumo('domi'); setPasoOrden('datos') }}
              className="w-full bg-white border-2 border-gray-200 hover:border-orange-400 rounded-2xl p-5 flex items-center gap-4 transition-all text-left active:scale-[0.98] group">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <Bike size={28} className="text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="font-black text-gray-900 text-xl">A domicilio</p>
                <p className="text-sm text-gray-400 mt-0.5">Te lo llevamos a casa</p>
              </div>
              <ArrowRight size={22} className="text-gray-300 group-hover:text-orange-500 transition-colors" />
            </button>
          )}
          <button onClick={() => setPasoOrden('browse')}
            className="w-full text-sm text-gray-400 py-2 hover:text-gray-600 transition-colors">
            ← Volver al menú
          </button>
        </div>
      )}

      {/* ── DATOS ────────────────────────────────────────────────── */}
      {pasoOrden === 'datos' && (
        <div className="p-4 max-w-2xl mx-auto space-y-4 pb-8">
          <div className="flex items-center gap-2 py-2">
            <button onClick={() => setPasoOrden(qrConsumo && qrDomi ? 'tipo' : 'browse')}
              className="text-orange-500 text-sm font-bold flex items-center gap-1">
              <ChevronLeft size={16} /> Volver
            </button>
            <span className="text-xs text-gray-400 ml-1">
              {tipoConsumo === 'consumo' ? '🍽️ Consumo en lugar' : '🛵 Domicilio'}
            </span>
          </div>

          {/* Resumen pedido */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Tu pedido</p>
            <div className="space-y-2">
              {carrito.map(i => (
                <div key={i.plato.id} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-bold">{i.cantidad}×</span>
                    <span className="text-sm text-gray-700">{i.plato.nombre}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">${(i.cantidad * i.plato.precio).toLocaleString('es-CO')}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between items-center">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-black text-orange-500 text-xl">${totalCarrito.toLocaleString('es-CO')}</span>
            </div>
          </div>

          {/* Formulario */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Tus datos</p>
            <input placeholder="Nombre *" value={nombre} onChange={e => setNombre(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
            <input placeholder="Teléfono *" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
            <input placeholder="Cédula (opcional — fidelidad)" value={cedula} onChange={e => setCedula(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
            {tipoConsumo === 'consumo' && (
              <input placeholder="Número de mesa *" type="number" value={mesa} onChange={e => setMesa(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
            )}
            {tipoConsumo === 'domi' && (
              <input placeholder="Dirección de entrega *" value={direccion} onChange={e => setDireccion(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
            )}
            <textarea placeholder="Notas (alergias, instrucciones…)" value={notasPedido} onChange={e => setNotasPedido(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none" />
          </div>

          <button onClick={enviarPedido} disabled={enviando}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-200 transition-colors active:scale-[0.98]">
            {enviando ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            {enviando ? 'Enviando…' : 'Confirmar pedido'}
          </button>
        </div>
      )}

      {/* ── SEGUIMIENTO ─────────────────────────────────────────── */}
      {pasoOrden === 'seguimiento' && (
        <div className="p-4 max-w-2xl mx-auto space-y-4 pb-8">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-6 text-center text-white shadow-xl shadow-green-200 mt-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={32} />
            </div>
            <p className="font-black text-2xl mb-1">¡Pedido enviado!</p>
            <p className="text-white/80 text-sm">
              {tipoConsumo === 'domi' ? '🛵 En camino a tu dirección' : '🍽️ Sigue el estado abajo'}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Estado de tu pedido</p>
            {itemsSeg.map(item => {
              const cfg = ESTADO_CFG[item.estado] ?? ESTADO_CFG['pendiente']
              return (
                <div key={item.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-4 flex items-center justify-between shadow-sm">
                  <p className="text-sm font-semibold text-gray-800">{item.cantidad}× {item.nombre}</p>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    <span className={`text-xs font-bold ${cfg.texto}`}>{cfg.label}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <button onClick={() => { setPasoOrden('browse'); setNombre(''); setTelefono(''); setCedula(''); setMesa(searchParams.get('mesa') ?? ''); setDireccion(''); setNotasPedido(''); setPedidoId(null); setItemsSeg([]); setTipoConsumo(null) }}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3.5 rounded-2xl text-sm transition-colors">
            Hacer otro pedido →
          </button>
        </div>
      )}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════
  // ── VISTA: RESERVAS ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════
  if (vista === 'reservas') return (
    <div className="min-h-screen bg-gray-50">
      <Header titulo="Reservas" subtitulo="Reserva tu mesa con anticipación" />
      <div className="p-4 max-w-2xl mx-auto pb-8">
        {resOk ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={36} className="text-green-500" />
            </div>
            <p className="font-black text-gray-900 text-2xl mb-2">¡Reserva enviada!</p>
            <p className="text-gray-400 leading-relaxed mb-8">El restaurante confirmará tu reserva por teléfono. ¡Nos vemos pronto!</p>
            <button onClick={() => { setResOk(false); setFormRes({ nombre: '', telefono: '', fecha: '', hora: '12:00', personas: 2, notas: '' }) }}
              className="bg-purple-500 text-white font-bold px-8 py-3 rounded-xl text-sm">
              Hacer otra reserva
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
              <input placeholder="Tu nombre *" value={formRes.nombre} onChange={e => setFormRes(p => ({ ...p, nombre: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
              <input placeholder="Teléfono *" type="tel" value={formRes.telefono} onChange={e => setFormRes(p => ({ ...p, telefono: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Fecha *</label>
                  <input type="date" value={formRes.fecha} min={new Date().toISOString().split('T')[0]} onChange={e => setFormRes(p => ({ ...p, fecha: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Hora *</label>
                  <input type="time" value={formRes.hora} onChange={e => setFormRes(p => ({ ...p, hora: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-2 block">Personas</label>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setFormRes(p => ({ ...p, personas: Math.max(1, p.personas - 1) }))}
                    className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-200 font-black transition-colors">
                    <Minus size={18} />
                  </button>
                  <span className="text-3xl font-black text-gray-900 w-12 text-center">{formRes.personas}</span>
                  <button type="button" onClick={() => setFormRes(p => ({ ...p, personas: Math.min(20, p.personas + 1) }))}
                    className="w-11 h-11 bg-purple-500 rounded-xl flex items-center justify-center text-white hover:bg-purple-600 transition-colors">
                    <Plus size={18} />
                  </button>
                  <span className="text-sm text-gray-400">persona{formRes.personas !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <textarea placeholder="Notas (cumpleaños, alergias, decoración…)" value={formRes.notas} onChange={e => setFormRes(p => ({ ...p, notas: e.target.value }))} rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
            </div>
            <button onClick={enviarReserva} disabled={enviandoRes}
              className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-purple-200 transition-colors active:scale-[0.98]">
              {enviandoRes ? <Loader2 size={20} className="animate-spin" /> : <CalendarDays size={20} />}
              {enviandoRes ? 'Enviando…' : 'Solicitar reserva'}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════
  // ── VISTA: RESEÑAS ──────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════
  if (vista === 'resenas') return (
    <div className="min-h-screen bg-gray-50">
      <Header titulo="Reseñas" subtitulo={resenas.length > 0 ? `★ ${promedioResenas.toFixed(1)} · ${resenas.length} opiniones` : 'Sé el primero'} />
      <div className="p-4 max-w-2xl mx-auto space-y-4 pb-8">

        {/* Formulario nueva reseña */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm mt-4">
          <p className="font-bold text-gray-900">Tu experiencia</p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Calificación:</span>
            <Estrellas valor={formResena.puntuacion} onChange={n => setFormResena(p => ({ ...p, puntuacion: n }))} size="lg" />
          </div>
          <input placeholder="Tu nombre" value={formResena.nombre} onChange={e => setFormResena(p => ({ ...p, nombre: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          <textarea placeholder="Cuéntanos tu experiencia…" value={formResena.comentario} onChange={e => setFormResena(p => ({ ...p, comentario: e.target.value }))} rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
          <button onClick={enviarResena} disabled={enviandoResena}
            className="w-full bg-amber-400 hover:bg-amber-500 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98]">
            {enviandoResena ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
            Publicar reseña
          </button>
        </div>

        {/* Lista */}
        {resenas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Star size={36} className="mx-auto mb-3 opacity-30" />
            <p>Aún no hay reseñas. ¡Sé el primero!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resenas.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-gray-900">{r.nombre}</p>
                  <Estrellas valor={r.puntuacion} size="sm" />
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{r.comentario}</p>
                <p className="text-[11px] text-gray-400 mt-2">
                  {new Date(r.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════
  // ── VISTA: PQRS ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════
  if (vista === 'pqrs') return (
    <div className="min-h-screen bg-gray-50">
      <Header titulo="Contáctanos" subtitulo="Peticiones, quejas, reclamos y sugerencias" />
      <div className="p-4 max-w-2xl mx-auto pb-8">
        {pqrsOk ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={36} className="text-blue-500" />
            </div>
            <p className="font-black text-gray-900 text-2xl mb-2">¡Mensaje enviado!</p>
            <p className="text-gray-400 leading-relaxed mb-8">Revisaremos tu solicitud y nos pondremos en contacto si es necesario.</p>
            <button onClick={() => { setPqrsOk(false); setFormPqrs({ nombre: '', telefono: '', tipo: 'peticion', mensaje: '' }) }}
              className="bg-blue-500 text-white font-bold px-8 py-3 rounded-xl text-sm">
              Enviar otra
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            {/* Tipo selector */}
            <div className="grid grid-cols-2 gap-2">
              {(['peticion', 'queja', 'reclamo', 'sugerencia'] as const).map(t => (
                <button key={t} onClick={() => setFormPqrs(p => ({ ...p, tipo: t }))}
                  className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${formPqrs.tipo === t ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-200'}`}>
                  {t === 'peticion' ? '📋 Petición' : t === 'queja' ? '😤 Queja' : t === 'reclamo' ? '⚠️ Reclamo' : '💡 Sugerencia'}
                </button>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 shadow-sm">
              <input placeholder="Tu nombre *" value={formPqrs.nombre} onChange={e => setFormPqrs(p => ({ ...p, nombre: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <input placeholder="Teléfono (opcional)" type="tel" value={formPqrs.telefono} onChange={e => setFormPqrs(p => ({ ...p, telefono: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <textarea placeholder="Describe tu solicitud *" value={formPqrs.mensaje} onChange={e => setFormPqrs(p => ({ ...p, mensaje: e.target.value }))} rows={4}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
            </div>
            <button onClick={enviarPqrs} disabled={enviandoPqrs}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-colors active:scale-[0.98]">
              {enviandoPqrs ? <Loader2 size={20} className="animate-spin" /> : <MessageSquare size={20} />}
              {enviandoPqrs ? 'Enviando…' : 'Enviar mensaje'}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return null
}

// ─── EXPORT CON SUSPENSE (requerido por useSearchParams) ──────────────────
export default function RestaurantePublicoPage({ params }: { params: Promise<{ negocioId: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RestaurantePublicoInner params={params} />
    </Suspense>
  )
}
