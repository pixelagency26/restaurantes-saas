'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { use } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Plus, Minus, ChevronLeft, Star,
  CalendarDays, CheckCircle, MessageSquare,
  Bike, UtensilsCrossed, AlertTriangle, ArrowRight,
  Loader2, Send, ChevronRight, Upload, X, Banknote, CreditCard
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
type PasoOrden = 'browse' | 'tipo' | 'datos' | 'pago' | 'seguimiento'
type MetodoPagoDomi = 'efectivo' | 'transferencia' | null

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
          className={`${sz} transition-transform ${onChange ? 'hover:scale-110 cursor-pointer' : 'cursor-default'} ${n <= valor ? 'text-orange-400' : 'text-gray-600'}`}>
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Pago domi
  const [metodoPagoDomi, setMetodoPagoDomi] = useState<MetodoPagoDomi>(null)
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null)
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null)
  const [subiendoComprobante, setSubiendoComprobante] = useState(false)

  // Cliente lookup
  const [clientePrevio, setClientePrevio] = useState<{ id: string; nombre: string } | null>(null)
  const [buscandoCliente, setBuscandoCliente] = useState(false)

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

  const puedeOrdenar  = planGte(negocio?.plan || 'starter', 'basico') && (qrConsumo || qrDomi)
  const puedeReservar = planGte(negocio?.plan || 'starter', 'basico')
  const promedioResenas = resenas.length > 0 ? resenas.reduce((s, r) => s + r.puntuacion, 0) / resenas.length : 0

  // ── Buscar cliente por teléfono (onBlur) ────────────────────
  async function buscarClientePorTelefono(tel: string) {
    if (!tel || tel.replace(/\D/g, '').length < 7) return
    setBuscandoCliente(true)
    const { data } = await supabase.from('clientes')
      .select('id, nombre')
      .eq('negocio_id', negocioId)
      .eq('telefono', tel.trim())
      .maybeSingle()
    if (data) {
      setClientePrevio(data)
      if (!nombre.trim()) setNombre(data.nombre)
    } else {
      setClientePrevio(null)
    }
    setBuscandoCliente(false)
  }

  // ── Ir al checkout ───────────────────────────────────────────
  function irACheckout() {
    if (carrito.length === 0) { toast.error('Agrega algo primero'); return }
    if (mesa && qrConsumo) { setTipoConsumo('consumo'); setPasoOrden('datos'); return }
    if (qrConsumo && qrDomi) { setPasoOrden('tipo'); return }
    setTipoConsumo(qrConsumo ? 'consumo' : 'domi')
    setPasoOrden('datos')
  }

  // ── Validar datos y continuar ────────────────────────────────
  function irAPago() {
    if (!nombre.trim() || !telefono.trim()) { toast.error('Completa nombre y teléfono'); return }
    if (tipoConsumo === 'consumo' && !mesa.trim()) { toast.error('Indica tu número de mesa'); return }
    if (tipoConsumo === 'domi' && !direccion.trim()) { toast.error('Indica tu dirección'); return }
    if (tipoConsumo === 'domi') { setPasoOrden('pago') } else { enviarPedido() }
  }

  // ── Manejar comprobante ──────────────────────────────────────
  function handleComprobanteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('El archivo no puede superar 5MB'); return }
    setComprobanteFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setComprobantePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ── Enviar pedido ────────────────────────────────────────────
  async function enviarPedido() {
    if (!nombre.trim() || !telefono.trim()) { toast.error('Completa nombre y teléfono'); return }
    if (tipoConsumo === 'consumo' && !mesa.trim()) { toast.error('Indica tu número de mesa'); return }
    if (tipoConsumo === 'domi' && !direccion.trim()) { toast.error('Indica tu dirección'); return }
    if (tipoConsumo === 'domi' && !metodoPagoDomi) { toast.error('Elige un método de pago'); return }
    if (tipoConsumo === 'domi' && metodoPagoDomi === 'transferencia' && !comprobanteFile) {
      toast.error('Adjunta el comprobante de transferencia'); return
    }
    setEnviando(true)

    // Subir comprobante si aplica
    let comprobanteUrl: string | null = null
    if (tipoConsumo === 'domi' && metodoPagoDomi === 'transferencia' && comprobanteFile) {
      setSubiendoComprobante(true)
      const ext = comprobanteFile.name.split('.').pop()
      const path = `${negocioId}/${Date.now()}.${ext}`
      const { data: upData, error: upError } = await supabase.storage
        .from('comprobantes').upload(path, comprobanteFile, { upsert: true })
      setSubiendoComprobante(false)
      if (!upError && upData) {
        const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(path)
        comprobanteUrl = urlData.publicUrl
      } else {
        toast.error('No se pudo subir el comprobante. Verifica con el restaurante.')
      }
    }

    const { data: turno } = await supabase.from('turnos').select('id')
      .eq('negocio_id', negocioId).is('cerrado_en', null)
      .order('abierto_en', { ascending: false }).limit(1).single()
    if (!turno) { toast.error('El restaurante no está recibiendo pedidos ahora'); setEnviando(false); return }

    let mesaId: number | null = null
    if (tipoConsumo === 'consumo' && mesa.trim()) {
      const { data: md } = await supabase.from('mesas').select('id')
        .eq('negocio_id', negocioId).eq('numero', parseInt(mesa)).single()
      mesaId = md?.id ?? null
    }

    // Siempre buscar/crear cliente (por teléfono primero, luego cédula)
    let clienteId: string | null = clientePrevio?.id ?? null
    if (!clienteId) {
      // Buscar por cédula si la ingresó
      if (cedula.trim()) {
        const { data: cl } = await supabase.from('clientes').select('id, nombre')
          .eq('cedula', cedula.trim()).eq('negocio_id', negocioId).maybeSingle()
        if (cl) clienteId = cl.id
      }
      // Buscar por teléfono si aún no lo encontramos
      if (!clienteId && telefono.trim()) {
        const { data: cl } = await supabase.from('clientes').select('id, nombre')
          .eq('telefono', telefono.trim()).eq('negocio_id', negocioId).maybeSingle()
        if (cl) clienteId = cl.id
      }
      // Si no existe, crearlo
      if (!clienteId) {
        const { data: nc } = await supabase.from('clientes').insert({
          negocio_id: negocioId,
          cedula: cedula.trim() || null,
          nombre: nombre.trim(),
          telefono: telefono.trim(),
        }).select('id').single()
        clienteId = nc?.id ?? null
      }
    }

    const { data: pedido, error } = await supabase.from('pedidos').insert({
      negocio_id: negocioId,
      mesa_id: mesaId,
      cliente_id: clienteId,
      cliente_nombre: nombre.trim(),
      cliente_cedula: cedula.trim() || null,
      cliente_telefono: telefono.trim(),
      cliente_direccion: tipoConsumo === 'domi' ? direccion.trim() : null,
      turno_id: turno.id,
      tipo: tipoConsumo === 'domi' ? 'domi' : 'cliente_qr',
      notas: notasPedido.trim() || null,
      metodo_pago_cliente: tipoConsumo === 'domi' ? metodoPagoDomi : null,
      comprobante_url: comprobanteUrl,
    }).select().single()

    if (error || !pedido) {
      console.error('Error creando pedido:', error)
      toast.error('Error al enviar: ' + (error?.message || 'intenta de nuevo'))
      setEnviando(false); return
    }

    await supabase.from('items_pedido').insert(
      carrito.map(i => ({ pedido_id: pedido.id, plato_id: i.plato.id, cantidad: i.cantidad, precio_unitario: i.plato.precio, notas: i.notas || null }))
    )
    if (mesaId) await supabase.from('mesas').update({ estado: 'ocupada' }).eq('id', mesaId)

    const { data: items } = await supabase.from('items_pedido')
      .select('id, cantidad, estado, plato:platos(nombre)').eq('pedido_id', pedido.id)
    if (items) setItemsSeg(items.map(i => ({
      id: i.id,
      nombre: (i.plato as { nombre: string })?.nombre || '',
      cantidad: i.cantidad,
      estado: i.estado
    })))

    setPedidoId(pedido.id)
    setPasoOrden('seguimiento')
    setCarrito([])
    setEnviando(false)
    toast.success('✅ ¡Pedido enviado!')
  }

  async function enviarResena() {
    if (!formResena.nombre.trim() || !formResena.comentario.trim()) { toast.error('Completa nombre y comentario'); return }
    setEnviandoResena(true)
    const { error } = await supabase.from('resenas').insert({
      negocio_id: negocioId, nombre: formResena.nombre.trim(),
      puntuacion: formResena.puntuacion, comentario: formResena.comentario.trim()
    })
    if (!error) { toast.success('¡Gracias por tu reseña!'); setFormResena({ nombre: '', puntuacion: 5, comentario: '' }); cargar() }
    else toast.error('Error al enviar')
    setEnviandoResena(false)
  }

  async function enviarPqrs() {
    if (!formPqrs.nombre.trim() || !formPqrs.mensaje.trim()) { toast.error('Completa nombre y mensaje'); return }
    setEnviandoPqrs(true)
    const { error } = await supabase.from('pqrs').insert({
      negocio_id: negocioId, nombre: formPqrs.nombre.trim(),
      telefono: formPqrs.telefono.trim() || null, tipo: formPqrs.tipo, mensaje: formPqrs.mensaje.trim()
    })
    if (!error) setPqrsOk(true)
    else toast.error('Error al enviar')
    setEnviandoPqrs(false)
  }

  async function enviarReserva() {
    if (!formRes.nombre.trim() || !formRes.telefono.trim() || !formRes.fecha || !formRes.hora) {
      toast.error('Completa todos los campos'); return
    }
    setEnviandoRes(true)
    const { error } = await supabase.from('reservas').insert({
      negocio_id: negocioId, nombre: formRes.nombre.trim(), telefono: formRes.telefono.trim(),
      fecha: formRes.fecha, hora: formRes.hora, personas: formRes.personas,
      notas: formRes.notas.trim() || null, estado: 'pendiente'
    })
    if (!error) setResOk(true)
    else toast.error('Error al enviar')
    setEnviandoRes(false)
  }

  function resetPedido() {
    setPasoOrden('browse')
    setNombre(''); setTelefono(''); setCedula('')
    setMesa(searchParams.get('mesa') ?? '')
    setDireccion(''); setNotasPedido('')
    setPedidoId(null); setItemsSeg([])
    setTipoConsumo(null)
    setMetodoPagoDomi(null)
    setComprobanteFile(null); setComprobantePreview(null)
    setClientePrevio(null)
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
    pendiente:      { label: 'En espera',   dot: 'bg-gray-500',                 texto: 'text-gray-400'   },
    en_preparacion: { label: 'Preparando…', dot: 'bg-orange-400 animate-pulse', texto: 'text-orange-400' },
    listo:          { label: '¡Listo! ✓',   dot: 'bg-green-400',                texto: 'text-green-400'  },
    entregado:      { label: 'Entregado',   dot: 'bg-green-300',                texto: 'text-gray-500'   },
  }

  // ─── POPUP SUGERIDO ─────────────────────────────────────────
  const PopupSugerido = () => sugeridoPopup ? (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-5"
      onClick={() => setSugeridoPopup(false)}>
      <div className="bg-gray-900 border border-gray-700 rounded-3xl overflow-hidden max-w-xs w-full shadow-2xl shadow-black/60 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}>
        {sugeridoImagenUrl ? (
          <img src={sugeridoImagenUrl} alt={sugeridoNombre} className="w-full h-40 object-cover" />
        ) : (
          <div className="h-36 bg-gradient-to-br from-orange-600 to-amber-500 flex items-center justify-center text-6xl">🍽️</div>
        )}
        <div className="p-5 text-center space-y-2">
          <span className="inline-block bg-orange-500/20 border border-orange-500/30 text-orange-400 text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wide">
            ⭐ Sugerido del mes
          </span>
          <h3 className="font-black text-white text-xl leading-tight">{sugeridoNombre}</h3>
          {sugeridoDescripcion && <p className="text-gray-400 text-sm leading-relaxed">{sugeridoDescripcion}</p>}
          {sugeridoPrecio && (
            <p className="text-orange-400 font-black text-2xl">${parseFloat(sugeridoPrecio).toLocaleString('es-CO')}</p>
          )}
          <div className="flex flex-col gap-2 pt-1">
            <button onClick={() => { setSugeridoPopup(false); setVista('menu') }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-2xl text-sm transition-colors">
              Ver en el menú →
            </button>
            <button onClick={() => setSugeridoPopup(false)}
              className="text-xs text-gray-500 hover:text-gray-400 py-1 transition-colors">
              Ver el menú completo
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null

  // ═══════════════════════════════════════════════════════════════
  // ── VISTA: HOME ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════
  if (vista === 'home') return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <PopupSugerido />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500" />
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-white/10 rounded-full" />
        <div className="relative px-6 pt-16 pb-12 text-center">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-5 border-2 border-white/30 shadow-2xl">
            <UtensilsCrossed size={36} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white leading-tight mb-2 drop-shadow-sm">{negocio?.nombre}</h1>
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

        {/* Ver Menú / Pedir */}
        <button onClick={() => setVista('menu')}
          className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-4 shadow-lg active:scale-[0.98] transition-transform text-left group hover:border-orange-500/30">
          <div className="w-14 h-14 bg-orange-500/15 rounded-xl flex items-center justify-center shrink-0">
            <UtensilsCrossed size={26} className="text-orange-500" />
          </div>
          <div className="flex-1">
            <p className="font-black text-white text-lg leading-tight">
              {puedeOrdenar ? 'Pedir' : 'Ver Menú'}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {puedeOrdenar
                ? (qrConsumo && qrDomi ? 'Consumo en lugar o domicilio'
                   : qrConsumo ? 'Consumo en el restaurante'
                   : 'Pedido a domicilio')
                : 'Conoce nuestra carta'}
            </p>
          </div>
          <ChevronRight size={20} className="text-gray-600 shrink-0 group-hover:text-orange-500 transition-colors" />
        </button>

        {/* Reservas */}
        {puedeReservar && (
          <button onClick={() => setVista('reservas')}
            className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-4 shadow-lg active:scale-[0.98] transition-transform text-left group hover:border-orange-500/30">
            <div className="w-14 h-14 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
              <CalendarDays size={26} className="text-orange-400" />
            </div>
            <div className="flex-1">
              <p className="font-black text-white text-lg leading-tight">Reservas</p>
              <p className="text-sm text-gray-500 mt-0.5">Reserva tu mesa con anticipación</p>
            </div>
            <ChevronRight size={20} className="text-gray-600 shrink-0 group-hover:text-orange-500 transition-colors" />
          </button>
        )}

        {/* Reseñas */}
        <button onClick={() => setVista('resenas')}
          className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-4 shadow-lg active:scale-[0.98] transition-transform text-left group hover:border-orange-500/30">
          <div className="w-14 h-14 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
            <Star size={26} className="text-orange-400" />
          </div>
          <div className="flex-1">
            <p className="font-black text-white text-lg leading-tight">Reseñas</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {resenas.length > 0 ? `★ ${promedioResenas.toFixed(1)} · Deja tu opinión` : 'Sé el primero en opinar'}
            </p>
          </div>
          <ChevronRight size={20} className="text-gray-600 shrink-0 group-hover:text-orange-500 transition-colors" />
        </button>

        {/* PQRS */}
        <button onClick={() => setVista('pqrs')}
          className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center gap-4 shadow-lg active:scale-[0.98] transition-transform text-left group hover:border-orange-500/30">
          <div className="w-14 h-14 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
            <MessageSquare size={26} className="text-orange-400" />
          </div>
          <div className="flex-1">
            <p className="font-black text-white text-lg leading-tight">Contáctanos</p>
            <p className="text-sm text-gray-500 mt-0.5">Peticiones, quejas y sugerencias</p>
          </div>
          <ChevronRight size={20} className="text-gray-600 shrink-0 group-hover:text-orange-500 transition-colors" />
        </button>

        {/* WhatsApp */}
        {socialWa && (
          <a href={`https://wa.me/${socialWa.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
            className="w-full bg-green-600 hover:bg-green-500 rounded-2xl p-5 flex items-center gap-4 active:scale-[0.98] transition-all text-left">
            <div className="w-14 h-14 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-3xl">💬</span>
            </div>
            <div className="flex-1">
              <p className="font-black text-white text-lg leading-tight">WhatsApp</p>
              <p className="text-sm text-green-200 mt-0.5">Escríbenos directamente</p>
            </div>
            <ChevronRight size={20} className="text-white/50 shrink-0" />
          </a>
        )}
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <div className="px-4 pb-8 text-center">
        <p className="text-gray-700 text-xs">Powered by <span className="font-bold text-gray-600">Restaurant Pix</span></p>
      </div>
    </div>
  )

  // ── Header ──────────────────────────────────────────────────
  function Header({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
    return (
      <div className="sticky top-0 z-20 bg-gray-900 border-b border-gray-800 shadow-lg shadow-black/20">
        <div className="flex items-center gap-3 px-4 py-4 max-w-2xl mx-auto">
          <button onClick={() => { setVista('home'); resetPedido() }}
            className="w-9 h-9 bg-gray-800 rounded-xl flex items-center justify-center shrink-0 hover:bg-gray-700 transition-colors">
            <ChevronLeft size={20} className="text-gray-300" />
          </button>
          <div>
            <p className="font-black text-white text-lg leading-tight">{titulo}</p>
            {subtitulo && <p className="text-xs text-gray-500">{subtitulo}</p>}
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // ── VISTA: MENÚ ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════
  if (vista === 'menu') return (
    <div className="min-h-screen bg-gray-950">
      <PopupSugerido />
      <Header titulo={negocio?.nombre || ''} subtitulo={puedeOrdenar ? 'Toca + para agregar al carrito' : 'Solo lectura'} />

      {/* ── BROWSE ─────────────────────────────────────────────── */}
      {pasoOrden === 'browse' && (
        <>
          {/* Categorías */}
          <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-gray-900 border-b border-gray-800 sticky top-[69px] z-10">
            {categorias.map(c => (
              <button key={c.id} onClick={() => setCatActiva(c.id)}
                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                  catActiva === c.id
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}>
                {c.nombre}
              </button>
            ))}
          </div>

          {/* Platos */}
          <div className="p-4 max-w-2xl mx-auto space-y-3 pb-32">
            {platos.filter(p => p.categoria_id === catActiva).map(plato => {
              const cant = cantPlato(plato.id)
              return (
                <div key={plato.id} className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 hover:border-gray-700 transition-colors">
                  <div className="flex items-center gap-4 p-4">
                    {plato.imagen_url ? (
                      <img src={plato.imagen_url} alt={plato.nombre} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-20 h-20 bg-gray-800 rounded-xl flex items-center justify-center shrink-0">
                        <UtensilsCrossed size={28} className="text-gray-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white">{plato.nombre}</p>
                      {plato.descripcion && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{plato.descripcion}</p>
                      )}
                      <p className="text-orange-400 font-black mt-2">${plato.precio.toLocaleString('es-CO')}</p>
                    </div>
                    <div className="shrink-0">
                      {puedeOrdenar ? (
                        cant > 0 ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => cambiarCant(plato.id, -1)}
                              className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-gray-300 font-black hover:bg-gray-600 transition-colors">
                              <Minus size={14} />
                            </button>
                            <span className="w-6 text-center font-black text-white text-lg">{cant}</span>
                            <button onClick={() => agregar(plato)}
                              className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white hover:bg-orange-400 transition-colors">
                              <Plus size={14} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => agregar(plato)}
                            className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-500/30 hover:bg-orange-400 transition-colors active:scale-95">
                            <Plus size={18} />
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-gray-600 bg-gray-800 px-2.5 py-1 rounded-full">Vista</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {platos.filter(p => p.categoria_id === catActiva).length === 0 && (
              <div className="text-center py-16 text-gray-600">
                <UtensilsCrossed size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin platos en esta categoría</p>
              </div>
            )}
          </div>

          {/* Botón carrito flotante */}
          {puedeOrdenar && cantTotal > 0 && (
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-950 via-gray-950/90 to-transparent">
              <button onClick={irACheckout}
                className="w-full max-w-2xl mx-auto bg-orange-500 hover:bg-orange-400 text-white font-bold py-4 rounded-2xl flex items-center justify-between px-5 shadow-xl shadow-orange-500/30 transition-colors active:scale-[0.98] block">
                <span className="bg-orange-400 text-white text-xs font-black w-7 h-7 rounded-full flex items-center justify-center shrink-0">{cantTotal}</span>
                <span className="text-base">Ver carrito</span>
                <span className="font-black text-lg">${totalCarrito.toLocaleString('es-CO')}</span>
              </button>
            </div>
          )}

          {!puedeOrdenar && (
            <div className="mx-4 mb-4 max-w-2xl mx-auto bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-orange-400 shrink-0 mt-0.5" />
              <p className="text-sm text-orange-300">Los pedidos online no están disponibles. Acércate al mostrador.</p>
            </div>
          )}
        </>
      )}

      {/* ── ELEGIR TIPO ─────────────────────────────────────────── */}
      {pasoOrden === 'tipo' && (
        <div className="p-4 max-w-2xl mx-auto space-y-4 pt-6">
          <div className="text-center mb-8">
            <p className="font-black text-white text-2xl">¿Cómo lo quieres?</p>
            <p className="text-gray-500 text-sm mt-1">Elige una opción para continuar</p>
          </div>
          {qrConsumo && (
            <button onClick={() => { setTipoConsumo('consumo'); setPasoOrden('datos') }}
              className="w-full bg-gray-900 border-2 border-gray-700 hover:border-orange-500/50 rounded-2xl p-5 flex items-center gap-4 transition-all text-left active:scale-[0.98] group">
              <div className="w-16 h-16 bg-orange-500/15 rounded-xl flex items-center justify-center shrink-0">
                <UtensilsCrossed size={28} className="text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="font-black text-white text-xl">Para comer aquí</p>
                <p className="text-sm text-gray-500 mt-0.5">Consumo en el restaurante</p>
              </div>
              <ArrowRight size={22} className="text-gray-600 group-hover:text-orange-400 transition-colors" />
            </button>
          )}
          {qrDomi && (
            <button onClick={() => { setTipoConsumo('domi'); setPasoOrden('datos') }}
              className="w-full bg-gray-900 border-2 border-gray-700 hover:border-orange-500/50 rounded-2xl p-5 flex items-center gap-4 transition-all text-left active:scale-[0.98] group">
              <div className="w-16 h-16 bg-orange-500/15 rounded-xl flex items-center justify-center shrink-0">
                <Bike size={28} className="text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="font-black text-white text-xl">A domicilio</p>
                <p className="text-sm text-gray-500 mt-0.5">Te lo llevamos a casa</p>
              </div>
              <ArrowRight size={22} className="text-gray-600 group-hover:text-orange-400 transition-colors" />
            </button>
          )}
          <button onClick={() => setPasoOrden('browse')}
            className="w-full text-sm text-gray-600 py-2 hover:text-gray-400 transition-colors">
            ← Volver al menú
          </button>
        </div>
      )}

      {/* ── DATOS ────────────────────────────────────────────────── */}
      {pasoOrden === 'datos' && (
        <div className="p-4 max-w-2xl mx-auto space-y-4 pb-8">
          <div className="flex items-center gap-2 py-2">
            <button onClick={() => setPasoOrden(qrConsumo && qrDomi ? 'tipo' : 'browse')}
              className="text-orange-400 text-sm font-bold flex items-center gap-1">
              <ChevronLeft size={16} /> Volver
            </button>
            <span className="text-xs text-gray-600 ml-1">
              {tipoConsumo === 'consumo' ? '🍽️ Consumo en lugar' : '🛵 Domicilio'}
            </span>
          </div>

          {/* Resumen pedido */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Tu pedido</p>
            <div className="space-y-2">
              {carrito.map(i => (
                <div key={i.plato.id} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 font-bold">{i.cantidad}×</span>
                    <span className="text-sm text-gray-300">{i.plato.nombre}</span>
                  </div>
                  <span className="text-sm font-bold text-white">${(i.cantidad * i.plato.precio).toLocaleString('es-CO')}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-800 mt-3 pt-3 flex justify-between items-center">
              <span className="font-bold text-gray-300">Total</span>
              <span className="font-black text-orange-400 text-xl">${totalCarrito.toLocaleString('es-CO')}</span>
            </div>
          </div>

          {/* Formulario */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tus datos</p>
            <input
              placeholder="Teléfono *"
              type="tel"
              value={telefono}
              onChange={e => { setTelefono(e.target.value); setClientePrevio(null) }}
              onBlur={e => buscarClientePorTelefono(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50"
            />
            {buscandoCliente && (
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Buscando…
              </p>
            )}
            {clientePrevio && !buscandoCliente && (
              <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl">👋</span>
                <div>
                  <p className="text-orange-300 font-black text-sm">¡Hola de nuevo, {clientePrevio.nombre.split(' ')[0]}!</p>
                  <p className="text-orange-400/60 text-xs">Ya te tenemos registrado</p>
                </div>
              </div>
            )}
            <input placeholder="Nombre *" value={nombre} onChange={e => setNombre(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50" />
            <input placeholder="Cédula (opcional — fidelidad)" value={cedula} onChange={e => setCedula(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50" />
            {tipoConsumo === 'consumo' && (
              <input placeholder="Número de mesa *" type="number" value={mesa} onChange={e => setMesa(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50" />
            )}
            {tipoConsumo === 'domi' && (
              <input placeholder="Dirección de entrega *" value={direccion} onChange={e => setDireccion(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50" />
            )}
            <textarea placeholder="Notas (alergias, instrucciones…)" value={notasPedido} onChange={e => setNotasPedido(e.target.value)} rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 resize-none" />
          </div>

          <button onClick={irAPago}
            className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-colors active:scale-[0.98]">
            {tipoConsumo === 'domi' ? <><ArrowRight size={20} /> Siguiente — Pago</> : <><Send size={20} /> Confirmar pedido</>}
          </button>
        </div>
      )}

      {/* ── PAGO (solo domi) ─────────────────────────────────────── */}
      {pasoOrden === 'pago' && (
        <div className="p-4 max-w-2xl mx-auto space-y-4 pb-8">
          <div className="flex items-center gap-2 py-2">
            <button onClick={() => setPasoOrden('datos')}
              className="text-orange-400 text-sm font-bold flex items-center gap-1">
              <ChevronLeft size={16} /> Volver
            </button>
            <span className="text-xs text-gray-600 ml-1">🛵 Método de pago</span>
          </div>

          {/* Título */}
          <div className="text-center py-2">
            <p className="font-black text-white text-xl">¿Cómo vas a pagar?</p>
            <p className="text-gray-500 text-sm mt-1">Elige el método antes de confirmar</p>
          </div>

          {/* Total */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex justify-between items-center">
            <span className="text-gray-400 font-semibold">Total a pagar</span>
            <span className="text-orange-400 font-black text-2xl">${totalCarrito.toLocaleString('es-CO')}</span>
          </div>

          {/* Opciones de pago */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setMetodoPagoDomi('efectivo'); setComprobanteFile(null); setComprobantePreview(null) }}
              className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${
                metodoPagoDomi === 'efectivo'
                  ? 'bg-orange-500/15 border-orange-500 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}>
              <Banknote size={32} className={metodoPagoDomi === 'efectivo' ? 'text-orange-400' : 'text-gray-600'} />
              <div className="text-center">
                <p className="font-black text-sm">Efectivo</p>
                <p className="text-xs text-gray-500 mt-0.5">Pago al recibir</p>
              </div>
              {metodoPagoDomi === 'efectivo' && (
                <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                  <CheckCircle size={14} className="text-white" />
                </div>
              )}
            </button>

            <button
              onClick={() => setMetodoPagoDomi('transferencia')}
              className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${
                metodoPagoDomi === 'transferencia'
                  ? 'bg-orange-500/15 border-orange-500 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}>
              <CreditCard size={32} className={metodoPagoDomi === 'transferencia' ? 'text-orange-400' : 'text-gray-600'} />
              <div className="text-center">
                <p className="font-black text-sm">Transferencia</p>
                <p className="text-xs text-gray-500 mt-0.5">Nequi / Bancolombia</p>
              </div>
              {metodoPagoDomi === 'transferencia' && (
                <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                  <CheckCircle size={14} className="text-white" />
                </div>
              )}
            </button>
          </div>

          {/* Info efectivo */}
          {metodoPagoDomi === 'efectivo' && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-2xl">💵</span>
              <div>
                <p className="text-amber-300 font-bold text-sm">Pago en efectivo</p>
                <p className="text-amber-400/70 text-xs mt-0.5 leading-relaxed">
                  Ten el dinero listo al recibir el pedido. El domiciliario te dará el cambio si aplica.
                </p>
              </div>
            </div>
          )}

          {/* Subir comprobante */}
          {metodoPagoDomi === 'transferencia' && (
            <div className="space-y-3">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-3">
                <span className="text-2xl">📱</span>
                <div>
                  <p className="text-blue-300 font-bold text-sm">Comprobante de transferencia</p>
                  <p className="text-blue-400/70 text-xs mt-0.5 leading-relaxed">
                    Adjunta la captura de pantalla o foto del comprobante de pago. El restaurante lo verificará.
                  </p>
                </div>
              </div>

              {comprobantePreview ? (
                <div className="relative">
                  <img src={comprobantePreview} alt="Comprobante" className="w-full max-h-64 object-contain rounded-2xl border border-gray-700 bg-gray-900" />
                  <button
                    onClick={() => { setComprobanteFile(null); setComprobantePreview(null) }}
                    className="absolute top-2 right-2 w-8 h-8 bg-gray-900/90 border border-gray-700 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition-colors">
                    <X size={16} />
                  </button>
                  <div className="mt-2 flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle size={16} />
                    <span className="font-semibold">Comprobante adjunto</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-700 hover:border-orange-500/50 rounded-2xl p-8 flex flex-col items-center gap-3 transition-all text-center bg-gray-900/50 hover:bg-gray-900">
                  <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center">
                    <Upload size={24} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-300 text-sm">Toca para adjuntar</p>
                    <p className="text-xs text-gray-600 mt-0.5">Foto o captura de pantalla (max 5MB)</p>
                  </div>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleComprobanteChange}
              />
            </div>
          )}

          <button
            onClick={enviarPedido}
            disabled={enviando || !metodoPagoDomi || (metodoPagoDomi === 'transferencia' && !comprobanteFile)}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98]">
            {enviando
              ? <><Loader2 size={20} className="animate-spin" /> {subiendoComprobante ? 'Subiendo comprobante…' : 'Enviando…'}</>
              : <><Send size={20} /> Confirmar pedido</>
            }
          </button>

          {metodoPagoDomi === 'transferencia' && !comprobanteFile && (
            <p className="text-center text-xs text-gray-600">Adjunta el comprobante para continuar</p>
          )}
        </div>
      )}

      {/* ── SEGUIMIENTO ─────────────────────────────────────────── */}
      {pasoOrden === 'seguimiento' && (
        <div className="p-4 max-w-2xl mx-auto space-y-4 pb-8">
          <div className="bg-gradient-to-br from-orange-600 to-amber-500 rounded-3xl p-6 text-center text-white shadow-xl shadow-orange-500/20 mt-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={32} />
            </div>
            <p className="font-black text-2xl mb-1">¡Pedido enviado!</p>
            <p className="text-white/80 text-sm">
              {tipoConsumo === 'domi'
                ? metodoPagoDomi === 'transferencia'
                  ? '🧾 Verificaremos tu comprobante y salimos'
                  : '🛵 Prepararemos y salimos a tu dirección'
                : '🍽️ Sigue el estado de tu pedido abajo'}
            </p>
          </div>

          {tipoConsumo === 'domi' && metodoPagoDomi === 'efectivo' && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-2xl">💵</span>
              <div>
                <p className="text-amber-300 font-bold text-sm">Pago en efectivo</p>
                <p className="text-amber-400/70 text-xs mt-0.5">
                  Ten listo <span className="font-black text-amber-300">${totalCarrito.toLocaleString('es-CO')}</span> al recibir el domicilio.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-black text-gray-600 uppercase tracking-widest px-1">Estado de tu pedido</p>
            {itemsSeg.map(item => {
              const cfg = ESTADO_CFG[item.estado] ?? ESTADO_CFG['pendiente']
              return (
                <div key={item.id} className="bg-gray-900 rounded-2xl border border-gray-800 px-4 py-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-200">{item.cantidad}× {item.nombre}</p>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    <span className={`text-xs font-bold ${cfg.texto}`}>{cfg.label}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <button onClick={resetPedido}
            className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3.5 rounded-2xl text-sm transition-colors">
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
    <div className="min-h-screen bg-gray-950">
      <Header titulo="Reservas" subtitulo="Reserva tu mesa con anticipación" />
      <div className="p-4 max-w-2xl mx-auto pb-8">
        {resOk ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-orange-500/15 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={36} className="text-orange-400" />
            </div>
            <p className="font-black text-white text-2xl mb-2">¡Reserva enviada!</p>
            <p className="text-gray-500 leading-relaxed mb-8">El restaurante confirmará tu reserva. ¡Nos vemos pronto!</p>
            <button onClick={() => { setResOk(false); setFormRes({ nombre: '', telefono: '', fecha: '', hora: '12:00', personas: 2, notas: '' }) }}
              className="bg-orange-500 text-white font-bold px-8 py-3 rounded-xl text-sm hover:bg-orange-400 transition-colors">
              Hacer otra reserva
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-4">
              <input placeholder="Tu nombre *" value={formRes.nombre} onChange={e => setFormRes(p => ({ ...p, nombre: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
              <input placeholder="Teléfono *" type="tel" value={formRes.telefono} onChange={e => setFormRes(p => ({ ...p, telefono: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Fecha *</label>
                  <input type="date" value={formRes.fecha} min={new Date().toISOString().split('T')[0]}
                    onChange={e => setFormRes(p => ({ ...p, fecha: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Hora *</label>
                  <input type="time" value={formRes.hora} onChange={e => setFormRes(p => ({ ...p, hora: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block">Personas</label>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setFormRes(p => ({ ...p, personas: Math.max(1, p.personas - 1) }))}
                    className="w-11 h-11 bg-gray-800 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-700 font-black transition-colors">
                    <Minus size={18} />
                  </button>
                  <span className="text-3xl font-black text-white w-12 text-center">{formRes.personas}</span>
                  <button type="button" onClick={() => setFormRes(p => ({ ...p, personas: Math.min(20, p.personas + 1) }))}
                    className="w-11 h-11 bg-orange-500 rounded-xl flex items-center justify-center text-white hover:bg-orange-400 transition-colors">
                    <Plus size={18} />
                  </button>
                  <span className="text-sm text-gray-600">persona{formRes.personas !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <textarea placeholder="Notas (cumpleaños, alergias…)" value={formRes.notas}
                onChange={e => setFormRes(p => ({ ...p, notas: e.target.value }))} rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none" />
            </div>
            <button onClick={enviarReserva} disabled={enviandoRes}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-gray-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-colors active:scale-[0.98]">
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
    <div className="min-h-screen bg-gray-950">
      <Header titulo="Reseñas" subtitulo={resenas.length > 0 ? `★ ${promedioResenas.toFixed(1)} · ${resenas.length} opiniones` : 'Sé el primero'} />
      <div className="p-4 max-w-2xl mx-auto space-y-4 pb-8">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-4 mt-4">
          <p className="font-bold text-white">Tu experiencia</p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Calificación:</span>
            <Estrellas valor={formResena.puntuacion} onChange={n => setFormResena(p => ({ ...p, puntuacion: n }))} size="lg" />
          </div>
          <input placeholder="Tu nombre" value={formResena.nombre} onChange={e => setFormResena(p => ({ ...p, nombre: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
          <textarea placeholder="Cuéntanos tu experiencia…" value={formResena.comentario}
            onChange={e => setFormResena(p => ({ ...p, comentario: e.target.value }))} rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none" />
          <button onClick={enviarResena} disabled={enviandoResena}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-gray-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98]">
            {enviandoResena ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
            Publicar reseña
          </button>
        </div>

        {resenas.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <Star size={36} className="mx-auto mb-3 opacity-30" />
            <p>Aún no hay reseñas. ¡Sé el primero!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resenas.map(r => (
              <div key={r.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-white">{r.nombre}</p>
                  <Estrellas valor={r.puntuacion} size="sm" />
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{r.comentario}</p>
                <p className="text-[11px] text-gray-600 mt-2">
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
    <div className="min-h-screen bg-gray-950">
      <Header titulo="Contáctanos" subtitulo="Peticiones, quejas, reclamos y sugerencias" />
      <div className="p-4 max-w-2xl mx-auto pb-8">
        {pqrsOk ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-orange-500/15 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={36} className="text-orange-400" />
            </div>
            <p className="font-black text-white text-2xl mb-2">¡Mensaje enviado!</p>
            <p className="text-gray-500 leading-relaxed mb-8">Revisaremos tu solicitud. Gracias.</p>
            <button onClick={() => { setPqrsOk(false); setFormPqrs({ nombre: '', telefono: '', tipo: 'peticion', mensaje: '' }) }}
              className="bg-orange-500 text-white font-bold px-8 py-3 rounded-xl text-sm hover:bg-orange-400 transition-colors">
              Enviar otra
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-2">
              {(['peticion', 'queja', 'reclamo', 'sugerencia'] as const).map(t => (
                <button key={t} onClick={() => setFormPqrs(p => ({ ...p, tipo: t }))}
                  className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                    formPqrs.tipo === t
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-gray-900 text-gray-500 border-gray-700 hover:border-gray-600'
                  }`}>
                  {t === 'peticion' ? '📋 Petición' : t === 'queja' ? '😤 Queja' : t === 'reclamo' ? '⚠️ Reclamo' : '💡 Sugerencia'}
                </button>
              ))}
            </div>
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-3">
              <input placeholder="Tu nombre *" value={formPqrs.nombre} onChange={e => setFormPqrs(p => ({ ...p, nombre: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
              <input placeholder="Teléfono (opcional)" type="tel" value={formPqrs.telefono} onChange={e => setFormPqrs(p => ({ ...p, telefono: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
              <textarea placeholder="Describe tu solicitud *" value={formPqrs.mensaje}
                onChange={e => setFormPqrs(p => ({ ...p, mensaje: e.target.value }))} rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none" />
            </div>
            <button onClick={enviarPqrs} disabled={enviandoPqrs}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-gray-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-colors active:scale-[0.98]">
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

// ─── EXPORT CON SUSPENSE ───────────────────────────────────────────────────
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
