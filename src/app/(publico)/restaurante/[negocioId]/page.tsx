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
  Loader2, Send, ChevronRight, Upload, X, Banknote, CreditCard, Search
} from 'lucide-react'
import {
  ItemConModificadores,
  consumoInventarioCarrito,
  hayConfigPendiente,
  itemKey,
  itemPedidoPayload,
  modificadoresPedidoPayload,
  tieneModificadores,
} from '@/lib/modificadores'
import ModificadorModal from '@/components/ModificadorModal'
import ConfigurarModificadoresPedido from '@/components/ConfigurarModificadoresPedido'
import { itemDomicilioPayload, parseTarifaDomicilio } from '@/lib/domicilios'
import { ModificadorSeleccionado } from '@/types'

// ─── TIPOS ─────────────────────────────────────────────────────────────────
interface Negocio { id: string; nombre: string; plan: string }
interface Categoria { id: number; nombre: string; orden: number }
interface Plato {
  id: string; nombre: string; descripcion: string | null
  precio: number; imagen_url: string | null; activo: boolean; categoria_id: number
  modificadores?: unknown[]
}
interface InvInfo { cantidad_disponible: number; alerta_minima: number }
type PlatoConInv = Plato & { inv?: InvInfo }
type ItemCarrito = ItemConModificadores
interface Resena { id: string; nombre: string; puntuacion: number; comentario: string; created_at: string }

type Vista = 'home' | 'menu' | 'resenas' | 'pqrs' | 'reservas'
type TipoConsumo = 'consumo' | 'domi' | null
type PasoOrden = 'browse' | 'tipo' | 'datos' | 'pago' | 'seguimiento'
type MetodoPagoDomi = 'efectivo' | 'transferencia' | null
type PagoTarifaDomi = 'transferencia' | 'efectivo'

const PLAN_NIVEL: Record<string, number> = { starter: 0, basico: 1, pro: 2 }
function planGte(plan: string, req: string) {
  return (PLAN_NIVEL[plan] ?? 0) >= (PLAN_NIVEL[req] ?? 0)
}

// ─── CLASES REUTILIZABLES ──────────────────────────────────────────────────
const INPUT = 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 transition-colors'
const BTN_PRIMARY = 'w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-orange-200 transition-all active:scale-[0.98]'
const BTN_DARK = 'w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]'
const BTN_DISABLED = 'disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed'
const CARD = 'bg-white rounded-2xl border border-gray-200 shadow-sm'

// ─── ESTRELLAS ─────────────────────────────────────────────────────────────
function Estrellas({ valor, onChange, size = 'md' }: { valor: number; onChange?: (n: number) => void; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-3xl' : 'text-xl'
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(n)}
          className={`${sz} transition-transform ${onChange ? 'hover:scale-110 cursor-pointer' : 'cursor-default'} ${n <= valor ? 'text-orange-500' : 'text-gray-300'}`}>
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

  const [negocio, setNegocio]           = useState<Negocio | null>(null)
  const [cargando, setCargando]         = useState(true)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [vista, setVista]               = useState<Vista>('home')

  // Config
  const [qrConsumo, setQrConsumo] = useState(false)
  const [qrDomi, setQrDomi]       = useState(false)
  const [socialWa, setSocialWa]   = useState('')

  // Sugerido
  const [sugeridoPopup, setSugeridoPopup]           = useState(false)
  const [sugeridoNombre, setSugeridoNombre]         = useState('')
  const [sugeridoPrecio, setSugeridoPrecio]         = useState('')
  const [sugeridoDescripcion, setSugeridoDescripcion] = useState('')
  const [sugeridoImagenUrl, setSugeridoImagenUrl]   = useState('')

  // Menú
  const [categorias, setCategorias]         = useState<Categoria[]>([])
  const [platos, setPlatos]                 = useState<PlatoConInv[]>([])
  const [catActiva, setCatActiva]           = useState<number | null>(null)
  const [busquedaPlato, setBusquedaPlato]   = useState('')
  const [carrito, setCarrito]               = useState<ItemCarrito[]>([])
  const [platoConfig, setPlatoConfig]       = useState<Plato | null>(null)
  const [configurandoComplementos, setConfigurandoComplementos] = useState(false)
  const [turnoConInventario, setTurnoConInventario] = useState(false)
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
  const [pedidoEstado, setPedidoEstado] = useState<string | null>(null)
  const [itemsSeg, setItemsSeg]     = useState<{ id: string; nombre: string; cantidad: number; estado: string }[]>([])

  // Cliente previo
  const [clientePrevio, setClientePrevio]   = useState<{ id: string; nombre: string } | null>(null)
  const [buscandoCliente, setBuscandoCliente] = useState(false)

  // Pago domi
  const [metodoPagoDomi, setMetodoPagoDomi]     = useState<MetodoPagoDomi>(null)
  const [pagoTarifaDomi, setPagoTarifaDomi]     = useState<PagoTarifaDomi>('transferencia')
  const [tarifaDomicilio, setTarifaDomicilio]   = useState(0)
  const [comprobanteFile, setComprobanteFile]   = useState<File | null>(null)
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null)
  const [subiendoComprobante, setSubiendoComprobante] = useState(false)

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

  // Mesas disponibles para selección
  const [mesasDisponibles, setMesasDisponibles] = useState<{ id: number; numero: number; estado: string }[]>([])

  // ── Carga ────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: neg }, { data: cats }, { data: pls }, { data: cfg }, { data: res }, { data: turnoData }, { data: mesasData }, { data: mods }] = await Promise.all([
      supabase.from('negocios').select('id, nombre, plan').eq('id', negocioId).single(),
      supabase.from('categorias').select('*').eq('negocio_id', negocioId).order('orden'),
      supabase.from('platos').select('*').eq('negocio_id', negocioId).eq('activo', true),
      supabase.from('configuracion').select('clave, valor').eq('negocio_id', negocioId)
        .in('clave', ['qr_consumo_activo', 'qr_domi_activo', 'social_whatsapp',
                      'sugerido_activo', 'sugerido_nombre', 'sugerido_precio',
                      'sugerido_descripcion', 'sugerido_imagen_url', 'tarifa_domicilio']),
      supabase.from('resenas').select('*').eq('negocio_id', negocioId)
        .order('created_at', { ascending: false }),
      supabase.from('turnos').select('id, abierto_en').eq('negocio_id', negocioId).is('cerrado_en', null)
        .order('abierto_en', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('mesas').select('id, numero, estado').eq('negocio_id', negocioId).order('numero'),
      supabase.from('grupos_modificadores').select('*, opciones:opciones_modificador(*, componente:platos(nombre))').eq('negocio_id', negocioId).order('orden'),
    ])
    if (!neg) { setNoEncontrado(true); setCargando(false); return }
    setNegocio(neg as Negocio)
    if (mesasData) {
      setMesasDisponibles(mesasData as { id: number; numero: number; estado: string }[])
      // Pre-seleccionar mesa desde URL param (?mesa=3)
      const mesaParam = searchParams.get('mesa')
      if (mesaParam) {
        const encontrada = (mesasData as { id: number; numero: number; estado: string }[]).find(m => m.numero === parseInt(mesaParam))
        if (encontrada) setMesa(String(encontrada.numero))
      }
    }
    if (cats) { setCategorias(cats as Categoria[]); if (cats[0]) setCatActiva(cats[0].id) }

    // Cargar inventario con restricción POR PLATO (no global)
    // Solo los platos que están en turnos_inventario tienen límite de stock
    let invMap: Record<string, InvInfo> = {}
    const platosEnTurnoSet = new Set<string>()
    if (turnoData?.id) {
      const td = turnoData as { id: string; abierto_en: string }
      const { data: tiData } = await supabase.from('turnos_inventario')
        .select('plato_id').eq('turno_id', td.id)
      ;(tiData || []).forEach((t: { plato_id: string }) => platosEnTurnoSet.add(t.plato_id))
      if (platosEnTurnoSet.size > 0) {
        // Primary: turnos_inventario legible → cargar inventario para esos platos
        const { data: invData } = await supabase.from('inventario')
          .select('plato_id, cantidad_disponible, alerta_minima')
          .in('plato_id', [...platosEnTurnoSet])
        ;(invData || []).forEach((i: { plato_id: string; cantidad_disponible: number; alerta_minima: number }) => {
          invMap[i.plato_id] = { cantidad_disponible: i.cantidad_disponible, alerta_minima: i.alerta_minima }
        })
      } else if (td.abierto_en) {
        // Fallback: turnos_inventario vacío/bloqueado → usar updated_at del inventario
        // Los platos actualizados desde que abrió el turno son los configurados en este turno
        const abrioEn = new Date(td.abierto_en).getTime()
        const { data: invAll } = await supabase.from('inventario')
          .select('plato_id, cantidad_disponible, alerta_minima, updated_at')
        ;(invAll || []).forEach((i: { plato_id: string; cantidad_disponible: number; alerta_minima: number; updated_at: string | null }) => {
          if (i.updated_at && new Date(i.updated_at).getTime() >= abrioEn - 1000) {
            platosEnTurnoSet.add(i.plato_id)
            invMap[i.plato_id] = { cantidad_disponible: i.cantidad_disponible, alerta_minima: i.alerta_minima }
          }
        })
      }
    }
    setTurnoConInventario(platosEnTurnoSet.size > 0)
    if (pls) {
      const modsPorPlato = new Map<string, unknown[]>()
      ;((mods || []) as { plato_id: string }[]).forEach(g => {
        modsPorPlato.set(g.plato_id, [...(modsPorPlato.get(g.plato_id) || []), g])
      })
      setPlatos((pls as Plato[]).map(p => ({ ...p, inv: invMap[p.id], modificadores: modsPorPlato.get(p.id) || [] })))
    }
    if (cfg) {
      const m: Record<string, string> = {}
      cfg.forEach((r: { clave: string; valor: string }) => { m[r.clave] = r.valor })
      setQrConsumo(planGte((neg as Negocio).plan || 'starter', 'basico') && m['qr_consumo_activo'] === 'true')
      setQrDomi(planGte((neg as Negocio).plan || 'starter', 'pro') && m['qr_domi_activo'] === 'true')
      setTarifaDomicilio(parseTarifaDomicilio(m['tarifa_domicilio']))
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

  // Suscripción realtime al inventario para actualizar disponibilidad en tiempo real
  useEffect(() => {
    if (!turnoConInventario) return
    const canal = supabase.channel('pub-inventario')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inventario' }, (payload) => {
        const upd = payload.new as { plato_id: string; cantidad_disponible: number; alerta_minima: number }
        setPlatos(prev => prev.map(p =>
          p.id === upd.plato_id
            ? { ...p, inv: { cantidad_disponible: upd.cantidad_disponible, alerta_minima: upd.alerta_minima } }
            : p
        ))
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [turnoConInventario, supabase])

  useEffect(() => {
    if (!pedidoId) return
    const canal = supabase.channel(`pub-seg-${pedidoId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${pedidoId}` },
        (payload) => {
          const n = payload.new as { estado: string }
          setPedidoEstado(n.estado)
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items_pedido', filter: `pedido_id=eq.${pedidoId}` },
        (payload) => {
          const n = payload.new as { id: string; estado: string }
          setItemsSeg(prev => prev.map(i => i.id === n.id ? { ...i, estado: n.estado } : i))
        })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [pedidoId, supabase])

  // ── Helpers ──────────────────────────────────────────────────
  const totalCarrito = carrito.reduce((s, i) => s + i.cantidad * i.plato.precio, 0)
  const totalDomi = tipoConsumo === 'domi' ? totalCarrito + tarifaDomicilio : totalCarrito
  const totalTransferenciaDomi = tipoConsumo === 'domi' && metodoPagoDomi === 'transferencia' && pagoTarifaDomi === 'efectivo'
    ? totalCarrito
    : totalDomi
  const cantTotal    = carrito.reduce((s, i) => s + i.cantidad, 0)
  const cantPlato    = (id: string) => carrito.filter(i => i.plato.id === id).reduce((a, i) => a + i.cantidad, 0)
  function validarConsumo(items: ItemCarrito[]) {
    const consumo = consumoInventarioCarrito(items)
    for (const [platoId, cantidad] of consumo.entries()) {
      const plato = platos.find(p => p.id === platoId)
      if (turnoConInventario && plato?.inv && cantidad > plato.inv.cantidad_disponible) {
        return `Solo hay ${plato.inv.cantidad_disponible} unidad(es) de ${plato.nombre}`
      }
    }
    return null
  }

  function agregar(platoRaw: Plato, modificadores?: ModificadorSeleccionado[]) {
    const platoConInv = platos.find(p => p.id === platoRaw.id)
    const requiereConfig = !modificadores && tieneModificadores(platoRaw as never)
    const mods = modificadores || []
    const errorConsumo = validarConsumo([...carrito, { plato: platoRaw as never, cantidad: 1, notas: '', modificadores: mods }])
    if (errorConsumo) { toast.error(errorConsumo); return }
    const keyNuevo = itemKey({ plato: platoRaw as never, cantidad: 1, notas: '', modificadores: mods })
    if (turnoConInventario && platoConInv?.inv) {
      const disp = platoConInv.inv.cantidad_disponible
      if (disp === 0) { toast.error(`${platoRaw.nombre} no est? disponible`); return }
      const enCarrito = carrito.find(i => itemKey(i) === keyNuevo)?.cantidad ?? 0
      if (enCarrito >= disp) { toast.error(`Solo quedan ${disp} unidad(es) de ${platoRaw.nombre}`); return }
    }
    setCarrito(prev => {
      const ex = prev.find(i => itemKey(i) === keyNuevo)
      if (ex) return prev.map(i => itemKey(i) === keyNuevo ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { plato: platoRaw as never, cantidad: 1, notas: '', modificadores: mods }]
    })
    if (requiereConfig) toast('Puedes escoger los complementos al confirmar el pedido')
  }
  function cambiarCant(id: string, delta: number) {
    if (delta > 0 && turnoConInventario) {
      const platoConInv = platos.find(p => p.id === id)
      if (platoConInv?.inv) {
        const disp = platoConInv.inv.cantidad_disponible
        const enCarrito = carrito.find(i => i.plato.id === id)?.cantidad ?? 0
        if (disp <= 0) { toast.error('No hay más unidades disponibles'); return }
        if (enCarrito >= disp) { toast.error('No hay más unidades disponibles'); return }
      }
    }
    setCarrito(prev =>
      prev.map(i => i.plato.id === id ? { ...i, cantidad: Math.max(0, i.cantidad + delta) } : i)
        .filter(i => i.cantidad > 0)
    )
  }

  const puedeOrdenar  = planGte(negocio?.plan || 'starter', 'basico') && (qrConsumo || qrDomi)
  const puedeReservar = planGte(negocio?.plan || 'starter', 'basico')
  const promedioResenas = resenas.length > 0
    ? resenas.reduce((s, r) => s + r.puntuacion, 0) / resenas.length : 0

  // ── Buscar cliente por teléfono ──────────────────────────────
  async function buscarClientePorTelefono(tel: string) {
    if (!tel || tel.replace(/\D/g, '').length < 7) return
    setBuscandoCliente(true)
    const { data } = await supabase.from('clientes').select('id, nombre, cedula, telefono')
      .eq('negocio_id', negocioId).eq('telefono', tel.trim()).maybeSingle()
    if (data) {
      setClientePrevio(data)
      if (!nombre.trim()) setNombre(data.nombre)
      if (!cedula.trim() && data.cedula) setCedula(data.cedula)
    }
    else setClientePrevio(null)
    setBuscandoCliente(false)
  }

  async function buscarClientePorCedula(val: string) {
    if (!val || val.replace(/\D/g, '').length < 5) return
    setBuscandoCliente(true)
    const { data } = await supabase.from('clientes').select('id, nombre, cedula, telefono')
      .eq('negocio_id', negocioId).eq('cedula', val.trim()).maybeSingle()
    if (data) {
      setClientePrevio(data)
      setNombre(data.nombre || '')
      if (data.telefono) setTelefono(data.telefono)
    }
    setBuscandoCliente(false)
  }

  // ── Checkout ─────────────────────────────────────────────────
  function irACheckout() {
    if (carrito.length === 0) { toast.error('Agrega algo primero'); return }
    if (hayConfigPendiente(carrito)) { setConfigurandoComplementos(true); return }
    if (mesa && qrConsumo) { setTipoConsumo('consumo'); setPasoOrden('datos'); return }
    if (qrConsumo && qrDomi) { setPasoOrden('tipo'); return }
    setTipoConsumo(qrConsumo ? 'consumo' : 'domi')
    setPasoOrden('datos')
  }

  function irAPago() {
    if (!nombre.trim() || !telefono.trim()) { toast.error('Completa nombre y teléfono'); return }
    if (tipoConsumo === 'consumo' && !mesa.trim()) { toast.error('Indica tu número de mesa'); return }
    if (tipoConsumo === 'domi' && !direccion.trim()) { toast.error('Indica tu dirección'); return }
    tipoConsumo === 'domi' ? setPasoOrden('pago') : enviarPedido()
  }

  function handleComprobanteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5MB'); return }
    setComprobanteFile(file)
    const reader = new FileReader()
    reader.onload = ev => setComprobantePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ── Enviar pedido ────────────────────────────────────────────
  async function enviarPedido() {
    if (!nombre.trim() || !telefono.trim()) { toast.error('Completa nombre y teléfono'); return }
    if (tipoConsumo === 'consumo' && !mesa.trim()) { toast.error('Indica tu número de mesa'); return }
    if (tipoConsumo === 'domi' && !direccion.trim()) { toast.error('Indica tu dirección'); return }
    if (tipoConsumo === 'domi' && !metodoPagoDomi) { toast.error('Elige método de pago'); return }
    if (tipoConsumo === 'domi' && metodoPagoDomi === 'transferencia' && !comprobanteFile) {
      toast.error('Adjunta el comprobante'); return
    }
    if (hayConfigPendiente(carrito)) { setConfigurandoComplementos(true); return }
    const errorConsumo = validarConsumo(carrito)
    if (errorConsumo) { toast.error(errorConsumo, { duration: 5000 }); return }
    setEnviando(true)

    // Subir comprobante
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
      }
    }

    // Buscar turno activo
    const { data: turno } = await supabase.from('turnos').select('id')
      .eq('negocio_id', negocioId).is('cerrado_en', null)
      .order('abierto_en', { ascending: false }).limit(1).single()
    if (!turno) { toast.error('El restaurante no está recibiendo pedidos ahora'); setEnviando(false); return }

    // Mesa
    let mesaId: number | null = null
    if (tipoConsumo === 'consumo' && mesa.trim()) {
      const { data: md } = await supabase.from('mesas').select('id')
        .eq('negocio_id', negocioId).eq('numero', parseInt(mesa)).maybeSingle()
      mesaId = md?.id ?? null
    }

    // Cliente — siempre buscar/crear
    let clienteId: string | null = clientePrevio?.id ?? null
    if (!clienteId) {
      if (cedula.trim()) {
        const { data: cl } = await supabase.from('clientes').select('id')
          .eq('cedula', cedula.trim()).eq('negocio_id', negocioId).maybeSingle()
        if (cl) clienteId = cl.id
      }
      if (!clienteId && telefono.trim()) {
        const { data: cl } = await supabase.from('clientes').select('id')
          .eq('telefono', telefono.trim()).eq('negocio_id', negocioId).maybeSingle()
        if (cl) clienteId = cl.id
      }
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

    // Crear pedido
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
      // QR domi → siempre llega a gerencia primero (evita fraudes)
      estado: 'pendiente',
      // Para transferencia el domi queda bloqueado hasta que gerencia confirme recepción del dinero
      ...(tipoConsumo === 'domi' ? { pago_domi_aprobado: metodoPagoDomi !== 'transferencia' } : {}),
      notas: [
        notasPedido.trim(),
        tipoConsumo === 'domi' && tarifaDomicilio > 0 && metodoPagoDomi === 'transferencia' && pagoTarifaDomi === 'efectivo'
          ? `Domicilio $${tarifaDomicilio.toLocaleString('es-CO')} se paga en efectivo al recibir`
          : '',
      ].filter(Boolean).join(' · ') || null,
      metodo_pago_cliente: tipoConsumo === 'domi' ? metodoPagoDomi : null,
      comprobante_url: comprobanteUrl,
    }).select().single()

    if (error || !pedido) {
      console.error('Error creando pedido:', error)
      toast.error('Error al enviar: ' + (error?.message || 'intenta de nuevo'))
      setEnviando(false); return
    }

    for (const item of carrito) {
      const { data: itemCreado, error: itemError } = await supabase.from('items_pedido')
        .insert(itemPedidoPayload(item, pedido.id, null))
        .select('id').single()
      if (itemError) console.error('Error insertando item:', itemError)
      if (itemCreado?.id) {
        const mods = modificadoresPedidoPayload(itemCreado.id, item)
        if (mods.length > 0) await supabase.from('items_pedido_modificadores').insert(mods)
      }
    }
    if (tipoConsumo === 'domi' && tarifaDomicilio > 0) {
      await supabase.from('items_pedido').insert(itemDomicilioPayload(pedido.id, tarifaDomicilio, null))
    }

    if (mesaId) await supabase.from('mesas').update({ estado: 'ocupada' }).eq('id', mesaId)

    const { data: items } = await supabase.from('items_pedido')
      .select('id, cantidad, estado, plato:platos(nombre)').eq('pedido_id', pedido.id)
    if (items) setItemsSeg(items.map(i => ({
      id: i.id, nombre: (Array.isArray(i.plato) ? i.plato[0] : i.plato)?.nombre || '',
      cantidad: i.cantidad, estado: i.estado
    })))

    setPedidoId(pedido.id)
    setPedidoEstado(tipoConsumo === 'domi' && metodoPagoDomi === 'transferencia' ? 'pendiente_pago' : 'pendiente')
    setPasoOrden('seguimiento')
    setCarrito([]); setEnviando(false)
    toast.success('✅ ¡Pedido enviado!')
  }

  async function enviarResena() {
    if (!formResena.nombre.trim() || !formResena.comentario.trim()) { toast.error('Completa nombre y comentario'); return }
    setEnviandoResena(true)
    const { error } = await supabase.from('resenas').insert({
      negocio_id: negocioId, nombre: formResena.nombre.trim(),
      puntuacion: formResena.puntuacion, comentario: formResena.comentario.trim()
    })
    if (!error) { toast.success('¡Gracias!'); setFormResena({ nombre: '', puntuacion: 5, comentario: '' }); cargar() }
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
    if (!error) setPqrsOk(true); else toast.error('Error al enviar')
    setEnviandoPqrs(false)
  }

  async function enviarReserva() {
    if (!formRes.nombre.trim() || !formRes.telefono.trim() || !formRes.fecha) { toast.error('Completa todos los campos'); return }
    setEnviandoRes(true)
    const { error } = await supabase.from('reservas').insert({
      negocio_id: negocioId, nombre: formRes.nombre.trim(), telefono: formRes.telefono.trim(),
      fecha: formRes.fecha, hora: formRes.hora, personas: formRes.personas,
      notas: formRes.notas.trim() || null, estado: 'pendiente'
    })
    if (!error) setResOk(true); else toast.error('Error al enviar')
    setEnviandoRes(false)
  }

  function resetPedido() {
    setPasoOrden('browse'); setNombre(''); setTelefono(''); setCedula('')
    setMesa(searchParams.get('mesa') ?? ''); setDireccion(''); setNotasPedido('')
    setPedidoId(null); setPedidoEstado(null); setItemsSeg([]); setTipoConsumo(null)
    setMetodoPagoDomi(null); setComprobanteFile(null); setComprobantePreview(null)
    setClientePrevio(null)
  }

  // ── Carga / 404 ──────────────────────────────────────────────
  if (cargando) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
          <UtensilsCrossed size={28} className="text-orange-500 animate-pulse" />
        </div>
        <p className="text-gray-400 text-sm">Cargando…</p>
      </div>
    </div>
  )

  if (noEncontrado) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center px-6">
        <AlertTriangle size={40} className="text-gray-300 mx-auto mb-3" />
        <p className="font-bold text-gray-900 text-lg">Restaurante no encontrado</p>
        <p className="text-gray-400 text-sm mt-1">El enlace puede ser incorrecto.</p>
      </div>
    </div>
  )

  const ESTADO_CFG: Record<string, { label: string; dot: string; texto: string }> = {
    pendiente_pago:  { label: '🔍 Verificando…', dot: 'bg-yellow-400 animate-pulse', texto: 'text-yellow-600' },
    pendiente:       { label: 'En espera',        dot: 'bg-gray-400',                 texto: 'text-gray-500'   },
    en_preparacion:  { label: 'Preparando…',      dot: 'bg-orange-500 animate-pulse', texto: 'text-orange-600' },
    listo:           { label: '¡Listo! ✓',        dot: 'bg-green-500',                texto: 'text-green-600'  },
    en_camino:       { label: '🛵 En camino',      dot: 'bg-blue-500 animate-pulse',   texto: 'text-blue-600'   },
    entregado:       { label: 'Entregado',         dot: 'bg-green-400',                texto: 'text-gray-500'   },
    pagado:          { label: '✓ Entregado',       dot: 'bg-green-500',                texto: 'text-gray-500'   },
  }

  // ── Popup sugerido (reutilizable) ────────────────────────────
  const PopupSugerido = () => sugeridoPopup ? (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-5"
      onClick={() => setSugeridoPopup(false)}>
      <div className="bg-white rounded-3xl overflow-hidden max-w-xs w-full shadow-2xl"
        onClick={e => e.stopPropagation()}>
        {sugeridoImagenUrl
          ? <img src={sugeridoImagenUrl} alt={sugeridoNombre} className="w-full h-44 object-cover" />
          : <div className="h-40 bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-6xl">🍽️</div>
        }
        <div className="p-5 text-center space-y-2">
          <span className="inline-block bg-orange-100 text-orange-600 text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wide">
            ⭐ Sugerido del mes
          </span>
          <h3 className="font-black text-gray-900 text-xl leading-tight">{sugeridoNombre}</h3>
          {sugeridoDescripcion && <p className="text-gray-500 text-sm">{sugeridoDescripcion}</p>}
          {sugeridoPrecio && <p className="text-orange-500 font-black text-2xl">${parseFloat(sugeridoPrecio).toLocaleString('es-CO')}</p>}
          <button onClick={() => { setSugeridoPopup(false); setVista('menu') }}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-2xl text-sm mt-1 transition-colors">
            Ver en el menú →
          </button>
          <button onClick={() => setSugeridoPopup(false)} className="text-xs text-gray-400 py-1 hover:text-gray-600 transition-colors block w-full">
            Ver el menú completo
          </button>
        </div>
      </div>
    </div>
  ) : null
  const modalModificadores = platoConfig && (
    <ModificadorModal
      plato={platoConfig as never}
      onCancel={() => setPlatoConfig(null)}
      onConfirm={mods => { agregar(platoConfig, mods); setPlatoConfig(null) }}
    />
  )
  const modalConfigPedido = configurandoComplementos && (
    <ConfigurarModificadoresPedido
      items={carrito}
      onCancel={() => setConfigurandoComplementos(false)}
      onConfirm={items => {
        setCarrito(items)
        setConfigurandoComplementos(false)
        toast.success('Complementos configurados')
      }}
    />
  )

  // ═══════════════════════════════════════════
  // HOME
  // ═══════════════════════════════════════════
  if (vista === 'home') return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PopupSugerido />
      {modalModificadores}
      {modalConfigPedido}

      {/* Hero naranja */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 px-6 pt-14 pb-16 text-center">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/10 rounded-full" />
        <div className="absolute -bottom-6 -left-6 w-36 h-36 bg-white/10 rounded-full" />
        <div className="relative">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-4 border-2 border-white/30 shadow-xl">
            <UtensilsCrossed size={34} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-1 drop-shadow">{negocio?.nombre}</h1>
          {resenas.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span className="text-white text-base">{'★'.repeat(Math.round(promedioResenas))}{'☆'.repeat(5 - Math.round(promedioResenas))}</span>
              <span className="text-white/90 font-bold text-sm">{promedioResenas.toFixed(1)}</span>
              <span className="text-white/60 text-xs">({resenas.length})</span>
            </div>
          )}
          <p className="text-white/75 text-sm mt-1">¿En qué te ayudamos?</p>
        </div>
      </div>

      {/* Botones — tarjetas blancas con sombra */}
      <div className="flex-1 px-4 py-5 space-y-3 -mt-6 relative z-10">

        <button onClick={() => setVista('menu')}
          className="w-full bg-white rounded-2xl p-5 flex items-center gap-4 shadow-md border border-gray-100 active:scale-[0.98] transition-transform text-left hover:shadow-lg group">
          <div className="w-14 h-14 bg-orange-500 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-orange-200 group-hover:bg-orange-600 transition-colors">
            <UtensilsCrossed size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-black text-gray-900 text-lg">{puedeOrdenar ? 'Pedir' : 'Ver Menú'}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {puedeOrdenar
                ? qrConsumo && qrDomi ? 'En restaurante o domicilio'
                  : qrConsumo ? 'Consumo en el restaurante'
                  : 'Pedido a domicilio'
                : 'Conoce nuestra carta'}
            </p>
          </div>
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition-colors">
            <ChevronRight size={16} className="text-gray-400 group-hover:text-orange-500 transition-colors" />
          </div>
        </button>

        {puedeReservar && (
          <button onClick={() => setVista('reservas')}
            className="w-full bg-white rounded-2xl p-5 flex items-center gap-4 shadow-md border border-gray-100 active:scale-[0.98] transition-transform text-left hover:shadow-lg group">
            <div className="w-14 h-14 bg-gray-900 rounded-xl flex items-center justify-center shrink-0 shadow-md">
              <CalendarDays size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="font-black text-gray-900 text-lg">Reservas</p>
              <p className="text-sm text-gray-500 mt-0.5">Reserva tu mesa con anticipación</p>
            </div>
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
              <ChevronRight size={16} className="text-gray-400" />
            </div>
          </button>
        )}

        <button onClick={() => setVista('resenas')}
          className="w-full bg-white rounded-2xl p-5 flex items-center gap-4 shadow-md border border-gray-100 active:scale-[0.98] transition-transform text-left hover:shadow-lg group">
          <div className="w-14 h-14 bg-amber-500 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-amber-100">
            <Star size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-black text-gray-900 text-lg">Reseñas</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {resenas.length > 0 ? `★ ${promedioResenas.toFixed(1)} · Deja tu opinión` : 'Sé el primero en opinar'}
            </p>
          </div>
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
            <ChevronRight size={16} className="text-gray-400" />
          </div>
        </button>

        <button onClick={() => setVista('pqrs')}
          className="w-full bg-white rounded-2xl p-5 flex items-center gap-4 shadow-md border border-gray-100 active:scale-[0.98] transition-transform text-left hover:shadow-lg group">
          <div className="w-14 h-14 bg-gray-700 rounded-xl flex items-center justify-center shrink-0 shadow-md">
            <MessageSquare size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-black text-gray-900 text-lg">Contáctanos</p>
            <p className="text-sm text-gray-500 mt-0.5">Peticiones, quejas y sugerencias</p>
          </div>
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
            <ChevronRight size={16} className="text-gray-400" />
          </div>
        </button>

        {socialWa && (
          <a href={`https://wa.me/${socialWa.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
            className="w-full bg-green-500 rounded-2xl p-5 flex items-center gap-4 shadow-md shadow-green-100 active:scale-[0.98] transition-transform text-left">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center shrink-0 text-3xl">💬</div>
            <div className="flex-1">
              <p className="font-black text-white text-lg">WhatsApp</p>
              <p className="text-sm text-green-100">Escríbenos directamente</p>
            </div>
            <ChevronRight size={18} className="text-white/60 shrink-0" />
          </a>
        )}
      </div>

      <p className="text-center text-gray-300 text-xs pb-6">Powered by <span className="font-bold">Restaurant Pix</span></p>
    </div>
  )

  // ── Header reutilizable ──────────────────────────────────────
  function Header({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
    return (
      <div className="sticky top-0 z-20 bg-gray-900 shadow-lg">
        <div className="flex items-center gap-3 px-4 py-3.5 max-w-2xl mx-auto">
          <button onClick={() => { setVista('home'); resetPedido() }}
            className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center shrink-0 transition-colors">
            <ChevronLeft size={20} className="text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-black text-white text-base leading-tight truncate">{titulo}</p>
            {subtitulo && <p className="text-xs text-gray-400 truncate">{subtitulo}</p>}
          </div>
          <div className="w-2 h-2 bg-orange-500 rounded-full shrink-0" />
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // MENÚ
  // ═══════════════════════════════════════════
  if (vista === 'menu') return (
    <div className="min-h-screen bg-gray-50">
      <PopupSugerido />
      {modalModificadores}
      {modalConfigPedido}
      <Header titulo={negocio?.nombre || ''} subtitulo={puedeOrdenar ? 'Toca + para agregar' : 'Solo lectura'} />

      {/* BROWSE */}
      {pasoOrden === 'browse' && (
        <>
          {/* Buscador + Categorías */}
          <div className="bg-white border-b border-gray-200 sticky top-[57px] z-10">
            <div className="px-4 pt-3 pb-2">
              <div className="relative max-w-2xl mx-auto">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={busquedaPlato}
                  onChange={e => setBusquedaPlato(e.target.value)}
                  placeholder="Buscar en el menú..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
                {busquedaPlato && (
                  <button onClick={() => setBusquedaPlato('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2 px-4 py-2 overflow-x-auto">
              {categorias.map(c => (
                <button key={c.id} onClick={() => { setCatActiva(c.id); setBusquedaPlato('') }}
                  className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                    catActiva === c.id && !busquedaPlato
                      ? 'bg-orange-500 text-white shadow-sm shadow-orange-200'
                      : 'bg-gray-900 text-white hover:bg-gray-700'
                  }`}>
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>

          {/* Platos */}
          <div className="p-4 max-w-2xl mx-auto space-y-3 pb-32">
            {(() => {
              const bq = busquedaPlato.trim().toLowerCase()
              return (bq
                ? platos.filter(p => p.nombre.toLowerCase().includes(bq) || (p.descripcion || '').toLowerCase().includes(bq))
                : platos.filter(p => p.categoria_id === catActiva)
              ).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
            })().map(plato => {
              const cant      = cantPlato(plato.id)
              const requiereConfig = tieneModificadores(plato as never)
              const disp      = plato.inv?.cantidad_disponible ?? null
              const sinStock  = turnoConInventario && disp !== null && disp === 0
              const stockBajo = turnoConInventario && disp !== null && disp > 0 && disp <= (plato.inv?.alerta_minima ?? 3)
              return (
                <div key={plato.id} className={`${CARD} overflow-hidden ${sinStock ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-4 p-4">
                    {plato.imagen_url
                      ? <img src={plato.imagen_url} alt={plato.nombre} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                      : <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                          <UtensilsCrossed size={26} className="text-gray-300" />
                        </div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm leading-tight">{plato.nombre}</p>
                      {plato.descripcion && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{plato.descripcion}</p>
                      )}
                      <p className="text-orange-500 font-black text-base mt-1.5">${plato.precio.toLocaleString('es-CO')}</p>
                      {sinStock  && <span className="inline-block mt-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">No disponible</span>}
                      {stockBajo && <span className="inline-block mt-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚠️ Pocas cantidades</span>}
                    </div>
                    <div className="shrink-0 pl-2">
                      {puedeOrdenar && !sinStock ? (
                        cant > 0 && !requiereConfig ? (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => cambiarCant(plato.id, -1)}
                              className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center font-black transition-colors">
                              <Minus size={14} className="text-gray-700" />
                            </button>
                            <span className="w-6 text-center font-black text-gray-900 text-lg">{cant}</span>
                            <button onClick={() => agregar(plato)}
                              className="w-8 h-8 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center transition-colors shadow-sm shadow-orange-200">
                              <Plus size={14} className="text-white" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => agregar(plato)}
                            className="w-10 h-10 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center shadow-md shadow-orange-200 transition-all active:scale-95">
                            <Plus size={18} className="text-white" />
                          </button>
                        )
                      ) : sinStock ? (
                        <span className="text-xs text-red-400 bg-red-50 px-2.5 py-1 rounded-full font-medium">Agotado</span>
                      ) : (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">Vista</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {(() => {
              const bq = busquedaPlato.trim().toLowerCase()
              const lista = bq
                ? platos.filter(p => p.nombre.toLowerCase().includes(bq) || (p.descripcion || '').toLowerCase().includes(bq))
                : platos.filter(p => p.categoria_id === catActiva)
              return lista.length === 0 ? (
                <div className="text-center py-16">
                  <UtensilsCrossed size={36} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">{bq ? `Sin resultados para "${bq}"` : 'Sin platos en esta categoría'}</p>
                </div>
              ) : null
            })()}
          </div>

          {/* Carrito flotante */}
          {puedeOrdenar && cantTotal > 0 && (
            <div className="fixed bottom-0 left-0 right-0 px-4 pb-5 pt-3 bg-gradient-to-t from-gray-50 to-transparent">
              <button onClick={irACheckout}
                className="w-full max-w-2xl mx-auto bg-gray-900 hover:bg-gray-800 text-white font-bold py-4 rounded-2xl flex items-center justify-between px-5 shadow-xl transition-colors active:scale-[0.98] block">
                <span className="bg-orange-500 text-white text-xs font-black w-7 h-7 rounded-full flex items-center justify-center shrink-0">{cantTotal}</span>
                <span className="text-sm">Ver carrito</span>
                <span className="font-black text-orange-400">${totalCarrito.toLocaleString('es-CO')}</span>
              </button>
            </div>
          )}

          {!puedeOrdenar && (
            <div className="mx-4 mb-4 bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-orange-500 shrink-0 mt-0.5" />
              <p className="text-sm text-orange-700">Pedidos online no disponibles. Acércate al mostrador.</p>
            </div>
          )}
        </>
      )}

      {/* TIPO */}
      {pasoOrden === 'tipo' && (
        <div className="p-4 max-w-2xl mx-auto pt-6 space-y-4">
          <div className="text-center mb-6">
            <p className="font-black text-gray-900 text-2xl">¿Cómo lo quieres?</p>
            <p className="text-gray-500 text-sm mt-1">Elige una opción para continuar</p>
          </div>
          {qrConsumo && (
            <button onClick={() => { setTipoConsumo('consumo'); setPasoOrden('datos') }}
              className={`${CARD} w-full p-5 flex items-center gap-4 hover:border-orange-300 hover:shadow-md transition-all active:scale-[0.98] text-left group`}>
              <div className="w-16 h-16 bg-orange-500 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-orange-100">
                <UtensilsCrossed size={26} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="font-black text-gray-900 text-xl">Para comer aquí</p>
                <p className="text-sm text-gray-500">Consumo en el restaurante</p>
              </div>
              <ArrowRight size={20} className="text-gray-300 group-hover:text-orange-500 transition-colors" />
            </button>
          )}
          {qrDomi && (
            <button onClick={() => { setTipoConsumo('domi'); setPasoOrden('datos') }}
              className={`${CARD} w-full p-5 flex items-center gap-4 hover:border-orange-300 hover:shadow-md transition-all active:scale-[0.98] text-left group`}>
              <div className="w-16 h-16 bg-gray-900 rounded-xl flex items-center justify-center shrink-0 shadow-md">
                <Bike size={26} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="font-black text-gray-900 text-xl">A domicilio</p>
                <p className="text-sm text-gray-500">Te lo llevamos a casa</p>
              </div>
              <ArrowRight size={20} className="text-gray-300 group-hover:text-orange-500 transition-colors" />
            </button>
          )}
          <button onClick={() => setPasoOrden('browse')} className="w-full text-sm text-gray-400 py-2 hover:text-gray-600 transition-colors">
            ← Volver al menú
          </button>
        </div>
      )}

      {/* DATOS */}
      {pasoOrden === 'datos' && (
        <div className="p-4 max-w-2xl mx-auto space-y-4 pb-8">
          <div className="flex items-center gap-2 py-2">
            <button onClick={() => setPasoOrden(qrConsumo && qrDomi ? 'tipo' : 'browse')}
              className="text-orange-500 text-sm font-bold flex items-center gap-1 hover:text-orange-600 transition-colors">
              <ChevronLeft size={16} /> Volver
            </button>
            <span className="text-xs text-gray-400">
              {tipoConsumo === 'consumo' ? '🍽️ Consumo en lugar' : '🛵 Domicilio'}
            </span>
          </div>

          {/* Resumen */}
          <div className={`${CARD} p-4`}>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Tu pedido</p>
            {carrito.map(i => (
              <div key={itemKey(i)} className="flex justify-between items-center py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-gray-400 w-5">{i.cantidad}×</span>
                  <div>
                    <span className="text-sm text-gray-700 font-medium">{i.plato.nombre}</span>
                    {i.modificadores.length > 0 && <p className="text-xs text-gray-500">{i.modificadores.map(m => `${m.nombre_grupo}: ${m.nombre_opcion}`).join(' · ')}</p>}
                  </div>
                </div>
                <span className="text-sm font-black text-gray-900">${(i.cantidad * i.plato.precio).toLocaleString('es-CO')}</span>
              </div>
            ))}
            <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between items-center">
              <span className="font-bold text-gray-600 text-sm">Total</span>
              <span className="font-black text-orange-500 text-xl">${totalCarrito.toLocaleString('es-CO')}</span>
            </div>
          </div>

          {/* Formulario */}
          <div className={`${CARD} p-4 space-y-3`}>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Tus datos</p>

            {/* Teléfono primero para poder saludar */}
            <input placeholder="Teléfono *" type="tel" value={telefono}
              onChange={e => { setTelefono(e.target.value); setClientePrevio(null) }}
              onBlur={e => buscarClientePorTelefono(e.target.value)}
              className={INPUT} />

            {buscandoCliente && (
              <p className="text-xs text-gray-400 flex items-center gap-1.5 pl-1">
                <Loader2 size={11} className="animate-spin text-orange-400" /> Verificando…
              </p>
            )}

            {clientePrevio && !buscandoCliente && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl">👋</span>
                <div>
                  <p className="text-orange-700 font-black text-sm">¡Hola de nuevo, {clientePrevio.nombre.split(' ')[0]}!</p>
                  <p className="text-orange-500 text-xs">Ya te tenemos registrado 🎉</p>
                </div>
              </div>
            )}

            <input placeholder="Nombre *" value={nombre} onChange={e => setNombre(e.target.value)} className={INPUT} />
            <input placeholder="Cédula (opcional)" value={cedula}
              onChange={e => { setCedula(e.target.value); setClientePrevio(null) }}
              onBlur={e => buscarClientePorCedula(e.target.value)}
              className={INPUT} />

            {tipoConsumo === 'consumo' && (
              <div>
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                  ¿En qué mesa estás? *
                </p>
                {mesasDisponibles.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {mesasDisponibles.map(m => {
                      const seleccionada = mesa === String(m.numero)
                      const libre = m.estado === 'libre'
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMesa(String(m.numero))}
                          className={`py-3 rounded-xl font-black text-base transition-all border-2 flex flex-col items-center justify-center gap-0.5 ${
                            seleccionada
                              ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-200 scale-105'
                              : libre
                              ? 'bg-white text-gray-900 border-gray-200 hover:border-orange-300 hover:shadow-sm'
                              : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-orange-200'
                          }`}
                        >
                          <span>{m.numero}</span>
                          {!libre && (
                            <span className="text-[9px] font-bold leading-none opacity-70">
                              {m.estado === 'ocupada' ? 'ocupada' : m.estado === 'esperando_pago' ? 'en pago' : m.estado}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  // Fallback si no cargaron mesas (e.g. RLS anon no configurado)
                  <input placeholder="Número de mesa *" type="number" value={mesa} onChange={e => setMesa(e.target.value)} className={INPUT} />
                )}
                {mesa && (
                  <p className="text-xs text-orange-600 font-bold mt-2 pl-1">✓ Mesa {mesa} seleccionada</p>
                )}
              </div>
            )}
            {tipoConsumo === 'domi' && (
              <input placeholder="Dirección de entrega *" value={direccion} onChange={e => setDireccion(e.target.value)} className={INPUT} />
            )}
            <textarea placeholder="Notas (alergias, instrucciones…)" value={notasPedido}
              onChange={e => setNotasPedido(e.target.value)} rows={2}
              className={`${INPUT} resize-none`} />
          </div>

          <button onClick={irAPago} className={`${BTN_PRIMARY}`}>
            {tipoConsumo === 'domi'
              ? <><ArrowRight size={18} /> Siguiente — Método de pago</>
              : <><Send size={18} /> Confirmar pedido</>}
          </button>
        </div>
      )}

      {/* PAGO (solo domi) */}
      {pasoOrden === 'pago' && (
        <div className="p-4 max-w-2xl mx-auto space-y-4 pb-8">
          <div className="flex items-center gap-2 py-2">
            <button onClick={() => setPasoOrden('datos')}
              className="text-orange-500 text-sm font-bold flex items-center gap-1">
              <ChevronLeft size={16} /> Volver
            </button>
          </div>

          <div className="text-center py-2">
            <p className="font-black text-gray-900 text-2xl">¿Cómo vas a pagar?</p>
            <p className="text-gray-500 text-sm mt-1">Selecciona el método antes de confirmar</p>
          </div>

          {/* Total */}
          <div className="bg-gray-900 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-semibold text-sm">Pedido</span>
              <span className="text-white font-black">${totalCarrito.toLocaleString('es-CO')}</span>
            </div>
            {tarifaDomicilio > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-semibold text-sm">Domicilio</span>
                <span className="text-white font-black">${tarifaDomicilio.toLocaleString('es-CO')}</span>
              </div>
            )}
            <div className="border-t border-white/10 pt-2 flex justify-between items-center">
              <span className="text-gray-300 font-semibold text-sm">Total cuenta</span>
              <span className="text-orange-400 font-black text-2xl">${totalDomi.toLocaleString('es-CO')}</span>
            </div>
          </div>

          {/* Opciones */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setMetodoPagoDomi('efectivo'); setComprobanteFile(null); setComprobantePreview(null); setPagoTarifaDomi('efectivo') }}
              className={`${CARD} p-5 flex flex-col items-center gap-3 transition-all hover:shadow-md ${
                metodoPagoDomi === 'efectivo' ? 'border-orange-400 ring-2 ring-orange-400/30 bg-orange-50' : ''
              }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${metodoPagoDomi === 'efectivo' ? 'bg-orange-500' : 'bg-gray-100'}`}>
                <Banknote size={24} className={metodoPagoDomi === 'efectivo' ? 'text-white' : 'text-gray-500'} />
              </div>
              <div className="text-center">
                <p className={`font-black text-sm ${metodoPagoDomi === 'efectivo' ? 'text-orange-700' : 'text-gray-900'}`}>Efectivo</p>
                <p className="text-xs text-gray-400 mt-0.5">Pago al recibir</p>
              </div>
            </button>

            <button onClick={() => { setMetodoPagoDomi('transferencia'); setPagoTarifaDomi('transferencia') }}
              className={`${CARD} p-5 flex flex-col items-center gap-3 transition-all hover:shadow-md ${
                metodoPagoDomi === 'transferencia' ? 'border-orange-400 ring-2 ring-orange-400/30 bg-orange-50' : ''
              }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${metodoPagoDomi === 'transferencia' ? 'bg-orange-500' : 'bg-gray-100'}`}>
                <CreditCard size={24} className={metodoPagoDomi === 'transferencia' ? 'text-white' : 'text-gray-500'} />
              </div>
              <div className="text-center">
                <p className={`font-black text-sm ${metodoPagoDomi === 'transferencia' ? 'text-orange-700' : 'text-gray-900'}`}>Transferencia</p>
                <p className="text-xs text-gray-400 mt-0.5">Nequi / Bancolombia</p>
              </div>
            </button>
          </div>

          {/* Info efectivo */}
          {metodoPagoDomi === 'efectivo' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-2xl">💵</span>
              <div>
                <p className="text-amber-800 font-bold text-sm">Pago en efectivo</p>
                <p className="text-amber-600 text-xs mt-0.5">Ten el dinero listo al recibir. El domiciliario te dará el cambio.</p>
              </div>
            </div>
          )}

          {/* Comprobante */}
          {metodoPagoDomi === 'transferencia' && (
            <div className="space-y-3">
              {tarifaDomicilio > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-3 space-y-2">
                  <p className="text-sm font-black text-gray-900">¿Cómo quieres pagar el domicilio?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPagoTarifaDomi('transferencia')}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold ${pagoTarifaDomi === 'transferencia' ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                      Incluir en transferencia
                    </button>
                    <button
                      type="button"
                      onClick={() => setPagoTarifaDomi('efectivo')}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold ${pagoTarifaDomi === 'efectivo' ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                      Pagar domi en efectivo
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Transferencia ahora: <b>${totalTransferenciaDomi.toLocaleString('es-CO')}</b>
                  </p>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
                <span className="text-2xl">📱</span>
                <div>
                  <p className="text-blue-800 font-bold text-sm">Adjunta tu comprobante</p>
                  <p className="text-blue-600 text-xs mt-0.5">Sube la captura de pantalla o foto del pago. El restaurante lo verificará.</p>
                </div>
              </div>

              {comprobantePreview ? (
                <div className="relative">
                  <img src={comprobantePreview} alt="Comprobante" className="w-full max-h-64 object-contain rounded-2xl border border-gray-200 bg-gray-50" />
                  <button onClick={() => { setComprobanteFile(null); setComprobantePreview(null) }}
                    className="absolute top-2 right-2 w-8 h-8 bg-white border border-gray-200 shadow rounded-full flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors">
                    <X size={16} />
                  </button>
                  <div className="mt-2 flex items-center gap-1.5 text-green-600 text-sm pl-1">
                    <CheckCircle size={15} />
                    <span className="font-semibold">Comprobante listo</span>
                  </div>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 hover:border-orange-400 rounded-2xl p-8 flex flex-col items-center gap-3 bg-white hover:bg-orange-50 transition-all text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <Upload size={22} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-700 text-sm">Toca para adjuntar</p>
                    <p className="text-xs text-gray-400 mt-0.5">Foto o captura (max 5MB)</p>
                  </div>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleComprobanteChange} />
            </div>
          )}

          <button onClick={enviarPedido}
            disabled={enviando || !metodoPagoDomi || (metodoPagoDomi === 'transferencia' && !comprobanteFile)}
            className={`${BTN_PRIMARY} ${BTN_DISABLED}`}>
            {enviando
              ? <><Loader2 size={18} className="animate-spin" /> {subiendoComprobante ? 'Subiendo…' : 'Enviando…'}</>
              : <><Send size={18} /> Confirmar pedido</>}
          </button>
          {metodoPagoDomi === 'transferencia' && !comprobanteFile && (
            <p className="text-center text-xs text-gray-400">Adjunta el comprobante para continuar</p>
          )}
        </div>
      )}

      {/* SEGUIMIENTO */}
      {pasoOrden === 'seguimiento' && (() => {
        const esDomi = tipoConsumo === 'domi'
        const est = pedidoEstado || (esDomi ? 'pendiente_pago' : 'pendiente')

        // Tarjetas de estado para domi
        const DOMI_ESTADO: Record<string, { bg: string; emoji: string; titulo: string; subtitulo: string }> = {
          pendiente_pago:  { bg: 'from-yellow-400 to-amber-400',  emoji: '🔍', titulo: 'Verificando tu pago…',    subtitulo: 'El restaurante está revisando tu comprobante. Te avisamos.' },
          pendiente:       { bg: 'from-gray-600 to-gray-700',     emoji: '⏳', titulo: 'Pedido en cola',           subtitulo: 'Lo tenemos, pronto pasamos a prepararlo.' },
          en_preparacion:  { bg: 'from-orange-500 to-amber-500',  emoji: '🔥', titulo: 'Preparando tu pedido…',    subtitulo: 'La cocina está trabajando en tu pedido.' },
          listo:           { bg: 'from-green-500 to-emerald-500', emoji: '✅', titulo: '¡Pedido listo!',           subtitulo: 'El domiciliario ya va a recogerte tu pedido.' },
          en_camino:       { bg: 'from-blue-500 to-sky-500',      emoji: '🛵', titulo: '¡En camino!',              subtitulo: 'El domiciliario ya está en ruta hacia ti.' },
          entregado:       { bg: 'from-green-500 to-emerald-600', emoji: '🎉', titulo: '¡Entregado!',              subtitulo: '¡Gracias por tu pedido! Buen provecho.' },
          pagado:          { bg: 'from-green-500 to-emerald-600', emoji: '🎉', titulo: '¡Entregado!',              subtitulo: '¡Gracias por tu pedido! Buen provecho.' },
        }
        const estadoCfgDomi = DOMI_ESTADO[est] ?? DOMI_ESTADO['pendiente']

        return (
          <div className="p-4 max-w-2xl mx-auto space-y-4 pb-8">

            {/* Banner de estado */}
            <div className={`bg-gradient-to-br ${esDomi ? estadoCfgDomi.bg : 'from-orange-500 to-amber-500'} rounded-3xl p-7 text-center text-white shadow-xl mt-4`}>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">
                {esDomi ? estadoCfgDomi.emoji : <CheckCircle size={32} />}
              </div>
              <p className="font-black text-2xl mb-1">{esDomi ? estadoCfgDomi.titulo : '¡Pedido enviado!'}</p>
              <p className="text-white/80 text-sm">{esDomi ? estadoCfgDomi.subtitulo : '🍽️ Sigue el estado abajo'}</p>
            </div>

            {/* Recordatorio efectivo */}
            {esDomi && metodoPagoDomi === 'efectivo' && est !== 'pagado' && est !== 'entregado' && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">💵</span>
                <div>
                  <p className="text-amber-800 font-bold text-sm">Recuerda tener listo</p>
                  <p className="text-amber-600 text-sm font-black">${totalDomi.toLocaleString('es-CO')}</p>
                </div>
              </div>
            )}

            {/* Items — solo si no es domi en camino/entregado */}
            {!(esDomi && (est === 'en_camino' || est === 'pagado' || est === 'entregado')) && (
              <div className="space-y-2">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">
                  {esDomi && est === 'pendiente_pago' ? 'Tu pedido' : 'Estado del pedido'}
                </p>
                {itemsSeg.map(item => {
                  const cfg = esDomi && est === 'pendiente_pago'
                    ? ESTADO_CFG['pendiente_pago']
                    : (ESTADO_CFG[item.estado] ?? ESTADO_CFG['pendiente'])
                  return (
                    <div key={item.id} className={`${CARD} px-4 py-4 flex items-center justify-between`}>
                      <p className="text-sm font-semibold text-gray-800">{item.cantidad}× {item.nombre}</p>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className={`text-xs font-bold ${cfg.texto}`}>{cfg.label}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <button onClick={resetPedido} className={BTN_DARK}>Hacer otro pedido →</button>
          </div>
        )
      })()}
    </div>
  )

  // ═══════════════════════════════════════════
  // RESERVAS
  // ═══════════════════════════════════════════
  if (vista === 'reservas') return (
    <div className="min-h-screen bg-gray-50">
      <Header titulo="Reservas" subtitulo="Asegura tu mesa con anticipación" />
      <div className="p-4 max-w-2xl mx-auto pb-8">
        {resOk ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={36} className="text-orange-500" />
            </div>
            <p className="font-black text-gray-900 text-2xl mb-2">¡Reserva enviada!</p>
            <p className="text-gray-500 mb-8">El restaurante confirmará pronto. ¡Nos vemos!</p>
            <button onClick={() => { setResOk(false); setFormRes({ nombre: '', telefono: '', fecha: '', hora: '12:00', personas: 2, notas: '' }) }}
              className="bg-orange-500 text-white font-bold px-8 py-3 rounded-xl hover:bg-orange-600 transition-colors">
              Otra reserva
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            <div className={`${CARD} p-5 space-y-3`}>
              <input placeholder="Tu nombre *" value={formRes.nombre} onChange={e => setFormRes(p => ({ ...p, nombre: e.target.value }))} className={INPUT} />
              <input placeholder="Teléfono *" type="tel" value={formRes.telefono} onChange={e => setFormRes(p => ({ ...p, telefono: e.target.value }))} className={INPUT} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Fecha *</label>
                  <input type="date" value={formRes.fecha} min={new Date().toISOString().split('T')[0]}
                    onChange={e => setFormRes(p => ({ ...p, fecha: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Hora *</label>
                  <input type="time" value={formRes.hora} onChange={e => setFormRes(p => ({ ...p, hora: e.target.value }))} className={INPUT} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-2">Personas</label>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setFormRes(p => ({ ...p, personas: Math.max(1, p.personas - 1) }))}
                    className="w-11 h-11 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center font-black transition-colors">
                    <Minus size={18} className="text-gray-700" />
                  </button>
                  <span className="text-3xl font-black text-gray-900 w-12 text-center">{formRes.personas}</span>
                  <button type="button" onClick={() => setFormRes(p => ({ ...p, personas: Math.min(20, p.personas + 1) }))}
                    className="w-11 h-11 bg-orange-500 hover:bg-orange-600 rounded-xl flex items-center justify-center transition-colors">
                    <Plus size={18} className="text-white" />
                  </button>
                  <span className="text-sm text-gray-400">persona{formRes.personas !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <textarea placeholder="Notas (cumpleaños, alergias…)" value={formRes.notas}
                onChange={e => setFormRes(p => ({ ...p, notas: e.target.value }))} rows={2} className={`${INPUT} resize-none`} />
            </div>
            <button onClick={enviarReserva} disabled={enviandoRes} className={`${BTN_PRIMARY} ${BTN_DISABLED}`}>
              {enviandoRes ? <Loader2 size={18} className="animate-spin" /> : <CalendarDays size={18} />}
              {enviandoRes ? 'Enviando…' : 'Solicitar reserva'}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // ═══════════════════════════════════════════
  // RESEÑAS
  // ═══════════════════════════════════════════
  if (vista === 'resenas') return (
    <div className="min-h-screen bg-gray-50">
      <Header titulo="Reseñas" subtitulo={resenas.length > 0 ? `★ ${promedioResenas.toFixed(1)} · ${resenas.length} opiniones` : 'Sé el primero'} />
      <div className="p-4 max-w-2xl mx-auto space-y-4 pb-8">
        <div className={`${CARD} p-5 space-y-4 mt-4`}>
          <p className="font-black text-gray-900">Tu experiencia</p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 font-medium">Calificación</span>
            <Estrellas valor={formResena.puntuacion} onChange={n => setFormResena(p => ({ ...p, puntuacion: n }))} size="lg" />
          </div>
          <input placeholder="Tu nombre" value={formResena.nombre} onChange={e => setFormResena(p => ({ ...p, nombre: e.target.value }))} className={INPUT} />
          <textarea placeholder="Cuéntanos tu experiencia…" value={formResena.comentario}
            onChange={e => setFormResena(p => ({ ...p, comentario: e.target.value }))} rows={3} className={`${INPUT} resize-none`} />
          <button onClick={enviarResena} disabled={enviandoResena} className={`${BTN_PRIMARY} ${BTN_DISABLED}`}>
            {enviandoResena ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
            Publicar reseña
          </button>
        </div>

        {resenas.length === 0 ? (
          <div className="text-center py-12 text-gray-300">
            <Star size={40} className="mx-auto mb-3" />
            <p className="text-gray-400">¡Sé el primero en opinar!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resenas.map(r => (
              <div key={r.id} className={`${CARD} p-4`}>
                <div className="flex items-start justify-between gap-2 mb-2">
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

  // ═══════════════════════════════════════════
  // PQRS
  // ═══════════════════════════════════════════
  if (vista === 'pqrs') return (
    <div className="min-h-screen bg-gray-50">
      <Header titulo="Contáctanos" subtitulo="Peticiones, quejas, reclamos y sugerencias" />
      <div className="p-4 max-w-2xl mx-auto pb-8">
        {pqrsOk ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={36} className="text-orange-500" />
            </div>
            <p className="font-black text-gray-900 text-2xl mb-2">¡Mensaje enviado!</p>
            <p className="text-gray-500 mb-8">Revisaremos tu solicitud. Gracias.</p>
            <button onClick={() => { setPqrsOk(false); setFormPqrs({ nombre: '', telefono: '', tipo: 'peticion', mensaje: '' }) }}
              className="bg-gray-900 text-white font-bold px-8 py-3 rounded-xl hover:bg-gray-800 transition-colors">
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
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}>
                  {t === 'peticion' ? '📋 Petición' : t === 'queja' ? '😤 Queja' : t === 'reclamo' ? '⚠️ Reclamo' : '💡 Sugerencia'}
                </button>
              ))}
            </div>
            <div className={`${CARD} p-5 space-y-3`}>
              <input placeholder="Tu nombre *" value={formPqrs.nombre} onChange={e => setFormPqrs(p => ({ ...p, nombre: e.target.value }))} className={INPUT} />
              <input placeholder="Teléfono (opcional)" type="tel" value={formPqrs.telefono} onChange={e => setFormPqrs(p => ({ ...p, telefono: e.target.value }))} className={INPUT} />
              <textarea placeholder="Describe tu solicitud *" value={formPqrs.mensaje}
                onChange={e => setFormPqrs(p => ({ ...p, mensaje: e.target.value }))} rows={4} className={`${INPUT} resize-none`} />
            </div>
            <button onClick={enviarPqrs} disabled={enviandoPqrs} className={`${BTN_PRIMARY} ${BTN_DISABLED}`}>
              {enviandoPqrs ? <Loader2 size={18} className="animate-spin" /> : <MessageSquare size={18} />}
              {enviandoPqrs ? 'Enviando…' : 'Enviar mensaje'}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return null
}

export default function RestaurantePublicoPage({ params }: { params: Promise<{ negocioId: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RestaurantePublicoInner params={params} />
    </Suspense>
  )
}
