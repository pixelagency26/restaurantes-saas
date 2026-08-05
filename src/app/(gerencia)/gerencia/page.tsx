'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  BarChart3, TrendingUp, Users, DollarSign, Clock, ChefHat,
  Plus, Minus, X, Play, Square, MapPin, CheckCircle, Banknote,
  Pencil, Trash2, UtensilsCrossed, Timer, UserCircle, Search, Bike,
  Download, Upload, SlidersHorizontal, CalendarDays, Settings, Lock, ClipboardList,
  LogOut, AlertTriangle, RotateCcw, ShieldAlert
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts'
import ModificadorModal from '@/components/ModificadorModal'
import ConfigurarModificadoresPedido from '@/components/ConfigurarModificadoresPedido'
import { ItemConModificadores, consumoInventarioCarrito, hayConfigPendiente, itemKey, itemPedidoPayload, modificadoresPedidoPayload, tieneModificadores } from '@/lib/modificadores'
import { itemDomicilioPayload, parseTarifaDomicilio } from '@/lib/domicilios'
import { ModificadorSeleccionado } from '@/types'

// ─── TIPOS ───────────────────────────────────────────────────
interface PlatoStat { nombre: string; cantidad: number; total: number }
interface MeseraStat { nombre: string; pedidos: number; total: number }
interface PedidoResumen { id: string; mesa: number; total: number; estado: string; created_at: string; pagado_en?: string | null; tipo: string; turno_id?: string | null }
interface ItemDetalle { id?: string; plato_id?: string | null; nombre: string; cantidad: number; precio_unitario: number; notas: string | null; estado: string; pedido_por_nombre?: string | null }
interface PedidoDetalle {
  id: string; estado: string; tipo: string; created_at: string; notas: string | null
  mesa: { numero: number }; mesera: { nombre: string } | null; items: ItemDetalle[]
  cliente_nombre?: string | null; cliente_telefono?: string | null
  cliente_cedula?: string | null; cliente_direccion?: string | null
  comprobante_url?: string | null; metodo_pago_cliente?: string | null
}
interface PagoRegistrado { id: string; metodo: string; monto: number; propina: number; created_at: string }
interface TiempoStat { nombre: string; espera: number; preparacion: number; total: number; cantidad: number }
interface CocineroStat { nombre: string; platos: number; tiempoPromedio: number }
interface Categoria { id: number; nombre: string; orden: number }
interface ClienteStat {
  id: string; cedula: string | null; nombre: string; telefono: string | null
  fecha_cumpleanos: string | null; notas?: string | null; advertencias?: string | null
  pedidos: number; totalGastado: number; ultimaVisita: string | null
}
interface ClientePedidoItem { nombre: string; cantidad: number; precio_unitario: number }
interface ClientePedido { id: string; created_at: string; total: number; tipo: string; estado: string; items: ClientePedidoItem[] }
interface HistorialItemPedido {
  id: string; plato_id: string | null; cantidad: number; precio_unitario: number; notas: string | null; estado: string
  plato: { nombre: string; controla_inventario: boolean } | null
}
interface HistorialPedido {
  id: string; created_at: string; tipo: string; estado: string; turno_id: string | null; cliente_nombre: string | null
  mesa: { numero: number } | null
  cliente: { nombre: string; cedula: string | null } | null
  mesera: { nombre: string } | null
  items: HistorialItemPedido[]
  pagos: { id: string; metodo: string; monto: number; propina: number }[]
}
interface Plato {
  id: string; nombre: string; descripcion: string | null; precio: number; costo: number | null
  categoria_id: number; imagen_url: string | null; activo: boolean
  visible_menu?: boolean; controla_inventario?: boolean; modificadores?: GrupoModificador[]
}
interface PlatoOpcionComponente {
  id: string; componente_plato_id: string; cantidad: number
  componente?: { nombre: string } | null
}
interface PlatoOpcion {
  id: string; nombre: string; es_default: boolean; orden: number
  componentes: PlatoOpcionComponente[]
}
interface OpcionModificador {
  id: string; nombre: string; componente_plato_id: string | null; cantidad_descontar: number
  descuenta_inventario: boolean; es_opcion_no_aplica: boolean; orden: number; activo: boolean
  componente?: { nombre: string } | null
}
interface GrupoModificador {
  id: string; nombre: string; tipo: 'radio' | 'checkbox'; min_selecciones: number
  max_selecciones: number | null; tiene_opcion_todos: boolean; obligatorio: boolean; orden: number
  opciones: OpcionModificador[]
}
interface MenuTurno {
  id: string; nombre: string
  items: { plato_id: string; cantidad: number }[]
  created_at: string
}
interface InventarioTurnoItem {
  plato_id: string
  nombre: string
  categoria: string
  cantidad_inicial: number
  cantidad_actual: number
  alerta_minima: number
  en_turno: boolean
}

type MetodoPago = 'efectivo' | 'nequi' | 'daviplata' | 'bancolombia'
type Seccion = 'mesas' | 'carta' | 'resumen' | 'tiempos' | 'caja' | 'usuarios' | 'clientes' | 'permisos' | 'reservas' | 'marketing' | 'historial'
type RangoResumen = 'hoy' | 'semana' | 'mes' | 'personalizado'

const GUIA_GERENCIA: { seccion: Seccion; titulo: string; texto: string; accion: string; planReq: 'starter' | 'basico' | 'pro' }[] = [
  { seccion: 'mesas', titulo: 'Mesas y pedidos', texto: 'Aqui ves mesas ocupadas, domicilios pendientes y puedes cobrar, editar cuentas o tomar pedidos desde gerencia.', accion: 'Revisa una mesa o crea un pedido nuevo cuando haya turno abierto.', planReq: 'starter' },
  { seccion: 'carta', titulo: 'Carta e inventario', texto: 'Aqui administras platos, precios, fotos, categorias y complementos inventariables.', accion: 'Crea o edita platos antes de abrir el turno.', planReq: 'starter' },
  { seccion: 'resumen', titulo: 'Informes', texto: 'Aqui ves ventas, pedidos, utilidad, metodos de pago y comparativas contra la semana anterior.', accion: 'Cambia el rango para revisar hoy, semana, mes o fechas exactas.', planReq: 'basico' },
  { seccion: 'tiempos', titulo: 'Tiempos', texto: 'Aqui miras demoras por plato, cocinero y mesera para detectar cuellos de botella.', accion: 'Usalo al final del dia para mejorar cocina y servicio.', planReq: 'pro' },
  { seccion: 'clientes', titulo: 'Clientes', texto: 'Aqui consultas clientes, historial, gasto, cumpleanos, notas y advertencias.', accion: 'Importa o edita clientes para que el sistema los autocomplete al pedir.', planReq: 'basico' },
  { seccion: 'reservas', titulo: 'Reservas', texto: 'Aqui aparecen las solicitudes que llegan desde la pagina publica.', accion: 'Confirma o cancela reservas para mantener el salon organizado.', planReq: 'basico' },
  { seccion: 'marketing', titulo: 'Marketing', texto: 'Aqui configuras sugeridos, promociones visuales y herramientas para vender mas.', accion: 'Activa el sugerido del mes cuando quieras empujar un plato.', planReq: 'pro' },
  { seccion: 'caja', titulo: 'Caja y turno', texto: 'Aqui abres turno, cargas inventario inicial, registras movimientos y cierras caja.', accion: 'Abre turno con inventario para que todos vean disponibilidad en tiempo real.', planReq: 'starter' },
]

const METODOS: { id: MetodoPago; label: string; color: string; emoji: string }[] = [
  { id: 'efectivo',    label: 'Efectivo',    color: 'bg-green-500',  emoji: '💵' },
  { id: 'nequi',       label: 'Nequi',       color: 'bg-gray-600', emoji: '💜' },
  { id: 'daviplata',   label: 'Daviplata',   color: 'bg-red-500',    emoji: '❤️' },
  { id: 'bancolombia', label: 'Bancolombia', color: 'bg-yellow-500', emoji: '🟡' },
]

const METODOS_DIGITALES_DOMI = ['transferencia', 'nequi', 'daviplata', 'bancolombia']
const CARGOS_EXTRA_RAPIDOS = ['Empaque', 'Desechables', 'Domi', 'Servicio extra', 'Daño', 'Otro']

const PLATO_VACIO: Omit<Plato, 'id'> = {
  nombre: '', descripcion: '', precio: 0, costo: 0, categoria_id: 0, imagen_url: '',
  activo: true, visible_menu: true, controla_inventario: true,
}

function desplazarFechaISO(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

function diasEntreInclusive(desde: string, hasta: string) {
  const a = new Date(`${desde}T12:00:00`).getTime()
  const b = new Date(`${hasta}T12:00:00`).getTime()
  return Math.max(1, Math.round((b - a) / 86400000) + 1)
}

function porcentajeCambio(actual: number, anterior: number) {
  if (anterior === 0) return actual > 0 ? 100 : 0
  return Math.round(((actual - anterior) / anterior) * 100)
}

export default function GerenciaPage() {
  const [seccion, setSeccion] = useState<Seccion>('mesas')
  const [preguntarGuia, setPreguntarGuia] = useState(false)
  const [guiaActiva, setGuiaActiva] = useState(false)
  const [guiaPaso, setGuiaPaso] = useState(0)
  const [turnoActivo, setTurnoActivo] = useState<{ id: string; abierto_en: string; monto_inicial: number } | null>(null)
  const [stats, setStats] = useState({ ventas: 0, pedidos: 0, utilidad: 0 })
  const [platosTop, setPlatosTop] = useState<PlatoStat[]>([])
  const [meseras, setMeseras] = useState<MeseraStat[]>([])
  const [pedidosHoy, setPedidosHoy] = useState<PedidoResumen[]>([])

  // Mesas y cobro
  const [mesas, setMesas] = useState<{ id: number; numero: number; estado: string; zona: string | null }[]>([])
  const [domiActivos, setDomiActivos] = useState<{
    id: string; created_at: string; total: number
    cliente_nombre: string | null; cliente_telefono: string | null
    estado: string; metodos: string[]
    metodo_pago_cliente: string | null
    comprobante_url: string | null
    pago_domi_aprobado: boolean
  }[]>([])
  const [notifsListoDomi, setNotifsListoDomi] = useState<{ id: number; clienteNombre: string }[]>([])
  const [mesaDetalle, setMesaDetalle] = useState<{ mesa: typeof mesas[0] | null; pedido: PedidoDetalle; pagos: PagoRegistrado[]; isDomi?: boolean } | null>(null)
  const [montoPago, setMontoPago] = useState(''); const [propinaPago, setPropinaPago] = useState(''); const [pagaCon, setPagaCon] = useState('')
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo'); const [agregandoPago, setAgregandoPago] = useState(false)
  const [vistaModal, setVistaModal] = useState<'pago' | 'cliente'>('pago')

  // Captura cliente al cobrar
  const [telefonoCliente, setTelefonoCliente] = useState('')
  const [clienteEncontrado, setClienteEncontrado] = useState<{ id: string; nombre: string; telefono: string | null } | null>(null)
  const [clienteForm, setClienteForm] = useState({ nombre: '', telefono: '', fecha_cumpleanos: '' })
  const [buscandoCl, setBuscandoCl] = useState(false)
  const [guardandoCl, setGuardandoCl] = useState(false)
  const [pedidoPagadoId, setPedidoPagadoId] = useState<string | null>(null)

  // Caja
  const [montoInicial, setMontoInicial] = useState('')
  const [modalCaja, setModalCaja] = useState<'abrir' | 'cerrar' | null>(null)
  const [conteoFinal, setConteoFinal] = useState<Record<string, string>>({})
  const [pagosPorMetodo, setPagosPorMetodo] = useState<{ metodo: string; monto: number; propina: number }[]>([])
  const [movimientosCaja, setMovimientosCaja] = useState<{ id: string; tipo: string; monto: number; descripcion: string | null; created_at: string }[]>([])
  const [nuevoMov, setNuevoMov] = useState({ tipo: 'egreso' as 'ingreso' | 'egreso', monto: '', descripcion: '' })
  const [agregandoMov, setAgregandoMov] = useState(false)
  const [abriendo, setAbriendo] = useState(false)
  const [cerrandoTurno, setCerrandoTurno] = useState(false)
  // Inventario por turno
  const [pasoCaja, setPasoCaja] = useState<'efectivo' | 'inventario'>('efectivo')
  const [inventarioTurno, setInventarioTurno] = useState<Record<string, number>>({})
  const [resumenInventario, setResumenInventario] = useState<{ plato_id: string; nombre: string; categoria: string; precio: number; cantidad_inicial: number; cantidad_restante: number }[]>([])
  const [modalAjusteInventario, setModalAjusteInventario] = useState(false)
  const [inventarioTurnoItems, setInventarioTurnoItems] = useState<InventarioTurnoItem[]>([])
  const [inventarioTurnoValores, setInventarioTurnoValores] = useState<Record<string, string>>({})
  const [guardandoInventarioId, setGuardandoInventarioId] = useState<string | null>(null)

  // Usuarios
  const [modalUsuario, setModalUsuario] = useState(false)
  const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: '', email: '', password: '', rol: 'mesera' })
  const [creandoUsuario, setCreandoUsuario] = useState(false)
  const [errorCrearUsuario, setErrorCrearUsuario] = useState<string | null>(null)
  const [listaUsuarios, setListaUsuarios] = useState<{ id: string; nombre: string; rol: string; activo: boolean }[]>([])
  const [editandoUsuario, setEditandoUsuario] = useState<{ id: string; nombre: string; rol: string; activo: boolean; nuevaPassword: string } | null>(null)
  const [guardandoUsuario, setGuardandoUsuario] = useState(false)
  const [eliminandoUsuario, setEliminandoUsuario] = useState(false)

  // Tiempos (hoy — sección Tiempos)
  const [tiemposPorPlato, setTiemposPorPlato] = useState<TiempoStat[]>([])
  const [tiemposPorCocinero, setTiemposPorCocinero] = useState<CocineroStat[]>([])
  const [tiemposPorMesera, setTiemposPorMesera] = useState<{ nombre: string; pedidos: number; tiempoPromedio: number }[]>([])

  // Tiempos del período (sección Informes — filtrado por fecha)
  const [resumenTiempoPlato, setResumenTiempoPlato] = useState<TiempoStat[]>([])
  const [resumenTiempoCocinero, setResumenTiempoCocinero] = useState<CocineroStat[]>([])

  // Resumen / informes
  const [rangoResumen, setRangoResumen] = useState<RangoResumen>('hoy')
  const hoyStr = new Date().toISOString().split('T')[0]
  const [fechaDesde, setFechaDesde] = useState(hoyStr)
  const [fechaHasta, setFechaHasta] = useState(hoyStr)
  const [ventasPorHora, setVentasPorHora] = useState<{ hora: string; ventas: number }[]>([])
  const [ventasPorDia, setVentasPorDia] = useState<{ dia: string; ventas: number; domis: number }[]>([])
  const [datosPagosMetodo, setDatosPagosMetodo] = useState<{ name: string; value: number; color: string }[]>([])
  const [resumenStats, setResumenStats] = useState({ ventas: 0, pedidos: 0, utilidad: 0, domis: 0 })
  const [resumenStatsAnterior, setResumenStatsAnterior] = useState({ ventas: 0, pedidos: 0, utilidad: 0, domis: 0 })
  const [cargandoResumen, setCargandoResumen] = useState(false)

  // Clientes
  const [clientes, setClientes] = useState<ClienteStat[]>([])
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [clienteDetalle, setClienteDetalle] = useState<{ cliente: ClienteStat; pedidos: ClientePedido[] } | null>(null)
  const [clienteEditando, setClienteEditando] = useState<ClienteStat | null>(null)
  const [clienteFormEdit, setClienteFormEdit] = useState({ nombre: '', cedula: '', telefono: '', fecha_cumpleanos: '', notas: '', advertencias: '' })
  const [cargandoClientes, setCargandoClientes] = useState(false)
  const [importandoClientes, setImportandoClientes] = useState(false)
  const [ordenClientes, setOrdenClientes] = useState<'mayor_consumo' | 'menor_consumo' | 'az' | 'cumpleanos'>('mayor_consumo')
  const [filtroMesCumple, setFiltroMesCumple] = useState<number>(0) // 0 = todos los meses

  // Menús de turno (múltiples menús con nombre)
  const [subSeccionCarta, setSubSeccionCarta] = useState<'carta' | 'menus'>('carta')
  const [menusTurno, setMenusTurno] = useState<MenuTurno[]>([])
  const [modalNuevoMenu, setModalNuevoMenu] = useState<'nuevo' | 'editar' | null>(null)
  const [menuForm, setMenuForm] = useState<{ nombre: string; items: Record<string, number> }>({ nombre: '', items: {} })
  const [editandoMenuId, setEditandoMenuId] = useState<string | null>(null)
  const [guardandoMenu, setGuardandoMenu] = useState(false)
  // Modo inventario al abrir turno
  const [modoInventario, setModoInventario] = useState<'manual' | 'menu'>('manual')
  const [menuSeleccionadoId, setMenuSeleccionadoId] = useState<string | null>(null)

  // Reservas
  const [reservas, setReservas] = useState<{ id: string; nombre: string; telefono: string; fecha: string; hora: string; personas: number; notas: string | null; estado: string; created_at: string }[]>([])
  const [cargandoReservas, setCargandoReservas] = useState(false)
  const [filtroReservaEstado, setFiltroReservaEstado] = useState<'todos' | 'pendiente' | 'confirmada' | 'cancelada'>('todos')

  // Permisos / configuración cocina
  const [bloqueoActivo, setBloqueoActivo] = useState(false)
  const [bloqueoCantidad, setBloqueoCantidad] = useState(3)
  const [guardandoPermisos, setGuardandoPermisos] = useState(false)
  // Nombres de cocineros (sin cuenta separada)
  const [nombresCocineros, setNombresCocineros] = useState<string[]>([])
  const [nuevoNombreCocinero, setNuevoNombreCocinero] = useState('')
  const [guardandoNombresCocineros, setGuardandoNombresCocineros] = useState(false)
  // Sugerido del mes
  const [sugeridoActivo, setSugeridoActivo] = useState(false)
  const [sugeridoNombre, setSugeridoNombre] = useState('')
  const [sugeridoPrecio, setSugeridoPrecio] = useState('')
  const [sugeridoDescripcion, setSugeridoDescripcion] = useState('')
  const [sugeridoImagenUrl, setSugeridoImagenUrl] = useState('')
  const [guardandoSugerido, setGuardandoSugerido] = useState(false)
  // Permisos QR
  const [qrConsumoActivo, setQrConsumoActivo] = useState(false)
  const [qrDomiActivo, setQrDomiActivo] = useState(false)
  const [tarifaDomicilio, setTarifaDomicilio] = useState('')
  const [guardandoDomicilios, setGuardandoDomicilios] = useState(false)

  // Plan del negocio (para control de acceso)
  const [negocioPlan, setNegocioPlan] = useState<'starter' | 'basico' | 'pro'>('pro')
  const [negocioId, setNegocioId] = useState<string | null>(null)

  // Panel de configuración ⚙️
  const [modalSettings, setModalSettings] = useState(false)
  const [seccionSettings, setSeccionSettings] = useState<'cuenta' | 'usuarios' | 'permisos' | 'restablecer' | 'facturacion' | 'domicilios' | 'marketing'>('cuenta')
  // Facturación
  const [facturacion, setFacturacion] = useState<{ plan: string; activa: boolean; hasta: string | null; nombre: string } | null>(null)
  const [cargandoFact, setCargandoFact] = useState(false)
  // Restablecer negocio
  const [restablecerScope, setRestablecerScope] = useState<'todo' | 'desde_fecha'>('todo')
  const [restablecerFecha, setRestablecerFecha] = useState('')
  const [restablecerItems, setRestablecerItems] = useState({ pedidos: false, turnos: false, clientes: false, inventario: false })
  const [restablecerConfirm, setRestablecerConfirm] = useState('')
  const [restableciendo, setRestableciendo] = useState(false)
  const [pasoRestablecer, setPasoRestablecer] = useState<'opciones' | 'confirmar'>('opciones')

  // Edición de ítems desde gerencia (cancelar / reemplazar)
  const [modoEdicionPedido, setModoEdicionPedido] = useState(false)
  const [itemReemplazando, setItemReemplazando] = useState<{ id: string; nombre: string } | null>(null)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [guardandoPrecioItemId, setGuardandoPrecioItemId] = useState<string | null>(null)
  const [preciosEditados, setPreciosEditados] = useState<Record<string, string>>({})
  const [categoriaReemplazo, setCategoriaReemplazo] = useState<number | 'todas'>('todas')
  const [cargoExtraNombre, setCargoExtraNombre] = useState('')
  const [cargoExtraMonto, setCargoExtraMonto] = useState('')
  const [guardandoCargoExtra, setGuardandoCargoExtra] = useState(false)

  // Tomar pedido desde gerencia
  const [modalNuevoPedido, setModalNuevoPedido] = useState(false)
  const [nuevoOrdenTipo, setNuevoOrdenTipo] = useState<'mesa' | 'domi'>('mesa')
  const [nuevoOrdenMesaId, setNuevoOrdenMesaId] = useState<number | null>(null)
  const [nuevoOrdenCarrito, setNuevoOrdenCarrito] = useState<Record<string, number>>({})
  const [nuevoOrdenItemsMod, setNuevoOrdenItemsMod] = useState<ItemConModificadores[]>([])
  const [platoConfigNuevoOrden, setPlatoConfigNuevoOrden] = useState<Plato | null>(null)
  const [configurandoNuevoOrden, setConfigurandoNuevoOrden] = useState(false)
  const [nuevoOrdenNotas, setNuevoOrdenNotas] = useState('')
  const [nuevoOrdenDomi, setNuevoOrdenDomi] = useState({ nombre: '', telefono: '', direccion: '' })
  const [nuevoOrdenDomiGratis, setNuevoOrdenDomiGratis] = useState(false)
  const [nuevoOrdenCategoria, setNuevoOrdenCategoria] = useState<number | 'todas'>('todas')
  const [tomandoPedido, setTomandoPedido] = useState(false)
  // Inventario activo para el modal de nuevo pedido
  const [inventarioModalMap, setInventarioModalMap] = useState<Record<string, { cantidad: number; alerta: number }>>({})
  const [turnoConInventario, setTurnoConInventario] = useState(false)
  // Refs para acceder al estado del modal desde callbacks de realtime (evita stale closure)
  const modalNuevoPedidoRef = useRef(false)
  const turnoActivoIdRef = useRef<string | null>(null)

  // Gestión de zonas y mesas
  const [modoGestionMesas, setModoGestionMesas] = useState(false)
  const [modalNuevaZona, setModalNuevaZona] = useState(false)
  const [nuevaZonaNombre, setNuevaZonaNombre] = useState('')
  const [modalRenombrarZona, setModalRenombrarZona] = useState<string | null>(null)
  const [renombrarZonaValor, setRenombrarZonaValor] = useState('')
  const [modalAgregarMesa, setModalAgregarMesa] = useState<string | null>(null)
  const [nuevaMesaNumero, setNuevaMesaNumero] = useState('')
  const [guardandoMesa, setGuardandoMesa] = useState(false)
  const [modalQR, setModalQR] = useState<{ id: number; numero: number; zona: string | null } | null>(null)
  const [modalQRDomi, setModalQRDomi] = useState(false)

  // Carta
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [platos, setPlatos] = useState<Plato[]>([])
  const [modalPlato, setModalPlato] = useState<'nuevo' | 'editar' | null>(null)
  const [platoForm, setPlatoForm] = useState<Omit<Plato, 'id'>>(PLATO_VACIO)
  const [platoEditandoId, setPlatoEditandoId] = useState<string | null>(null)
  const [guardandoPlato, setGuardandoPlato] = useState(false)
  const [categoriaActivaCarta, setCategoriaActivaCarta] = useState<number | 'todas'>('todas')
  const [platoOpciones, setPlatoOpciones] = useState<PlatoOpcion[]>([])
  const [nuevaOpcionNombre, setNuevaOpcionNombre] = useState('')
  const [guardandoOpcion, setGuardandoOpcion] = useState(false)
  const [gruposMod, setGruposMod] = useState<GrupoModificador[]>([])
  const [nuevoGrupoMod, setNuevoGrupoMod] = useState({ nombre: '', tipo: 'radio' as 'radio' | 'checkbox', tiene_opcion_todos: false, max_selecciones: '' })
  const [nuevasOpcionesMod, setNuevasOpcionesMod] = useState<Record<string, { nombre: string; componente_plato_id: string; no_aplica: boolean }>>({})

  // Historial
  const [historialPedidos, setHistorialPedidos] = useState<HistorialPedido[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [historialBusqueda, setHistorialBusqueda] = useState('')
  const [historialFechaDesde, setHistorialFechaDesde] = useState('')
  const [historialFechaHasta, setHistorialFechaHasta] = useState('')
  const [pedidoHistorial, setPedidoHistorial] = useState<HistorialPedido | null>(null)
  const [editandoHistorial, setEditandoHistorial] = useState(false)
  const [preciosHistorial, setPreciosHistorial] = useState<Record<string, string>>({})
  const [guardandoHistorialItemId, setGuardandoHistorialItemId] = useState<string | null>(null)
  const [eliminandoHistorialItemId, setEliminandoHistorialItemId] = useState<string | null>(null)
  const [eliminandoPagoId, setEliminandoPagoId] = useState<string | null>(null)
  const [modoDividir, setModoDividir]           = useState(false)
  const [itemsSeleccionados, setItemsSeleccionados] = useState<Set<string>>(new Set())
  const [itemsPagadosLocal, setItemsPagadosLocal]   = useState<Set<string>>(new Set())

  const supabase = createClient()
  const hoy = new Date().toISOString().split('T')[0]

  // ── CARGAR MESAS ─────────────────────────────────────────────
  const cargarMesas = useCallback(async () => {
    const [{ data: mesasData }, { data: domiData }] = await Promise.all([
      supabase.from('mesas').select('*').order('numero'),
      supabase.from('pedidos')
        .select('id, created_at, estado, cliente_nombre, cliente_telefono, metodo_pago_cliente, comprobante_url, pago_domi_aprobado, items:items_pedido(cantidad, precio_unitario)')
        .eq('tipo', 'domi')
        .gte('created_at', `${hoy}T00:00:00`)
        .neq('estado', 'cancelado')
        .order('created_at', { ascending: false }),
    ])
    if (mesasData) setMesas(mesasData)
    if (domiData) {
      const ids = domiData.map((p: unknown) => (p as { id: string }).id)
      const { data: pagosDomi } = ids.length > 0
        ? await supabase.from('pagos').select('pedido_id, metodo, monto, propina').in('pedido_id', ids)
        : { data: [] }

      setDomiActivos(domiData.map((p: unknown) => {
        const ped = p as {
          id: string; created_at: string; estado: string
          cliente_nombre: string | null; cliente_telefono: string | null
          metodo_pago_cliente: string | null; comprobante_url: string | null
          pago_domi_aprobado: boolean
          items: { cantidad: number; precio_unitario: number }[]
        }
        const total = ped.items?.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0) ?? 0
        const pagosEste = (pagosDomi || []).filter((pg: { pedido_id: string }) => pg.pedido_id === ped.id) as { metodo: string; monto: number; propina: number }[]
        const metodos = [...new Set(pagosEste.map(pg => pg.metodo))]
        return {
          id: ped.id, created_at: ped.created_at, total,
          cliente_nombre: ped.cliente_nombre, cliente_telefono: ped.cliente_telefono,
          estado: ped.estado, metodos,
          metodo_pago_cliente: ped.metodo_pago_cliente,
          comprobante_url: ped.comprobante_url,
          pago_domi_aprobado: ped.pago_domi_aprobado ?? true,
        }
      }))
    }
  }, [supabase])

  // ── CARGAR CARTA ─────────────────────────────────────────────
  const cargarCarta = useCallback(async () => {
    const [{ data: cats }, { data: pls }, { data: mods }, { data: invData }] = await Promise.all([
      supabase.from('categorias').select('*').order('orden'),
      supabase.from('platos').select('*').order('nombre'),
      supabase.from('grupos_modificadores').select('*, opciones:opciones_modificador(*, componente:platos(nombre))').order('orden'),
      supabase.from('inventario').select('plato_id, cantidad_disponible'),
    ])
    if (cats) setCategorias(cats)
    if (pls) {
      const modsPorPlato = new Map<string, GrupoModificador[]>()
      ;((mods || []) as unknown as (GrupoModificador & { plato_id: string })[]).forEach(g => {
        modsPorPlato.set(g.plato_id, [...(modsPorPlato.get(g.plato_id) || []), g])
      })
      const invMap = new Map<string, number>()
      ;((invData || []) as { plato_id: string; cantidad_disponible: number }[]).forEach(i => invMap.set(i.plato_id, i.cantidad_disponible))
      setPlatos((pls as Plato[]).map(p => ({
        ...p,
        modificadores: (modsPorPlato.get(p.id) || []).map(grupo => ({
          ...grupo,
          opciones: grupo.opciones.map(op => {
            if (!op.descuenta_inventario || !op.componente_plato_id) return op
            const stock = invMap.get(op.componente_plato_id)
            if (stock !== undefined && stock <= 0) return { ...op, activo: false }
            return op
          }),
        })),
      })))
    }
  }, [supabase])

  const cargarOpcionesPlato = useCallback(async (platoId: string) => {
    const { data } = await supabase
      .from('plato_opciones')
      .select('id, nombre, es_default, orden, componentes:plato_opcion_componentes(id, componente_plato_id, cantidad, componente:platos(nombre))')
      .eq('plato_id', platoId)
      .order('orden')
    setPlatoOpciones((data || []) as unknown as PlatoOpcion[])
  }, [supabase])

  const cargarModificadoresPlato = useCallback(async (platoId: string) => {
    const { data } = await supabase
      .from('grupos_modificadores')
      .select('*, opciones:opciones_modificador(*, componente:platos(nombre))')
      .eq('plato_id', platoId)
      .order('orden')
    setGruposMod((data || []) as unknown as GrupoModificador[])
  }, [supabase])

  // ── CARGAR RESUMEN / INFORMES ────────────────────────────────
  const cargarResumen = useCallback(async (desde: string, hasta: string) => {
    setCargandoResumen(true)
    const desdeISO = `${desde}T00:00:00`
    const hastaISO = `${hasta}T23:59:59`
    const esSoloDia = desde === hasta

    const [{ data: pedidos }, { data: pagos }, { data: itemsTiemposRes }] = await Promise.all([
      supabase.from('pedidos')
        .select('id, created_at, tipo, items:items_pedido(cantidad, precio_unitario, plato:platos(costo))')
        .gte('created_at', desdeISO).lte('created_at', hastaISO).neq('estado', 'cancelado'),
      supabase.from('pagos')
        .select('metodo, monto, propina')
        .gte('created_at', desdeISO).lte('created_at', hastaISO),
      supabase.from('items_pedido')
        .select('plato_id, cocinero, created_at, tiempo_inicio_prep, tiempo_listo, plato:platos(nombre)')
        .not('tiempo_listo', 'is', null)
        .gte('created_at', desdeISO).lte('created_at', hastaISO),
    ])

    // KPIs del período
    let totalVentas = 0, totalUtilidad = 0, totalDomis = 0
    ;(pedidos || []).forEach((p: unknown) => {
      const ped = p as { tipo: string; items: { cantidad: number; precio_unitario: number; plato: { costo: number } }[] }
      const sub = ped.items?.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0) ?? 0
      totalVentas += sub
      totalUtilidad += ped.items?.reduce((a, i) => a + i.cantidad * (i.precio_unitario - (i.plato?.costo || 0)), 0) ?? 0
      if (ped.tipo === 'domi') totalDomis += sub
    })
    setResumenStats({ ventas: totalVentas, pedidos: (pedidos || []).length, utilidad: totalUtilidad, domis: totalDomis })

    // Comparativa contra la misma ventana de dias de la semana anterior.
    const diasPeriodo = diasEntreInclusive(desde, hasta)
    const desdeAnterior = desplazarFechaISO(desde, -7)
    const hastaAnterior = desplazarFechaISO(hasta, -7)
    const { data: pedidosAnterior } = await supabase.from('pedidos')
      .select('id, tipo, items:items_pedido(cantidad, precio_unitario, plato:platos(costo))')
      .gte('created_at', `${desdeAnterior}T00:00:00`)
      .lte('created_at', `${hastaAnterior}T23:59:59`)
      .neq('estado', 'cancelado')
    let ventasAnt = 0, utilidadAnt = 0, domisAnt = 0
    ;(pedidosAnterior || []).forEach((p: unknown) => {
      const ped = p as { tipo: string; items: { cantidad: number; precio_unitario: number; plato: { costo: number } }[] }
      const sub = ped.items?.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0) ?? 0
      ventasAnt += sub
      utilidadAnt += ped.items?.reduce((a, i) => a + i.cantidad * (i.precio_unitario - (i.plato?.costo || 0)), 0) ?? 0
      if (ped.tipo === 'domi') domisAnt += sub
    })
    void diasPeriodo
    setResumenStatsAnterior({ ventas: ventasAnt, pedidos: (pedidosAnterior || []).length, utilidad: utilidadAnt, domis: domisAnt })

    // Gráfico: por hora si es un solo día, por fecha si es rango
    if (esSoloDia) {
      const porHora: Record<number, number> = {}
      for (let h = 6; h <= 22; h++) porHora[h] = 0
      ;(pedidos || []).forEach((p: unknown) => {
        const ped = p as { created_at: string; items: { cantidad: number; precio_unitario: number }[] }
        const h = new Date(ped.created_at).getHours()
        const total = ped.items?.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0) ?? 0
        if (h >= 6 && h <= 22) porHora[h] = (porHora[h] || 0) + total
      })
      setVentasPorHora(Object.entries(porHora).map(([h, v]) => ({ hora: `${h}h`, ventas: v })))
      setVentasPorDia([])
    } else {
      const porDia: Record<string, { ventas: number; domis: number; iso: string }> = {}
      ;(pedidos || []).forEach((p: unknown) => {
        const ped = p as { created_at: string; tipo: string; items: { cantidad: number; precio_unitario: number }[] }
        const iso = ped.created_at.split('T')[0]
        const dia = new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
        const total = ped.items?.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0) ?? 0
        if (!porDia[iso]) porDia[iso] = { ventas: 0, domis: 0, iso }
        porDia[iso].ventas += total
        if (ped.tipo === 'domi') porDia[iso].domis += total
        void dia
      })
      // Rellenar días vacíos dentro del rango
      const result: { dia: string; ventas: number; domis: number }[] = []
      const d = new Date(desde + 'T12:00:00')
      const fin = new Date(hasta + 'T12:00:00')
      while (d <= fin) {
        const iso = d.toISOString().split('T')[0]
        const etiqueta = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
        const v = porDia[iso]
        result.push({ dia: etiqueta, ventas: (v?.ventas ?? 0) - (v?.domis ?? 0), domis: v?.domis ?? 0 })
        d.setDate(d.getDate() + 1)
      }
      setVentasPorDia(result)
      setVentasPorHora([])
    }

    // Torta métodos de pago
    const colores: Record<string, string> = { efectivo: '#22c55e', nequi: '#a855f7', daviplata: '#ef4444', bancolombia: '#eab308' }
    const porMetodo: Record<string, number> = {}
    ;(pagos || []).forEach((p: unknown) => {
      const pago = p as { metodo: string; monto: number; propina: number }
      porMetodo[pago.metodo] = (porMetodo[pago.metodo] || 0) + pago.monto + pago.propina
    })
    setDatosPagosMetodo(Object.entries(porMetodo).map(([m, v]) => ({
      name: m.charAt(0).toUpperCase() + m.slice(1), value: v, color: colores[m] || '#6b7280'
    })))

    // Tiempos del período
    if (itemsTiemposRes) {
      const porPlatoRes: Record<string, { nombre: string; esperas: number[]; preps: number[]; totales: number[] }> = {}
      const porCocineroRes: Record<string, { platos: number; tiempos: number[] }> = {}
      ;(itemsTiemposRes as unknown as {
        plato_id: string; cocinero: string | null
        created_at: string; tiempo_inicio_prep: string | null; tiempo_listo: string | null
        plato: { nombre: string }
      }[]).forEach(i => {
        const nombre = i.plato?.nombre || '?'
        const t0 = new Date(i.created_at).getTime()
        const t1 = i.tiempo_inicio_prep ? new Date(i.tiempo_inicio_prep).getTime() : null
        const t2 = i.tiempo_listo ? new Date(i.tiempo_listo).getTime() : null
        if (!porPlatoRes[nombre]) porPlatoRes[nombre] = { nombre, esperas: [], preps: [], totales: [] }
        if (t1) porPlatoRes[nombre].esperas.push((t1 - t0) / 60000)
        if (t1 && t2) porPlatoRes[nombre].preps.push((t2 - t1) / 60000)
        if (t2) porPlatoRes[nombre].totales.push((t2 - t0) / 60000)
        if (i.cocinero && t1 && t2) {
          if (!porCocineroRes[i.cocinero]) porCocineroRes[i.cocinero] = { platos: 0, tiempos: [] }
          porCocineroRes[i.cocinero].platos++
          porCocineroRes[i.cocinero].tiempos.push((t2 - t1) / 60000)
        }
      })
      const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
      setResumenTiempoPlato(Object.values(porPlatoRes).map(p => ({
        nombre: p.nombre, espera: avg(p.esperas), preparacion: avg(p.preps),
        total: avg(p.totales), cantidad: p.totales.length,
      })).sort((a, b) => b.cantidad - a.cantidad))
      setResumenTiempoCocinero(Object.entries(porCocineroRes).map(([nombre, d]) => ({
        nombre, platos: d.platos, tiempoPromedio: avg(d.tiempos),
      })).sort((a, b) => b.platos - a.platos))
    }

    setCargandoResumen(false)
  }, [supabase])

  // ── CARGAR CLIENTES ──────────────────────────────────────────
  const cargarClientes = useCallback(async () => {
    setCargandoClientes(true)
    const { data } = await supabase.from('clientes').select('*').order('nombre')
    if (!data) { setCargandoClientes(false); return }
    // Para cada cliente, obtener stats de pedidos vinculados
    const { data: pedidosClientes } = await supabase
      .from('pedidos').select('cliente_id, created_at, items:items_pedido(cantidad, precio_unitario)')
      .not('cliente_id', 'is', null).neq('estado', 'cancelado')

    const statsMap: Record<string, { pedidos: number; total: number; ultima: string }> = {}
    ;(pedidosClientes || []).forEach((p: unknown) => {
      const ped = p as { cliente_id: string; created_at: string; items: { cantidad: number; precio_unitario: number }[] }
      if (!ped.cliente_id) return
      const total = ped.items?.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0) ?? 0
      if (!statsMap[ped.cliente_id]) statsMap[ped.cliente_id] = { pedidos: 0, total: 0, ultima: '' }
      statsMap[ped.cliente_id].pedidos++
      statsMap[ped.cliente_id].total += total
      if (!statsMap[ped.cliente_id].ultima || ped.created_at > statsMap[ped.cliente_id].ultima)
        statsMap[ped.cliente_id].ultima = ped.created_at
    })
    setClientes(data.map((c: ClienteStat) => ({
      ...c,
      pedidos: statsMap[c.id]?.pedidos ?? 0,
      totalGastado: statsMap[c.id]?.total ?? 0,
      ultimaVisita: statsMap[c.id]?.ultima ?? null,
    })))
    setCargandoClientes(false)
  }, [supabase])

  // ── CARGAR / GUARDAR CONFIGURACIÓN ──────────────────────────
  const cargarConfiguracion = useCallback(async () => {
    const { data } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['bloqueo_cocina_activo', 'bloqueo_cocina_cantidad', 'qr_consumo_activo', 'qr_domi_activo', 'nombres_cocineros',
                    'sugerido_activo', 'sugerido_nombre', 'sugerido_precio', 'sugerido_descripcion', 'sugerido_imagen_url', 'tarifa_domicilio'])
    if (data) {
      const cfg: Record<string, string> = {}
      data.forEach((r: { clave: string; valor: string }) => { cfg[r.clave] = r.valor })
      if ('bloqueo_cocina_activo' in cfg) setBloqueoActivo(cfg['bloqueo_cocina_activo'] === 'true')
      if ('bloqueo_cocina_cantidad' in cfg) setBloqueoCantidad(parseInt(cfg['bloqueo_cocina_cantidad']) || 3)
      if ('qr_consumo_activo' in cfg) setQrConsumoActivo(cfg['qr_consumo_activo'] === 'true')
      if ('qr_domi_activo' in cfg) setQrDomiActivo(cfg['qr_domi_activo'] === 'true')
      if ('nombres_cocineros' in cfg) { try { setNombresCocineros(JSON.parse(cfg['nombres_cocineros']) as string[]) } catch { setNombresCocineros([]) } }
      if ('sugerido_activo' in cfg) setSugeridoActivo(cfg['sugerido_activo'] === 'true')
      if ('sugerido_nombre' in cfg) setSugeridoNombre(cfg['sugerido_nombre'] || '')
      if ('sugerido_precio' in cfg) setSugeridoPrecio(cfg['sugerido_precio'] || '')
      if ('sugerido_descripcion' in cfg) setSugeridoDescripcion(cfg['sugerido_descripcion'] || '')
      if ('sugerido_imagen_url' in cfg) setSugeridoImagenUrl(cfg['sugerido_imagen_url'] || '')
      if ('tarifa_domicilio' in cfg) setTarifaDomicilio(String(parseTarifaDomicilio(cfg['tarifa_domicilio'])))
    }
  }, [supabase])

  // ── RESERVAS ─────────────────────────────────────────────────
  const cargarReservas = useCallback(async () => {
    setCargandoReservas(true)
    const { data } = await supabase.from('reservas').select('*').order('fecha', { ascending: true }).order('hora', { ascending: true })
    if (data) setReservas(data as typeof reservas)
    setCargandoReservas(false)
  }, [supabase])

  async function actualizarEstadoReserva(id: string, estado: string) {
    await supabase.from('reservas').update({ estado }).eq('id', id)
    toast.success(estado === 'confirmada' ? '✅ Reserva confirmada' : '❌ Reserva cancelada')
    cargarReservas()
  }

  // ── HISTORIAL ────────────────────────────────────────────────
  const cargarHistorial = useCallback(async (desde?: string, hasta?: string) => {
    setCargandoHistorial(true)
    let q = supabase
      .from('pedidos')
      .select(`
        id, created_at, tipo, estado, turno_id, cliente_nombre,
        mesa:mesas(numero),
        cliente:clientes(nombre, cedula),
        mesera:usuarios!mesera_id(nombre),
        items:items_pedido(id, plato_id, cantidad, precio_unitario, notas, estado, plato:platos(nombre, controla_inventario)),
        pagos(id, metodo, monto, propina)
      `)
      .in('estado', ['pagado', 'entregado', 'cancelado'])
      .order('created_at', { ascending: false })
      .limit(200)
    const d = desde || historialFechaDesde
    const h = hasta || historialFechaHasta
    if (d) q = q.gte('created_at', `${d}T00:00:00`)
    if (h) q = q.lte('created_at', `${h}T23:59:59`)
    const { data } = await q
    if (data) setHistorialPedidos(data as unknown as HistorialPedido[])
    setCargandoHistorial(false)
  }, [supabase, historialFechaDesde, historialFechaHasta])

  function abrirHistorialDetalle(ped: HistorialPedido) {
    const init: Record<string, string> = {}
    ped.items?.forEach(i => { init[i.id] = String(i.precio_unitario) })
    setPreciosHistorial(init)
    setPedidoHistorial(ped)
    setEditandoHistorial(false)
  }

  async function guardarPrecioHistorial(itemId: string) {
    const precio = Number(preciosHistorial[itemId])
    if (isNaN(precio) || precio < 0) { toast.error('Precio inválido'); return }
    setGuardandoHistorialItemId(itemId)
    const { error } = await supabase.from('items_pedido').update({ precio_unitario: precio }).eq('id', itemId)
    if (error) { toast.error('Error al guardar precio'); setGuardandoHistorialItemId(null); return }
    const actualizar = (items: HistorialItemPedido[]) =>
      items?.map(i => i.id === itemId ? { ...i, precio_unitario: precio } : i)
    setHistorialPedidos(prev => prev.map(p => ({ ...p, items: actualizar(p.items) })))
    setPedidoHistorial(prev => prev ? { ...prev, items: actualizar(prev.items) } : null)
    toast.success('Precio corregido')
    setGuardandoHistorialItemId(null)
  }

  async function eliminarItemHistorial(
    itemId: string, platoId: string | null, cantidad: number, restaurarInventario: boolean
  ) {
    setEliminandoHistorialItemId(itemId)
    const { error } = await supabase.from('items_pedido').delete().eq('id', itemId)
    if (error) { toast.error('Error al eliminar ítem'); setEliminandoHistorialItemId(null); return }
    if (restaurarInventario && platoId) {
      const { data: inv } = await supabase.from('inventario')
        .select('id, cantidad_disponible').eq('plato_id', platoId).maybeSingle()
      if (inv) {
        await supabase.from('inventario')
          .update({ cantidad_disponible: inv.cantidad_disponible + cantidad }).eq('id', inv.id)
        toast.success(`Ítem eliminado · Inventario +${cantidad}`)
      } else {
        toast.success('Ítem eliminado')
      }
    } else {
      toast.success('Ítem eliminado')
    }
    const filtrar = (items: HistorialItemPedido[]) => items?.filter(i => i.id !== itemId)
    setHistorialPedidos(prev => prev.map(p => ({ ...p, items: filtrar(p.items) })))
    setPedidoHistorial(prev => prev ? { ...prev, items: filtrar(prev.items) } : null)
    setEliminandoHistorialItemId(null)
  }

  // ── PLAN / ACCESO ────────────────────────────────────────────
  const PLAN_NIVEL: Record<string, number> = { starter: 0, basico: 1, pro: 2 }
  const PLAN_LIMITE = {
    starter: { mesas: 4, usuarios: 4, zonas: 1 },
    basico:  { mesas: 20, usuarios: 10, zonas: 3 },
    pro:     { mesas: Infinity, usuarios: Infinity, zonas: Infinity },
  }
  function puedeAcceder(planReq: 'starter' | 'basico' | 'pro') {
    return (PLAN_NIVEL[negocioPlan] ?? 0) >= (PLAN_NIVEL[planReq] ?? 0)
  }
  const puedeQRConsumo = puedeAcceder('basico')
  const puedeQRDomi = puedeAcceder('pro')
  useEffect(() => {
    if (!puedeQRConsumo && qrConsumoActivo) setQrConsumoActivo(false)
    if (!puedeQRDomi && qrDomiActivo) setQrDomiActivo(false)
  }, [puedeQRConsumo, puedeQRDomi, qrConsumoActivo, qrDomiActivo])
  const pasosGuia = GUIA_GERENCIA.filter(p => puedeAcceder(p.planReq))
  const pasoGuiaActual = pasosGuia[guiaPaso] || pasosGuia[0]
  function iniciarGuia() {
    if (typeof window !== 'undefined') localStorage.setItem('gerencia_guia_v1', 'started')
    setPreguntarGuia(false)
    setGuiaPaso(0)
    setGuiaActiva(true)
    const primero = pasosGuia[0]
    if (primero) setSeccion(primero.seccion)
  }
  function cerrarGuia() {
    if (typeof window !== 'undefined') localStorage.setItem('gerencia_guia_v1', 'done')
    setPreguntarGuia(false)
    setGuiaActiva(false)
  }
  function avanzarGuia() {
    const siguiente = guiaPaso + 1
    if (siguiente >= pasosGuia.length) { cerrarGuia(); return }
    setGuiaPaso(siguiente)
    setSeccion(pasosGuia[siguiente].seccion)
  }
  function abrirUpgrade() {
    setModalSettings(true); setSeccionSettings('facturacion'); cargarFacturacion()
  }
  function renderPlanLock(planReq: 'basico' | 'pro') {
    const nombre = planReq === 'pro' ? 'Pro' : 'Profesional'
    const precio = planReq === 'pro' ? '$149.000/mes' : '$89.900/mes'
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-5">
          <Lock size={32} className="text-gray-400" />
        </div>
        <p className="font-black text-gray-900 text-xl mb-1">Plan {nombre}</p>
        <p className="text-gray-400 text-sm mb-2">{precio}</p>
        <p className="text-gray-500 text-sm mb-6 max-w-xs leading-relaxed">
          Esta función no está disponible en tu plan actual. Sube de plan para desbloquearla.
        </p>
        <button onClick={abrirUpgrade}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3.5 rounded-2xl transition-colors">
          Ver planes →
        </button>
      </div>
    )
  }

  async function cargarPlan() {
    const { data } = await supabase.from('negocios').select('id, plan').single()
    if (data?.plan) setNegocioPlan(data.plan as 'starter' | 'basico' | 'pro')
    if (data?.id) setNegocioId(data.id)
  }

  // ── FACTURACIÓN ──────────────────────────────────────────────
  async function cargarFacturacion() {
    setCargandoFact(true)
    const { data } = await supabase
      .from('negocios')
      .select('nombre, plan, suscripcion_activa, suscripcion_hasta')
      .single()
    if (data) {
      setFacturacion({
        nombre: data.nombre || '',
        plan: data.plan || 'basico',
        activa: data.suscripcion_activa ?? false,
        hasta: data.suscripcion_hasta || null,
      })
    }
    setCargandoFact(false)
  }

  // ── MENÚS DE TURNO ───────────────────────────────────────────
  const cargarMenusTurno = useCallback(async () => {
    const { data } = await supabase.from('menus_turno').select('*').order('created_at', { ascending: false })
    if (data) setMenusTurno(data as MenuTurno[])
  }, [supabase])

  async function guardarMenuTurno() {
    if (!menuForm.nombre.trim()) { toast.error('Escribe un nombre para el menú'); return }
    setGuardandoMenu(true)
    const items = Object.entries(menuForm.items)
      .filter(([, qty]) => qty > 0)
      .map(([plato_id, cantidad]) => ({ plato_id, cantidad }))
    if (editandoMenuId) {
      await supabase.from('menus_turno').update({ nombre: menuForm.nombre.trim(), items }).eq('id', editandoMenuId)
      toast.success('✅ Menú actualizado')
    } else {
      const { error: errMenu } = await supabase.from('menus_turno').insert({ nombre: menuForm.nombre.trim(), items, ...(negocioId ? { negocio_id: negocioId } : {}) })
      if (errMenu) { toast.error('Error al crear menú: ' + errMenu.message, { duration: 6000 }); setGuardandoMenu(false); return }
      toast.success('✅ Menú creado')
    }
    setGuardandoMenu(false)
    setModalNuevoMenu(null)
    setEditandoMenuId(null)
    setMenuForm({ nombre: '', items: {} })
    await cargarMenusTurno()
  }

  async function eliminarMenuTurno(id: string, nombre: string) {
    if (!confirm(`¿Eliminar el menú "${nombre}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('menus_turno').delete().eq('id', id)
    toast.success('Menú eliminado')
    await cargarMenusTurno()
  }

  function aplicarMenuTurno(menuId: string) {
    const menu = menusTurno.find(m => m.id === menuId)
    if (!menu) return
    const init: Record<string, number> = {}
    platos.forEach(p => { init[p.id] = 0 })
    menu.items.forEach(item => { init[item.plato_id] = item.cantidad })
    setInventarioTurno(init)
    setMenuSeleccionadoId(menuId)
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function ejecutarRestablecer() {
    if (restablecerConfirm !== 'BORRAR') { toast.error('Escribe BORRAR para confirmar'); return }
    const alguno = Object.values(restablecerItems).some(Boolean)
    if (!alguno) { toast.error('Selecciona al menos un tipo de datos'); return }
    setRestableciendo(true)
    try {
      const desde = restablecerScope === 'desde_fecha' && restablecerFecha
        ? `${restablecerFecha}T00:00:00.000Z`
        : '2000-01-01T00:00:00.000Z'  // efectivamente todo

      if (restablecerItems.pedidos) {
        // Borrar en orden correcto para no romper FK
        const { data: pedidosIds } = await supabase.from('pedidos').select('id').gte('created_at', desde)
        const ids = (pedidosIds || []).map((p: { id: string }) => p.id)
        if (ids.length > 0) {
          await Promise.all([
            supabase.from('pagos').delete().in('pedido_id', ids),
            supabase.from('items_pedido').delete().in('pedido_id', ids),
          ])
          await supabase.from('pedidos').delete().in('id', ids)
        }
      }

      if (restablecerItems.turnos) {
        const { data: turnosIds } = await supabase.from('turnos').select('id').gte('abierto_en', desde)
        const ids = (turnosIds || []).map((t: { id: string }) => t.id)
        if (ids.length > 0) {
          await Promise.all([
            supabase.from('movimientos_caja').delete().in('turno_id', ids),
            supabase.from('turnos_inventario').delete().in('turno_id', ids),
          ])
          await supabase.from('turnos').delete().in('id', ids)
        }
      }

      if (restablecerItems.clientes) {
        // Desligar pedidos antes de borrar clientes
        await supabase.from('pedidos').update({ cliente_id: null }).not('cliente_id', 'is', null)
        await supabase.from('clientes').delete().not('id', 'is', null)
      }

      if (restablecerItems.inventario) {
        await supabase.from('inventario').update({ cantidad_disponible: 0 }).not('plato_id', 'is', null)
      }

      toast.success('✅ Datos restablecidos correctamente')
      setRestablecerConfirm('')
      setRestablecerItems({ pedidos: false, turnos: false, clientes: false, inventario: false })
      setPasoRestablecer('opciones')
      setModalSettings(false)
      await cargarDatos(); await cargarMesas()
    } catch (e) {
      toast.error('Error al restablecer: ' + String(e))
    }
    setRestableciendo(false)
  }

  // ── Helper: upsert en configuracion con negocio_id correcto ──
  async function upsertConfig(pares: { clave: string; valor: string }[]) {
    // Obtener negocio_id (desde estado o desde la BD)
    let nid: string | null = negocioId
    if (!nid) {
      const { data: u } = await supabase.auth.getUser()
      if (u.user?.id) {
        const { data: uData } = await supabase.from('usuarios').select('negocio_id').eq('id', u.user.id).single()
        nid = uData?.negocio_id ?? null
        if (nid) setNegocioId(nid)
      }
    }
    if (!nid) { toast.error('No se pudo identificar el negocio'); return false }
    const rows = pares.map(p => ({ ...p, negocio_id: nid }))
    const { error } = await supabase.from('configuracion').upsert(rows, { onConflict: 'negocio_id,clave' })
    if (error) { toast.error('Error al guardar: ' + error.message); return false }
    return true
  }

  async function guardarConfiguracion() {
    setGuardandoPermisos(true)
    const qrConsumoPermitido = puedeQRConsumo && qrConsumoActivo
    const qrDomiPermitido = puedeQRDomi && qrDomiActivo
    if (qrConsumoActivo && !puedeQRConsumo) setQrConsumoActivo(false)
    if (qrDomiActivo && !puedeQRDomi) setQrDomiActivo(false)
    const ok = await upsertConfig([
      { clave: 'bloqueo_cocina_activo',   valor: String(bloqueoActivo)   },
      { clave: 'bloqueo_cocina_cantidad', valor: String(bloqueoCantidad) },
      { clave: 'qr_consumo_activo',       valor: String(qrConsumoPermitido) },
      { clave: 'qr_domi_activo',          valor: String(qrDomiPermitido) },
    ])
    if (ok) toast.success('✅ Permisos guardados')
    setGuardandoPermisos(false)
  }

  async function guardarNombresCocineros(lista: string[]) {
    setGuardandoNombresCocineros(true)
    const ok = await upsertConfig([{ clave: 'nombres_cocineros', valor: JSON.stringify(lista) }])
    if (ok) toast.success('✅ Nombres guardados')
    setGuardandoNombresCocineros(false)
  }

  function agregarNombreCocinero() {
    const nombre = nuevoNombreCocinero.trim()
    if (!nombre || nombresCocineros.includes(nombre)) return
    const nueva = [...nombresCocineros, nombre]
    setNombresCocineros(nueva)
    setNuevoNombreCocinero('')
    guardarNombresCocineros(nueva)
  }

  function eliminarNombreCocinero(nombre: string) {
    const nueva = nombresCocineros.filter(n => n !== nombre)
    setNombresCocineros(nueva)
    guardarNombresCocineros(nueva)
  }

  async function guardarSugerido() {
    setGuardandoSugerido(true)
    const ok = await upsertConfig([
      { clave: 'sugerido_activo',      valor: String(sugeridoActivo)  },
      { clave: 'sugerido_nombre',      valor: sugeridoNombre          },
      { clave: 'sugerido_precio',      valor: sugeridoPrecio          },
      { clave: 'sugerido_descripcion', valor: sugeridoDescripcion     },
      { clave: 'sugerido_imagen_url',  valor: sugeridoImagenUrl       },
    ])
    if (ok) toast.success(sugeridoActivo ? '🌟 Sugerido activado' : '✅ Sugerido guardado (inactivo)')
    setGuardandoSugerido(false)
  }

  async function abrirClienteDetalle(cliente: ClienteStat) {
    const { data } = await supabase.from('pedidos')
      .select('id, created_at, tipo, estado, items:items_pedido(cantidad, precio_unitario, plato:platos(nombre))')
      .eq('cliente_id', cliente.id).order('created_at', { ascending: false })
    const pedidos = (data || []).map((p: unknown) => {
      const ped = p as {
        id: string; created_at: string; tipo: string; estado: string
        items: { cantidad: number; precio_unitario: number; plato: { nombre: string } }[]
      }
      return {
        id: ped.id,
        created_at: ped.created_at,
        tipo: ped.tipo,
        estado: ped.estado,
        total: ped.items?.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0) ?? 0,
        items: ped.items?.map(i => ({
          nombre: i.plato?.nombre || '?',
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
        })) ?? [],
      }
    })
    setClienteDetalle({ cliente, pedidos })
  }

  // ── CARGAR CAJA ──────────────────────────────────────────────
  const cargarCaja = useCallback(async (turnoId: string) => {
    const { data: pedidosTurno } = await supabase
      .from('pedidos').select('id').eq('turno_id', turnoId).neq('estado', 'cancelado')

    const ids = (pedidosTurno || []).map((p: { id: string }) => p.id)
    const [{ data: pagos }, { data: movs }] = await Promise.all([
      ids.length > 0
        ? supabase.from('pagos').select('metodo, monto, propina').in('pedido_id', ids)
        : Promise.resolve({ data: [] }),
      supabase.from('movimientos_caja').select('*').eq('turno_id', turnoId).order('created_at'),
    ])

    const porMetodo: Record<string, { monto: number; propina: number }> = {}
    ;(pagos || []).forEach((p: { metodo: string; monto: number; propina: number }) => {
      if (!porMetodo[p.metodo]) porMetodo[p.metodo] = { monto: 0, propina: 0 }
      porMetodo[p.metodo].monto += p.monto
      porMetodo[p.metodo].propina += p.propina
    })
    // Redondear al peso para evitar errores de punto flotante en el cuadre
    setPagosPorMetodo(Object.entries(porMetodo).map(([metodo, v]) => ({
      metodo,
      monto:   Math.round(v.monto),
      propina: Math.round(v.propina),
    })))
    setMovimientosCaja(movs || [])
  }, [supabase])

  // ── RESUMEN DE INVENTARIO AL CERRAR TURNO ───────────────────
  const cargarResumenInventario = useCallback(async (turnoId: string) => {
    const { data: snapshots } = await supabase
      .from('turnos_inventario')
      .select('plato_id, cantidad_inicial, plato:platos(nombre, precio, categoria:categorias(nombre))')
      .eq('turno_id', turnoId)
    if (!snapshots || snapshots.length === 0) { setResumenInventario([]); return }
    const platosIds = (snapshots as unknown as { plato_id: string }[]).map(s => s.plato_id)
    const { data: invActual } = await supabase
      .from('inventario').select('plato_id, cantidad_disponible').in('plato_id', platosIds)
    setResumenInventario((snapshots as unknown as {
      plato_id: string; cantidad_inicial: number;
      plato: { nombre: string; precio: number; categoria: { nombre: string } | null }
    }[]).map(s => {
      const inv = (invActual || []).find((i: { plato_id: string }) => i.plato_id === s.plato_id) as { cantidad_disponible: number } | undefined
      return {
        plato_id: s.plato_id,
        nombre: s.plato.nombre,
        categoria: s.plato.categoria?.nombre || '',
        precio: s.plato.precio,
        cantidad_inicial: s.cantidad_inicial,
        cantidad_restante: inv?.cantidad_disponible ?? 0,
      }
    }))
  }, [supabase])

  const cargarInventarioTurnoActivo = useCallback(async () => {
    if (!turnoActivo) { setInventarioTurnoItems([]); setInventarioTurnoValores({}); return }

    const [{ data: snapshots }, { data: inventarioActual }] = await Promise.all([
      supabase.from('turnos_inventario').select('plato_id, cantidad_inicial').eq('turno_id', turnoActivo.id),
      supabase.from('inventario').select('plato_id, cantidad_disponible, alerta_minima'),
    ])

    const snapMap = new Map((snapshots || []).map((s: { plato_id: string; cantidad_inicial: number }) => [s.plato_id, s]))
    const invMap = new Map((inventarioActual || []).map((i: { plato_id: string; cantidad_disponible: number; alerta_minima: number }) => [i.plato_id, i]))
    const catMap = new Map(categorias.map(c => [c.id, c.nombre]))

    const items = platos
      .filter(p => p.controla_inventario ?? true)
      .map(p => {
        const snap = snapMap.get(p.id)
        const inv = invMap.get(p.id)
        return {
          plato_id: p.id,
          nombre: p.nombre,
          categoria: catMap.get(p.categoria_id) || 'Sin categoria',
          cantidad_inicial: snap?.cantidad_inicial ?? 0,
          cantidad_actual: inv?.cantidad_disponible ?? 0,
          alerta_minima: inv?.alerta_minima ?? 3,
          en_turno: Boolean(snap),
        }
      })
      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre))

    setInventarioTurnoItems(items)
    setInventarioTurnoValores(Object.fromEntries(items.map(i => [i.plato_id, String(i.cantidad_actual)])))
  }, [categorias, platos, supabase, turnoActivo])

  async function guardarAjusteInventarioTurno(item: InventarioTurnoItem) {
    if (!turnoActivo) { toast.error('No hay turno activo'); return }

    const raw = inventarioTurnoValores[item.plato_id]
    const nuevaCantidad = Math.max(0, Math.floor(Number(raw || 0)))
    if (!Number.isFinite(nuevaCantidad)) { toast.error('Cantidad invalida'); return }

    setGuardandoInventarioId(item.plato_id)
    const delta = nuevaCantidad - item.cantidad_actual
    const nuevaInicial = Math.max(0, item.cantidad_inicial + delta)

    const { data: invActualizado, error: invUpdateError } = await supabase
      .from('inventario')
      .update({ cantidad_disponible: nuevaCantidad, alerta_minima: item.alerta_minima, updated_at: new Date().toISOString() })
      .eq('plato_id', item.plato_id)
      .select('plato_id')
      .maybeSingle()

    if (invUpdateError) {
      setGuardandoInventarioId(null)
      toast.error('No se pudo actualizar inventario')
      return
    }

    if (!invActualizado) {
      const { error: invInsertError } = await supabase
        .from('inventario')
        .insert({ plato_id: item.plato_id, cantidad_disponible: nuevaCantidad, alerta_minima: item.alerta_minima })
      if (invInsertError) {
        setGuardandoInventarioId(null)
        toast.error('No se pudo crear inventario')
        return
      }
    }

    const { error: turnoInvError } = item.en_turno
      ? await supabase
        .from('turnos_inventario')
        .update({ cantidad_inicial: nuevaInicial })
        .eq('turno_id', turnoActivo.id)
        .eq('plato_id', item.plato_id)
      : await supabase
        .from('turnos_inventario')
        .insert({ turno_id: turnoActivo.id, plato_id: item.plato_id, cantidad_inicial: nuevaInicial })

    setGuardandoInventarioId(null)
    if (turnoInvError) {
      toast.error('Inventario actualizado, pero no se pudo ajustar el turno')
      return
    }

    toast.success('Inventario actualizado')
    await cargarInventarioTurnoActivo()
    await cargarResumenInventario(turnoActivo.id)
    await cargarInventarioModal()
  }

  async function guardarDomicilios() {
    const tarifa = parseTarifaDomicilio(tarifaDomicilio)
    setGuardandoDomicilios(true)
    const ok = await upsertConfig([{ clave: 'tarifa_domicilio', valor: String(tarifa) }])
    setGuardandoDomicilios(false)
    if (ok) {
      setTarifaDomicilio(String(tarifa))
      toast.success('Tarifa de domicilio guardada')
    }
  }

  // ── CARGAR ESTADÍSTICAS Y TIEMPOS ────────────────────────────
  const cargarDatos = useCallback(async () => {
    const [{ data: pedidos }, { data: itemsTiempos }, { data: turno }] = await Promise.all([
      supabase.from('pedidos').select(`
        id, estado, tipo, created_at, pagado_en, turno_id,
        mesa:mesas(numero), mesera:usuarios(nombre),
        items:items_pedido(cantidad, precio_unitario, plato:platos(nombre, costo))
      `).gte('created_at', `${hoy}T00:00:00`).neq('estado', 'cancelado').order('created_at', { ascending: false }),

      supabase.from('items_pedido').select(`
        plato_id, cocinero, estado,
        created_at, tiempo_inicio_prep, tiempo_listo,
        pedido:pedidos(created_at, mesera:usuarios(nombre)),
        plato:platos(nombre)
      `).not('tiempo_listo', 'is', null).gte('created_at', `${hoy}T00:00:00`),

      supabase.from('turnos').select('*').is('cerrado_en', null).order('abierto_en', { ascending: false }).limit(1).maybeSingle(),
    ])

    setTurnoActivo(turno ?? null)
    if (turno?.id) cargarCaja(turno.id)

    if (pedidos) {
      let totalVentas = 0, totalUtilidad = 0
      const resumen: PedidoResumen[] = []
      const platosMap: Record<string, PlatoStat> = {}
      const mesesMap: Record<string, MeseraStat> = {}

      pedidos.forEach((p: unknown) => {
        const ped = p as {
          id: string; estado: string; tipo: string; created_at: string; pagado_en?: string | null; turno_id?: string | null
          mesa: { numero: number }; mesera: { nombre: string } | null
          items: { cantidad: number; precio_unitario: number; plato: { nombre: string; costo: number } }[]
        }
        let totalPedido = 0
        ped.items?.forEach(item => {
          const sub = item.cantidad * item.precio_unitario
          totalPedido += sub; totalVentas += sub
          totalUtilidad += item.cantidad * (item.precio_unitario - (item.plato?.costo || 0))
          const nm = item.plato?.nombre || '?'
          if (!platosMap[nm]) platosMap[nm] = { nombre: nm, cantidad: 0, total: 0 }
          platosMap[nm].cantidad += item.cantidad; platosMap[nm].total += sub
        })
        if (ped.mesera?.nombre) {
          const nm = ped.mesera.nombre
          if (!mesesMap[nm]) mesesMap[nm] = { nombre: nm, pedidos: 0, total: 0 }
          mesesMap[nm].pedidos++; mesesMap[nm].total += totalPedido
        }
        resumen.push({ id: ped.id, mesa: ped.mesa?.numero, total: totalPedido, estado: ped.estado, created_at: ped.created_at, pagado_en: ped.pagado_en, tipo: ped.tipo, turno_id: ped.turno_id })
      })
      setStats({ ventas: totalVentas, pedidos: pedidos.length, utilidad: totalUtilidad })
      setPlatosTop(Object.values(platosMap).sort((a, b) => b.cantidad - a.cantidad))
      setMeseras(Object.values(mesesMap).sort((a, b) => b.total - a.total))
      setPedidosHoy(resumen)
    }

    if (itemsTiempos) {
      // Tiempos por plato
      const porPlato: Record<string, { nombre: string; esperas: number[]; preps: number[]; totales: number[] }> = {}
      const porCocinero: Record<string, { platos: number; tiempos: number[] }> = {}
      const porMesera: Record<string, { pedidos: Set<string>; tiempos: number[] }> = {}

      itemsTiempos.forEach((i: unknown) => {
        const item = i as {
          plato_id: string; cocinero: string | null; estado: string
          created_at: string; tiempo_inicio_prep: string | null; tiempo_listo: string | null
          pedido: { created_at: string; mesera: { nombre: string } | null }
          plato: { nombre: string }
        }
        const nombre = item.plato?.nombre || '?'
        const t0 = new Date(item.created_at).getTime()
        const t1 = item.tiempo_inicio_prep ? new Date(item.tiempo_inicio_prep).getTime() : null
        const t2 = item.tiempo_listo ? new Date(item.tiempo_listo).getTime() : null

        if (!porPlato[nombre]) porPlato[nombre] = { nombre, esperas: [], preps: [], totales: [] }
        if (t1) porPlato[nombre].esperas.push((t1 - t0) / 60000)
        if (t1 && t2) porPlato[nombre].preps.push((t2 - t1) / 60000)
        if (t2) porPlato[nombre].totales.push((t2 - t0) / 60000)

        if (item.cocinero && t1 && t2) {
          if (!porCocinero[item.cocinero]) porCocinero[item.cocinero] = { platos: 0, tiempos: [] }
          porCocinero[item.cocinero].platos++
          porCocinero[item.cocinero].tiempos.push((t2 - t1) / 60000)
        }

        const meseraNm = item.pedido?.mesera?.nombre
        if (meseraNm && t2) {
          if (!porMesera[meseraNm]) porMesera[meseraNm] = { pedidos: new Set(), tiempos: [] }
          porMesera[meseraNm].tiempos.push((t2 - t0) / 60000)
        }
      })

      const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0

      setTiemposPorPlato(Object.values(porPlato).map(p => ({
        nombre: p.nombre,
        espera: avg(p.esperas),
        preparacion: avg(p.preps),
        total: avg(p.totales),
        cantidad: p.totales.length,
      })).sort((a, b) => b.cantidad - a.cantidad))

      setTiemposPorCocinero(Object.entries(porCocinero).map(([nombre, d]) => ({
        nombre, platos: d.platos, tiempoPromedio: avg(d.tiempos)
      })).sort((a, b) => b.platos - a.platos))

      setTiemposPorMesera(Object.entries(porMesera).map(([nombre, d]) => ({
        nombre, pedidos: d.pedidos.size, tiempoPromedio: avg(d.tiempos)
      })))
    }
  }, [supabase, hoy])

  // Mantener refs sincronizados (para callbacks de realtime que no pueden leer estado fresco)
  useEffect(() => { modalNuevoPedidoRef.current = modalNuevoPedido }, [modalNuevoPedido])
  useEffect(() => { turnoActivoIdRef.current = turnoActivo?.id ?? null }, [turnoActivo])
  useEffect(() => {
    setModoDividir(false)
    setItemsSeleccionados(new Set())
    setItemsPagadosLocal(new Set())
  }, [mesaDetalle?.pedido?.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem('gerencia_guia_v1')) setPreguntarGuia(true)
  }, [])

  // Refrescar inventarioModalMap sin depender del estado cerrado (usa refs para evitar stale closure)
  const cargarInventarioModal = useCallback(async () => {
    if (!modalNuevoPedidoRef.current || !turnoActivoIdRef.current) return
    const { data: tiRows } = await supabase.from('turnos_inventario')
      .select('plato_id').eq('turno_id', turnoActivoIdRef.current)
    if (!tiRows || tiRows.length === 0) return
    const platoIds = tiRows.map((r: { plato_id: string }) => r.plato_id)
    const { data } = await supabase.from('inventario')
      .select('plato_id, cantidad_disponible, alerta_minima').in('plato_id', platoIds)
    const map: Record<string, { cantidad: number; alerta: number }> = {}
    ;(data || []).forEach((i: { plato_id: string; cantidad_disponible: number; alerta_minima: number }) => {
      map[i.plato_id] = { cantidad: i.cantidad_disponible, alerta: i.alerta_minima }
    })
    setInventarioModalMap(map)
  }, [supabase])

  useEffect(() => {
    cargarDatos(); cargarMesas(); cargarCarta()
    cargarResumen(hoyStr, hoyStr)
    cargarConfiguracion()
    cargarMenusTurno()
    cargarPlan()
    const canal = supabase.channel('gerencia-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => { cargarDatos(); cargarMesas() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, cargarMesas)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion' }, cargarConfiguracion)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, cargarReservas)
      // Actualizar el mapa de inventario en tiempo real cuando otro usuario toma un pedido
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inventario' }, cargarInventarioModal)
      .subscribe()

    // Notificación cuando un pedido domi llega a "listo" (cocina terminó)
    const canalDomiListo = supabase.channel('gerencia-domi-listo')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, (payload) => {
        const p = payload.new as { tipo: string; estado: string; cliente_nombre: string | null }
        if (p.tipo === 'domi' && p.estado === 'listo') {
          const notifId = Date.now()
          setNotifsListoDomi(prev => [...prev, { id: notifId, clienteNombre: p.cliente_nombre || 'Cliente' }])
          setTimeout(() => setNotifsListoDomi(prev => prev.filter(n => n.id !== notifId)), 30000)
        }
      })
      .subscribe()

    // Polling de respaldo cada 20 s para mesas (por si el evento realtime no llega)
    const intervalMesas = setInterval(cargarMesas, 20000)

    return () => { supabase.removeChannel(canal); supabase.removeChannel(canalDomiListo); clearInterval(intervalMesas) }
  }, [cargarDatos, cargarMesas, cargarCarta, cargarResumen, cargarConfiguracion, cargarMenusTurno, cargarReservas, cargarInventarioModal, supabase, hoyStr])

  // Cargar resumen de inventario al abrir modal cerrar turno
  useEffect(() => {
    if (modalCaja === 'cerrar' && turnoActivo) {
      cargarResumenInventario(turnoActivo.id)
    }
    if (modalCaja !== 'abrir') {
      // Limpiar paso caja al cerrar modal
      if (modalCaja === null) { setPasoCaja('efectivo') }
    }
  }, [modalCaja, turnoActivo, cargarResumenInventario])

  useEffect(() => {
    if (!modalAjusteInventario) return
    cargarInventarioTurnoActivo()
    const canal = supabase.channel('gerencia-inventario-turno')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario' }, cargarInventarioTurnoActivo)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_inventario' }, cargarInventarioTurnoActivo)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [cargarInventarioTurnoActivo, modalAjusteInventario, supabase])

  // Cargar inventario cuando se abre el modal de nuevo pedido
  useEffect(() => {
    if (!modalNuevoPedido || !turnoActivo) { setTurnoConInventario(false); setInventarioModalMap({}); return }
    supabase.from('turnos_inventario')
      .select('plato_id').eq('turno_id', turnoActivo.id)
      .then(({ data: tiRows }) => {
        const tieneInv = (tiRows?.length ?? 0) > 0
        setTurnoConInventario(tieneInv)
        if (!tieneInv || !tiRows) { setInventarioModalMap({}); return }
        // Solo cargar inventario para los platos de ESTE turno (no todos los históricos)
        const platoIds = tiRows.map((r: { plato_id: string }) => r.plato_id)
        supabase.from('inventario')
          .select('plato_id, cantidad_disponible, alerta_minima')
          .in('plato_id', platoIds)
          .then(({ data }) => {
            const map: Record<string, { cantidad: number; alerta: number }> = {}
            ;(data || []).forEach((i: { plato_id: string; cantidad_disponible: number; alerta_minima: number }) => {
              map[i.plato_id] = { cantidad: i.cantidad_disponible, alerta: i.alerta_minima }
            })
            setInventarioModalMap(map)
          })
      })
  }, [modalNuevoPedido, turnoActivo, supabase])

  useEffect(() => {
    if (seccion === 'resumen') {
      if (rangoResumen === 'personalizado') return // se dispara manualmente con el botón
      let desde = hoyStr
      const hasta = hoyStr
      if (rangoResumen === 'semana') {
        const d = new Date(); d.setDate(d.getDate() - 6)
        desde = d.toISOString().split('T')[0]
      } else if (rangoResumen === 'mes') {
        const d = new Date(); d.setDate(1)
        desde = d.toISOString().split('T')[0]
      }
      cargarResumen(desde, hasta)
    }
    if (seccion === 'clientes') cargarClientes()
    if (seccion === 'reservas') cargarReservas()
    if (seccion === 'historial') cargarHistorial()
    if (seccion === 'usuarios') {
      supabase.from('usuarios').select('id, nombre, rol, activo').order('nombre').then(({ data }) => {
        if (data) setListaUsuarios(data)
      })
    }
  }, [seccion, rangoResumen, cargarResumen, cargarClientes, cargarReservas, cargarHistorial, hoyStr, supabase])

  // ── DETALLE MESA ─────────────────────────────────────────────
  async function abrirDetalleMesa(mesa: typeof mesas[0]) {
    if (mesa.estado === 'libre') { toast('Mesa libre'); return }
    setModoEdicionPedido(false); setItemReemplazando(null)
    const { data: pedido } = await supabase.from('pedidos').select(`
      id, estado, tipo, created_at, notas, cliente_nombre, cliente_cedula, cliente_telefono,
      mesa:mesas(numero), mesera:usuarios(nombre),
      items:items_pedido(id, plato_id, estado, cantidad, precio_unitario, notas, plato:platos(nombre), pedido_por_usuario:usuarios!pedido_por(nombre))
    `).eq('mesa_id', mesa.id).in('estado', ['pendiente','en_preparacion','listo','entregado','esperando_pago'])
      .order('created_at', { ascending: false }).limit(1).single()
    if (!pedido) { toast.error('No se encontró el pedido'); return }
    const { data: pagos } = await supabase.from('pagos').select('*').eq('pedido_id', pedido.id).order('created_at')
    const p = pedido as typeof pedido & { cliente_nombre: string | null; cliente_cedula: string | null; cliente_telefono: string | null }
    const fmt: PedidoDetalle = {
      ...pedido,
      mesa: (pedido.mesa as unknown as { numero: number }),
      mesera: pedido.mesera as unknown as { nombre: string } | null,
      items: (pedido.items as unknown as { id: string; plato_id: string | null; estado: string; cantidad: number; precio_unitario: number; notas: string | null; plato: { nombre: string } | null; pedido_por_usuario: { nombre: string } | null }[])
        .map(i => ({ id: i.id, plato_id: i.plato_id, nombre: i.plato?.nombre || i.notas?.replace(/^Cargo extra:\s*/i, '') || 'Cargo extra', cantidad: i.cantidad, precio_unitario: i.precio_unitario, notas: i.plato_id ? i.notas : null, estado: i.estado, pedido_por_nombre: i.pedido_por_usuario?.nombre || null })),
      cliente_nombre:   p.cliente_nombre,
      cliente_cedula:   p.cliente_cedula,
      cliente_telefono: p.cliente_telefono,
    }
    // Pre-llenar cliente si el pedido ya trae teléfono (QR u orden anterior)
    if (p.cliente_telefono) {
      setTelefonoCliente(p.cliente_telefono)
      setClienteForm({ nombre: p.cliente_nombre || '', telefono: p.cliente_telefono || '', fecha_cumpleanos: '' })
      const { data: cl } = await supabase.from('clientes').select('id, nombre, telefono').eq('telefono', p.cliente_telefono).maybeSingle()
      if (cl) setClienteEncontrado(cl)
    } else {
      setTelefonoCliente('')
      setClienteEncontrado(null)
      setClienteForm({ nombre: '', telefono: '', fecha_cumpleanos: '' })
    }
    setMesaDetalle({ mesa, pedido: fmt, pagos: (pagos || []) as PagoRegistrado[] })
    setMontoPago(''); setPropinaPago(''); setPagaCon(''); setPagaCon(''); setMetodoPago('efectivo'); setVistaModal('pago')
  }

  async function abrirDetalleDomi(pedidoId: string) {
    const { data: pedido } = await supabase.from('pedidos').select(`
      id, estado, tipo, created_at, notas, cliente_nombre, cliente_cedula, cliente_telefono, cliente_direccion,
      comprobante_url, metodo_pago_cliente,
      mesera:usuarios(nombre),
      items:items_pedido(id, plato_id, estado, cantidad, precio_unitario, notas, plato:platos(nombre))
    `).eq('id', pedidoId).single()
    if (!pedido) { toast.error('No se encontró el domi'); return }
    const { data: pagos } = await supabase.from('pagos').select('*').eq('pedido_id', pedido.id).order('created_at')
    const p = pedido as typeof pedido & {
      cliente_nombre: string | null; cliente_cedula: string | null
      cliente_telefono: string | null; cliente_direccion: string | null
      comprobante_url: string | null; metodo_pago_cliente: string | null
    }
    const fmt: PedidoDetalle = {
      ...pedido,
      mesa: { numero: 0 } as { numero: number },
      mesera: pedido.mesera as unknown as { nombre: string } | null,
      items: (pedido.items as unknown as { id: string; plato_id: string | null; estado: string; cantidad: number; precio_unitario: number; notas: string | null; plato: { nombre: string } | null }[])
        .map(i => ({ id: i.id, plato_id: i.plato_id, nombre: i.plato?.nombre || i.notas?.replace(/^Cargo extra:\s*/i, '') || 'Cargo extra', cantidad: i.cantidad, precio_unitario: i.precio_unitario, notas: i.plato_id ? i.notas : null, estado: i.estado })),
      cliente_nombre: p.cliente_nombre,
      cliente_cedula: p.cliente_cedula,
      cliente_telefono: p.cliente_telefono,
      cliente_direccion: p.cliente_direccion,
      comprobante_url: p.comprobante_url,
      metodo_pago_cliente: p.metodo_pago_cliente,
    }
    setMesaDetalle({ mesa: null, pedido: fmt, pagos: (pagos || []) as PagoRegistrado[], isDomi: true })
    setMontoPago(''); setPropinaPago(''); setPagaCon(''); setPagaCon(''); setMetodoPago('efectivo'); setVistaModal('pago')
  }

  async function confirmarPagoTransferencia() {
    if (!mesaDetalle) return
    const metodo = mesaDetalle.pedido.metodo_pago_cliente as MetodoPago | null
    if (!metodo) { toast.error('Sin método de pago del cliente'); return }
    setAgregandoPago(true)
    const total = mesaDetalle.pedido.items.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0)
    await supabase.from('pagos').insert({ pedido_id: mesaDetalle.pedido.id, metodo, monto: total, propina: 0 })
    await supabase.from('pedidos').update({ estado: 'pagado', pagado_en: new Date().toISOString() }).eq('id', mesaDetalle.pedido.id)
    toast.success('✅ Pago confirmado y registrado en caja')
    setMesaDetalle(null); setVistaModal('pago')
    setAgregandoPago(false)
    cargarMesas(); cargarDatos()
  }

  // ── Confirmar pago -> Cocina ─────────────────────────────
  // Para pedidos desde la página pública (pendiente_pago): gerencia los valida y envía a cocina.
  // Si es transferencia: pago_domi_aprobado queda FALSE hasta que gerencia confirme recepción real del dinero.
  // Si es efectivo: se aprueba directamente (pago en mano al entregar).
  async function confirmarQrDomiPago(pedidoId: string, metodo: string | null) {
        await supabase.from('pedidos').update({
      estado: 'pendiente',
      pago_domi_aprobado: true,
    }).eq('id', pedidoId)
    toast.success(METODOS_DIGITALES_DOMI.includes(metodo || '') ? 'Pago confirmado. Pedido enviado a cocina' : 'Pedido enviado a cocina')
    cargarMesas()
  }

  // ── RECHAZAR PEDIDO QR ────────────────────────────────────────
  async function rechazarQrDomiPago(pedidoId: string) {
    if (!confirm('¿Rechazar este pedido? Se notificará al cliente.')) return
    await supabase.from('pedidos').update({ estado: 'cancelado' }).eq('id', pedidoId)
    toast.success('Pedido rechazado')
    cargarMesas()
  }

  // ── CONFIRMAR RECEPCIÓN DEL PAGO (transferencia listo) ────────
  // Desbloquea al domiciliario para que pueda salir a entregar.
  async function confirmarRecepcionPago(pedidoId: string) {
    await supabase.from('pedidos').update({ pago_domi_aprobado: true }).eq('id', pedidoId)
    toast.success('✅ Pago confirmado — El domiciliario ya puede salir a entregar')
    cargarMesas()
  }

  async function agregarCargoExtra() {
    if (!mesaDetalle) return
    const nombre = cargoExtraNombre.trim()
    const monto = Math.round(Number(cargoExtraMonto || 0))
    if (!nombre) { toast.error('Escribe el concepto del cargo'); return }
    if (!Number.isFinite(monto) || monto <= 0) { toast.error('Monto invalido'); return }

    setGuardandoCargoExtra(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: itemCreado, error } = await supabase
      .from('items_pedido')
      .insert({
        pedido_id: mesaDetalle.pedido.id,
        plato_id: null,
        pedido_por: user?.id ?? null,
        cantidad: 1,
        precio_unitario: monto,
        notas: `Cargo extra: ${nombre}`,
        estado: 'listo',
      })
      .select('id, plato_id, estado, cantidad, precio_unitario, notas')
      .single()

    setGuardandoCargoExtra(false)
    if (error || !itemCreado) {
      toast.error('No se pudo agregar el cargo')
      return
    }

    setMesaDetalle(prev => prev ? {
      ...prev,
      pedido: {
        ...prev.pedido,
        items: [
          ...prev.pedido.items,
          {
            id: itemCreado.id,
            plato_id: null,
            nombre,
            cantidad: itemCreado.cantidad,
            precio_unitario: itemCreado.precio_unitario,
            notas: null,
            estado: itemCreado.estado,
          },
        ],
      },
    } : prev)
    setCargoExtraNombre('')
    setCargoExtraMonto('')
    toast.success('Cargo agregado a la cuenta')
    cargarDatos()
  }

  async function agregarPago() {
    if (!mesaDetalle || !montoPago) return
    // ── Bloqueo: todos los ítems deben estar listos o entregados ──────────────
    const hayEnPreparacion = mesaDetalle.pedido.items.some(
      i => i.estado === 'pendiente' || i.estado === 'en_preparacion'
    )
    if (hayEnPreparacion) {
      toast.error('⏳ Hay platos que aún no han salido de cocina. Espera a que todo esté listo.')
      return
    }
    setAgregandoPago(true)
    const monto = parseFloat(montoPago); const propina = parseFloat(propinaPago || '0')
    if (isNaN(monto) || monto <= 0) { toast.error('Monto inválido'); setAgregandoPago(false); return }
    await supabase.from('pagos').insert({ pedido_id: mesaDetalle.pedido.id, metodo: metodoPago, monto, propina })
    const { data: pagosActualizados } = await supabase.from('pagos').select('*').eq('pedido_id', mesaDetalle.pedido.id).order('created_at')
    const totalPagadoNuevo = (pagosActualizados || []).reduce((a: number, p: PagoRegistrado) => a + p.monto + p.propina, 0)
    const totalPedidoActual = mesaDetalle.pedido.items.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0)
    setMontoPago(''); setPropinaPago(''); setPagaCon('')
    if (totalPagadoNuevo >= totalPedidoActual) {
      // Pago completo → cerrar pedido + (si tiene mesa) liberarla
      await supabase.from('pedidos').update({ estado: 'pagado', pagado_en: new Date().toISOString() }).eq('id', mesaDetalle.pedido.id)
      if (!mesaDetalle.isDomi && mesaDetalle.mesa) {
        await supabase.from('mesas').update({ estado: 'libre' }).eq('id', mesaDetalle.mesa.id)
        toast.success(`✅ Mesa ${mesaDetalle.mesa.numero} pagada y liberada`)
      } else {
        toast.success('✅ Domi pagado')
      }
      const myPedidoId = mesaDetalle.pedido.id
      setPedidoPagadoId(myPedidoId)
      // Auto-guardar cliente si se ingresó teléfono
      if (telefonoCliente.trim()) {
        if (clienteEncontrado) {
          await supabase.from('pedidos').update({ cliente_id: clienteEncontrado.id }).eq('id', myPedidoId)
          if (!mesaDetalle.isDomi && mesaDetalle.mesa) toast.success(`✅ Mesa ${mesaDetalle.mesa.numero} pagada · ${clienteEncontrado.nombre} registrado`)
          else toast.success(`✅ Domi pagado · ${clienteEncontrado.nombre} registrado`)
        } else if (clienteForm.nombre.trim()) {
          const { data: nuevo } = await supabase.from('clientes').insert({
            telefono: telefonoCliente.trim(),
            nombre: clienteForm.nombre.trim(),
            fecha_cumpleanos: clienteForm.fecha_cumpleanos || null,
            ...(negocioId ? { negocio_id: negocioId } : {}),
          }).select('id').single()
          if (nuevo?.id) await supabase.from('pedidos').update({ cliente_id: nuevo.id }).eq('id', myPedidoId)
          if (!mesaDetalle.isDomi && mesaDetalle.mesa) toast.success(`✅ Mesa ${mesaDetalle.mesa.numero} pagada · Cliente ${clienteForm.nombre} guardado`)
          else toast.success(`✅ Domi pagado · Cliente ${clienteForm.nombre} guardado`)
        } else {
          if (!mesaDetalle.isDomi && mesaDetalle.mesa) toast.success(`✅ Mesa ${mesaDetalle.mesa.numero} pagada y liberada`)
          else toast.success('✅ Domi pagado')
        }
      } else {
        if (!mesaDetalle.isDomi && mesaDetalle.mesa) toast.success(`✅ Mesa ${mesaDetalle.mesa.numero} pagada y liberada`)
        else toast.success('✅ Domi pagado')
      }
      setMesaDetalle(null)
      setTelefonoCliente(''); setClienteEncontrado(null); setClienteForm({ nombre: '', telefono: '', fecha_cumpleanos: '' })
      setVistaModal('pago')
      cargarMesas(); cargarDatos()
    } else {
      setMesaDetalle(prev => prev ? { ...prev, pagos: (pagosActualizados || []) as PagoRegistrado[] } : null)
      if (modoDividir && itemsSeleccionados.size > 0) {
        setItemsPagadosLocal(prev => new Set([...prev, ...itemsSeleccionados]))
        setItemsSeleccionados(new Set())
        setMontoPago('')
      }
      toast.success(`Falta: $${(totalPedidoActual - totalPagadoNuevo).toLocaleString('es-CO')}`)
    }
    setAgregandoPago(false)
  }

  async function eliminarPago(pagoId: string) {
    if (!mesaDetalle) return
    setEliminandoPagoId(pagoId)
    const { error } = await supabase.from('pagos').delete().eq('id', pagoId)
    if (error) { toast.error('Error al eliminar pago'); setEliminandoPagoId(null); return }
    const { data: pagosActualizados } = await supabase.from('pagos').select('*').eq('pedido_id', mesaDetalle.pedido.id).order('created_at')
    setMesaDetalle(prev => prev ? { ...prev, pagos: (pagosActualizados || []) as PagoRegistrado[] } : null)
    toast.success('Pago eliminado')
    setEliminandoPagoId(null)
  }

  async function cerrarMesa() {
    if (!mesaDetalle) return
    await supabase.from('pedidos').update({ estado: 'pagado', pagado_en: new Date().toISOString() }).eq('id', mesaDetalle.pedido.id)
    if (!mesaDetalle.isDomi && mesaDetalle.mesa) {
      await supabase.from('mesas').update({ estado: 'libre' }).eq('id', mesaDetalle.mesa.id)
      toast.success(`Mesa ${mesaDetalle.mesa.numero} cerrada ✓`)
    } else {
      toast.success('Domi cerrado ✓')
    }
    setMesaDetalle(null); setVistaModal('pago'); cargarMesas(); cargarDatos()
  }

  async function buscarCliente() {
    if (!telefonoCliente.trim()) return
    setBuscandoCl(true)
    const { data } = await supabase.from('clientes').select('id, nombre, telefono').eq('telefono', telefonoCliente.trim()).maybeSingle()
    if (data) { setClienteEncontrado(data); setClienteForm({ nombre: data.nombre, telefono: data.telefono || '', fecha_cumpleanos: '' }) }
    else { setClienteEncontrado(null); setClienteForm({ nombre: '', telefono: telefonoCliente.trim(), fecha_cumpleanos: '' }) }
    setBuscandoCl(false)
  }

  async function guardarCliente() {
    if (!telefonoCliente.trim() || !clienteForm.nombre.trim()) { toast.error('Celular y nombre son obligatorios'); return }
    setGuardandoCl(true)
    let clienteId = clienteEncontrado?.id
    if (!clienteEncontrado) {
      const { data: nuevo } = await supabase.from('clientes').insert({
        telefono: telefonoCliente.trim(),
        nombre: clienteForm.nombre.trim(),
        fecha_cumpleanos: clienteForm.fecha_cumpleanos || null,
        ...(negocioId ? { negocio_id: negocioId } : {}),
      }).select('id').single()
      clienteId = nuevo?.id
    }
    if (clienteId && pedidoPagadoId) {
      await supabase.from('pedidos').update({ cliente_id: clienteId }).eq('id', pedidoPagadoId)
    }
    toast.success(clienteEncontrado ? `Cliente registrado en pedido ✓` : `¡Cliente ${clienteForm.nombre} guardado!`)
    setTelefonoCliente(''); setClienteEncontrado(null); setClienteForm({ nombre: '', telefono: '', fecha_cumpleanos: '' })
    setGuardandoCl(false)
  }

  function saltarCliente() {
    setTelefonoCliente(''); setClienteEncontrado(null); setClienteForm({ nombre: '', telefono: '', fecha_cumpleanos: '' })
  }

  const totalPedido = mesaDetalle?.pedido.items.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0) ?? 0
  const totalPagado = mesaDetalle?.pagos.reduce((a, p) => a + p.monto + p.propina, 0) ?? 0
  const saldoPendiente = totalPedido - totalPagado
  const vuelto = totalPagado > totalPedido ? totalPagado - totalPedido : 0
  const subtotalSeleccionado = mesaDetalle
    ? mesaDetalle.pedido.items
        .filter((item, idx) => itemsSeleccionados.has(item.id ?? String(idx)))
        .reduce((a, item) => a + item.cantidad * item.precio_unitario, 0)
    : 0
  // Bloqueo de pago: ningún ítem puede estar pendiente o en preparación
  const itemsSinListar  = mesaDetalle?.pedido.items.filter(i => i.estado === 'pendiente' || i.estado === 'en_preparacion') ?? []
  const pedidoListoPagar = itemsSinListar.length === 0

  // ── CAJA ─────────────────────────────────────────────────────
  function irAInventario() {
    const init: Record<string, number> = {}
    platos.forEach(p => { init[p.id] = 0 })
    setInventarioTurno(init)
    setModoInventario('manual')
    setMenuSeleccionadoId(null)
    setPasoCaja('inventario')
  }

  async function abrirTurno() {
    if (abriendo) return  // Bloquea doble clic
    setAbriendo(true)

    const { data: { user } } = await supabase.auth.getUser()

    // Obtener negocio_id directamente de la BD (igual que mi_negocio_id() en SQL)
    // Esto evita el error de RLS cuando el estado aún no ha cargado
    let myNegocioId: string | null = negocioId
    if (!myNegocioId && user?.id) {
      const { data: uData } = await supabase
        .from('usuarios').select('negocio_id').eq('id', user.id).single()
      myNegocioId = uData?.negocio_id ?? null
      if (myNegocioId) setNegocioId(myNegocioId) // actualizar estado también
    }
    if (!myNegocioId) {
      toast.error('No se pudo identificar el negocio. Recarga la página.')
      setAbriendo(false)
      return
    }

    const { data: nuevoTurno, error: turnoError } = await supabase
      .from('turnos').insert({ negocio_id: myNegocioId, abierto_por: user?.id, monto_inicial: parseFloat(montoInicial) || 0 })
      .select().single()

    if (turnoError || !nuevoTurno?.id) {
      toast.error('Error al abrir el turno: ' + (turnoError?.message ?? 'Respuesta vacía del servidor'))
      setAbriendo(false)
      return
    }

    const platosValidos = new Set(platos.map(p => p.id))
    const entries = Object.entries(inventarioTurno).filter(([platoId, qty]) => qty > 0 && platosValidos.has(platoId))
    if (entries.length > 0) {
      const inventarioBase = entries.map(([platoId, qty]) => ({
        plato_id: platoId,
        cantidad: qty,
      }))
      const { error: invError } = await supabase.rpc('preparar_inventario_turno_v2', {
        p_items: inventarioBase,
        p_negocio_id: myNegocioId,
      })

      if (invError) {
        console.error('Error al preparar inventario base:', invError)
        toast.error('Error al preparar inventario: ' + invError.message, { duration: 8000 })
        setAbriendo(false)
        return
      }

      // Insertar en turnos_inventario — el trigger sync_inventario_desde_turno()
      // actualiza la tabla inventario automáticamente (SECURITY DEFINER, bypassa RLS).
      const { error: tiError } = await supabase.from('turnos_inventario').insert(
        entries.map(([platoId, qty]) => ({
          turno_id: nuevoTurno.id,
          plato_id: platoId,
          cantidad_inicial: qty,
        }))
      )
      if (tiError) {
        console.error('Error al guardar inventario de turno:', tiError)
        toast.error('Error al guardar inventario del turno: ' + tiError.message, { duration: 8000 })
      }
    }
    cargarCaja(nuevoTurno.id)

    toast.success('✅ Turno abierto')
    setModalCaja(null); setMontoInicial(''); setPasoCaja('efectivo'); setInventarioTurno({})
    setAbriendo(false)
    await cargarDatos()
  }
  async function cerrarTurno() {
    if (cerrandoTurno) return
    if (!turnoActivo) { toast.error('No hay turno activo'); return }
    setCerrandoTurno(true)
    const montoFinalTotal = Object.values(conteoFinal).reduce((a, v) => a + (parseFloat(v) || 0), 0)
    const { data, error } = await supabase.rpc('cerrar_turno_seguro', {
      p_turno_id: turnoActivo.id,
      p_monto_final: montoFinalTotal,
    })
    if (error) {
      toast.error('Error al cerrar turno: ' + error.message)
      setCerrandoTurno(false)
      return
    }
    if (data === false) {
      await cargarDatos()
      toast.success('Turno ya estaba cerrado')
      setModalCaja(null); setConteoFinal({})
      setPagosPorMetodo([]); setMovimientosCaja([])
      setCerrandoTurno(false)
      return
    }
    toast.success('Turno cerrado')
    setModalCaja(null); setConteoFinal({})
    setPagosPorMetodo([]); setMovimientosCaja([])
    await cargarDatos()
    setCerrandoTurno(false)
  }

  async function agregarMovimiento() {
    if (!turnoActivo) { toast.error('No hay turno activo'); return }
    if (!nuevoMov.monto || parseFloat(nuevoMov.monto) <= 0) { toast.error('Ingresa un monto válido'); return }
    if (!nuevoMov.descripcion.trim()) { toast.error('Escribe una descripción'); return }
    setAgregandoMov(true)
    const { error } = await supabase.from('movimientos_caja').insert({
      turno_id: turnoActivo.id,
      tipo: nuevoMov.tipo,
      monto: parseFloat(nuevoMov.monto),
      descripcion: nuevoMov.descripcion.trim(),
    })
    if (error) { toast.error('Error al guardar'); setAgregandoMov(false); return }
    toast.success(nuevoMov.tipo === 'ingreso' ? '✓ Ingreso registrado' : '✓ Egreso registrado')
    setNuevoMov({ tipo: 'egreso', monto: '', descripcion: '' })
    cargarCaja(turnoActivo.id)
    setAgregandoMov(false)
  }

  // ── USUARIOS ─────────────────────────────────────────────────
  async function crearUsuario() {
    setErrorCrearUsuario(null)
    if (!nuevoUsuario.nombre || !nuevoUsuario.email || !nuevoUsuario.password) {
      setErrorCrearUsuario('Completa todos los campos (nombre, correo y contraseña)')
      return
    }
    // Verificar límite de usuarios según plan
    const limiteUsuarios = PLAN_LIMITE[negocioPlan]?.usuarios ?? Infinity
    if (listaUsuarios.filter(u => u.activo).length >= limiteUsuarios) {
      setErrorCrearUsuario(`Tu plan ${negocioPlan} permite máximo ${limiteUsuarios} usuarios activos. Actualiza tu plan.`)
      abrirUpgrade(); return
    }
    setCreandoUsuario(true)
    try {
      // Garantizar que tenemos el negocio_id aunque el estado no haya cargado aún
      let nid = negocioId
      if (!nid) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: u } = await supabase.from('usuarios').select('negocio_id').eq('id', user.id).single()
          nid = u?.negocio_id ?? null
        }
      }
      if (!nid) {
        setErrorCrearUsuario('No se pudo obtener el ID del negocio. Recarga la página e intenta de nuevo.')
        setCreandoUsuario(false); return
      }
      const res = await fetch('/api/crear-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nuevoUsuario, negocio_id: nid }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error ?? 'Error desconocido'
        setErrorCrearUsuario(msg)
        toast.error('Error: ' + msg, { duration: 6000 })
        setCreandoUsuario(false); return
      }
      toast.success(`✅ Usuario ${nuevoUsuario.nombre} creado`)
      setModalUsuario(false)
      setErrorCrearUsuario(null)
      setNuevoUsuario({ nombre: '', email: '', password: '', rol: 'mesera' })
      // Recargar lista
      const { data: ul } = await supabase.from('usuarios').select('id, nombre, rol, activo').order('nombre')
      if (ul) setListaUsuarios(ul)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorCrearUsuario('Error de conexión: ' + msg)
      toast.error('Error de conexión: ' + msg, { duration: 6000 })
    }
    setCreandoUsuario(false)
  }

  // ── EDITAR USUARIO (rol / nombre) ────────────────────────────
  async function guardarCambiosUsuario() {
    if (!editandoUsuario) return
    setGuardandoUsuario(true)

    // 1. Actualizar nombre y rol en la tabla usuarios
    const { error } = await supabase
      .from('usuarios')
      .update({ nombre: editandoUsuario.nombre.trim(), rol: editandoUsuario.rol })
      .eq('id', editandoUsuario.id)
    if (error) { toast.error('No se pudo guardar: ' + error.message); setGuardandoUsuario(false); return }

    // 2. Si escribió nueva contraseña, cambiarla vía API
    if (editandoUsuario.nuevaPassword.trim()) {
      const res = await fetch('/api/gestionar-usuario', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editandoUsuario.id, nuevaPassword: editandoUsuario.nuevaPassword.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error('Error al cambiar contraseña: ' + data.error); setGuardandoUsuario(false); return }
    }

    toast.success('✅ Usuario actualizado')
    setEditandoUsuario(null)
    setGuardandoUsuario(false)
    const { data: ul } = await supabase.from('usuarios').select('id, nombre, rol, activo').order('nombre')
    if (ul) setListaUsuarios(ul)
  }

  async function toggleActivoUsuario(id: string, activoActual: boolean) {
    const res = await fetch('/api/gestionar-usuario', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, activo: !activoActual }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error('Error: ' + data.error); return }
    toast.success(activoActual ? '🔒 Usuario inhabilitado' : '✅ Usuario habilitado')
    setEditandoUsuario(null)
    const { data: ul } = await supabase.from('usuarios').select('id, nombre, rol, activo').order('nombre')
    if (ul) setListaUsuarios(ul)
  }

  async function eliminarUsuario(id: string, nombre: string) {
    if (!confirm(`¿Eliminar definitivamente a "${nombre}"? Esta acción no se puede deshacer.`)) return
    setEliminandoUsuario(true)
    const res = await fetch('/api/gestionar-usuario', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    setEliminandoUsuario(false)
    if (!res.ok) { toast.error('Error al eliminar: ' + data.error); return }
    toast.success(`🗑️ Usuario "${nombre}" eliminado`)
    setEditandoUsuario(null)
    const { data: ul } = await supabase.from('usuarios').select('id, nombre, rol, activo').order('nombre')
    if (ul) setListaUsuarios(ul)
  }

  // ── GESTIÓN ZONAS / MESAS ────────────────────────────────────
  async function crearZonaConMesa() {
    if (!nuevaZonaNombre.trim()) { toast.error('Escribe el nombre de la zona'); return }
    const num = parseInt(nuevaMesaNumero)
    if (isNaN(num) || num <= 0) { toast.error('Número de mesa inválido'); return }
    // Verificar límites según plan
    const limMesas = PLAN_LIMITE[negocioPlan]?.mesas ?? Infinity
    const limZonas = PLAN_LIMITE[negocioPlan]?.zonas ?? Infinity
    if (mesas.length >= limMesas) { toast.error(`Tu plan permite máximo ${limMesas} mesas`); abrirUpgrade(); return }
    const zonasActuales = [...new Set(mesas.map(m => m.zona))].filter(Boolean).length
    if (zonasActuales >= limZonas) { toast.error(`Tu plan permite máximo ${limZonas} zona(s)`); abrirUpgrade(); return }
    setGuardandoMesa(true)
    const { error } = await supabase.from('mesas').insert({ numero: num, estado: 'libre', zona: nuevaZonaNombre.trim(), ...(negocioId ? { negocio_id: negocioId } : {}) })
    setGuardandoMesa(false)
    if (error) { toast.error('Error: ' + error.message); return }
    toast.success(`Zona "${nuevaZonaNombre.trim()}" creada con mesa ${num}`)
    setModalNuevaZona(false); setNuevaZonaNombre(''); setNuevaMesaNumero('')
    await cargarMesas()
  }

  async function agregarMesaEnZona(zona: string) {
    const num = parseInt(nuevaMesaNumero)
    if (isNaN(num) || num <= 0) { toast.error('Número inválido'); return }
    const limMesas = PLAN_LIMITE[negocioPlan]?.mesas ?? Infinity
    if (mesas.length >= limMesas) { toast.error(`Tu plan permite máximo ${limMesas} mesas`); abrirUpgrade(); return }
    setGuardandoMesa(true)
    const { error } = await supabase.from('mesas').insert({ numero: num, estado: 'libre', zona, ...(negocioId ? { negocio_id: negocioId } : {}) })
    setGuardandoMesa(false)
    if (error) { toast.error('Error: ' + error.message); return }
    toast.success(`Mesa ${num} agregada`)
    setModalAgregarMesa(null); setNuevaMesaNumero('')
    await cargarMesas()
  }

  async function renombrarZona(viejo: string, nuevo: string) {
    if (!nuevo.trim()) { toast.error('Escribe el nuevo nombre'); return }
    const { error } = await supabase.from('mesas').update({ zona: nuevo.trim() }).eq('zona', viejo)
    if (error) { toast.error('Error: ' + error.message); return }
    toast.success('Zona renombrada')
    setModalRenombrarZona(null); setRenombrarZonaValor('')
    await cargarMesas()
  }

  async function eliminarMesa(id: number) {
    const mesa = mesas.find(m => m.id === id)
    if (mesa?.estado !== 'libre') { toast.error('Solo puedes eliminar mesas que estén libres'); return }
    if (!confirm('¿Eliminar esta mesa?')) return
    const { error } = await supabase.from('mesas').delete().eq('id', id)
    if (error) { toast.error('Error: ' + error.message); return }
    toast.success('Mesa eliminada')
    await cargarMesas()
  }

  // ── CARTA ─────────────────────────────────────────────────────
  function abrirNuevoPlato() {
    setPlatoForm({ ...PLATO_VACIO, categoria_id: categorias[0]?.id || 0 })
    setPlatoOpciones([]); setNuevaOpcionNombre('')
    setGruposMod([]); setNuevoGrupoMod({ nombre: '', tipo: 'radio', tiene_opcion_todos: false, max_selecciones: '' }); setNuevasOpcionesMod({})
    setPlatoEditandoId(null); setModalPlato('nuevo')
  }
  function abrirEditarPlato(plato: Plato) {
    setPlatoForm({
      nombre: plato.nombre, descripcion: plato.descripcion || '', precio: plato.precio,
      costo: plato.costo || 0, categoria_id: plato.categoria_id, imagen_url: plato.imagen_url || '',
      activo: plato.activo, visible_menu: plato.visible_menu ?? true,
      controla_inventario: plato.controla_inventario ?? true,
    })
    setNuevaOpcionNombre('')
    setNuevoGrupoMod({ nombre: '', tipo: 'radio', tiene_opcion_todos: false, max_selecciones: '' }); setNuevasOpcionesMod({})
    setPlatoEditandoId(plato.id); setModalPlato('editar')
    cargarOpcionesPlato(plato.id)
    cargarModificadoresPlato(plato.id)
  }
  async function guardarPlato() {
    if (!platoForm.nombre || !platoForm.precio || !platoForm.categoria_id) { toast.error('Completa nombre, precio y categoría'); return }
    setGuardandoPlato(true)

    // Garantizar negocio_id
    let nid = negocioId
    if (!nid) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: u } = await supabase.from('usuarios').select('negocio_id').eq('id', user.id).single()
        nid = u?.negocio_id ?? null
        if (nid) setNegocioId(nid)
      }
    }

    const datos = {
      nombre: platoForm.nombre,
      descripcion: platoForm.descripcion || null,
      precio: platoForm.precio,
      costo: platoForm.costo || null,
      categoria_id: platoForm.categoria_id,
      imagen_url: platoForm.imagen_url || null,
      activo: platoForm.activo,
      visible_menu: platoForm.visible_menu ?? true,
      controla_inventario: platoForm.controla_inventario ?? true,
      ...(nid ? { negocio_id: nid } : {}),
    }

    if (modalPlato === 'nuevo') {
      const { data: nuevoPl, error } = await supabase.from('platos').insert(datos).select().single()
      if (error) {
        toast.error('Error al crear plato: ' + error.message, { duration: 6000 })
        setGuardandoPlato(false); return
      }
      await supabase.from('inventario').insert({ plato_id: nuevoPl.id, cantidad_disponible: 0, alerta_minima: 3, ...(nid ? { negocio_id: nid } : {}) })
      toast.success('✅ Plato creado')
    } else {
      const { error } = await supabase.from('platos').update(datos).eq('id', platoEditandoId!)
      if (error) {
        toast.error('Error al actualizar plato: ' + error.message, { duration: 6000 })
        setGuardandoPlato(false); return
      }
      toast.success('✅ Plato actualizado')
    }
    setModalPlato(null); setGuardandoPlato(false); cargarCarta()
  }
  async function agregarOpcionPlato() {
    if (!platoEditandoId) return
    const nombre = nuevaOpcionNombre.trim()
    if (!nombre) { toast.error('Elige una opción'); return }
    setGuardandoOpcion(true)
    const { error } = await supabase.from('plato_opciones').insert({
      plato_id: platoEditandoId,
      nombre,
      es_default: platoOpciones.length === 0,
      orden: platoOpciones.length,
    })
    if (error) toast.error('Error al crear opción: ' + error.message)
    else {
      setNuevaOpcionNombre('')
      await cargarOpcionesPlato(platoEditandoId)
      toast.success('Opción creada')
    }
    setGuardandoOpcion(false)
  }
  async function eliminarOpcionPlato(opcionId: string) {
    if (!platoEditandoId) return
    if (!confirm('¿Eliminar esta opción y sus componentes?')) return
    const { error } = await supabase.from('plato_opciones').delete().eq('id', opcionId)
    if (error) toast.error('Error al eliminar opción: ' + error.message)
    else {
      await cargarOpcionesPlato(platoEditandoId)
      toast.success('Opción eliminada')
    }
  }
  async function setComponenteOpcion(opcionId: string, componentePlatoId: string, cantidad: number) {
    if (!platoEditandoId) return
    const qty = Math.max(0, cantidad || 0)
    if (qty === 0) {
      await supabase.from('plato_opcion_componentes')
        .delete().eq('opcion_id', opcionId).eq('componente_plato_id', componentePlatoId)
    } else {
      await supabase.from('plato_opcion_componentes')
        .upsert({ opcion_id: opcionId, componente_plato_id: componentePlatoId, cantidad: qty }, { onConflict: 'opcion_id,componente_plato_id' })
    }
    await cargarOpcionesPlato(platoEditandoId)
  }

  async function agregarGrupoModificador() {
    if (!platoEditandoId) return
    const nombre = nuevoGrupoMod.nombre.trim()
    if (!nombre) { toast.error('Escribe el nombre del grupo'); return }
    const { error } = await supabase.from('grupos_modificadores').insert({
      plato_id: platoEditandoId,
      nombre,
      tipo: nuevoGrupoMod.tipo,
      min_selecciones: nuevoGrupoMod.tipo === 'radio' ? 1 : 0,
      max_selecciones: nuevoGrupoMod.tipo === 'radio' ? 1 : (nuevoGrupoMod.max_selecciones ? Math.max(1, parseInt(nuevoGrupoMod.max_selecciones) || 1) : null),
      obligatorio: nuevoGrupoMod.tipo === 'radio',
      tiene_opcion_todos: nuevoGrupoMod.tipo === 'checkbox' && nuevoGrupoMod.tiene_opcion_todos,
      orden: gruposMod.length,
    })
    if (error) { toast.error('Error al crear grupo: ' + error.message); return }
    setNuevoGrupoMod({ nombre: '', tipo: 'radio', tiene_opcion_todos: false, max_selecciones: '' })
    await cargarModificadoresPlato(platoEditandoId)
  }

  async function eliminarGrupoModificador(grupoId: string) {
    if (!platoEditandoId) return
    if (!confirm('¿Eliminar este grupo y sus opciones?')) return
    const { error } = await supabase.from('grupos_modificadores').delete().eq('id', grupoId)
    if (error) toast.error('Error al eliminar grupo: ' + error.message)
    else await cargarModificadoresPlato(platoEditandoId)
  }

  async function actualizarGrupoModificador(grupoId: string, cambios: Partial<Pick<GrupoModificador, 'max_selecciones' | 'tiene_opcion_todos'>>) {
    if (!platoEditandoId) return
    const { error } = await supabase.from('grupos_modificadores').update(cambios).eq('id', grupoId)
    if (error) { toast.error('Error al actualizar grupo: ' + error.message); return }
    await cargarModificadoresPlato(platoEditandoId)
  }

  async function agregarOpcionModificador(grupo: GrupoModificador, opcionRapida?: { nombre: string; componente_plato_id: string | null; no_aplica: boolean }) {
    if (!platoEditandoId) return
    const form = opcionRapida || nuevasOpcionesMod[grupo.id] || { nombre: '', componente_plato_id: '', no_aplica: false }
    const nombre = form.nombre.trim()
    if (!nombre) { toast.error('Escribe el nombre de la opción'); return }
    if (!form.no_aplica && !form.componente_plato_id) { toast.error('Elige el componente inventariable'); return }
    const { error } = await supabase.from('opciones_modificador').insert({
      grupo_id: grupo.id,
      nombre,
      componente_plato_id: form.no_aplica ? null : form.componente_plato_id,
      cantidad_descontar: form.no_aplica ? 0 : 1,
      descuenta_inventario: !form.no_aplica,
      es_opcion_no_aplica: form.no_aplica,
      orden: grupo.opciones.length,
      activo: true,
    })
    if (error) { toast.error('Error al crear opción: ' + error.message); return }
    setNuevasOpcionesMod(prev => ({ ...prev, [grupo.id]: { nombre: '', componente_plato_id: '', no_aplica: false } }))
    await cargarModificadoresPlato(platoEditandoId)
  }

  async function toggleOpcionModificador(opcion: OpcionModificador) {
    if (!platoEditandoId) return
    await supabase.from('opciones_modificador').update({ activo: !opcion.activo }).eq('id', opcion.id)
    await cargarModificadoresPlato(platoEditandoId)
  }

  async function eliminarOpcionModificador(opcionId: string) {
    if (!platoEditandoId) return
    await supabase.from('opciones_modificador').delete().eq('id', opcionId)
    await cargarModificadoresPlato(platoEditandoId)
  }
  async function toggleActivoPlato(plato: Plato) {
    await supabase.from('platos').update({ activo: !plato.activo }).eq('id', plato.id)
    toast.success(plato.activo ? 'Plato desactivado' : 'Plato activado')
    cargarCarta()
  }
  async function eliminarPlato(plato: Plato) {
    if (!confirm(`¿Eliminar "${plato.nombre}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('platos').delete().eq('id', plato.id)
    toast.success('Plato eliminado'); cargarCarta()
  }

  async function ajustarInventarioPlato(platoId: string | null | undefined, delta: number) {
    if (!platoId || delta === 0) return
    const { data } = await supabase
      .from('inventario')
      .select('cantidad_disponible, alerta_minima')
      .eq('plato_id', platoId)
      .maybeSingle()
    if (!data) return
    const inv = data as { cantidad_disponible: number; alerta_minima: number }
    await supabase
      .from('inventario')
      .update({
        cantidad_disponible: Math.max(0, inv.cantidad_disponible + delta),
        alerta_minima: inv.alerta_minima,
        updated_at: new Date().toISOString(),
      })
      .eq('plato_id', platoId)
  }

  async function ajustarInventarioItemPedido(itemId: string, direccion: 'restaurar' | 'descontar') {
    const signo = direccion === 'restaurar' ? 1 : -1
    const { data: item } = await supabase
      .from('items_pedido')
      .select('plato_id, cantidad')
      .eq('id', itemId)
      .maybeSingle()
    if (!item) return null
    const base = item as { plato_id: string | null; cantidad: number }
    await ajustarInventarioPlato(base.plato_id, signo * base.cantidad)

    const { data: mods } = await supabase
      .from('items_pedido_modificadores')
      .select('cantidad_descontada, descuenta_inventario, opcion:opciones_modificador(componente_plato_id)')
      .eq('item_pedido_id', itemId)
    for (const mod of (mods || []) as unknown as {
      cantidad_descontada: number
      descuenta_inventario: boolean
      opcion: { componente_plato_id: string | null } | null
    }[]) {
      if (!mod.descuenta_inventario || !mod.opcion?.componente_plato_id || mod.cantidad_descontada <= 0) continue
      await ajustarInventarioPlato(mod.opcion.componente_plato_id, signo * mod.cantidad_descontada * base.cantidad)
    }
    return base
  }

  // ── CANCELAR / REEMPLAZAR ÍTEM ────────────────────────────────
  async function cancelarItem(itemId: string) {
    if (!confirm('Eliminar solo este plato de la cuenta? El pedido seguira abierto y se devolvera al inventario.')) return
    setGuardandoEdicion(true)
    await ajustarInventarioItemPedido(itemId, 'restaurar')
    const { error } = await supabase.from('items_pedido').delete().eq('id', itemId)
    if (error) {
      await ajustarInventarioItemPedido(itemId, 'descontar')
      toast.error('Error al eliminar plato')
      setGuardandoEdicion(false)
      return
    }
    setMesaDetalle(prev => prev
      ? { ...prev, pedido: { ...prev.pedido, items: prev.pedido.items.filter(i => i.id !== itemId) } }
      : null)
    toast.success('Plato eliminado de la cuenta e inventario restaurado')
    await cargarDatos()
    await cargarMesas()
    await cargarInventarioModal()
    setGuardandoEdicion(false)
  }

  async function reemplazarItem(itemId: string, nuevoPlatoId: string) {
    const plato = platos.find(p => p.id === nuevoPlatoId)
    if (!plato) return
    setGuardandoEdicion(true)
    const itemAnterior = await ajustarInventarioItemPedido(itemId, 'restaurar')
    const { error } = await supabase.from('items_pedido')
      .update({ plato_id: nuevoPlatoId, precio_unitario: plato.precio, estado: 'pendiente' })
      .eq('id', itemId)
    if (error) {
      await ajustarInventarioItemPedido(itemId, 'descontar')
      toast.error('Error al reemplazar plato')
      setGuardandoEdicion(false)
      return
    }
    await supabase.from('items_pedido_modificadores').delete().eq('item_pedido_id', itemId)
    await ajustarInventarioPlato(nuevoPlatoId, -(itemAnterior?.cantidad ?? 1))
    setMesaDetalle(prev => {
      if (!prev) return null
      return { ...prev, pedido: { ...prev.pedido, items: prev.pedido.items.map(i =>
        i.id === itemId ? { ...i, plato_id: nuevoPlatoId, nombre: plato.nombre, precio_unitario: plato.precio, estado: 'pendiente' } : i
      ) } }
    })
    setItemReemplazando(null)
    toast.success(`✅ Cambiado a "${plato.nombre}" — enviado a cocina`)
    setGuardandoEdicion(false)
  }

  // ── TOMAR PEDIDO DESDE GERENCIA ───────────────────────────────
  async function actualizarPrecioItem(item: ItemDetalle) {
    if (!item.id) return
    const valor = Math.round(Number(preciosEditados[item.id] ?? item.precio_unitario))
    if (!Number.isFinite(valor) || valor < 0) { toast.error('Valor invalido'); return }
    setGuardandoPrecioItemId(item.id)
    const { error } = await supabase
      .from('items_pedido')
      .update({ precio_unitario: valor })
      .eq('id', item.id)
    setGuardandoPrecioItemId(null)
    if (error) { toast.error('No se pudo cambiar el valor'); return }
    setMesaDetalle(prev => prev ? {
      ...prev,
      pedido: {
        ...prev.pedido,
        items: prev.pedido.items.map(i => i.id === item.id ? { ...i, precio_unitario: valor } : i),
      },
    } : prev)
    setPreciosEditados(prev => {
      const next = { ...prev }
      delete next[item.id!]
      return next
    })
    toast.success('Valor actualizado')
    cargarDatos()
  }

  function agregarNuevoOrdenPlato(plato: Plato, modificadores?: ModificadorSeleccionado[]) {
    const requiereConfig = !modificadores && tieneModificadores(plato as never)
    const mods = modificadores || []
    const itemNuevo: ItemConModificadores = { plato: plato as never, cantidad: 1, notas: '', modificadores: mods }
    const consumoProyectado = consumoInventarioCarrito([
      ...nuevoOrdenItemsMod,
      ...Object.entries(nuevoOrdenCarrito)
        .filter(([, qty]) => qty > 0)
        .map(([platoId, qty]) => ({ plato: platos.find(p => p.id === platoId)! as never, cantidad: qty, notas: '', modificadores: [] })),
      itemNuevo,
    ])
    for (const [platoId, cantidad] of consumoProyectado.entries()) {
      const inv = inventarioModalMap[platoId]
      if (inv && cantidad > inv.cantidad) {
        const nombre = platos.find(p => p.id === platoId)?.nombre || 'este producto'
        toast.error(`Solo hay ${inv.cantidad} unidad(es) de ${nombre}`)
        return
      }
    }
    if (requiereConfig || mods.length > 0) {
      const keyNuevo = itemKey(itemNuevo)
      setNuevoOrdenItemsMod(prev => {
        const existe = prev.find(i => itemKey(i) === keyNuevo)
        if (existe) return prev.map(i => itemKey(i) === keyNuevo ? { ...i, cantidad: i.cantidad + 1 } : i)
        return [...prev, itemNuevo]
      })
      if (requiereConfig) toast('Puedes escoger los complementos al confirmar el pedido')
      return
    }
    setNuevoOrdenCarrito(prev => ({ ...prev, [plato.id]: (prev[plato.id] ?? 0) + 1 }))
  }

  function quitarNuevoOrdenPlato(plato: Plato) {
    if (tieneModificadores(plato as never)) {
      setNuevoOrdenItemsMod(prev => {
        const index = prev.findIndex(i => i.plato.id === plato.id)
        if (index < 0) return prev
        const item = prev[index]
        if (item.cantidad > 1) return prev.map((i, idx) => idx === index ? { ...i, cantidad: i.cantidad - 1 } : i)
        return prev.filter((_, idx) => idx !== index)
      })
      return
    }
    setNuevoOrdenCarrito(prev => ({ ...prev, [plato.id]: Math.max(0, (prev[plato.id] ?? 0) - 1) }))
  }

  async function tomarPedidoGerencia() {
    const itemsCarrito = Object.entries(nuevoOrdenCarrito).filter(([, qty]) => qty > 0)
    if (itemsCarrito.length === 0 && nuevoOrdenItemsMod.length === 0) { toast.error('Agrega al menos un plato al pedido'); return }
    if (!turnoActivo) { toast.error('No hay turno activo — abre el turno primero'); return }
    if (nuevoOrdenTipo === 'mesa' && !nuevoOrdenMesaId) { toast.error('Selecciona una mesa'); return }
    if (hayConfigPendiente(nuevoOrdenItemsMod)) { setConfigurandoNuevoOrden(true); return }
    setTomandoPedido(true)
    try {
      // ── Verificación de stock en tiempo real (previene sobre-pedidos) ──
      if (turnoConInventario) {
        const platoIdsConInv = Object.keys(inventarioModalMap)
        const cantidadesPorPlato = consumoInventarioCarrito([
          ...nuevoOrdenItemsMod,
          ...itemsCarrito.map(([platoId, qty]) => ({ plato: platos.find(pl => pl.id === platoId)! as never, cantidad: qty, notas: '', modificadores: [] })),
        ])
        const itemsConLimite = [...cantidadesPorPlato.entries()].filter(([platoId]) => platoIdsConInv.includes(platoId))
        if (itemsConLimite.length > 0) {
          const { data: invActual } = await supabase
            .from('inventario').select('plato_id, cantidad_disponible')
            .in('plato_id', itemsConLimite.map(([id]) => id))
          const invMap = Object.fromEntries(
            ((invActual || []) as { plato_id: string; cantidad_disponible: number }[]).map(i => [i.plato_id, i.cantidad_disponible])
          )
          for (const [platoId, qty] of itemsConLimite) {
            const pl = platos.find(p => p.id === platoId)
            const disp = invMap[platoId] ?? 0
            if (disp < qty) {
              toast.error(`Sin stock suficiente para "${pl?.nombre ?? platoId}": quedan ${disp}`, { duration: 5000 })
              setTomandoPedido(false)
              return
            }
          }
        }
      }
      const { data: { user } } = await supabase.auth.getUser()
      let pedidoId: string

      // Helper para crear pedido y obtener su id con manejo de error
      const crearPedido = async (datos: Record<string, unknown>): Promise<string> => {
        const { data: nuevo, error: errNuevo } = await supabase
          .from('pedidos').insert(datos).select('id').single()
        if (errNuevo || !nuevo) throw new Error(errNuevo?.message || 'No se pudo crear el pedido')
        return nuevo.id
      }

      if (nuevoOrdenTipo === 'mesa') {
        const mesa = mesas.find(m => m.id === nuevoOrdenMesaId)
        if (mesa && mesa.estado !== 'libre') {
          // Mesa ocupada → agregar a pedido existente
          const { data: ped } = await supabase.from('pedidos')
            .select('id').eq('mesa_id', nuevoOrdenMesaId!)
            .in('estado', ['pendiente','en_preparacion','listo','entregado','esperando_pago'])
            .order('created_at', { ascending: false }).limit(1).maybeSingle()
          if (ped) {
            pedidoId = ped.id
          } else {
            pedidoId = await crearPedido({
              mesa_id: nuevoOrdenMesaId, mesera_id: user?.id || null, turno_id: turnoActivo.id,
              estado: 'pendiente', tipo: 'mesera', notas: nuevoOrdenNotas || null,
              ...(negocioId ? { negocio_id: negocioId } : {}),
            })
            await supabase.from('mesas').update({ estado: 'ocupada' }).eq('id', nuevoOrdenMesaId!)
          }
        } else {
          // Mesa libre → crear nuevo pedido
          pedidoId = await crearPedido({
            mesa_id: nuevoOrdenMesaId, mesera_id: user?.id || null, turno_id: turnoActivo.id,
            estado: 'pendiente', tipo: 'mesera', notas: nuevoOrdenNotas || null,
            ...(negocioId ? { negocio_id: negocioId } : {}),
          })
          await supabase.from('mesas').update({ estado: 'ocupada' }).eq('id', nuevoOrdenMesaId!)
        }
      } else {
        // Domicilio
        pedidoId = await crearPedido({
          mesera_id: user?.id || null, turno_id: turnoActivo.id,
          estado: 'pendiente', tipo: 'domi', notas: nuevoOrdenNotas || null,
          cliente_nombre:    nuevoOrdenDomi.nombre    || null,
          cliente_telefono:  nuevoOrdenDomi.telefono  || null,
          cliente_direccion: nuevoOrdenDomi.direccion || null,
          ...(negocioId ? { negocio_id: negocioId } : {}),
        })
      }

      const itemsSimples = itemsCarrito.map(([platoId, qty]) => {
        const p = platos.find(pl => pl.id === platoId)!
        return { pedido_id: pedidoId, plato_id: platoId, cantidad: qty, precio_unitario: p.precio, estado: 'pendiente', pedido_por: user?.id || null }
      })
      if (itemsSimples.length > 0) {
        const { error: errItems } = await supabase.from('items_pedido').insert(itemsSimples)
        if (errItems) throw new Error(errItems.message)
      }
      for (const item of nuevoOrdenItemsMod) {
        const { data: itemCreado, error: itemError } = await supabase.from('items_pedido')
          .insert({ ...itemPedidoPayload(item, pedidoId, user?.id || null), estado: 'pendiente' })
          .select('id').single()
        if (itemError) throw new Error(itemError.message)
        if (itemCreado?.id) {
          const mods = modificadoresPedidoPayload(itemCreado.id, item)
          if (mods.length > 0) await supabase.from('items_pedido_modificadores').insert(mods)
        }
      }
      const tarifa = parseTarifaDomicilio(tarifaDomicilio)
      if (nuevoOrdenTipo === 'domi' && tarifa > 0 && !nuevoOrdenDomiGratis) {
        const { error: errDomi } = await supabase.from('items_pedido').insert(itemDomicilioPayload(pedidoId, tarifa, user?.id || null))
        if (errDomi) throw new Error(errDomi.message)
      }

      toast.success('✅ Pedido enviado a cocina')
      setModalNuevoPedido(false)
      setNuevoOrdenCarrito({}); setNuevoOrdenItemsMod([]); setNuevoOrdenMesaId(null); setNuevoOrdenNotas('')
      setNuevoOrdenDomi({ nombre: '', telefono: '', direccion: '' })
      setNuevoOrdenDomiGratis(false)
      cargarMesas(); cargarDatos()
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
    }
    setTomandoPedido(false)
  }

  const platosFiltradosCarta = categoriaActivaCarta === 'todas' ? platos : platos.filter(p => p.categoria_id === categoriaActivaCarta)
  const utilidadPlato = (p: Plato) => p.costo ? ((p.precio - p.costo) / p.precio * 100).toFixed(0) : null

  // ── CLIENTES: filtrado, ordenado y exportación ────────────────
  const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  const clientesFiltradosOrdenados = clientes
    .filter(c =>
      (!busquedaCliente ||
        c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase()) ||
        (c.cedula || '').includes(busquedaCliente)) &&
      (filtroMesCumple === 0 ||
        (c.fecha_cumpleanos != null &&
          new Date(c.fecha_cumpleanos + 'T12:00:00').getMonth() + 1 === filtroMesCumple))
    )
    .sort((a, b) => {
      if (ordenClientes === 'mayor_consumo') return b.totalGastado - a.totalGastado
      if (ordenClientes === 'menor_consumo') return a.totalGastado - b.totalGastado
      if (ordenClientes === 'az') return a.nombre.localeCompare(b.nombre, 'es')
      if (ordenClientes === 'cumpleanos') {
        // Ordena por proximidad del cumpleaños al día de hoy
        const hoy = new Date()
        const mesHoy = hoy.getMonth() + 1
        const diaHoy = hoy.getDate()
        const diasHasta = (c: ClienteStat) => {
          if (!c.fecha_cumpleanos) return 9999
          const [, mm, dd] = c.fecha_cumpleanos.split('-').map(Number)
          let diff = (mm - mesHoy) * 31 + (dd - diaHoy)
          if (diff < 0) diff += 365
          return diff
        }
        return diasHasta(a) - diasHasta(b)
      }
      return 0
    })

  function exportarClientesCSV() {
    const lista = clientesFiltradosOrdenados
    if (lista.length === 0) { toast('No hay clientes para exportar'); return }
    const encabezado = ['Nombre', 'Cedula', 'Telefono', 'Cumpleanos', 'Notas', 'Advertencias', 'Visitas', 'Total gastado ($)', 'Ultima visita']
    const filas = lista.map(c => [
      c.nombre,
      c.cedula || '',
      c.telefono || '',
      c.fecha_cumpleanos || '',
      c.notas || '',
      c.advertencias || '',
      String(c.pedidos),
      String(c.totalGastado),
      c.ultimaVisita
        ? new Date(c.ultimaVisita).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
        : '',
    ])
    const csv = [encabezado, ...filas].map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clientes_' + new Date().toISOString().split('T')[0] + '.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`${lista.length} clientes exportados`)
  }

  function parseCSVClientes(texto: string) {
    const sep = texto.includes(';') ? ';' : texto.includes('\t') ? '\t' : ','
    const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim())
    if (lineas.length < 2) return []
    const split = (linea: string) => {
      const cols: string[] = []
      let actual = '', comillas = false
      for (let i = 0; i < linea.length; i++) {
        const ch = linea[i]
        if (ch === '"') { comillas = !comillas; continue }
        if (ch === sep && !comillas) { cols.push(actual.trim()); actual = ''; continue }
        actual += ch
      }
      cols.push(actual.trim())
      return cols
    }
    const headers = split(lineas[0]).map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    const idx = (nombres: string[]) => headers.findIndex(h => nombres.some(n => h.includes(n)))
    const iNombre = idx(['nombre'])
    const iCedula = idx(['cedula', 'documento'])
    const iTelefono = idx(['telefono', 'celular'])
    const iCumple = idx(['cumple', 'nacimiento'])
    const iNotas = idx(['nota'])
    const iAdv = idx(['advertencia', 'alerta'])
    return lineas.slice(1).map(linea => {
      const c = split(linea)
      return {
        nombre: iNombre >= 0 ? c[iNombre] || '' : '',
        cedula: iCedula >= 0 ? c[iCedula] || '' : '',
        telefono: iTelefono >= 0 ? c[iTelefono] || '' : '',
        fecha_cumpleanos: iCumple >= 0 ? c[iCumple] || '' : '',
        notas: iNotas >= 0 ? c[iNotas] || '' : '',
        advertencias: iAdv >= 0 ? c[iAdv] || '' : '',
      }
    }).filter(c => c.nombre.trim())
  }

  async function importarClientesCSV(file: File | null) {
    if (!file) return
    setImportandoClientes(true)
    try {
      const texto = await file.text()
      const filas = parseCSVClientes(texto)
      if (filas.length === 0) { toast.error('El archivo no tiene clientes validos'); setImportandoClientes(false); return }
      let creados = 0, actualizados = 0
      for (const fila of filas) {
        const ced = fila.cedula.trim() || null
        const tel = fila.telefono.trim() || null
        let existente: { id: string } | null = null
        if (ced) {
          const { data } = await supabase.from('clientes').select('id').eq('cedula', ced).maybeSingle()
          existente = data
        }
        if (!existente && tel) {
          const { data } = await supabase.from('clientes').select('id').eq('telefono', tel).maybeSingle()
          existente = data
        }
        const payload = {
          nombre: fila.nombre.trim(),
          cedula: ced,
          telefono: tel,
          fecha_cumpleanos: fila.fecha_cumpleanos.trim() || null,
          notas: fila.notas.trim() || null,
          advertencias: fila.advertencias.trim() || null,
          ...(negocioId ? { negocio_id: negocioId } : {}),
        }
        if (existente?.id) {
          const { error } = await supabase.from('clientes').update(payload).eq('id', existente.id)
          if (!error) actualizados++
        } else {
          const { error } = await supabase.from('clientes').insert(payload)
          if (!error) creados++
        }
      }
      toast.success(`Importados: ${creados} nuevos, ${actualizados} actualizados`)
      await cargarClientes()
    } catch (e) {
      toast.error('Error al importar clientes: ' + String(e))
    }
    setImportandoClientes(false)
  }

  function abrirEditarCliente(cliente: ClienteStat) {
    setClienteEditando(cliente)
    setClienteFormEdit({
      nombre: cliente.nombre || '',
      cedula: cliente.cedula || '',
      telefono: cliente.telefono || '',
      fecha_cumpleanos: cliente.fecha_cumpleanos || '',
      notas: cliente.notas || '',
      advertencias: cliente.advertencias || '',
    })
  }

  async function guardarClienteEditado() {
    if (!clienteEditando || !clienteFormEdit.nombre.trim()) return
    const { error } = await supabase.from('clientes').update({
      nombre: clienteFormEdit.nombre.trim(),
      cedula: clienteFormEdit.cedula.trim() || null,
      telefono: clienteFormEdit.telefono.trim() || null,
      fecha_cumpleanos: clienteFormEdit.fecha_cumpleanos || null,
      notas: clienteFormEdit.notas.trim() || null,
      advertencias: clienteFormEdit.advertencias.trim() || null,
    }).eq('id', clienteEditando.id)
    if (error) { toast.error('Error al guardar cliente'); return }
    toast.success('Cliente actualizado')
    setClienteEditando(null)
    await cargarClientes()
  }

  async function eliminarCliente(cliente: ClienteStat) {
    if (!confirm(`Eliminar cliente "${cliente.nombre}"? Sus pedidos quedan guardados, pero sin cliente vinculado.`)) return
    await supabase.from('pedidos').update({ cliente_id: null }).eq('cliente_id', cliente.id)
    const { error } = await supabase.from('clientes').delete().eq('id', cliente.id)
    if (error) { toast.error('Error al borrar cliente'); return }
    toast.success('Cliente eliminado')
    setClienteDetalle(null)
    await cargarClientes()
  }
  // Zonas únicas derivadas de las mesas (orden alfabético, nulas al final)
  const zonasLista = [...new Set(mesas.map(m => m.zona || 'Sin zona'))].sort((a, b) =>
    a === 'Sin zona' ? 1 : b === 'Sin zona' ? -1 : a.localeCompare(b, 'es')
  )

  const historialFiltrado = historialPedidos.filter(ped => {
    if (!historialBusqueda.trim()) return true
    const q = historialBusqueda.toLowerCase()
    const mesa = ped.mesa?.numero ? String(ped.mesa.numero) : ''
    const cliente = (ped.cliente_nombre || ped.cliente?.nombre || '').toLowerCase()
    const platos = ped.items?.map(i => i.plato?.nombre || '').join(' ').toLowerCase() || ''
    return mesa.includes(q) || cliente.includes(q) || platos.includes(q)
  })

  const nav = [
    { id: 'mesas',     label: 'Mesas',     icon: <MapPin size={16} />,          planReq: 'starter' as const },
    { id: 'carta',     label: 'Carta',     icon: <UtensilsCrossed size={16} />, planReq: 'starter' as const },
    { id: 'resumen',   label: 'Informes',  icon: <BarChart3 size={16} />,       planReq: 'basico'  as const },
    { id: 'tiempos',   label: 'Tiempos',   icon: <Timer size={16} />,           planReq: 'pro'     as const },
    { id: 'clientes',  label: 'Clientes',  icon: <UserCircle size={16} />,      planReq: 'basico'  as const },
    { id: 'reservas',  label: 'Reservas',  icon: <CalendarDays size={16} />,    planReq: 'basico'  as const },
    { id: 'historial', label: 'Historial', icon: <ClipboardList size={16} />,   planReq: 'basico'  as const },
    { id: 'marketing', label: 'Marketing', icon: <TrendingUp size={16} />,      planReq: 'pro'     as const },
    { id: 'caja',      label: 'Caja',      icon: <DollarSign size={16} />,      planReq: 'starter' as const },
  ]

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {preguntarGuia && (
        <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-orange-100">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xl mb-4">?</div>
            <h2 className="text-xl font-black text-gray-900">Quieres una guia rapida?</h2>
            <p className="text-sm text-gray-500 leading-relaxed mt-2">
              Te muestro para que sirve cada panel y que deberias hacer primero. Toma menos de un minuto.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-6">
              <button onClick={cerrarGuia}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl py-3 text-sm">
                Ahora no
              </button>
              <button onClick={iniciarGuia}
                className="bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl py-3 text-sm shadow-lg shadow-orange-200">
                Si, guiame
              </button>
            </div>
          </div>
        </div>
      )}

      {guiaActiva && pasoGuiaActual && (
        <div className="fixed inset-x-0 bottom-0 z-[75] p-4 pointer-events-none">
          <div className="max-w-lg mx-auto bg-gray-950 text-white rounded-3xl p-5 shadow-2xl border border-white/10 pointer-events-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-orange-300 uppercase tracking-widest">
                  Guia {guiaPaso + 1} de {pasosGuia.length}
                </p>
                <h2 className="text-lg font-black mt-1">{pasoGuiaActual.titulo}</h2>
              </div>
              <button onClick={cerrarGuia} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-white/75 leading-relaxed mt-3">{pasoGuiaActual.texto}</p>
            <p className="text-sm text-orange-200 font-semibold mt-3">{pasoGuiaActual.accion}</p>
            <div className="flex gap-2 mt-5">
              <button onClick={cerrarGuia}
                className="flex-1 bg-white/10 hover:bg-white/15 text-white/80 font-bold rounded-2xl py-3 text-sm">
                Terminar
              </button>
              <button onClick={avanzarGuia}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl py-3 text-sm">
                {guiaPaso + 1 >= pasosGuia.length ? 'Finalizar' : 'Siguiente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {platoConfigNuevoOrden && (
        <ModificadorModal
          plato={platoConfigNuevoOrden as never}
          onCancel={() => setPlatoConfigNuevoOrden(null)}
          onConfirm={mods => { agregarNuevoOrdenPlato(platoConfigNuevoOrden, mods); setPlatoConfigNuevoOrden(null) }}
        />
      )}
      {configurandoNuevoOrden && (
        <ConfigurarModificadoresPedido
          items={nuevoOrdenItemsMod}
          onCancel={() => setConfigurandoNuevoOrden(false)}
          onConfirm={items => {
            setNuevoOrdenItemsMod(items)
            setConfigurandoNuevoOrden(false)
            toast.success('Complementos configurados')
          }}
        />
      )}

      {/* ── HEADER premium light ──────────────────────────────────── */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-[#FF7A00] to-orange-600 p-2 rounded-xl shadow-md shadow-orange-200">
            <BarChart3 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 tracking-tight text-[15px]">Panel Gerencia</h1>
            <p className="text-[11px] text-gray-400 capitalize leading-none mt-0.5">
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
            turnoActivo
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
              : 'bg-red-50 text-red-500 border-red-200'
          }`}>
            {turnoActivo ? '● Turno abierto' : '○ Sin turno'}
          </div>
          <button onClick={() => {
              setModalSettings(true)
              setSeccionSettings('cuenta')
              supabase.from('usuarios').select('id, nombre, rol, activo').order('nombre').then(({ data }) => {
                if (data) setListaUsuarios(data)
              })
              cargarFacturacion()
            }}
            className="w-9 h-9 bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-200 rounded-xl flex items-center justify-center transition-all group">
            <Settings size={17} className="text-gray-400 group-hover:text-orange-500 transition-colors" />
          </button>
        </div>
      </div>

      {/* ── NAVEGACIÓN light ─────────────────────────────────────── */}
      <div className="flex gap-1 px-3 py-2.5 bg-white border-b border-gray-100 overflow-x-auto scrollbar-none shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        {nav.map(n => {
          const bloqueado = !puedeAcceder(n.planReq)
          return (
            <button key={n.id}
              onClick={() => {
                if (bloqueado) { abrirUpgrade(); toast(`🔒 Plan ${n.planReq === 'pro' ? 'Pro' : 'Profesional'} requerido`, { icon: '⬆️' }); return }
                setSeccion(n.id as Seccion)
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all
                ${seccion === n.id && !bloqueado
                  ? 'bg-[#FF7A00] text-white shadow-md shadow-orange-200'
                  : bloqueado
                  ? 'text-gray-300 cursor-default'
                  : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600'}`}>
              {n.icon} {n.label}
              {bloqueado && <Lock size={12} className="text-gray-300 ml-0.5" />}
            </button>
          )
        })}
      </div>

      <div className="p-4">

        {/* ══ MESAS ══════════════════════════════════════════════ */}
        {seccion === 'mesas' && (
          <div>

            {/* ── Notificaciones domi listo (top, llamativas) ── */}
            {notifsListoDomi.length > 0 && (
              <div className="mb-4 space-y-2">
                {notifsListoDomi.map(n => (
                  <div key={n.id} className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-sm shadow-emerald-100">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center text-lg shrink-0">🛵</div>
                      <div>
                        <p className="text-emerald-700 font-black text-sm">¡Domi listo! — {n.clienteNombre}</p>
                        <p className="text-emerald-500 text-xs">Cocina terminó. El domiciliario puede recoger.</p>
                      </div>
                    </div>
                    <button onClick={() => setNotifsListoDomi(prev => prev.filter(x => x.id !== n.id))}
                      className="text-emerald-400 hover:text-emerald-600 shrink-0 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Barra de acciones ── */}
            <div className="flex items-center justify-between mb-5 gap-2">
              {!modoGestionMesas ? (
                /* Leyenda de estados */
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-200 ring-1 ring-gray-300 inline-block" />
                    <span className="text-xs text-gray-400 font-medium">Libre</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF7A00] inline-block" />
                    <span className="text-xs text-gray-500 font-medium">Ocupada</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                    <span className="text-xs text-gray-500 font-medium">Cobrando</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                  <p className="text-sm font-bold text-orange-600">Modo gestión</p>
                </div>
              )}
              <div className="flex gap-2 shrink-0">
                <button onClick={() => {
                  setModalNuevoPedido(true)
                  setNuevoOrdenTipo('mesa'); setNuevoOrdenCarrito({}); setNuevoOrdenItemsMod([])
                  setNuevoOrdenMesaId(null); setNuevoOrdenNotas('')
                  setNuevoOrdenCategoria('todas')
                  setNuevoOrdenDomi({ nombre: '', telefono: '', direccion: '' })
                }}
                  className="text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 bg-[#FF7A00] text-white hover:bg-orange-600 shadow-md shadow-orange-200 transition-all">
                  <Plus size={13} /> Pedido
                </button>
                <button onClick={() => setModalQRDomi(true)}
                  className="text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 shadow-sm transition-all">
                  🌐 Mi Página
                </button>
                <button onClick={() => setModoGestionMesas(g => !g)}
                  className={`text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all border ${
                    modoGestionMesas
                      ? 'bg-orange-50 text-orange-600 border-orange-200 shadow-sm'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 shadow-sm'
                  }`}>
                  <Settings size={13} /> {modoGestionMesas ? 'Salir' : 'Gestionar'}
                </button>
              </div>
            </div>

            {modoGestionMesas ? (
              /* ── MODO GESTIÓN ── */
              <div className="space-y-4">
                <button onClick={() => { setModalNuevaZona(true); setNuevaZonaNombre(''); setNuevaMesaNumero('') }}
                  className="w-full bg-[#FF7A00] hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-orange-200 transition-all active:scale-[0.98]">
                  <Plus size={18} /> Nueva zona
                </button>
                {zonasLista.length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-sm">No hay zonas. Crea la primera.</div>
                )}
                {zonasLista.map(zona => (
                  <div key={zona} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <span className="font-bold text-gray-800 text-base">{zona}</span>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => { setModalRenombrarZona(zona); setRenombrarZonaValor(zona) }}
                          className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-500 px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-medium border border-gray-200 transition-all">
                          <Pencil size={12} /> Renombrar
                        </button>
                        <button onClick={() => { setModalAgregarMesa(zona); setNuevaMesaNumero('') }}
                          className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-600 px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-medium border border-orange-200 transition-all">
                          <Plus size={12} /> Mesa
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {mesas
                        .filter(m => (m.zona || 'Sin zona') === zona)
                        .sort((a, b) => a.numero - b.numero)
                        .map(m => (
                          <div key={m.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 shadow-sm">
                            <span className="font-bold text-gray-700 text-sm">Mesa {m.numero}</span>
                            <button onClick={() => setModalQR(m)} className="text-gray-300 hover:text-orange-500 ml-1 transition-colors text-xs font-bold" title="Ver QR">QR</button>
                            {m.estado === 'libre' ? (
                              <button onClick={() => eliminarMesa(m.id)} className="text-red-300 hover:text-red-500 ml-0.5 transition-colors" title="Eliminar">
                                <X size={14} />
                              </button>
                            ) : (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${m.estado === 'ocupada' ? 'bg-orange-100 text-orange-600' : 'bg-amber-100 text-amber-700'}`}>
                                {m.estado === 'ocupada' ? 'ocupada' : 'cobrando'}
                              </span>
                            )}
                          </div>
                        ))}
                      {mesas.filter(m => (m.zona || 'Sin zona') === zona).length === 0 && (
                        <p className="text-sm text-gray-300 italic">Sin mesas</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ── MODO NORMAL: agrupado por zona ── */
              <div className="space-y-6">
                {zonasLista.map(zona => (
                  <div key={zona}>
                    {/* Zona header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-1 h-4 bg-[#FF7A00] rounded-full opacity-60" />
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">{zona}</h3>
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="text-[11px] text-gray-300 font-medium">
                        {mesas.filter(m => (m.zona || 'Sin zona') === zona && m.estado !== 'libre').length} /
                        {mesas.filter(m => (m.zona || 'Sin zona') === zona).length}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {mesas
                        .filter(m => (m.zona || 'Sin zona') === zona)
                        .sort((a, b) => a.numero - b.numero)
                        .map(mesa => (
                          <div key={mesa.id} className="relative group">
                            <button onClick={() => abrirDetalleMesa(mesa)}
                              className={`w-full rounded-2xl p-4 text-center font-bold transition-all duration-200 ${
                                mesa.estado === 'libre'
                                  ? 'bg-white border border-gray-100 shadow-sm text-gray-300 hover:border-orange-200 hover:shadow-[0_4px_16px_rgba(255,122,0,0.12)] hover:bg-orange-50/40 active:scale-[0.97]'
                                  : mesa.estado === 'ocupada'
                                  ? 'bg-gradient-to-br from-[#FF7A00] to-orange-600 text-white shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-200 active:scale-[0.97] border border-orange-400/20'
                                  : 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg shadow-amber-200 hover:shadow-xl hover:shadow-amber-200 active:scale-[0.97] border border-amber-300/20'
                              }`}>
                              <p className={`text-3xl font-black leading-none ${mesa.estado === 'libre' ? 'text-gray-300' : 'text-white'}`}>
                                {mesa.numero}
                              </p>
                              <p className={`text-[10px] mt-1.5 font-bold uppercase tracking-wide ${
                                mesa.estado === 'libre' ? 'text-gray-300' : 'text-white/80'
                              }`}>
                                {mesa.estado === 'libre' ? 'Libre' : mesa.estado === 'ocupada' ? 'Ocupada' : 'Cobrando'}
                              </p>
                            </button>
                            {/* QR badge — visible on hover */}
                            <button
                              onClick={e => { e.stopPropagation(); setModalQR(mesa) }}
                              title="Ver QR de mesa"
                              className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/90 border border-gray-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm hover:bg-orange-50 hover:border-orange-200 backdrop-blur-sm">
                              <span className="text-[9px] font-black text-gray-400">QR</span>
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
                {mesas.length === 0 && (
                  <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <MapPin size={28} className="text-gray-300" />
                    </div>
                    <p className="text-gray-400 text-sm font-medium mb-4">No hay mesas configuradas</p>
                    <button onClick={() => setModoGestionMesas(true)}
                      className="text-sm font-bold text-orange-500 hover:text-orange-600 transition-colors">
                      Crear primera zona →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Panel domicilios del día */}
            {domiActivos.length > 0 && (
              <div className="mt-5 space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">🛵 Domicilios de hoy</h3>

                {/* ── Pendientes de verificación ── */}
                {domiActivos.filter(d => METODOS_DIGITALES_DOMI.includes(d.metodo_pago_cliente || '') && !d.pago_domi_aprobado && d.estado !== 'cancelado' && d.estado !== 'pagado').length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-yellow-600">⚠️ Por verificar</p>
                    {domiActivos.filter(d => METODOS_DIGITALES_DOMI.includes(d.metodo_pago_cliente || '') && !d.pago_domi_aprobado && d.estado !== 'cancelado' && d.estado !== 'pagado').map(d => (
                      <div key={d.id} className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl px-4 py-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 text-sm">{d.cliente_nombre || 'Sin nombre'}</p>
                            {d.cliente_telefono && <p className="text-xs text-gray-500">📞 {d.cliente_telefono}</p>}
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs font-black text-orange-600">${d.total.toLocaleString('es-CO')}</span>
                              <span className="text-xs text-gray-500">
                                {d.metodo_pago_cliente === 'efectivo' ? '💵 Efectivo' : d.metodo_pago_cliente ? `📲 ${d.metodo_pago_cliente}` : ''}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-black bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full shrink-0">
                            {Math.floor((Date.now() - new Date(d.created_at).getTime()) / 60000)} min
                          </span>
                        </div>
                        {/* Comprobante transferencia */}
                        {METODOS_DIGITALES_DOMI.includes(d.metodo_pago_cliente || '') && d.comprobante_url && (
                          <a href={d.comprobante_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 text-xs text-blue-600 font-bold hover:text-blue-700 transition-colors">
                            🧾 Ver comprobante de transferencia →
                          </a>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => confirmarQrDomiPago(d.id, d.metodo_pago_cliente)}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-all">
                            <CheckCircle size={13} /> Confirmar pago a cocina
                          </button>
                          <button
                            onClick={() => rechazarQrDomiPago(d.id)}
                            className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-all border border-red-200">
                            ✗ Rechazar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Activos (en cocina / listos / en camino / pagados) ── */}
                <div className="space-y-2">
                  {domiActivos.filter(d => !(METODOS_DIGITALES_DOMI.includes(d.metodo_pago_cliente || '') && !d.pago_domi_aprobado && d.estado !== 'cancelado' && d.estado !== 'pagado')).map(d => {
                    const mins = Math.floor((Date.now() - new Date(d.created_at).getTime()) / 60000)
                    const pagado    = d.estado === 'pagado'
                    const listo     = d.estado === 'listo'
                    const enCamino  = d.estado === 'en_camino'
                    const enPrep    = d.estado === 'en_preparacion'
                    const EMOJIS: Record<string, string> = { efectivo: '💵', nequi: '💜', daviplata: '❤️', bancolombia: '🟡' }

                    // Para transferencia listo sin pago aprobado → mostrar botón "Recibir pago"
                    const necesitaConfirmarPago = listo && METODOS_DIGITALES_DOMI.includes(d.metodo_pago_cliente || '') && !d.pago_domi_aprobado

                    const badgeClases = pagado
                      ? 'bg-gray-200 text-gray-500'
                      : listo
                      ? 'bg-green-500 text-white animate-pulse'
                      : enCamino
                      ? 'bg-sky-500 text-white animate-pulse'
                      : enPrep
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-400 text-white'

                    const badgeLabel = pagado ? '✓ PAGADO' : listo ? '🍽️ LISTO' : enCamino ? '🛵 EN CAMINO' : enPrep ? '🔥 PREP.' : '⏳ ESPERA'

                    const cardClases = pagado
                      ? 'bg-white border-gray-200 opacity-50 cursor-default'
                      : listo
                      ? 'bg-green-50 border-green-300 shadow-sm shadow-green-100'
                      : enCamino
                      ? 'bg-sky-50 border-sky-300 shadow-sm shadow-sky-100'
                      : 'bg-white border-gray-200 shadow-sm hover:border-orange-300 hover:shadow-md'

                    return (
                      <div key={d.id} className={`rounded-2xl px-4 py-3 border ${cardClases}`}>
                        <button className="w-full text-left" onClick={() => !pagado && abrirDetalleDomi(d.id)} disabled={pagado}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${badgeClases}`}>
                                  {badgeLabel}
                                </span>
                                <span className="font-bold text-gray-800 text-sm">
                                  {d.cliente_nombre || <span className="text-gray-400 italic font-normal">Sin nombre</span>}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {d.cliente_telefono && <span className="text-xs text-gray-500">📞 {d.cliente_telefono}</span>}
                                <span className="text-xs font-semibold text-orange-600">${d.total.toLocaleString('es-CO')}</span>
                                {d.metodo_pago_cliente && (
                                  <span className="text-xs text-gray-400">
                                    {d.metodo_pago_cliente === 'efectivo' ? '💵' : '📲'} {d.metodo_pago_cliente}
                                  </span>
                                )}
                                {d.metodos.length > 0 && (
                                  <span className="text-xs text-gray-400">{d.metodos.map(m => EMOJIS[m] || m).join(' ')}</span>
                                )}
                              </div>
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${pagado ? 'bg-gray-100 text-gray-400' : mins >= 40 ? 'bg-red-50 text-red-500 border border-red-200' : mins >= 20 ? 'bg-yellow-50 text-yellow-600 border border-yellow-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                              {pagado ? new Date(d.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : `${mins} min`}
                            </span>
                          </div>
                          {listo && !necesitaConfirmarPago && <p className="text-xs text-green-600 font-bold mt-1">✅ Listo en cocina — Toca para cobrar →</p>}
                          {enCamino && <p className="text-xs text-sky-600 font-bold mt-1">🛵 Domi en camino (informativo)</p>}
                          {!pagado && !listo && !enCamino && <p className="text-xs text-gray-400 mt-1">Toca para cobrar →</p>}
                        </button>

                        {/* Botón Recibir pago (solo para transferencia listo sin aprobar) */}
                        {necesitaConfirmarPago && (
                          <div className="mt-2 pt-2 border-t border-green-200">
                            <p className="text-xs text-amber-600 font-bold mb-1.5">⏳ El domiciliario está bloqueado hasta confirmar recepción del dinero</p>
                            <button
                              onClick={() => confirmarRecepcionPago(d.id)}
                              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all">
                              <CheckCircle size={13} /> Recibí el pago — Domi puede salir
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ CARTA ══════════════════════════════════════════════ */}
        {seccion === 'carta' && (
          <div>
            {/* Tabs de subsección */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => setSubSeccionCarta('carta')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${subSeccionCarta === 'carta' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-white text-gray-500 border border-gray-200 hover:border-orange-300 hover:text-gray-700'}`}>
                <UtensilsCrossed size={15} /> Carta general
              </button>
              <button onClick={() => setSubSeccionCarta('menus')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${subSeccionCarta === 'menus' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-white text-gray-500 border border-gray-200 hover:border-orange-300 hover:text-gray-700'}`}>
                <ClipboardList size={15} /> Menús de turno
              </button>
            </div>

            {/* ── SUBSECCIÓN: CARTA GENERAL ── */}
            {subSeccionCarta === 'carta' && (
              <div>
                <div className="flex items-center justify-between mb-4 gap-2">
                  <h2 className="font-bold text-gray-900">Gestión de carta</h2>
                  <button onClick={abrirNuevoPlato} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-orange-900/30 transition-all">
                    <Plus size={15} /> Nuevo plato
                  </button>
                </div>

                {/* Filtro por categoría */}
                <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none">
                  <button onClick={() => setCategoriaActivaCarta('todas')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${categoriaActivaCarta === 'todas' ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/30' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'}`}>
                    Todas
                  </button>
                  {categorias.map(c => (
                    <button key={c.id} onClick={() => setCategoriaActivaCarta(c.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${categoriaActivaCarta === c.id ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/30' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'}`}>
                      {c.nombre}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {platosFiltradosCarta.map(plato => {
                    const margen = utilidadPlato(plato)
                    return (
                      <div key={plato.id} className={`bg-white rounded-2xl p-4 border shadow-sm transition-all ${plato.activo ? 'border-gray-200 hover:bg-gray-50' : 'border-gray-200 opacity-50'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-gray-900">{plato.nombre}</p>
                              {!plato.activo && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full border border-red-200">Inactivo</span>}
                              {margen && <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${parseInt(margen) >= 50 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : parseInt(margen) >= 30 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-600 border-red-200'}`}>{margen}% margen</span>}
                            </div>
                            {plato.descripcion && <p className="text-xs text-gray-400 mt-0.5 truncate">{plato.descripcion}</p>}
                            <div className="flex gap-4 mt-1">
                              <span className="text-sm font-bold text-gray-800">${plato.precio.toLocaleString('es-CO')} <span className="font-normal text-gray-400">precio</span></span>
                              {plato.costo ? <span className="text-sm text-gray-500">${plato.costo.toLocaleString('es-CO')} <span className="text-gray-400">costo</span></span> : <span className="text-xs text-orange-500">Sin costo registrado</span>}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{categorias.find(c => c.id === plato.categoria_id)?.nombre}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => abrirEditarPlato(plato)} className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center border border-gray-200 transition-all"><Pencil size={14} className="text-gray-500" /></button>
                            <button onClick={() => toggleActivoPlato(plato)} className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${plato.activo ? 'bg-orange-50 hover:bg-orange-100 border-orange-200' : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200'}`}>
                              {plato.activo ? <X size={14} className="text-orange-500" /> : <CheckCircle size={14} className="text-emerald-600" />}
                            </button>
                            <button onClick={() => eliminarPlato(plato)} className="w-8 h-8 bg-red-50 hover:bg-red-100 rounded-xl flex items-center justify-center border border-red-200 transition-all"><Trash2 size={14} className="text-red-500" /></button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── SUBSECCIÓN: MENÚS DE TURNO ── */}
            {subSeccionCarta === 'menus' && (
              <div>
                <div className="flex items-center justify-between mb-3 gap-2">
                  <h2 className="font-bold text-gray-900">Menús de turno</h2>
                  <button
                    onClick={() => { setModalNuevoMenu('nuevo'); setEditandoMenuId(null); setMenuForm({ nombre: '', items: {} }) }}
                    className="bg-orange-500/90 hover:bg-orange-500 text-white px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-orange-900/30 transition-all">
                    <Plus size={15} /> Nuevo menú
                  </button>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 text-xs text-orange-700 leading-relaxed mb-4">
                  💡 Crea menús con nombre para tener tus plantillas de cantidad por día o temporada. Al abrir el turno puedes escoger uno de la lista o ingresar cantidades manualmente.
                </div>

                <div className="space-y-3">
                  {menusTurno.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <ClipboardList size={36} className="mx-auto mb-3 opacity-40" />
                      <p className="text-sm font-medium">No hay menús creados todavía</p>
                      <p className="text-xs mt-1">Toca &quot;Nuevo menú&quot; para crear el primero</p>
                    </div>
                  )}
                  {menusTurno.map(menu => {
                    const itemsConCantidad = menu.items.filter(i => i.cantidad > 0)
                    const totalUnidades = menu.items.reduce((a, i) => a + i.cantidad, 0)
                    return (
                      <div key={menu.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:bg-gray-50 transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-gray-900 text-base">{menu.nombre}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {itemsConCantidad.length} platos · {totalUnidades} unidades totales
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {itemsConCantidad.slice(0, 5).map(item => {
                                const plato = platos.find(p => p.id === item.plato_id)
                                if (!plato) return null
                                return (
                                  <span key={item.plato_id} className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full">
                                    {plato.nombre} ×{item.cantidad}
                                  </span>
                                )
                              })}
                              {itemsConCantidad.length > 5 && (
                                <span className="text-xs text-gray-400 px-1">+{itemsConCantidad.length - 5} más</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => {
                              const items: Record<string, number> = {}
                              menu.items.forEach(i => { items[i.plato_id] = i.cantidad })
                              setMenuForm({ nombre: menu.nombre, items })
                              setEditandoMenuId(menu.id)
                              setModalNuevoMenu('editar')
                            }} className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center border border-gray-200 transition-all">
                              <Pencil size={14} className="text-gray-500" />
                            </button>
                            <button onClick={() => eliminarMenuTurno(menu.id, menu.nombre)}
                              className="w-8 h-8 bg-red-50 hover:bg-red-100 rounded-xl flex items-center justify-center border border-red-200 transition-all">
                              <Trash2 size={14} className="text-red-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ RESUMEN / INFORMES ══════════════════════════════════ */}
        {seccion === 'resumen' && puedeAcceder('basico') && (
          <div className="space-y-4">
            {/* Selector de rango */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 space-y-2">
              <div className="flex gap-1.5">
                {([['hoy', 'Hoy'], ['semana', 'Últimos 7 días'], ['mes', 'Este mes'], ['personalizado', '📅 Personalizado']] as [RangoResumen, string][]).map(([r, label]) => (
                  <button key={r} onClick={() => setRangoResumen(r)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${rangoResumen === r ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/30' : 'text-gray-500 hover:bg-gray-100 bg-gray-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
              {rangoResumen === 'personalizado' && (
                <div className="flex gap-2 items-end pt-1">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Desde</label>
                    <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Hasta</label>
                    <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                  </div>
                  <button onClick={() => cargarResumen(fechaDesde, fechaHasta)}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl text-sm whitespace-nowrap shadow-lg shadow-orange-900/30 transition-all">
                    Ver
                  </button>
                </div>
              )}
            </div>

            {cargandoResumen ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <div className="text-center"><BarChart3 size={32} className="mx-auto mb-2 animate-pulse text-orange-500" /><p>Cargando datos...</p></div>
              </div>
            ) : (<>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Ventas totales', valor: `$${resumenStats.ventas.toLocaleString('es-CO')}`, actual: resumenStats.ventas, anterior: resumenStatsAnterior.ventas, icon: <DollarSign size={18}/>, color: 'bg-emerald-500', glow: 'shadow-emerald-900/40' },
                { label: 'Pedidos', valor: resumenStats.pedidos, actual: resumenStats.pedidos, anterior: resumenStatsAnterior.pedidos, icon: <ChefHat size={18}/>, color: 'bg-gray-500', glow: 'shadow-gray-900/30' },
                { label: 'Utilidad', valor: `$${resumenStats.utilidad.toLocaleString('es-CO')}`, actual: resumenStats.utilidad, anterior: resumenStatsAnterior.utilidad, icon: <TrendingUp size={18}/>, color: 'bg-orange-500', glow: 'shadow-orange-900/30' },
                { label: 'Domicilios', valor: `$${resumenStats.domis.toLocaleString('es-CO')}`, actual: resumenStats.domis, anterior: resumenStatsAnterior.domis, icon: <Bike size={18}/>, color: 'bg-gray-400', glow: 'shadow-gray-900/30' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm text-center hover:bg-gray-50 transition-all">
                  <div className={`${s.color} shadow-lg ${s.glow} w-9 h-9 rounded-xl flex items-center justify-center text-white mx-auto mb-2`}>{s.icon}</div>
                  <p className="text-lg font-black text-gray-900 leading-tight">{s.valor}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  {(() => {
                    const pct = porcentajeCambio(s.actual, s.anterior)
                    const positivo = pct >= 0
                    return (
                      <p className={`text-[11px] font-black mt-1 ${positivo ? 'text-emerald-600' : 'text-red-500'}`}>
                        {positivo ? '+' : ''}{pct}% vs semana anterior
                      </p>
                    )
                  })()}
                </div>
              ))}
            </div>

            {/* Gráfico ventas por hora o por día */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <h3 className="font-bold text-gray-800 mb-3">
                {(rangoResumen === 'hoy' || (rangoResumen === 'personalizado' && fechaDesde === fechaHasta)) ? '📈 Ventas por hora' : '📅 Ventas por día'}
              </h3>
              {(() => {
                const esPorHora = ventasPorHora.length > 0
                return (
                  <ResponsiveContainer width="100%" height={180}>
                    {esPorHora ? (
                      <BarChart data={ventasPorHora} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#6b7280' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, color: '#111' }} formatter={(v) => [`$${Number(v ?? 0).toLocaleString('es-CO')}`, 'Ventas']} />
                        <Bar dataKey="ventas" fill="#f97316" radius={[4,4,0,0]} />
                      </BarChart>
                    ) : (
                      <BarChart data={ventasPorDia} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis dataKey="dia" tick={{ fontSize: 9, fill: '#6b7280' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, color: '#111' }} formatter={(v, n) => [`$${Number(v ?? 0).toLocaleString('es-CO')}`, n === 'ventas' ? 'Establecimiento' : 'Domicilios']} />
                        <Bar dataKey="ventas" stackId="a" fill="#f97316" radius={[0,0,0,0]} name="ventas" />
                        <Bar dataKey="domis" stackId="a" fill="#6b7280" radius={[4,4,0,0]} name="domis" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                )
              })()}
              {ventasPorDia.length > 0 && (
                <div className="flex gap-3 mt-2 justify-center text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500 inline-block"/>Establecimiento</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-500 inline-block"/>Domicilios</span>
                </div>
              )}
            </div>

            {/* Torta métodos de pago + Top platos */}
            <div className="grid grid-cols-1 gap-4">
              {/* Torta */}
              {datosPagosMetodo.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                  <h3 className="font-bold text-gray-800 mb-2">💳 Métodos de pago</h3>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={130} height={130}>
                      <PieChart>
                        <Pie data={datosPagosMetodo} cx="50%" cy="50%" innerRadius={35} outerRadius={58} dataKey="value" paddingAngle={3}>
                          {datosPagosMetodo.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, color: '#111' }} formatter={(v) => [`$${Number(v ?? 0).toLocaleString('es-CO')}`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {datosPagosMetodo.map(m => (
                        <div key={m.name} className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-sm text-gray-600">
                            <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ backgroundColor: m.color }} />
                            {m.name}
                          </span>
                          <span className="font-bold text-sm text-gray-900">${m.value.toLocaleString('es-CO')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Top platos gráfico */}
              {platosTop.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                  <h3 className="font-bold text-gray-900 mb-3">🏆 Platos más vendidos</h3>
                  <ResponsiveContainer width="100%" height={Math.min(platosTop.slice(0,6).length * 36, 220)}>
                    <BarChart layout="vertical" data={platosTop.slice(0,6).map(p => ({ nombre: p.nombre.length > 18 ? p.nombre.slice(0,16)+'…' : p.nombre, cant: p.cantidad, total: p.total }))}
                      margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => String(v)} />
                      <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={90} />
                      <Tooltip formatter={(v) => [Number(v ?? 0), 'Unidades']} />
                      <Bar dataKey="cant" fill="#f97316" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Desempeño meseras */}
            {meseras.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100"><h3 className="font-bold text-gray-800">👩 Desempeño meseras</h3></div>
                <div className="divide-y divide-gray-100">
                  {meseras.map((m, i) => (
                    <div key={m.nombre} className="flex items-center gap-3 px-4 py-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : 'bg-gray-300'}`}>{i+1}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 text-sm">{m.nombre}</p>
                        <p className="text-xs text-gray-400">{m.pedidos} pedido(s)</p>
                      </div>
                      <span className="font-bold text-gray-800 text-sm">${m.total.toLocaleString('es-CO')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tiempos del período ── */}
            {(resumenTiempoCocinero.length > 0 || resumenTiempoPlato.length > 0) && (
              <div className="space-y-3">
                <h3 className="font-bold text-gray-700 flex items-center gap-2"><Timer size={16} className="text-orange-500"/> Tiempos del período</h3>

                {resumenTiempoCocinero.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                      <ChefHat size={15} className="text-orange-500"/>
                      <p className="font-bold text-gray-800 text-sm">Rendimiento cocineras</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {resumenTiempoCocinero.map(c => (
                        <div key={c.nombre} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">👩‍🍳 {c.nombre}</p>
                            <p className="text-xs text-gray-400">{c.platos} plato(s)</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-800">{c.tiempoPromedio} min</p>
                            <p className="text-xs text-gray-400">prom. preparación</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {resumenTiempoPlato.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                      <Clock size={15} className="text-gray-500"/>
                      <p className="font-bold text-gray-800 text-sm">Tiempos por plato</p>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
                      {resumenTiempoPlato.map(p => (
                        <div key={p.nombre} className="px-4 py-3">
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-semibold text-gray-800 text-sm">{p.nombre}</p>
                            <span className="text-xs text-gray-400">{p.cantidad} veces</span>
                          </div>
                          <div className="flex gap-3 text-xs">
                            <span className="text-gray-500">⏳ Espera: <b>{p.espera} min</b></span>
                            <span className="text-orange-500">🔥 Prep: <b>{p.preparacion} min</b></span>
                            <span className="text-emerald-600">✅ Total: <b>{p.total} min</b></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Historial pedidos */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100"><h3 className="font-bold text-gray-800">📋 Pedidos del período</h3></div>
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {pedidosHoy.slice(0, 30).map(p => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      {p.tipo === 'domi' ? <Bike size={14} className="text-gray-400 shrink-0"/> : <MapPin size={14} className="text-gray-300 shrink-0"/>}
                      <div>
                        <span className="font-semibold text-gray-800">{p.tipo === 'domi' ? 'Domi' : `Mesa ${p.mesa}`}</span>
                        <span className="ml-1.5 text-gray-400 text-xs">{new Date(p.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">${p.total.toLocaleString('es-CO')}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${p.estado === 'pagado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : p.estado === 'listo' ? 'bg-gray-100 text-gray-500 border-gray-200' : p.estado === 'en_preparacion' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                        {p.estado.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
                {pedidosHoy.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">Sin pedidos en este período</p>}
              </div>
            </div>
            </>)}
          </div>
        )}

        {/* ══ TIEMPOS ═════════════════════════════════════════════ */}
        {seccion === 'tiempos' && puedeAcceder('pro') && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">Datos de hoy — basado en pedidos completados</p>

            {/* Por cocinera */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <ChefHat size={16} className="text-orange-500" />
                <h3 className="font-bold text-gray-800">Rendimiento por cocinera</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {tiemposPorCocinero.map(c => (
                  <div key={c.nombre} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">👩‍🍳 {c.nombre}</p>
                      <p className="text-xs text-gray-400">{c.platos} plato(s) preparado(s)</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-800">{c.tiempoPromedio} min</p>
                      <p className="text-xs text-gray-400">prom. preparación</p>
                    </div>
                  </div>
                ))}
                {tiemposPorCocinero.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">Sin datos — los tiempos se registran cuando cocina asigna platos</p>}
              </div>
            </div>

            {/* Permanencia en mesa */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <MapPin size={16} className="text-emerald-600" />
                <h3 className="font-bold text-gray-800">Tiempo de permanencia en mesa</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {(() => {
                  const pagadosHoy = pedidosHoy.filter(p => p.estado === 'pagado')
                  if (pagadosHoy.length === 0) return <p className="text-center text-gray-400 py-6 text-sm">Sin mesas cerradas hoy</p>
                  return pagadosHoy.slice(0, 8).map(p => {
                    const mins = p.pagado_en ? Math.round((new Date(p.pagado_en).getTime() - new Date(p.created_at).getTime()) / 60000) : null
                    return (
                      <div key={p.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">Mesa {p.mesa}</p>
                          <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-800">{mins !== null ? `${mins} min` : '—'}</p>
                          <p className="text-xs text-gray-400">en mesa</p>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>

            {/* Por mesera */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Users size={16} className="text-orange-500" />
                <h3 className="font-bold text-gray-800">Tiempos por mesera</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {tiemposPorMesera.map(m => (
                  <div key={m.nombre} className="flex items-center justify-between px-4 py-3">
                    <p className="font-semibold text-gray-800 text-sm">{m.nombre}</p>
                    <div className="text-right">
                      <p className="font-bold text-gray-800">{m.tiempoPromedio} min</p>
                      <p className="text-xs text-gray-400">tiempo total promedio</p>
                    </div>
                  </div>
                ))}
                {tiemposPorMesera.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">Sin datos hoy</p>}
              </div>
            </div>

            {/* Por plato */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Clock size={16} className="text-gray-500" />
                <h3 className="font-bold text-gray-800">Tiempos por plato</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {tiemposPorPlato.map(p => (
                  <div key={p.nombre} className="px-4 py-3">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-semibold text-gray-800 text-sm">{p.nombre}</p>
                      <span className="text-xs text-gray-400">{p.cantidad} veces</span>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span className="text-gray-500">⏳ Espera: <b>{p.espera} min</b></span>
                      <span className="text-orange-500">🔥 Prep: <b>{p.preparacion} min</b></span>
                      <span className="text-emerald-600">✅ Total: <b>{p.total} min</b></span>
                    </div>
                  </div>
                ))}
                {tiemposPorPlato.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">Sin datos hoy</p>}
              </div>
            </div>
          </div>
        )}

        {/* ══ CLIENTES ════════════════════════════════════════════ */}
        {seccion === 'clientes' && (!puedeAcceder('basico') ? renderPlanLock('basico') :
          <div className="space-y-3">

            {/* Buscador + botón exportar */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Buscar por nombre o cédula..." value={busquedaCliente}
                  onChange={e => setBusquedaCliente(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
              </div>
              <button onClick={exportarClientesCSV}
                className="flex items-center gap-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold px-3 py-2.5 rounded-xl text-sm whitespace-nowrap shadow-lg shadow-emerald-900/30 transition-all">
                <Download size={15} /> Excel
              </button>
              <label className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold px-3 py-2.5 rounded-xl text-sm whitespace-nowrap shadow-lg shadow-orange-900/20 transition-all cursor-pointer">
                <Upload size={15} /> {importandoClientes ? 'Importando...' : 'Importar'}
                <input type="file" accept=".csv,.txt" className="hidden"
                  onChange={e => { importarClientesCSV(e.target.files?.[0] || null); e.currentTarget.value = '' }} />
              </label>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 space-y-2">
              {/* Ordenar por */}
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1.5 flex items-center gap-1"><SlidersHorizontal size={12}/> Ordenar por</p>
                <div className="flex gap-1.5 flex-wrap">
                  {([
                    ['mayor_consumo', '💰 Mayor consumo'],
                    ['menor_consumo', '📉 Menor consumo'],
                    ['az',            '🔤 A → Z'],
                    ['cumpleanos',    '🎂 Cumpleaños próximo'],
                  ] as ['mayor_consumo'|'menor_consumo'|'az'|'cumpleanos', string][]).map(([v, label]) => (
                    <button key={v} onClick={() => setOrdenClientes(v)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${ordenClientes === v ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/30' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Filtrar por mes de cumpleaños */}
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1.5 flex items-center gap-1"><CalendarDays size={12}/> Filtrar por mes de cumpleaños</p>
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => setFiltroMesCumple(0)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filtroMesCumple === 0 ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/30' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'}`}>
                    Todos
                  </button>
                  {MESES_ES.map((mes, i) => (
                    <button key={mes} onClick={() => setFiltroMesCumple(i + 1)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filtroMesCumple === i + 1 ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/30' : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'}`}>
                      {mes.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Contador resultados */}
            {(busquedaCliente || filtroMesCumple > 0) && (
              <p className="text-xs text-gray-400 px-1">
                {clientesFiltradosOrdenados.length} resultado(s)
                {filtroMesCumple > 0 && ` · Cumpleaños en ${MESES_ES[filtroMesCumple - 1]}`}
              </p>
            )}

            {cargandoClientes ? (
              <div className="flex justify-center py-12 text-gray-400">
                <div className="text-center"><UserCircle size={32} className="mx-auto mb-2 animate-pulse text-orange-500"/><p>Cargando...</p></div>
              </div>
            ) : (
              <div className="space-y-2">
                {clientesFiltradosOrdenados.map((c, idx) => {
                  const esCumpleMes = c.fecha_cumpleanos != null &&
                    new Date(c.fecha_cumpleanos + 'T12:00:00').getMonth() === new Date().getMonth()
                  const mostrarRanking = ordenClientes === 'mayor_consumo' || ordenClientes === 'menor_consumo'
                  return (
                    <button key={c.id} onClick={() => abrirClienteDetalle(c)}
                      className={`w-full rounded-2xl border p-4 text-left shadow-sm transition-all ${esCumpleMes ? 'bg-orange-50 border-orange-200 hover:bg-orange-100' : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}>
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-100">
                            <span className="font-black text-sm text-orange-600">{c.nombre.charAt(0).toUpperCase()}</span>
                          </div>
                          {mostrarRanking && idx < 3 && (
                            <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[10px] font-black flex items-center justify-center ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : 'bg-amber-600'}`}>{idx + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-800">{c.nombre}</p>
                            {esCumpleMes && <span className="text-xs bg-orange-100 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full font-bold">🎂 Este mes</span>}
                          </div>
                          <div className="flex gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                            {c.cedula && <span>🪪 {c.cedula}</span>}
                            {c.telefono && <span>📞 {c.telefono}</span>}
                            {c.fecha_cumpleanos && (
                              <span className={esCumpleMes ? 'text-orange-500 font-semibold' : ''}>
                                🎂 {new Date(c.fecha_cumpleanos + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-gray-900 text-sm">${c.totalGastado.toLocaleString('es-CO')}</p>
                          <p className="text-xs text-gray-400">{c.pedidos} visita(s)</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
                {clientes.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <UserCircle size={40} className="mx-auto mb-2"/>
                    <p>Sin clientes registrados aún</p>
                    <p className="text-xs mt-1">Se agregan al cobrar y capturar cédula</p>
                  </div>
                )}
                {clientes.length > 0 && clientesFiltradosOrdenados.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <Search size={32} className="mx-auto mb-2"/>
                    <p>Sin resultados para los filtros aplicados</p>
                  </div>
                )}
              </div>
            )}

            {/* Modal detalle cliente */}
            {clienteDetalle && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
                <div className="bg-[#0f0f1e] border border-white/10 w-full md:max-w-lg md:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col overflow-hidden fade-in">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center border border-orange-500/30">
                        <span className="text-orange-300 font-black text-lg">{clienteDetalle.cliente.nombre.charAt(0)}</span>
                      </div>
                      <div>
                        <h2 className="text-lg font-black text-white">{clienteDetalle.cliente.nombre}</h2>
                        <p className="text-xs text-white/40">
                          {clienteDetalle.cliente.pedidos} visita(s) · ${clienteDetalle.cliente.totalGastado.toLocaleString('es-CO')} total
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setClienteDetalle(null)} className="w-9 h-9 rounded-full bg-white/8 hover:bg-white/14 border border-white/10 flex items-center justify-center transition-all"><X size={18} className="text-white/60"/></button>
                  </div>
                  <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                    {/* Datos */}
                    <div className="bg-white/5 rounded-2xl p-4 space-y-2 text-sm border border-white/8">
                      {clienteDetalle.cliente.cedula && <div className="flex justify-between"><span className="text-white/40">Cédula</span><span className="font-semibold text-white/80">{clienteDetalle.cliente.cedula}</span></div>}
                      {clienteDetalle.cliente.telefono && <div className="flex justify-between"><span className="text-white/40">Teléfono</span><span className="font-semibold text-white/80">{clienteDetalle.cliente.telefono}</span></div>}
                      {clienteDetalle.cliente.fecha_cumpleanos && (
                        <div className="flex justify-between">
                          <span className="text-white/40">Cumpleaños</span>
                          <span className="font-semibold text-white/80">🎂 {new Date(clienteDetalle.cliente.fecha_cumpleanos + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}</span>
                        </div>
                      )}
                      {clienteDetalle.cliente.ultimaVisita && (
                        <div className="flex justify-between">
                          <span className="text-white/40">Última visita</span>
                          <span className="font-semibold text-white/80">{new Date(clienteDetalle.cliente.ultimaVisita).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>
                    {(clienteDetalle.cliente.advertencias || clienteDetalle.cliente.notas) && (
                      <div className="space-y-2">
                        {clienteDetalle.cliente.advertencias && (
                          <div className="bg-red-500/12 border border-red-500/25 rounded-2xl p-4">
                            <p className="text-xs font-black text-red-300 uppercase tracking-wider mb-1">Advertencia</p>
                            <p className="text-sm text-red-50 whitespace-pre-wrap">{clienteDetalle.cliente.advertencias}</p>
                          </div>
                        )}
                        {clienteDetalle.cliente.notas && (
                          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <p className="text-xs font-black text-white/40 uppercase tracking-wider mb-1">Notas</p>
                            <p className="text-sm text-white/80 whitespace-pre-wrap">{clienteDetalle.cliente.notas}</p>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => abrirEditarCliente(clienteDetalle.cliente)}
                        className="bg-white/8 hover:bg-white/12 border border-white/10 text-white font-bold rounded-xl py-2 text-sm">
                        Editar cliente
                      </button>
                      <button onClick={() => eliminarCliente(clienteDetalle.cliente)}
                        className="bg-red-500/15 hover:bg-red-500/20 border border-red-500/25 text-red-200 font-bold rounded-xl py-2 text-sm">
                        Borrar cliente
                      </button>
                    </div>
                    {/* Platos favoritos */}
                    {clienteDetalle.pedidos.length > 0 && (() => {
                      const conteo: Record<string, number> = {}
                      clienteDetalle.pedidos.forEach(p =>
                        p.items.forEach(i => { conteo[i.nombre] = (conteo[i.nombre] || 0) + i.cantidad })
                      )
                      const top = Object.entries(conteo).sort((a, b) => b[1] - a[1])
                      return (
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
                          <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2">🏆 Platos más pedidos</p>
                          <div className="flex flex-wrap gap-1.5">
                            {top.map(([nombre, cant]) => (
                              <span key={nombre}
                                className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${cant >= 3 ? 'bg-orange-500 text-white border-orange-500/30' : cant >= 2 ? 'bg-orange-500/20 text-orange-300 border-orange-500/20' : 'bg-white/6 text-orange-300 border-white/10'}`}>
                                {nombre} <span className="opacity-75">×{cant}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Historial de visitas con platos */}
                    <div>
                      <h3 className="font-bold text-white/70 mb-2">Historial de visitas</h3>
                      <div className="space-y-2">
                        {clienteDetalle.pedidos.map(p => (
                          <div key={p.id} className="bg-white/5 border border-white/10 rounded-xl text-sm overflow-hidden">
                            {/* Cabecera de la visita */}
                            <div className="flex items-center justify-between px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white/80">{p.tipo === 'domi' ? '🛵 Domi' : '🍽️ Mesa'}</span>
                                <span className="text-white/35 text-xs">
                                  {new Date(p.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white/80">${p.total.toLocaleString('es-CO')}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${p.estado === 'pagado' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-white/8 text-white/40 border-white/10'}`}>
                                  {p.estado}
                                </span>
                              </div>
                            </div>
                            {/* Platos consumidos */}
                            {p.items.length > 0 && (
                              <div className="px-3 pb-2.5 pt-1.5 border-t border-gray-50 flex flex-wrap gap-1">
                                {p.items.map((item, i) => (
                                  <span key={i} className="bg-white/8 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                                    {item.cantidad}× {item.nombre}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {clienteDetalle.pedidos.length === 0 && (
                          <p className="text-center text-gray-400 py-4 text-sm">Sin historial vinculado aún</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {clienteEditando && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end md:items-center justify-center p-0 md:p-4">
                <div className="bg-white w-full md:max-w-lg md:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto p-5 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-black text-gray-900">Editar cliente</h2>
                    <button onClick={() => setClienteEditando(null)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><X size={18} /></button>
                  </div>
                  <input value={clienteFormEdit.nombre} onChange={e => setClienteFormEdit(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Nombre" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={clienteFormEdit.cedula} onChange={e => setClienteFormEdit(p => ({ ...p, cedula: e.target.value }))}
                      placeholder="Cedula" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900" />
                    <input value={clienteFormEdit.telefono} onChange={e => setClienteFormEdit(p => ({ ...p, telefono: e.target.value }))}
                      placeholder="Telefono" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900" />
                  </div>
                  <input type="date" value={clienteFormEdit.fecha_cumpleanos} onChange={e => setClienteFormEdit(p => ({ ...p, fecha_cumpleanos: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900" />
                  <textarea value={clienteFormEdit.notas} onChange={e => setClienteFormEdit(p => ({ ...p, notas: e.target.value }))}
                    placeholder="Notas internas del cliente" rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 resize-none" />
                  <textarea value={clienteFormEdit.advertencias} onChange={e => setClienteFormEdit(p => ({ ...p, advertencias: e.target.value }))}
                    placeholder="Advertencias importantes" rows={3} className="w-full border border-red-200 bg-red-50 rounded-xl px-3 py-2.5 text-sm text-gray-900 resize-none" />
                  <button onClick={guardarClienteEditado}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl py-3">
                    Guardar cambios
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ RESUMEN / INFORMES — bloqueo para starter ══════════ */}
        {seccion === 'resumen' && !puedeAcceder('basico') && renderPlanLock('basico')}

        {/* ══ TIEMPOS — bloqueo para starter y basico ═══════════ */}
        {seccion === 'tiempos' && !puedeAcceder('pro') && renderPlanLock('pro')}

        {/* ══ CAJA ════════════════════════════════════════════════ */}
        {seccion === 'caja' && (() => {
          const EMOJIS: Record<string, string> = { efectivo: '💵', nequi: '💜', daviplata: '❤️', bancolombia: '🟡' }
          // Solo pedidos del turno activo (no mezclar con turnos anteriores del mismo día)
          const pedidosTurno = turnoActivo
            ? pedidosHoy.filter(p => p.turno_id === turnoActivo.id)
            : pedidosHoy
          const ventasEstab  = pedidosTurno.filter(p => p.tipo !== 'domi').reduce((a, p) => a + p.total, 0)
          const ventasDomi   = pedidosTurno.filter(p => p.tipo === 'domi').reduce((a, p) => a + p.total, 0)
          const pedidosDomi  = pedidosTurno.filter(p => p.tipo === 'domi').length
          const pedidosEstab = pedidosTurno.filter(p => p.tipo !== 'domi').length
          const totalIngresos = movimientosCaja.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + m.monto, 0)
          const totalEgresos  = movimientosCaja.filter(m => m.tipo === 'egreso').reduce((a, m) => a + m.monto, 0)
          const efectivoEnPagos = pagosPorMetodo.find(p => p.metodo === 'efectivo')
          const efectivoEsperado = (efectivoEnPagos ? efectivoEnPagos.monto + efectivoEnPagos.propina : 0)
            + (turnoActivo?.monto_inicial ?? 0) + totalIngresos - totalEgresos

          return (
          <div className="space-y-4">

            {/* Estado turno */}
            <div className={`rounded-2xl p-4 border shadow-sm ${turnoActivo ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
              <p className={`text-sm ${turnoActivo ? 'text-emerald-700' : 'text-gray-400'}`}>{turnoActivo ? '● Turno abierto desde' : '○ Sin turno activo'}</p>
              {turnoActivo && <>
                <p className="font-bold text-gray-900">{new Date(turnoActivo.abierto_en).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</p>
                <p className="text-sm text-emerald-600">Base inicial: ${turnoActivo.monto_inicial.toLocaleString('es-CO')}</p>
              </>}
            </div>

            {turnoActivo && <>
              {/* Desglose por método de pago */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100"><h3 className="font-bold text-gray-800">Pagos recibidos por método</h3></div>
                <div className="divide-y divide-gray-100">
                  {pagosPorMetodo.length === 0 && <p className="text-center text-gray-400 py-4 text-sm">Sin pagos aún</p>}
                  {pagosPorMetodo.map(p => (
                    <div key={p.metodo} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{EMOJIS[p.metodo] || '💳'} {p.metodo.charAt(0).toUpperCase() + p.metodo.slice(1)}</p>
                        {p.propina > 0 && <p className="text-xs text-gray-400">Incluye ${p.propina.toLocaleString('es-CO')} en propinas</p>}
                      </div>
                      <p className="font-black text-gray-900">${(p.monto + p.propina).toLocaleString('es-CO')}</p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                    <p className="font-bold text-gray-600 text-sm">Total cobrado</p>
                    <p className="font-black text-emerald-600">${pagosPorMetodo.reduce((a, p) => a + p.monto + p.propina, 0).toLocaleString('es-CO')}</p>
                  </div>
                </div>
              </div>

              {/* Ventas establecimiento vs domicilios */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100"><h3 className="font-bold text-gray-800">Ventas del turno</h3></div>
                <div className="divide-y divide-gray-100">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div><p className="font-semibold text-gray-800 text-sm">🍽️ Establecimiento</p><p className="text-xs text-gray-400">{pedidosEstab} pedido(s)</p></div>
                    <p className="font-black text-gray-900">${ventasEstab.toLocaleString('es-CO')}</p>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div><p className="font-semibold text-gray-800 text-sm">🛵 Domicilios</p><p className="text-xs text-gray-400">{pedidosDomi} pedido(s)</p></div>
                    <p className="font-black text-gray-900">${ventasDomi.toLocaleString('es-CO')}</p>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                    <p className="font-black text-gray-700">Total</p>
                    <p className="font-black text-orange-500 text-lg">${(ventasEstab + ventasDomi).toLocaleString('es-CO')}</p>
                  </div>
                </div>
              </div>

              {/* Movimientos de caja */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">Notas de caja</h3>
                  {(totalIngresos > 0 || totalEgresos > 0) && (
                    <span className="text-xs text-gray-400">
                      +${totalIngresos.toLocaleString('es-CO')} / -${totalEgresos.toLocaleString('es-CO')}
                    </span>
                  )}
                </div>
                <div className="divide-y divide-gray-100">
                  {movimientosCaja.length === 0 && <p className="text-center text-gray-400 py-3 text-sm">Sin movimientos</p>}
                  {movimientosCaja.map(m => (
                    <div key={m.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{m.descripcion}</p>
                        <p className="text-xs text-gray-400">{new Date(m.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <span className={`font-black text-sm ${m.tipo === 'ingreso' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {m.tipo === 'ingreso' ? '+' : '-'}${m.monto.toLocaleString('es-CO')}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Formulario nuevo movimiento */}
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Registrar movimiento</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setNuevoMov(p => ({ ...p, tipo: 'ingreso' }))}
                      className={`py-2 rounded-xl text-sm font-bold border-2 transition-all ${nuevoMov.tipo === 'ingreso' ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-900/20' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                      ↑ Ingreso
                    </button>
                    <button onClick={() => setNuevoMov(p => ({ ...p, tipo: 'egreso' }))}
                      className={`py-2 rounded-xl text-sm font-bold border-2 transition-all ${nuevoMov.tipo === 'egreso' ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-900/20' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                      ↓ Egreso
                    </button>
                  </div>
                  <input type="text" placeholder='Descripción (ej: "Se sacó para mercado")' value={nuevoMov.descripcion}
                    onChange={e => setNuevoMov(p => ({ ...p, descripcion: e.target.value }))}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                  <div className="flex gap-2">
                    <input type="number" placeholder="Monto $" value={nuevoMov.monto}
                      onChange={e => setNuevoMov(p => ({ ...p, monto: e.target.value }))}
                      className="flex-1 bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                    <button onClick={agregarMovimiento} disabled={agregandoMov}
                      className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold px-4 rounded-xl text-sm shadow-lg shadow-orange-900/30 transition-all">
                      {agregandoMov ? '...' : 'Agregar'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Efectivo esperado en caja */}
              <div className={`rounded-2xl p-4 border-2 ${efectivoEsperado >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                <p className="text-xs font-bold text-gray-600 uppercase mb-1">Efectivo esperado en caja física</p>
                <p className={`text-2xl font-black ${efectivoEsperado >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  ${efectivoEsperado.toLocaleString('es-CO')}
                </p>
                <p className="text-xs text-gray-500 mt-1">Base ${turnoActivo.monto_inicial.toLocaleString('es-CO')} + efectivo cobrado + ingresos − egresos</p>
              </div>

              {/* Domicilios para cuadre */}
              {pedidosDomi > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100"><h3 className="font-bold text-gray-800 text-sm">Domicilios del turno</h3></div>
                  <div className="divide-y divide-gray-100">
                    {pedidosTurno.filter(p => p.tipo === 'domi').map(p => {
                      const domi = domiActivos.find(d => d.id === p.id)
                      return (
                        <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                          <div>
                            <p className="font-semibold text-gray-800">{domi?.cliente_nombre || 'Sin nombre'}</p>
                            {domi?.metodos.length ? <p className="text-xs text-gray-500">{domi.metodos.map(m => `${EMOJIS[m] || ''} ${m}`).join(' · ')}</p> : <p className="text-xs text-orange-500">⚠️ Sin pago</p>}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-800">${p.total.toLocaleString('es-CO')}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${p.estado === 'pagado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>{p.estado === 'pagado' ? 'Pagado' : 'Pendiente'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>}

            {!turnoActivo ? (
              <button onClick={() => setModalCaja('abrir')} className="w-full bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-lg shadow-xl shadow-emerald-900/30 transition-all"><Play size={20} /> Abrir turno</button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setModalAjusteInventario(true)} className="bg-white border border-orange-200 hover:border-orange-400 text-orange-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-sm shadow-sm transition-all">
                  <SlidersHorizontal size={18} /> Inventario
                </button>
                <button onClick={() => setModalCaja('cerrar')} className="bg-red-600/80 hover:bg-red-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-sm shadow-xl shadow-red-900/30 transition-all">
                  <Square size={18} /> Cerrar turno
                </button>
              </div>
            )}
          </div>
          )
        })()}

        {/* ══ USUARIOS ════════════════════════════════════════════ */}
        {seccion === 'usuarios' && (
          <div className="space-y-4">
            <button onClick={() => setModalUsuario(true)} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-900/30 transition-all">
              <Plus size={20} /> Crear nuevo usuario
            </button>
            {listaUsuarios.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
                <p className="text-gray-400 text-sm">No hay usuarios registrados todavía.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {listaUsuarios.map((u, i) => {
                  const ROL_BADGE: Record<string, string> = {
                    gerente: 'bg-orange-50 text-orange-600 border-orange-200',
                    mesera:  'bg-orange-50 text-orange-600 border-orange-200',
                    cocina:  'bg-emerald-50 text-emerald-700 border-emerald-200',
                    domi:    'bg-gray-100 text-gray-600 border-gray-200',
                  }
                  const ROL_LABEL: Record<string, string> = {
                    gerente: 'Gerente', mesera: 'Mesera', cocina: 'Cocina', domi: 'Domi',
                  }
                  return (
                    <div key={u.id} className={`flex items-center justify-between px-4 py-3.5 ${i !== 0 ? 'border-t border-gray-100' : ''} ${!u.activo ? 'opacity-40' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${u.activo ? 'bg-orange-100 text-orange-600' : 'bg-red-50 text-red-500'}`}>
                          {u.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-gray-800 text-sm">{u.nombre}</span>
                          {!u.activo && <p className="text-xs text-red-500 font-medium">Inhabilitado</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize border ${ROL_BADGE[u.rol] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {ROL_LABEL[u.rol] || u.rol}
                        </span>
                        <button
                          onClick={() => setEditandoUsuario({ id: u.id, nombre: u.nombre, rol: u.rol, activo: u.activo ?? true, nuevaPassword: '' })}
                          className="w-7 h-7 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg flex items-center justify-center transition-all"
                          title="Editar usuario">
                          <Pencil size={13} className="text-gray-500" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {/* ══ PERMISOS ════════════════════════════════════════════ */}
        {seccion === 'permisos' && (
          <div className="space-y-4">
            {/* Cocina */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Lock size={20} className="text-orange-500" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Control de flujo — Cocina</h2>
                  <p className="text-xs text-gray-400">Regula cuántos pedidos ve la cocina a la vez</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">Bloqueo de comandas</p>
                  <p className="text-xs text-gray-400 mt-0.5">La cocina solo verá un lote de pedidos a la vez, en estricto orden de llegada</p>
                </div>
                <button onClick={() => setBloqueoActivo(v => !v)}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${bloqueoActivo ? 'bg-orange-500' : 'bg-gray-700'}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${bloqueoActivo ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {bloqueoActivo && (
                <div>
                  <p className="font-semibold text-gray-800 text-sm mb-1">Comandas por lote</p>
                  <p className="text-xs text-gray-400 mb-3">Cuántos pedidos puede ver cocina al mismo tiempo antes de que aparezca el siguiente</p>
                  <div className="flex gap-2">
                    {[2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setBloqueoCantidad(n)}
                        className={`flex-1 py-3 rounded-xl font-black text-lg transition-all border-2 ${bloqueoCantidad === n ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-orange-400'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 bg-orange-50 border border-orange-100 rounded-xl p-3">
                    <p className="text-xs text-orange-700 leading-relaxed">
                      🔒 Cocina verá solo los primeros <b>{bloqueoCantidad} pedido{bloqueoCantidad !== 1 ? 's' : ''}</b> (por orden de llegada).
                    </p>
                  </div>
                </div>
              )}
              {!bloqueoActivo && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <p className="text-xs text-gray-500">🟢 Sin restricción — la cocina ve todos los pedidos activos al mismo tiempo.</p>
                </div>
              )}
            </div>

            {/* QR — solo basico/pro */}
            <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-5 ${!puedeQRConsumo ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <span className="text-xl">📱</span>
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">Pedidos por QR</h2>
                    <p className="text-xs text-gray-400">Permite que los clientes pidan desde su celular</p>
                  </div>
                </div>
                {!puedeQRConsumo && (
                  <span className="text-[10px] bg-orange-500/20 text-orange-300 font-bold px-2 py-1 rounded-full">Plan Profesional</span>
                )}
              </div>
              {!puedeQRConsumo ? (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
                  🔒 Disponible desde el plan Profesional ($89.900/mes). Actualiza tu plan para habilitar pedidos por QR.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 text-sm">Pedido QR — Consumo en el lugar</p>
                      <p className="text-xs text-gray-400 mt-0.5">Los clientes en mesa pueden ver el menú y pedir directamente desde su celular</p>
                    </div>
                    <button onClick={() => setQrConsumoActivo(v => !v)}
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${qrConsumoActivo ? 'bg-orange-500' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${qrConsumoActivo ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800 text-sm">Pedido QR — Domicilio</p>
                        {!puedeQRDomi && <span className="text-[10px] bg-orange-100 text-orange-600 font-bold px-2 py-0.5 rounded-full">Plan Pro</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">Los clientes pueden hacer pedidos a domicilio escaneando el QR de tu página pública</p>
                    </div>
                    <button onClick={() => puedeQRDomi ? setQrDomiActivo(v => !v) : abrirUpgrade()}
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${puedeQRDomi && qrDomiActivo ? 'bg-orange-500' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${puedeQRDomi && qrDomiActivo ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {(qrConsumoActivo || qrDomiActivo) && (
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                      <p className="text-xs text-orange-700 leading-relaxed">
                        📱 Tu página pública: <b className="font-mono text-[10px] break-all">{typeof window !== 'undefined' ? `${window.location.origin}/restaurante/${negocioId || '...'}` : `/restaurante/${negocioId || '...'}`}</b>. Los clientes podrán {qrConsumoActivo && 'consumir en el lugar'}{qrConsumoActivo && qrDomiActivo && ' y '}{qrDomiActivo && 'pedir a domicilio'}.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <button
              onClick={guardarConfiguracion}
              disabled={guardandoPermisos}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl transition-colors">
              {guardandoPermisos ? 'Guardando...' : '💾 Guardar configuración'}
            </button>
          </div>
        )}

        {/* ══ RESERVAS ════════════════════════════════════════════ */}
        {seccion === 'reservas' && (
          !puedeAcceder('basico') ? renderPlanLock('basico') : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Reservas</h2>
                <p className="text-xs text-gray-400">Solicitudes de reserva de tus clientes</p>
              </div>
              <button onClick={cargarReservas} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                <RotateCcw size={16} className="text-gray-600" />
              </button>
            </div>

            {/* Filtros de estado */}
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {(['todos', 'pendiente', 'confirmada', 'cancelada'] as const).map(f => (
                <button key={f} onClick={() => setFiltroReservaEstado(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                    filtroReservaEstado === f
                      ? f === 'pendiente' ? 'bg-amber-500 text-white border-amber-500'
                        : f === 'confirmada' ? 'bg-green-500 text-white border-green-500'
                        : f === 'cancelada' ? 'bg-red-400 text-white border-red-400'
                        : 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}>
                  {f === 'todos' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1)}
                  {f !== 'todos' && (
                    <span className="ml-1.5 opacity-80">
                      ({reservas.filter(r => r.estado === f).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {cargandoReservas ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : reservas.filter(r => filtroReservaEstado === 'todos' || r.estado === filtroReservaEstado).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                  <CalendarDays size={28} className="text-gray-400" />
                </div>
                <p className="font-bold text-gray-500">Sin reservas</p>
                <p className="text-xs text-gray-400 mt-1">Las solicitudes de tus clientes aparecerán aquí</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reservas
                  .filter(r => filtroReservaEstado === 'todos' || r.estado === filtroReservaEstado)
                  .map(r => (
                    <div key={r.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="font-bold text-gray-900">{r.nombre}</p>
                            <p className="text-xs text-gray-500 mt-0.5">📞 {r.telefono}</p>
                          </div>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                            r.estado === 'pendiente'  ? 'bg-amber-100 text-amber-700'
                            : r.estado === 'confirmada' ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-600'
                          }`}>
                            {r.estado.charAt(0).toUpperCase() + r.estado.slice(1)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center mb-3">
                          <div className="bg-gray-50 rounded-xl p-2">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Fecha</p>
                            <p className="text-sm font-bold text-gray-900">{new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-2">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Hora</p>
                            <p className="text-sm font-bold text-gray-900">{r.hora}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-2">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Personas</p>
                            <p className="text-sm font-bold text-gray-900">{r.personas}</p>
                          </div>
                        </div>
                        {r.notas && (
                          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
                            <p className="text-xs text-amber-700">📝 {r.notas}</p>
                          </div>
                        )}
                        {r.estado === 'pendiente' && (
                          <div className="flex gap-2">
                            <button onClick={() => actualizarEstadoReserva(r.id, 'confirmada')}
                              className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5">
                              <CheckCircle size={14} /> Confirmar
                            </button>
                            <button onClick={() => actualizarEstadoReserva(r.id, 'cancelada')}
                              className="flex-1 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 text-xs font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5">
                              <X size={14} /> Cancelar
                            </button>
                          </div>
                        )}
                        {r.estado !== 'pendiente' && (
                          <button onClick={() => actualizarEstadoReserva(r.id, 'pendiente')}
                            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs font-medium py-2 rounded-xl transition-colors">
                            Marcar como pendiente
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
          )
        )}

        {seccion === 'marketing' && (!puedeAcceder('pro') ? renderPlanLock('pro') : (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 border border-orange-200 rounded-xl flex items-center justify-center text-xl">🌟</div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Sugerido del mes</h3>
                    <p className="text-xs text-gray-400">Popup que aparece cuando el cliente abre el menu QR</p>
                  </div>
                </div>
                <button onClick={() => setSugeridoActivo(v => !v)}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${sugeridoActivo ? 'bg-orange-500' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${sugeridoActivo ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div>
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide block mb-1.5">Nombre del plato *</label>
                <input value={sugeridoNombre} onChange={e => setSugeridoNombre(e.target.value)}
                  placeholder="Ej: Bandeja especial, Burger Master..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
              </div>

              <div>
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide block mb-1.5">Precio (opcional)</label>
                <input type="number" value={sugeridoPrecio} onChange={e => setSugeridoPrecio(e.target.value)}
                  placeholder="Ej: 28900"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
              </div>

              <div>
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide block mb-1.5">Descripcion corta (opcional)</label>
                <input value={sugeridoDescripcion} onChange={e => setSugeridoDescripcion(e.target.value)}
                  placeholder="Ej: Carne, queso doble, papas y bebida"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
              </div>

              <div>
                <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide block mb-1.5">URL de imagen (opcional)</label>
                <input value={sugeridoImagenUrl} onChange={e => setSugeridoImagenUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                {sugeridoImagenUrl && (
                  <img src={sugeridoImagenUrl} alt="preview" className="mt-2 h-24 w-full object-cover rounded-xl border border-gray-200" onError={() => setSugeridoImagenUrl('')} />
                )}
              </div>

              {sugeridoNombre && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                  <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wide">Preview popup</p>
                  <div className="bg-white rounded-2xl overflow-hidden max-w-[240px] mx-auto shadow-xl">
                    <div className={`h-28 flex items-center justify-center ${sugeridoImagenUrl ? '' : 'bg-gradient-to-br from-amber-400 to-orange-500 text-4xl'}`}>
                      {sugeridoImagenUrl ? <img src={sugeridoImagenUrl} alt={sugeridoNombre} className="w-full h-full object-cover" /> : '🍽️'}
                    </div>
                    <div className="p-3 text-center">
                      <span className="inline-block bg-orange-100 text-orange-600 text-[9px] font-black px-2 py-0.5 rounded-full mb-1 uppercase">Sugerido del mes</span>
                      <p className="font-black text-gray-900 text-sm leading-tight">{sugeridoNombre}</p>
                      {sugeridoDescripcion && <p className="text-gray-500 text-[10px] mt-0.5 leading-snug">{sugeridoDescripcion}</p>}
                      {sugeridoPrecio && <p className="text-orange-600 font-black text-base mt-1">${parseFloat(sugeridoPrecio).toLocaleString('es-CO')}</p>}
                    </div>
                  </div>
                </div>
              )}

              <button onClick={guardarSugerido} disabled={guardandoSugerido || !sugeridoNombre.trim()}
                className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-all">
                {guardandoSugerido ? 'Guardando...' : sugeridoActivo ? 'Guardar y activar' : 'Guardar inactivo'}
              </button>
            </div>
          </div>
        ))}

        {/* ══ HISTORIAL ══════════════════════════════════════════════ */}
        {seccion === 'historial' && (!puedeAcceder('basico') ? renderPlanLock('basico') : (
          <div className="space-y-4">

            {/* Filtros */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
                  <ClipboardList size={18} className="text-orange-500" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">Historial de pedidos</h2>
                  <p className="text-xs text-gray-400">Busca, filtra y corrige cuentas pasadas</p>
                </div>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Mesa, cliente o producto..."
                  value={historialBusqueda}
                  onChange={e => setHistorialBusqueda(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide block mb-1">Desde</label>
                  <input type="date" value={historialFechaDesde}
                    onChange={e => setHistorialFechaDesde(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide block mb-1">Hasta</label>
                  <input type="date" value={historialFechaHasta}
                    onChange={e => setHistorialFechaHasta(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
                </div>
              </div>
              <button
                onClick={() => cargarHistorial()}
                disabled={cargandoHistorial}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                {cargandoHistorial
                  ? <RotateCcw size={14} className="animate-spin" />
                  : <Search size={14} />}
                {cargandoHistorial ? 'Cargando...' : 'Buscar pedidos'}
              </button>
            </div>

            {/* Lista */}
            {cargandoHistorial ? (
              <div className="text-center py-12">
                <RotateCcw size={24} className="mx-auto mb-3 text-orange-400 animate-spin" />
                <p className="text-gray-400 text-sm">Cargando historial...</p>
              </div>
            ) : historialPedidos.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                <ClipboardList size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium text-sm">Sin resultados</p>
                <p className="text-gray-400 text-xs mt-1">Ajusta las fechas y presiona Buscar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historialFiltrado.map(ped => {
                  const totalItems = ped.items?.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0) ?? 0
                  const totalPagado = ped.pagos?.reduce((a, p) => a + p.monto + p.propina, 0) ?? 0
                  const difiere = Math.abs(totalItems - totalPagado) > 1
                  const esTurnoActual = ped.turno_id === turnoActivo?.id
                  const fecha = new Date(ped.created_at)
                  return (
                    <button key={ped.id}
                      onClick={() => abrirHistorialDetalle(ped)}
                      className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-left hover:border-orange-200 transition-all active:scale-[0.99]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                            ped.tipo === 'domi' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                          }`}>
                            {ped.tipo === 'domi' ? '🛵' : ped.mesa?.numero ?? '?'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">
                              {ped.tipo === 'domi' ? 'Domicilio' : `Mesa ${ped.mesa?.numero}`}
                              {(ped.cliente_nombre || ped.cliente?.nombre) && (
                                <span className="text-gray-400 font-normal"> · {ped.cliente_nombre || ped.cliente?.nombre}</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">
                              {fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })} · {fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {ped.items?.length ?? 0} plato{(ped.items?.length ?? 0) !== 1 ? 's' : ''}
                              {ped.mesera && <span className="text-gray-300"> · {ped.mesera.nombre}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <p className="font-black text-gray-900">${totalItems.toLocaleString('es-CO')}</p>
                          {difiere && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full block">
                              Pagado ${totalPagado.toLocaleString('es-CO')}
                            </span>
                          )}
                          {esTurnoActual && (
                            <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full block">Turno actual</span>
                          )}
                          {ped.estado === 'cancelado' && (
                            <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full block">Cancelado</span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
                {historialFiltrado.length === 0 && historialBusqueda && (
                  <div className="text-center py-8 bg-white rounded-2xl border border-gray-200">
                    <p className="text-gray-400 text-sm">Sin resultados para &ldquo;{historialBusqueda}&rdquo;</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

      </div>

      {/* ══ MODAL DETALLE HISTORIAL ══════════════════════════════════ */}
      {pedidoHistorial && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-lg md:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl shadow-black/10">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                  pedidoHistorial.tipo === 'domi' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                }`}>
                  {pedidoHistorial.tipo === 'domi' ? '🛵' : pedidoHistorial.mesa?.numero ?? '?'}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">
                    {pedidoHistorial.tipo === 'domi' ? 'Domicilio' : `Mesa ${pedidoHistorial.mesa?.numero}`}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {new Date(pedidoHistorial.created_at).toLocaleString('es-CO', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!editandoHistorial ? (
                  <button
                    onClick={() => setEditandoHistorial(true)}
                    className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-600 text-xs font-bold px-3 py-2 rounded-xl hover:bg-orange-100 transition-colors">
                    <Pencil size={12} /> Editar
                  </button>
                ) : (
                  <button
                    onClick={() => setEditandoHistorial(false)}
                    className="flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-bold px-3 py-2 rounded-xl hover:bg-gray-200 transition-colors">
                    <X size={12} /> Cancelar
                  </button>
                )}
                <button
                  onClick={() => { setPedidoHistorial(null); setEditandoHistorial(false) }}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors">
                  <X size={16} className="text-gray-500" />
                </button>
              </div>
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* Cliente */}
              {(pedidoHistorial.cliente_nombre || pedidoHistorial.cliente?.nombre) && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Cliente</p>
                  <p className="font-semibold text-gray-900 text-sm">
                    {pedidoHistorial.cliente_nombre || pedidoHistorial.cliente?.nombre}
                  </p>
                  {pedidoHistorial.cliente?.cedula && (
                    <p className="text-xs text-gray-400 mt-0.5">CC {pedidoHistorial.cliente.cedula}</p>
                  )}
                </div>
              )}

              {/* Aviso turno */}
              {pedidoHistorial.turno_id === turnoActivo?.id ? (
                <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-green-700 font-semibold leading-snug">
                    Turno activo — al eliminar un ítem con inventario, se devolverá la cantidad al stock del día
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 font-semibold leading-snug">
                    Turno cerrado — solo se puede corregir precios o eliminar ítems, sin tocar inventario
                  </p>
                </div>
              )}

              {/* Ítems */}
              <div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-2">Productos</p>
                <div className="space-y-2">
                  {pedidoHistorial.items?.map(item => {
                    const esTurnoActual = pedidoHistorial.turno_id === turnoActivo?.id
                    const puedeRestaurar = esTurnoActual && (item.plato?.controla_inventario ?? false)
                    const precioActual = Number(preciosHistorial[item.id] ?? item.precio_unitario)
                    const totalItem = precioActual * item.cantidad
                    return (
                      <div key={item.id}
                        className={`bg-white border rounded-xl p-3 transition-all ${editandoHistorial ? 'border-orange-100' : 'border-gray-100'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">
                              {item.cantidad}× {item.plato?.nombre || 'Producto'}
                            </p>
                            {item.notas && <p className="text-xs text-amber-600 mt-0.5">⚠️ {item.notas}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            {editandoHistorial ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-400">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={preciosHistorial[item.id] ?? item.precio_unitario}
                                  onChange={e => setPreciosHistorial(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  className="w-24 text-right bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                                />
                                <span className="text-xs text-gray-400">c/u</span>
                              </div>
                            ) : (
                              <p className="font-semibold text-gray-900 text-sm">${totalItem.toLocaleString('es-CO')}</p>
                            )}
                            {editandoHistorial && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                = ${totalItem.toLocaleString('es-CO')}
                              </p>
                            )}
                          </div>
                        </div>

                        {editandoHistorial && (
                          <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-gray-100">
                            <button
                              onClick={() => guardarPrecioHistorial(item.id)}
                              disabled={guardandoHistorialItemId === item.id}
                              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors">
                              {guardandoHistorialItemId === item.id
                                ? <RotateCcw size={11} className="animate-spin" />
                                : <CheckCircle size={11} />}
                              Guardar precio
                            </button>
                            <button
                              onClick={() => eliminarItemHistorial(item.id, item.plato_id, item.cantidad, puedeRestaurar)}
                              disabled={eliminandoHistorialItemId === item.id}
                              className="flex-1 bg-red-50 hover:bg-red-100 disabled:opacity-50 border border-red-200 text-red-600 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-colors">
                              {eliminandoHistorialItemId === item.id
                                ? <RotateCcw size={11} className="animate-spin" />
                                : <Trash2 size={11} />}
                              {puedeRestaurar ? 'Eliminar + reponer' : 'Eliminar ítem'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {(pedidoHistorial.items?.length ?? 0) === 0 && (
                    <p className="text-center text-gray-400 text-sm py-4">Sin ítems registrados</p>
                  )}
                </div>
              </div>

              {/* Totales */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total productos</span>
                  <span className="font-bold text-gray-900">
                    ${(pedidoHistorial.items?.reduce((a, i) => a + Number(preciosHistorial[i.id] ?? i.precio_unitario) * i.cantidad, 0) ?? 0).toLocaleString('es-CO')}
                  </span>
                </div>
                {pedidoHistorial.pagos && pedidoHistorial.pagos.length > 0 && (
                  <>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-gray-500">Total cobrado</span>
                      <span className="font-black text-gray-900">
                        ${(pedidoHistorial.pagos.reduce((a, p) => a + p.monto + p.propina, 0)).toLocaleString('es-CO')}
                      </span>
                    </div>
                    <div className="space-y-1 pt-1">
                      {pedidoHistorial.pagos.map(pago => (
                        <div key={pago.id} className="flex justify-between text-xs text-gray-400">
                          <span className="capitalize">{pago.metodo}{pago.propina > 0 && ` (inc. propina $${pago.propina.toLocaleString('es-CO')})`}</span>
                          <span>${(pago.monto + pago.propina).toLocaleString('es-CO')}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL DETALLE MESA ══════════════════════════════════════ */}
      {mesaDetalle && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white border border-gray-100 w-full md:max-w-lg md:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col overflow-hidden fade-in shadow-2xl shadow-black/10">


            {/* ── Paso: detalle + pago ── */}
            {vistaModal === 'pago' && (<>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                {mesaDetalle.isDomi ? (
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="bg-[#FF7A00] text-white text-xs font-black px-2.5 py-1 rounded-full shadow-sm shadow-orange-200">🛵 DOMI</span>
                      <span className="text-lg font-black text-gray-900">{mesaDetalle.pedido.cliente_nombre || 'Sin nombre'}</span>
                    </div>
                    {mesaDetalle.pedido.cliente_cedula && <p className="text-xs text-gray-400">🪪 C.C. {mesaDetalle.pedido.cliente_cedula}</p>}
                    {mesaDetalle.pedido.cliente_telefono && <p className="text-xs text-gray-400">📞 {mesaDetalle.pedido.cliente_telefono}</p>}
                    {mesaDetalle.pedido.cliente_direccion && <p className="text-xs text-gray-400">📍 {mesaDetalle.pedido.cliente_direccion}</p>}
                    {mesaDetalle.pedido.metodo_pago_cliente && (
                      <p className="text-xs font-bold mt-1 text-gray-500">
                        💳 Pago: <span className="capitalize text-[#FF7A00]">{mesaDetalle.pedido.metodo_pago_cliente}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <h2 className="text-xl font-black text-gray-900">Mesa {mesaDetalle.mesa?.numero}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {mesaDetalle.pedido.mesera ? (
                        <span className="inline-flex items-center gap-1 bg-orange-50 text-[#FF7A00] text-xs font-bold px-2.5 py-1 rounded-full border border-orange-200">
                          👩‍🍳 {mesaDetalle.pedido.mesera.nombre}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">📱 Pedido QR</span>
                      )}
                      <span className="text-xs text-gray-400">{new Date(mesaDetalle.pedido.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-0.5 block md:hidden">
                  {new Date(mesaDetalle.pedido.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setModoEdicionPedido(v => !v); setItemReemplazando(null) }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${modoEdicionPedido ? 'bg-[#FF7A00] text-white shadow-sm shadow-orange-200' : 'bg-orange-50 text-[#FF7A00] border border-orange-200 hover:bg-orange-100'}`}>
                  {modoEdicionPedido ? '✓ Listo' : 'Eliminar/cambiar'}
                </button>
                <button onClick={() => { setMesaDetalle(null); setVistaModal('pago'); setModoEdicionPedido(false); setItemReemplazando(null); setTelefonoCliente(''); setClienteEncontrado(null); setClienteForm({ nombre: '', telefono: '', fecha_cumpleanos: '' }) }} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"><X size={18} className="text-gray-500" /></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* ── Cliente (solo mesas, no domi — domi ya trae datos) ── */}
              {!mesaDetalle.isDomi && (
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Cliente</p>
                    {(telefonoCliente || clienteEncontrado) && (
                      <button onClick={saltarCliente} className="text-[10px] text-gray-400 hover:text-gray-600 underline">
                        Continuar sin guardar
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      placeholder="Celular del cliente"
                      value={telefonoCliente}
                      onChange={e => setTelefonoCliente(e.target.value)}
                      onBlur={buscarCliente}
                      onKeyDown={e => e.key === 'Enter' && buscarCliente()}
                      className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-300"
                    />
                    <button
                      onClick={buscarCliente}
                      disabled={buscandoCl || !telefonoCliente.trim()}
                      className="bg-[#FF7A00] hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-3 py-2 rounded-xl text-sm font-bold transition-colors">
                      {buscandoCl ? '...' : 'Buscar'}
                    </button>
                  </div>
                  {clienteEncontrado && (
                    <p className="text-sm text-emerald-700 font-semibold bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                      ✓ Cliente frecuente: {clienteEncontrado.nombre}
                    </p>
                  )}
                  {telefonoCliente && !clienteEncontrado && !buscandoCl && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Nombre del cliente *"
                        value={clienteForm.nombre}
                        onChange={e => setClienteForm(p => ({ ...p, nombre: e.target.value }))}
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                      />
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">🎂 Cumpleaños (opcional)</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <select value={clienteForm.fecha_cumpleanos ? clienteForm.fecha_cumpleanos.split('-')[2] : ''}
                            onChange={e => { const p = clienteForm.fecha_cumpleanos ? clienteForm.fecha_cumpleanos.split('-') : ['2000','01','01']; setClienteForm(f => ({ ...f, fecha_cumpleanos: `${p[0]}-${p[1]}-${e.target.value.padStart(2,'0')}` })) }}
                            className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:outline-none">
                            <option value="">Día</option>
                            {Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={String(d).padStart(2,'0')}>{d}</option>)}
                          </select>
                          <select value={clienteForm.fecha_cumpleanos ? clienteForm.fecha_cumpleanos.split('-')[1] : ''}
                            onChange={e => { const p = clienteForm.fecha_cumpleanos ? clienteForm.fecha_cumpleanos.split('-') : ['2000','01','01']; setClienteForm(f => ({ ...f, fecha_cumpleanos: `${p[0]}-${e.target.value}-${p[2]}` })) }}
                            className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:outline-none">
                            <option value="">Mes</option>
                            {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m,i)=><option key={m} value={String(i+1).padStart(2,'0')}>{m}</option>)}
                          </select>
                          <select value={clienteForm.fecha_cumpleanos ? clienteForm.fecha_cumpleanos.split('-')[0] : ''}
                            onChange={e => { const p = clienteForm.fecha_cumpleanos ? clienteForm.fecha_cumpleanos.split('-') : ['2000','01','01']; setClienteForm(f => ({ ...f, fecha_cumpleanos: `${e.target.value}-${p[1]}-${p[2]}` })) }}
                            className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:outline-none">
                            <option value="">Año</option>
                            {Array.from({length:80},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y} value={y}>{y}</option>)}
                          </select>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400">Se guardará automáticamente al procesar el pago</p>
                    </div>
                  )}
                  {!telefonoCliente && (
                    <p className="text-xs text-gray-400">Opcional — ingresa el celular para reconocer al cliente</p>
                  )}
                </div>
              )}

              {/* ── Comprobante de transferencia (solo domi) ── */}
              {mesaDetalle.isDomi && mesaDetalle.pedido.comprobante_url && mesaDetalle.pagos.length === 0 && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 space-y-3">
                  <p className="text-sm font-black text-gray-800">📎 Comprobante de pago del cliente</p>
                  <a href={mesaDetalle.pedido.comprobante_url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={mesaDetalle.pedido.comprobante_url}
                      alt="Comprobante"
                      className="w-full rounded-xl object-cover max-h-64 border border-orange-200 hover:opacity-90 transition-opacity"
                    />
                  </a>
                  <p className="text-xs text-gray-500">Toca la imagen para verla en tamaño completo</p>
                  <button
                    onClick={confirmarPagoTransferencia}
                    disabled={agregandoPago}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                    <CheckCircle size={18} />
                    {agregandoPago ? 'Confirmando...' : `✅ Confirmar pago (${mesaDetalle.pedido.metodo_pago_cliente || 'transferencia'})`}
                  </button>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-700 text-sm">Pedido</h3>
                  <div className="flex items-center gap-2">
                    {modoEdicionPedido && (
                      <span className="text-xs text-orange-600 font-semibold bg-orange-50 px-2 py-0.5 rounded-full">
                        ✏️ Modo edición
                      </span>
                    )}
                    {!modoEdicionPedido && mesaDetalle.pedido.items.length > 1 && (
                      <button
                        onClick={() => { setModoDividir(v => !v); setItemsSeleccionados(new Set()) }}
                        className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-all ${modoDividir ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-300 hover:bg-indigo-50'}`}>
                        ÷ Dividir cuenta
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {mesaDetalle.pedido.items.map((item, i) => {
                    const itemKey = item.id ?? String(i)
                    const pagado  = itemsPagadosLocal.has(itemKey)
                    const selec   = itemsSeleccionados.has(itemKey)
                    return (
                      <div
                        key={item.id || i}
                        onClick={() => {
                          if (!modoDividir || pagado) return
                          setItemsSeleccionados(prev => {
                            const next = new Set(prev)
                            next.has(itemKey) ? next.delete(itemKey) : next.add(itemKey)
                            return next
                          })
                        }}
                        className={`text-sm rounded-xl transition-all ${
                          modoEdicionPedido
                            ? 'bg-orange-50 border border-orange-200 p-2.5'
                            : modoDividir
                            ? `p-2.5 border cursor-pointer ${pagado ? 'bg-gray-100 border-gray-200 opacity-60' : selec ? 'bg-indigo-50 border-indigo-300' : 'bg-gray-50 border-gray-200 hover:border-indigo-200'}`
                            : ''
                        }`}>
                        {modoEdicionPedido && item.id && item.plato_id && (
                          <div className="flex gap-1.5 mb-2">
                            <button
                              onClick={() => cancelarItem(item.id!)}
                              disabled={guardandoEdicion}
                              className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2.5 py-1 rounded-lg border border-red-200 transition-colors disabled:opacity-50">
                              <X size={11} /> Eliminar plato
                            </button>
                            <button
                              onClick={() => { setItemReemplazando({ id: item.id!, nombre: item.nombre }); setCategoriaReemplazo('todas') }}
                              disabled={guardandoEdicion}
                              className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-2.5 py-1 rounded-lg border border-gray-200 transition-colors disabled:opacity-50">
                              🔄 Reemplazar
                            </button>
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2">
                          {modoDividir && (
                            <div className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${pagado ? 'bg-gray-300 border-gray-300' : selec ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                              {(selec || pagado) && <span className="text-white text-[10px] font-black leading-none">{pagado ? '✓' : '✓'}</span>}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {!modoDividir && <span className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${!item.plato_id ? 'bg-sky-500' : item.estado === 'listo' || item.estado === 'entregado' ? 'bg-green-500' : item.estado === 'en_preparacion' ? 'bg-orange-400' : 'bg-gray-300'}`} />}
                              <span className={pagado ? 'line-through text-gray-400' : ''}>{item.cantidad}× {item.nombre}</span>
                              {!item.plato_id && <span className="text-[10px] bg-sky-50 text-sky-600 border border-sky-200 px-1.5 py-0.5 rounded-full font-bold">cargo extra</span>}
                              {item.notas && <span className="text-yellow-600 text-xs">({item.notas})</span>}
                              {pagado && <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-bold">Pagado</span>}
                            </div>
                            {item.pedido_por_nombre && (
                              <span className="ml-4 inline-flex items-center gap-1 text-xs text-orange-400 font-semibold mt-0.5">
                                ↳ agregado por {item.pedido_por_nombre}
                              </span>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <span className={`font-semibold ${pagado ? 'text-gray-400 line-through' : ''}`}>${(item.cantidad * item.precio_unitario).toLocaleString('es-CO')}</span>
                            {modoEdicionPedido && item.id && (
                              <div className="mt-2 flex items-center justify-end gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  value={preciosEditados[item.id] ?? String(item.precio_unitario)}
                                  onChange={e => setPreciosEditados(prev => ({ ...prev, [item.id!]: e.target.value }))}
                                  className="w-24 bg-white border border-orange-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                                  aria-label={`Valor de ${item.nombre}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => actualizarPrecioItem(item)}
                                  disabled={guardandoPrecioItemId === item.id}
                                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-bold px-2.5 py-1 rounded-lg transition-colors"
                                >
                                  {guardandoPrecioItemId === item.id ? '...' : 'OK'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Barra de selección cuando modo dividir está activo */}
                {modoDividir && (
                  <div className={`mt-2 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 transition-all ${subtotalSeleccionado > 0 ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50 border border-gray-200'}`}>
                    <div>
                      <p className="text-xs text-gray-500">Seleccionado</p>
                      <p className={`font-black text-base ${subtotalSeleccionado > 0 ? 'text-indigo-700' : 'text-gray-400'}`}>
                        ${subtotalSeleccionado.toLocaleString('es-CO')}
                      </p>
                    </div>
                    {subtotalSeleccionado > 0 && (
                      <button
                        onClick={() => setMontoPago(String(subtotalSeleccionado))}
                        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors">
                        Usar como monto →
                      </button>
                    )}
                    {subtotalSeleccionado === 0 && (
                      <p className="text-xs text-gray-400">Toca los productos a pagar</p>
                    )}
                  </div>
                )}

                <div className="mt-3 bg-orange-50 border-2 border-orange-200 rounded-2xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-orange-700">Agregar a la cuenta</p>
                      <p className="text-xs text-orange-600 mt-0.5">Item abierto para cargos que no estan en el menu.</p>
                    </div>
                    <span className="text-[10px] bg-white text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full font-bold shrink-0">extra</span>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">
                    {CARGOS_EXTRA_RAPIDOS.map(nombre => (
                      <button
                        key={nombre}
                        type="button"
                        onClick={() => setCargoExtraNombre(nombre === 'Otro' ? '' : nombre)}
                        className={`shrink-0 px-2.5 py-1.5 rounded-full border text-xs font-bold transition-all ${
                          cargoExtraNombre === nombre
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'bg-white border-orange-200 text-orange-700 hover:border-orange-400'
                        }`}
                      >
                        {nombre}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_112px_auto] gap-2">
                    <input
                      type="text"
                      value={cargoExtraNombre}
                      onChange={e => setCargoExtraNombre(e.target.value)}
                      placeholder="Escribe el concepto"
                      className="min-w-0 bg-white border border-orange-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                    />
                    <input
                      type="number"
                      value={cargoExtraMonto}
                      onChange={e => setCargoExtraMonto(e.target.value)}
                      placeholder="$0"
                      className="bg-white border border-orange-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                    />
                    <button
                      type="button"
                      onClick={agregarCargoExtra}
                      disabled={guardandoCargoExtra || !cargoExtraNombre.trim() || !cargoExtraMonto}
                      className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl px-3 font-bold text-sm transition-colors">
                      {guardandoCargoExtra ? '...' : 'Agregar'}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between font-black text-gray-900 text-base mt-3 pt-3 border-t">
                  <span>Total</span><span>${totalPedido.toLocaleString('es-CO')}</span>
                </div>
              </div>
              {mesaDetalle.pagos.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-700 text-sm mb-2">Pagos recibidos</h3>
                  <div className="space-y-2">
                    {mesaDetalle.pagos.map(pago => (
                      <div key={pago.id} className="flex items-center justify-between bg-green-50 rounded-xl px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span>{METODOS.find(m => m.id === pago.metodo)?.emoji}</span>
                          <span className="capitalize">{pago.metodo}</span>
                          {pago.propina > 0 && <span className="text-gray-400 text-xs">(+${pago.propina.toLocaleString('es-CO')} propina)</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-green-700">${pago.monto.toLocaleString('es-CO')}</span>
                          <button
                            onClick={() => eliminarPago(pago.id)}
                            disabled={eliminandoPagoId === pago.id}
                            className="text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                            title="Deshacer pago"
                          >
                            {eliminandoPagoId === pago.id
                              ? <span className="text-xs">...</span>
                              : <Trash2 size={14} />
                            }
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-3 rounded-2xl p-3 text-center ${saldoPendiente <= 0 ? 'bg-green-100' : 'bg-orange-50'}`}>
                    {saldoPendiente > 0
                      ? <p className="font-black text-orange-700 text-lg">Saldo: ${saldoPendiente.toLocaleString('es-CO')}</p>
                      : <><p className="font-black text-green-700 text-lg">✓ Pago completo</p>{vuelto > 0 && <p className="text-green-600 text-sm">Vuelto: ${vuelto.toLocaleString('es-CO')}</p>}</>
                    }
                  </div>
                </div>
              )}
              {/* ── Aviso: ítems aún en preparación ── */}
              {!pedidoListoPagar && (
                <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-4">
                  <p className="font-black text-orange-700 text-sm flex items-center gap-2">
                    ⏳ Pedido aún en cocina
                  </p>
                  <p className="text-xs text-orange-600 mt-1 leading-relaxed">
                    {itemsSinListar.length} plato{itemsSinListar.length !== 1 ? 's' : ''} todavía {itemsSinListar.length !== 1 ? 'están' : 'está'} en preparación:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {itemsSinListar.map((item, i) => (
                      <span key={i} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.estado === 'en_preparacion' ? 'bg-orange-200 text-orange-800' : 'bg-white/14 text-gray-700'}`}>
                        {item.cantidad}× {item.nombre} · {item.estado === 'en_preparacion' ? 'preparando' : 'pendiente'}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-orange-500 mt-2 font-medium">El pago se habilitará cuando cocina marque todo como listo.</p>
                </div>
              )}

              {saldoPendiente > 0 && (
                <div>
                  <h3 className="font-bold text-gray-700 text-sm mb-3">Registrar pago</h3>
                  <div className={`grid grid-cols-4 gap-2 mb-3 transition-opacity ${!pedidoListoPagar ? 'opacity-40 pointer-events-none' : ''}`}>
                    {METODOS.map(m => {
                      const soloEfectivo = negocioPlan === 'starter' && m.id !== 'efectivo'
                      return (
                        <button key={m.id}
                          onClick={() => { if (soloEfectivo) { abrirUpgrade(); toast('Solo efectivo en Plan Básico', { icon: '🔒' }); return } setMetodoPago(m.id); setPagaCon('') }}
                          className={`py-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border-2 transition-all relative
                            ${metodoPago === m.id && !soloEfectivo ? `${m.color} text-white border-transparent shadow-md` : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'}
                            ${soloEfectivo ? 'opacity-35' : ''}`}>
                          <span className="text-lg">{m.emoji}</span>{m.label}
                          {soloEfectivo && <Lock size={10} className="absolute top-1 right-1 text-gray-400" />}
                        </button>
                      )
                    })}
                  </div>
                  <div className={`flex gap-2 mb-2 transition-opacity ${!pedidoListoPagar ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-1">Monto</label>
                      <input type="number" value={montoPago} onChange={e => setMontoPago(e.target.value)} placeholder={`$${saldoPendiente.toLocaleString('es-CO')}`} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 placeholder-gray-400 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-300" />
                    </div>
                    <div className="w-28">
                      <label className="text-xs text-gray-500 block mb-1">Propina</label>
                      <input type="number" value={propinaPago} onChange={e => setPropinaPago(e.target.value)} placeholder="$0" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-300" />
                    </div>
                  </div>
                  {/* ── Paga con / Cambio (solo efectivo) ── */}
                  {metodoPago === 'efectivo' && pedidoListoPagar && (
                    <div className="mb-3">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 block mb-1">Paga con</label>
                          <input
                            type="number"
                            value={pagaCon}
                            onChange={e => setPagaCon(e.target.value)}
                            placeholder={`$${saldoPendiente.toLocaleString('es-CO')}`}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 placeholder-gray-400 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-300"
                          />
                        </div>
                        {pagaCon && parseFloat(pagaCon) >= saldoPendiente && (
                          <div className="w-32 flex flex-col justify-end">
                            <label className="text-xs text-emerald-600 block mb-1">Cambio</label>
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-center">
                              <span className="text-emerald-700 font-black text-sm">
                                ${(parseFloat(pagaCon) - saldoPendiente).toLocaleString('es-CO')}
                              </span>
                            </div>
                          </div>
                        )}
                        {pagaCon && parseFloat(pagaCon) < saldoPendiente && (
                          <div className="w-32 flex flex-col justify-end">
                            <label className="text-xs text-red-500 block mb-1">Faltan</label>
                            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-center">
                              <span className="text-red-600 font-black text-sm">
                                ${(saldoPendiente - parseFloat(pagaCon)).toLocaleString('es-CO')}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {pedidoListoPagar && (
                    <button onClick={() => setMontoPago(String(saldoPendiente))} className="text-xs text-[#FF7A00] font-medium mb-3 hover:underline">→ Usar saldo exacto (${saldoPendiente.toLocaleString('es-CO')})</button>
                  )}
                  <button
                    onClick={agregarPago}
                    disabled={agregandoPago || !montoPago || !pedidoListoPagar}
                    title={!pedidoListoPagar ? 'Hay platos que aún no han salido de cocina' : ''}
                    className={`w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                      !pedidoListoPagar
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-[#FF7A00] hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white shadow-md shadow-orange-200'
                    }`}>
                    <Banknote size={18} />
                    {!pedidoListoPagar ? '🔒 Pago bloqueado — pedido en curso' : agregandoPago ? 'Registrando...' : 'Agregar pago'}
                  </button>
                </div>
              )}
            </div>
            {saldoPendiente <= 0 && (
              <div className="px-5 py-4 border-t border-gray-100">
                <button
                  onClick={pedidoListoPagar ? cerrarMesa : undefined}
                  disabled={!pedidoListoPagar}
                  title={!pedidoListoPagar ? 'Hay platos que aún no han salido de cocina' : ''}
                  className={`w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-lg transition-all ${
                    pedidoListoPagar
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}>
                  <CheckCircle size={22} />
                  {pedidoListoPagar ? 'Cerrar mesa' : '🔒 Esperando cocina…'}
                </button>
                {!pedidoListoPagar && (
                  <p className="text-center text-xs text-[#FF7A00] mt-2 font-medium">
                    ⏳ {itemsSinListar.length} plato{itemsSinListar.length !== 1 ? 's' : ''} aún en preparación
                  </p>
                )}
              </div>
            )}
            </>)}
          </div>
        </div>
      )}

      {/* ══ MODAL NUEVO / EDITAR MENÚ DE TURNO ══════════════════════ */}
      {modalNuevoMenu && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-end justify-center p-0 md:p-4">
          <div className="bg-white border border-gray-100 w-full md:max-w-lg md:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col overflow-hidden fade-in shadow-2xl shadow-black/10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-black text-gray-900">
                  {modalNuevoMenu === 'editar' ? '✏️ Editar menú' : '📋 Nuevo menú de turno'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Define cantidades estándar por plato</p>
              </div>
              <button onClick={() => { setModalNuevoMenu(null); setEditandoMenuId(null); setMenuForm({ nombre: '', items: {} }) }}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"><X size={18} className="text-gray-500" /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {/* Nombre del menú */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Nombre del menú</label>
                <input
                  type="text"
                  placeholder="Ej: Entre semana, Fin de semana, Festivo..."
                  value={menuForm.nombre}
                  onChange={e => setMenuForm(prev => ({ ...prev, nombre: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 placeholder-gray-400 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-300"
                />
              </div>
              {/* Cantidades por plato */}
              {categorias.map(cat => {
                const platosCategoria = platos.filter(p => (p.controla_inventario ?? true) && p.categoria_id === cat.id)
                if (platosCategoria.length === 0) return null
                return (
                  <div key={cat.id}>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{cat.nombre}</p>
                    <div className="space-y-2">
                      {platosCategoria.map(p => (
                        <div key={p.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{p.nombre}</p>
                            <p className="text-xs text-gray-400">${p.precio.toLocaleString('es-CO')}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setMenuForm(prev => ({ ...prev, items: { ...prev.items, [p.id]: Math.max(0, (prev.items[p.id] ?? 0) - 1) } }))}
                              className="w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                              <Minus size={12} />
                            </button>
                            <input
                              type="number" min="0"
                              value={menuForm.items[p.id] ?? 0}
                              onChange={e => setMenuForm(prev => ({ ...prev, items: { ...prev.items, [p.id]: parseInt(e.target.value) || 0 } }))}
                              className="w-14 border border-gray-200 rounded-xl px-2 py-1.5 text-sm font-bold text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-orange-400/40 bg-white"
                            />
                            <button
                              onClick={() => setMenuForm(prev => ({ ...prev, items: { ...prev.items, [p.id]: (prev.items[p.id] ?? 0) + 1 } }))}
                              className="w-7 h-7 bg-[#FF7A00] text-white rounded-full flex items-center justify-center hover:bg-orange-600 transition-colors shadow-sm shadow-orange-200">
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {platos.filter(p => p.controla_inventario ?? true).length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">Sin productos con control de inventario</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 shrink-0">
              <button onClick={guardarMenuTurno} disabled={guardandoMenu}
                className="w-full bg-[#FF7A00] hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3 rounded-2xl transition-colors shadow-md shadow-orange-200">
                {guardandoMenu ? 'Guardando...' : modalNuevoMenu === 'editar' ? '💾 Actualizar menú' : '💾 Guardar menú'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL PLATO ══════════════════════════════════════════════ */}
      {modalPlato && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md fade-in max-h-[90vh] overflow-y-auto space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">{modalPlato === 'nuevo' ? 'Nuevo plato' : 'Editar plato'}</h3>
              <button onClick={() => setModalPlato(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Nombre del plato *</label>
              <input type="text" value={platoForm.nombre} onChange={e => setPlatoForm(p => ({ ...p, nombre: e.target.value }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Descripción (visible para meseras y clientes)</label>
              <textarea value={platoForm.descripcion || ''} onChange={e => setPlatoForm(p => ({ ...p, descripcion: e.target.value }))} rows={2} placeholder="Describe el plato..." className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Precio público *</label>
                <input type="number" value={platoForm.precio || ''} onChange={e => setPlatoForm(p => ({ ...p, precio: parseFloat(e.target.value) || 0 }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Costo (para utilidad)</label>
                <input type="number" value={platoForm.costo || ''} onChange={e => setPlatoForm(p => ({ ...p, costo: parseFloat(e.target.value) || 0 }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400" />
              </div>
            </div>
            {platoForm.precio && platoForm.costo ? (
              <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm">
                <span className="text-green-700 font-semibold">Utilidad: ${(platoForm.precio - (platoForm.costo || 0)).toLocaleString('es-CO')} ({Math.round((platoForm.precio - (platoForm.costo || 0)) / platoForm.precio * 100)}% margen)</span>
              </div>
            ) : null}
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Categoría *</label>
              <select value={platoForm.categoria_id} onChange={e => setPlatoForm(p => ({ ...p, categoria_id: parseInt(e.target.value) }))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400">
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">URL de imagen (opcional)</label>
              <input type="url" value={platoForm.imagen_url || ''} onChange={e => setPlatoForm(p => ({ ...p, imagen_url: e.target.value }))} placeholder="https://..." className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400" />
            </div>
            {[
              { key: 'activo', label: 'Activo para vender' },
              { key: 'visible_menu', label: 'Visible en menú público y meseras' },
              { key: 'controla_inventario', label: 'Controla inventario de turno' },
            ].map(opt => (
              <div key={opt.key} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                <label className="text-sm text-gray-700 font-medium">{opt.label}</label>
                <button onClick={() => setPlatoForm(p => ({ ...p, [opt.key]: !p[opt.key as keyof typeof p] }))}
                  className={`w-12 h-6 rounded-full transition-colors ${platoForm[opt.key as keyof typeof platoForm] ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${platoForm[opt.key as keyof typeof platoForm] ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}

            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900">Grupos de modificadores</h4>
                <p className="text-xs text-gray-500">Configura sopa, acompa?antes y opciones que descuentan inventario.</p>
              </div>

              {!platoEditandoId ? (
                <p className="text-xs text-gray-500 bg-white border border-gray-200 rounded-lg p-3">
                  Guarda el plato primero para agregar modificadores.
                </p>
              ) : (
                <>
                  <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                    <input
                      type="text"
                      value={nuevoGrupoMod.nombre}
                      onChange={e => setNuevoGrupoMod(p => ({ ...p, nombre: e.target.value }))}
                      placeholder="Sopa, acompa?antes..."
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={nuevoGrupoMod.tipo}
                        onChange={e => setNuevoGrupoMod(p => ({ ...p, tipo: e.target.value as 'radio' | 'checkbox', tiene_opcion_todos: e.target.value === 'checkbox' ? p.tiene_opcion_todos : false, max_selecciones: e.target.value === 'checkbox' ? p.max_selecciones : '' }))}
                        className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40">
                        <option value="radio">Una opci?n</option>
                        <option value="checkbox">Varias opciones</option>
                      </select>
                      <button onClick={agregarGrupoModificador} className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1">
                        <Plus size={15} /> Grupo
                      </button>
                    </div>
                    {nuevoGrupoMod.tipo === 'checkbox' && (
                      <div className="space-y-2">
                        <label className="block text-xs text-gray-500 font-bold">
                          Maximo de complementos de esta base
                          <input
                            type="number"
                            min={1}
                            value={nuevoGrupoMod.max_selecciones}
                            onChange={e => setNuevoGrupoMod(p => ({ ...p, max_selecciones: e.target.value }))}
                            placeholder="Sin limite"
                            className="mt-1 w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                          />
                        </label>
                        <label className="flex items-center gap-2 text-xs text-gray-700">
                          <input type="checkbox" checked={nuevoGrupoMod.tiene_opcion_todos} onChange={e => setNuevoGrupoMod(p => ({ ...p, tiene_opcion_todos: e.target.checked }))} />
                          Mostrar opci?n r?pida ?Todos los acompa?antes?
                        </label>
                      </div>
                    )}
                  </div>

                  {gruposMod.length === 0 ? (
                    <p className="text-xs text-gray-500 bg-white border border-gray-200 rounded-lg p-3">
                      Sin modificadores. Este plato seguir? vendi?ndose normal.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {gruposMod.map(grupo => {
                        return (
                          <div key={grupo.id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-bold text-gray-900">{grupo.nombre}</p>
                                <p className="text-[11px] text-gray-500">
                                  {grupo.tipo === 'radio' ? 'Una opci?n' : `Hasta ${grupo.max_selecciones || 'sin limite'} complemento(s)`}
                                  {grupo.tiene_opcion_todos ? ' ? Todos disponible' : ''}
                                </p>
                              </div>
                              <button onClick={() => eliminarGrupoModificador(grupo.id)} className="w-8 h-8 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center border border-red-100">
                                <Trash2 size={14} className="text-red-500" />
                              </button>
                            </div>
                            {grupo.tipo === 'checkbox' && (
                              <div className="grid grid-cols-2 gap-2">
                                <label className="text-[11px] text-gray-500 font-bold">
                                  Maximo seleccionable
                                  <input
                                    type="number"
                                    min={1}
                                    value={grupo.max_selecciones ?? ''}
                                    onChange={e => actualizarGrupoModificador(grupo.id, { max_selecciones: e.target.value ? Math.max(1, parseInt(e.target.value) || 1) : null })}
                                    placeholder="Sin limite"
                                    className="mt-1 w-full bg-gray-50 border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900 placeholder-gray-400 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                                  />
                                </label>
                                <label className="text-[11px] text-gray-500 font-bold flex items-center gap-2 pt-5">
                                  <input
                                    type="checkbox"
                                    checked={grupo.tiene_opcion_todos}
                                    onChange={e => actualizarGrupoModificador(grupo.id, { tiene_opcion_todos: e.target.checked })}
                                  />
                                  Boton todos
                                </label>
                              </div>
                            )}

                            <div className="space-y-1.5">
                              {grupo.opciones.map(opcion => (
                                <div key={opcion.id} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5">
                                  <div className="min-w-0">
                                    <p className={`text-xs font-bold truncate ${opcion.activo ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{opcion.nombre}</p>
                                    <p className="text-[11px] text-gray-500">
                                      {opcion.es_opcion_no_aplica ? 'No descuenta inventario' : `Descuenta: ${opcion.componente?.nombre || 'componente'} x${opcion.cantidad_descontar}`}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => toggleOpcionModificador(opcion)} className="text-[11px] px-2 py-1 rounded-lg bg-gray-100 text-gray-600">
                                      {opcion.activo ? 'Ocultar' : 'Activar'}
                                    </button>
                                    <button onClick={() => eliminarOpcionModificador(opcion.id)} className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center"><Trash2 size={12} className="text-red-500" /></button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="border-t border-gray-100 pt-2 space-y-2">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Agregar con click</p>
                              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                                {platos.filter(p => p.id !== platoEditandoId && (p.controla_inventario ?? true)).map(p => {
                                  const yaExiste = grupo.opciones.some(o => o.componente_plato_id === p.id && !o.es_opcion_no_aplica)
                                  return (
                                    <button
                                      key={p.id}
                                      onClick={() => agregarOpcionModificador(grupo, { nombre: p.nombre, componente_plato_id: p.id, no_aplica: false })}
                                      disabled={yaExiste}
                                      className="text-left text-xs bg-gray-50 hover:bg-orange-50 disabled:bg-gray-100 disabled:text-gray-400 border border-gray-200 hover:border-orange-200 rounded-lg px-2 py-2 text-gray-800 transition-colors">
                                      {p.nombre}
                                    </button>
                                  )
                                })}
                              </div>
                              <button
                                onClick={() => agregarOpcionModificador(grupo, { nombre: grupo.tipo === 'radio' ? `No deseo ${grupo.nombre.toLowerCase()}` : `Sin ${grupo.nombre.toLowerCase()}`, componente_plato_id: null, no_aplica: true })}
                                className="w-full text-xs bg-white hover:bg-gray-50 border border-dashed border-gray-300 rounded-lg px-2 py-2 text-gray-600 font-semibold">
                                Agregar opci?n sin descuento de inventario
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
            <button onClick={guardarPlato} disabled={guardandoPlato} className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-md shadow-orange-100 transition-all">
              {guardandoPlato ? 'Guardando...' : modalPlato === 'nuevo' ? 'Crear plato' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}

      {/* ══ MODALES CAJA Y USUARIOS ══════════════════════════════════ */}
      {modalAjusteInventario && turnoActivo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden fade-in flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
              <div>
                <h2 className="font-black text-gray-900 text-lg">Inventario del turno</h2>
                <p className="text-xs text-gray-500">Ajusta unidades disponibles si preparan mas o haces conteo.</p>
              </div>
              <button onClick={() => setModalAjusteInventario(false)} className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4">
              {inventarioTurnoItems.length === 0 ? (
                <div className="text-center py-10">
                  <p className="font-bold text-gray-700">No hay productos con inventario</p>
                  <p className="text-sm text-gray-400 mt-1">Activa control de inventario en la carta.</p>
                </div>
              ) : (
                [...new Set(inventarioTurnoItems.map(i => i.categoria))].map(cat => (
                  <div key={cat}>
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">{cat}</p>
                    <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden">
                      {inventarioTurnoItems.filter(i => i.categoria === cat).map(item => {
                        const valor = inventarioTurnoValores[item.plato_id] ?? String(item.cantidad_actual)
                        const nuevo = Math.max(0, Math.floor(Number(valor || 0)))
                        const delta = Number.isFinite(nuevo) ? nuevo - item.cantidad_actual : 0
                        return (
                          <div key={item.plato_id} className="px-4 py-3 bg-white flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 text-sm truncate">{item.nombre}</p>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5 text-xs text-gray-400">
                                <span>Disponible: <strong className="text-gray-700">{item.cantidad_actual}</strong></span>
                                <span>Inicial: <strong className="text-gray-700">{item.cantidad_inicial}</strong></span>
                                {!item.en_turno && <span className="text-orange-600 font-bold">Se agregara al turno</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setInventarioTurnoValores(p => ({ ...p, [item.plato_id]: String(Math.max(0, Number(valor || 0) - 1)) }))}
                                className="w-9 h-9 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600">
                                <Minus size={14} />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={valor}
                                onChange={e => setInventarioTurnoValores(p => ({ ...p, [item.plato_id]: e.target.value }))}
                                className="w-20 border-2 border-gray-200 focus:border-orange-400 rounded-xl px-3 py-2 text-center font-black text-gray-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setInventarioTurnoValores(p => ({ ...p, [item.plato_id]: String(Number(valor || 0) + 1) }))}
                                className="w-9 h-9 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 flex items-center justify-center text-orange-600">
                                <Plus size={14} />
                              </button>
                              <button
                                type="button"
                                disabled={guardandoInventarioId === item.plato_id || !Number.isFinite(nuevo) || delta === 0}
                                onClick={() => guardarAjusteInventarioTurno(item)}
                                className="h-9 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-black transition-colors">
                                {guardandoInventarioId === item.plato_id ? '...' : delta > 0 ? `+${delta}` : delta < 0 ? String(delta) : 'OK'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t bg-gray-50 shrink-0">
              <p className="text-xs text-gray-500">Los cambios actualizan la disponibilidad en Mesera, Domi y pagina publica en tiempo real.</p>
            </div>
          </div>
        </div>
      )}

      {modalCaja === 'abrir' && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm fade-in max-h-[90vh] flex flex-col overflow-hidden">

            {/* Header con indicador de pasos */}
            <div className="flex justify-between items-center px-5 py-4 border-b shrink-0">
              <div>
                <h3 className="font-bold text-lg">
                  {pasoCaja === 'efectivo' ? 'Abrir turno' : '📦 Inventario inicial'}
                </h3>
                <div className="flex gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${pasoCaja === 'efectivo' ? 'bg-green-500 text-white' : 'bg-white/14 text-gray-500'}`}>1. Caja</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${pasoCaja === 'inventario' ? 'bg-green-500 text-white' : 'bg-white/14 text-gray-500'}`}>2. Inventario</span>
                </div>
              </div>
              <button onClick={() => { setModalCaja(null); setPasoCaja('efectivo') }}><X size={20} /></button>
            </div>

            {pasoCaja === 'efectivo' ? (
              /* ── Paso 1: Efectivo ── */
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Monto inicial en caja (efectivo)</label>
                  <input type="number" value={montoInicial} onChange={e => setMontoInicial(e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-green-400 bg-gray-50" />
                </div>
                <button onClick={irAInventario}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                  Siguiente — Inventario →
                </button>
              </div>
            ) : (
              /* ── Paso 2: Inventario ── */
              <>
                <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">

                  {/* Selector de modo */}
                  <div className="flex gap-2">
                    <button onClick={() => { setModoInventario('manual'); setMenuSeleccionadoId(null) }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${modoInventario === 'manual' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      ✏️ Manual
                    </button>
                    <button onClick={() => setModoInventario('menu')}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${modoInventario === 'menu' ? 'bg-[#FF7A00] text-white shadow-sm shadow-orange-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      <ClipboardList size={14} /> Desde menú
                    </button>
                  </div>

                  {/* Picker de menú guardado */}
                  {modoInventario === 'menu' && (
                    <div className="space-y-2">
                      {menusTurno.length === 0 ? (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700 leading-relaxed">
                          No hay menús de turno creados aún. Ve a <strong>Carta → Menús de turno</strong> para crear uno.
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-gray-500 font-medium">Selecciona el menú para precargar cantidades:</p>
                          {menusTurno.map(menu => (
<button
  key={menu.id}
  onClick={() => aplicarMenuTurno(menu.id)}
  className={`w-full text-left p-3 rounded-xl border-2 transition-all opacity-100 ${
    menuSeleccionadoId === menu.id
      ? "border-orange-400 bg-orange-50 !text-black"
      : "border-gray-200 bg-white hover:bg-gray-50 !text-black"
  }`}
>
  <p className="font-bold text-black">{menu.nombre}</p>
  <p className="text-xs text-black mt-0.5">
    {menu.items.filter(i => i.cantidad > 0).length} platos ·{" "}
    {menu.items.reduce((a, i) => a + i.cantidad, 0)} unidades
  </p>
</button>
                          ))}
                          {menuSeleccionadoId && (
                            <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs text-green-700">
                              ✅ Cantidades cargadas. Puedes ajustarlas abajo antes de abrir.
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {modoInventario === 'manual' && (
                    <p className="text-sm text-gray-500 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2.5">
                      ✏️ Escribe cuántas unidades hay de cada plato <strong>al abrir el turno</strong>. El sistema las descontará automáticamente con cada pedido.
                    </p>
                  )}

                  {/* Lista de platos — siempre visible para ajustar */}
                  {categorias.map(cat => {
                    const platosCategoria = platos.filter(p => (p.controla_inventario ?? true) && p.categoria_id === cat.id)
                    if (platosCategoria.length === 0) return null
                    return (
                      <div key={cat.id}>
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{cat.nombre}</p>
                        <div className="space-y-2">
                          {platosCategoria.map(p => (
                            <div key={p.id} className="flex items-center justify-between bg-white/4 rounded-xl px-3 py-2.5">
                              <div className="flex-1 min-w-0 mr-3">
                                <p className="text-sm font-medium text-gray-800 truncate">{p.nombre}</p>
                                <p className="text-xs text-white/35">${p.precio.toLocaleString('es-CO')}</p>
                              </div>
                              <input
                                type="number" min="0"
                                value={inventarioTurno[p.id] ?? 0}
                                onChange={e => setInventarioTurno(prev => ({
                                  ...prev, [p.id]: parseInt(e.target.value) || 0
                                }))}
                                placeholder="0"
                                className="w-16 border border-gray-300 rounded-xl px-2 py-1.5 text-sm font-bold text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-green-400 bg-gray-50"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  {platos.filter(p => p.controla_inventario ?? true).length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-4">Sin productos con control de inventario</p>
                  )}
                </div>
                <div className="px-5 py-4 border-t shrink-0 space-y-2">
                  <button onClick={abrirTurno} disabled={abriendo}
                    className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                    {abriendo ? (
                      <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Abriendo turno...</>
                    ) : '✓ Abrir turno'}
                  </button>
                  <button onClick={() => setPasoCaja('efectivo')} disabled={abriendo}
                    className="w-full text-gray-400 text-sm py-1 hover:text-gray-600 disabled:opacity-40">
                    ← Volver
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {modalCaja === 'cerrar' && turnoActivo && (() => {
        const totalIngresos = movimientosCaja.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + m.monto, 0)
        const totalEgresos  = movimientosCaja.filter(m => m.tipo === 'egreso').reduce((a, m) => a + m.monto, 0)

        // Calcular esperado por método — redondeado al peso para evitar float errors
        const esperadoPorMetodo = METODOS.map(m => {
          const pago = pagosPorMetodo.find(p => p.metodo === m.id)
          let esperado = pago ? pago.monto + pago.propina : 0
          if (m.id === 'efectivo') esperado += turnoActivo.monto_inicial + totalIngresos - totalEgresos
          return { ...m, esperado: Math.round(esperado) }
        })

        // Sólo mostrar métodos con movimiento (o efectivo siempre)
        const metodosActivos = esperadoPorMetodo.filter(m => m.id === 'efectivo' || m.esperado > 0)

        // Resumen de descuadre total — redondear contado también
        let totalEsperado = 0, totalContado = 0, hayAlgunConteo = false
        metodosActivos.forEach(m => {
          totalEsperado += m.esperado
          const v = parseFloat(conteoFinal[m.id] || '')
          if (!isNaN(v)) { totalContado += Math.round(v); hayAlgunConteo = true }
        })
        const descuadreTotal = Math.round(totalContado - totalEsperado)

        return (
          <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-md fade-in max-h-[92vh] flex flex-col overflow-hidden">

              {/* Header */}
              <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 shrink-0">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Cuadre de caja</h3>
                  <p className="text-xs text-gray-400">Ingresa lo que tienes en cada medio</p>
                </div>
                <button onClick={() => setModalCaja(null)} className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"><X size={18} className="text-gray-500"/></button>
              </div>

              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

                {/* Resumen ventas */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 text-center">
                    <p className="text-xs text-gray-400 mb-0.5">Ventas</p>
                    <p className="font-black text-gray-900 text-sm">${stats.ventas.toLocaleString('es-CO')}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
                    <p className="text-xs text-gray-400 mb-0.5">Ingresos extra</p>
                    <p className="font-black text-emerald-700 text-sm">+${totalIngresos.toLocaleString('es-CO')}</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
                    <p className="text-xs text-gray-400 mb-0.5">Egresos</p>
                    <p className="font-black text-red-600 text-sm">-${totalEgresos.toLocaleString('es-CO')}</p>
                  </div>
                </div>

                {/* Fila por método */}
                {metodosActivos.map(m => {
                  const val = conteoFinal[m.id]
                  const contado = parseFloat(val || '')
                  const tieneValor = val !== undefined && val !== ''
                  const diff = tieneValor && !isNaN(contado) ? Math.round(contado) - m.esperado : null

                  return (
                    <div key={m.id} className={`rounded-2xl border-2 p-4 space-y-3 transition-all ${
                      diff === null ? 'bg-gray-50 border-gray-200' :
                      diff === 0   ? 'bg-emerald-50 border-emerald-300' :
                      diff > 0     ? 'bg-orange-50 border-orange-300' :
                                     'bg-red-50 border-red-300'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{m.emoji}</span>
                          <div>
                            <p className="font-bold text-gray-800">{m.label}</p>
                            {m.id === 'efectivo' && (
                              <p className="text-xs text-gray-400">
                                Base ${turnoActivo.monto_inicial.toLocaleString('es-CO')}
                                {totalIngresos > 0 && ` + ingresos $${totalIngresos.toLocaleString('es-CO')}`}
                                {totalEgresos  > 0 && ` − egresos $${totalEgresos.toLocaleString('es-CO')}`}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Sistema espera</p>
                          <p className="font-black text-gray-900">${m.esperado.toLocaleString('es-CO')}</p>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 block mb-1 font-medium">
                          {m.id === 'efectivo' ? '💵 ¿Cuánto hay en caja?' : `📱 ¿Cuánto hay en ${m.label}?`}
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={val || ''}
                          onChange={e => setConteoFinal(p => ({ ...p, [m.id]: e.target.value }))}
                          placeholder={`$${m.esperado.toLocaleString('es-CO')}`}
                          className={`w-full border-2 rounded-xl px-3 py-2.5 text-base font-bold focus:outline-none transition-all ${
                            diff === null   ? 'border-gray-300 focus:border-orange-400 bg-gray-50 text-gray-900' :
                            diff === 0      ? 'border-green-400 bg-green-50 text-green-800' :
                            diff > 0        ? 'border-orange-400 bg-orange-50 text-orange-800' :
                                              'border-red-400 bg-red-50 text-red-800'
                          }`}
                        />
                      </div>

                      {diff !== null && (
                        <div className={`rounded-xl px-3 py-2 text-sm font-bold flex items-center justify-between ${
                          diff === 0 ? 'bg-green-50 text-green-700 border border-green-200' :
                          diff > 0   ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                                       'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          <span>
                            {diff === 0 ? '✅ Cuadrado perfecto' :
                             diff > 0   ? `⬆️ Sobran` :
                                          `⬇️ Faltan`}
                          </span>
                          {diff !== 0 && (
                            <span className="text-base font-black">${Math.abs(diff).toLocaleString('es-CO')}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Resumen total descuadre */}
                {hayAlgunConteo && (
                  <div className={`rounded-2xl p-4 border-2 ${
                    descuadreTotal === 0 ? 'bg-green-500/10 border-green-500/40' :
                    descuadreTotal > 0   ? 'bg-orange-500/10 border-orange-500/30' :
                                           'bg-red-500/10 border-red-500/40'
                  }`}>
                    <p className="text-xs font-bold uppercase text-gray-500 mb-1">Descuadre total</p>
                    <p className={`text-2xl font-black ${
                      descuadreTotal === 0 ? 'text-green-600' :
                      descuadreTotal > 0   ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {descuadreTotal === 0 ? '✅ Todo cuadrado' :
                       descuadreTotal > 0   ? `+$${descuadreTotal.toLocaleString('es-CO')} sobrante` :
                                              `-$${Math.abs(descuadreTotal).toLocaleString('es-CO')} faltante`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Sistema: ${totalEsperado.toLocaleString('es-CO')} · Contado: ${totalContado.toLocaleString('es-CO')}
                    </p>
                  </div>
                )}

                {/* ── Resumen de inventario del turno ── */}
                {resumenInventario.length > 0 && (
                  <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
                      <h3 className="font-bold text-gray-800 text-sm">📦 Inventario del turno</h3>
                      <span className="text-xs text-gray-400">{resumenInventario.length} platos</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {resumenInventario.map(item => {
                        const vendidos = item.cantidad_inicial - item.cantidad_restante
                        const valorVendido = vendidos * item.precio
                        return (
                          <div key={item.plato_id} className="px-4 py-3">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">{item.nombre}</p>
                                <p className="text-xs text-gray-400">{item.categoria}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-black text-gray-900 text-sm">{vendidos} vendidos</p>
                                <p className="text-xs text-green-700 font-semibold">${valorVendido.toLocaleString('es-CO')}</p>
                              </div>
                            </div>
                            <div className="flex gap-4 mt-1 text-xs text-gray-400">
                              <span>Inicial: <span className="font-semibold text-gray-600">{item.cantidad_inicial}</span></span>
                              <span>Restante: <span className={`font-semibold ${item.cantidad_restante === 0 ? 'text-red-500' : 'text-gray-600'}`}>{item.cantidad_restante}</span></span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* Totales finales */}
                    {(() => {
                      const totalVendidos = resumenInventario.reduce((a, i) => a + (i.cantidad_inicial - i.cantidad_restante), 0)
                      const totalValor    = resumenInventario.reduce((a, i) => a + (i.cantidad_inicial - i.cantidad_restante) * i.precio, 0)
                      return (
                        <div className="px-4 py-3 bg-orange-50 border-t border-orange-100 flex justify-between items-center">
                          <span className="text-sm font-bold text-orange-600">{totalVendidos} unidades vendidas</span>
                          <span className="font-black text-orange-600">${totalValor.toLocaleString('es-CO')}</span>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t shrink-0">
                <button onClick={cerrarTurno} disabled={cerrandoTurno}
                  className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2">
                  {cerrandoTurno ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Cerrando...</> : <><Square size={18}/> Cerrar turno</>}
                </button>
                <p className="text-center text-xs text-gray-400 mt-2">Puedes cerrar sin llenar los campos si prefieres</p>
              </div>
            </div>
          </div>
        )
      })()}
      {/* ── Modal: QR de mesa ── */}
      {modalQR && (() => {
        const urlMiniLanding = `${typeof window !== 'undefined' ? window.location.origin : ''}/restaurante/${negocioId || ''}?mesa=${modalQR.numero}`
        const urlDirecta     = `${typeof window !== 'undefined' ? window.location.origin : ''}/mesa/${modalQR.id}`
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(urlMiniLanding)}&bgcolor=ffffff&color=1a1a1a&margin=2`
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-xs fade-in text-center space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-900 text-lg">Mesa {modalQR.numero}</p>
                  {modalQR.zona && <p className="text-xs text-gray-500">{modalQR.zona}</p>}
                </div>
                <button onClick={() => setModalQR(null)}><X size={20} className="text-gray-400" /></button>
              </div>
              <img src={qrSrc} alt={`QR Mesa ${modalQR.numero}`} className="mx-auto rounded-xl border border-gray-200 p-2" width={200} height={200} />
              <p className="text-xs text-gray-400 break-all font-mono">{urlMiniLanding}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(urlMiniLanding); toast.success('URL copiada') }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl text-sm transition-colors"
                >
                  📋 Copiar
                </button>
                <button
                  onClick={() => {
                    const a = document.createElement('a')
                    a.href = qrSrc
                    a.download = `QR-Mesa-${modalQR.numero}.png`
                    a.click()
                  }}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl text-sm transition-colors"
                >
                  ⬇️ Descargar
                </button>
              </div>
              <p className="text-[10px] text-gray-400">
                También funciona: <span className="font-mono break-all">/mesa/{modalQR.id}</span>
              </p>
            </div>
          </div>
        )
      })()}

      {/* ── Modal: Nueva zona ── */}
      {modalNuevaZona && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm fade-in space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Nueva zona</h3>
              <button onClick={() => setModalNuevaZona(false)}><X size={20} /></button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Nombre de la zona</label>
              <input type="text" placeholder="Ej: Terraza, Salón VIP, Zona A..."
                value={nuevaZonaNombre} onChange={e => setNuevaZonaNombre(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-gray-50" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Número de la primera mesa</label>
              <input type="number" min="1" placeholder="Ej: 1"
                value={nuevaMesaNumero} onChange={e => setNuevaMesaNumero(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-gray-50" />
            </div>
            <button onClick={crearZonaConMesa} disabled={guardandoMesa}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl">
              {guardandoMesa ? 'Creando...' : 'Crear zona'}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Renombrar zona ── */}
      {modalRenombrarZona && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm fade-in space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Renombrar zona</h3>
              <button onClick={() => setModalRenombrarZona(null)}><X size={20} /></button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Nuevo nombre</label>
              <input type="text" placeholder="Nombre de la zona"
                value={renombrarZonaValor} onChange={e => setRenombrarZonaValor(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-gray-50" />
            </div>
            <button onClick={() => renombrarZona(modalRenombrarZona, renombrarZonaValor)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl">
              Guardar nombre
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Agregar mesa a zona ── */}
      {modalAgregarMesa && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm fade-in space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Agregar mesa — {modalAgregarMesa}</h3>
              <button onClick={() => setModalAgregarMesa(null)}><X size={20} /></button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Número de mesa</label>
              <input type="number" min="1" placeholder="Ej: 5"
                value={nuevaMesaNumero} onChange={e => setNuevaMesaNumero(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-gray-50" />
            </div>
            <button onClick={() => agregarMesaEnZona(modalAgregarMesa)} disabled={guardandoMesa}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl">
              {guardandoMesa ? 'Agregando...' : 'Agregar mesa'}
            </button>
          </div>
        </div>
      )}

      {modalUsuario && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm fade-in space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">Nuevo usuario</h3>
              <button onClick={() => { setModalUsuario(false); setErrorCrearUsuario(null) }}><X size={20} className="text-gray-500" /></button>
            </div>
            <input type="text" placeholder="Nombre completo" value={nuevoUsuario.nombre} onChange={e => setNuevoUsuario(p => ({ ...p, nombre: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-gray-50" />
            <input type="email" placeholder="Correo electrónico" value={nuevoUsuario.email} onChange={e => setNuevoUsuario(p => ({ ...p, email: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-gray-50" />
            <input type="password" placeholder="Contraseña (mín. 6 caracteres)" value={nuevoUsuario.password} onChange={e => setNuevoUsuario(p => ({ ...p, password: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-gray-50" />
            <select value={nuevoUsuario.rol} onChange={e => setNuevoUsuario(p => ({ ...p, rol: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-gray-50">
              <option value="mesera">Mesera</option><option value="cocina">Cocina</option><option value="gerente">Gerente</option><option value="domi">Domi</option>
            </select>
            {errorCrearUsuario && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                ⚠️ {errorCrearUsuario}
              </div>
            )}
            <button onClick={crearUsuario} disabled={creandoUsuario} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-all">
              {creandoUsuario ? '⏳ Creando...' : 'Crear usuario'}
            </button>
          </div>
        </div>
      )}

      {/* ══ MODAL QR DOMI ════════════════════════════════════════════ */}
      {modalQRDomi && (() => {
        const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/restaurante/${negocioId || ''}`
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=1a1a1a&margin=2`
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-xs fade-in text-center space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <div className="text-left">
                  <p className="font-black text-gray-900 text-lg">📱 Página Pública</p>
                  <p className="text-xs text-gray-500">Menú, domicilios, reseñas y reservas</p>
                </div>
                <button onClick={() => setModalQRDomi(false)}><X size={20} className="text-gray-400" /></button>
              </div>

              <div className="bg-orange-50 rounded-2xl p-4">
                <img src={qrSrc} alt="QR Página Pública" className="mx-auto rounded-xl" width={210} height={210} />
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-left space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">URL pública</p>
                <p className="text-xs text-gray-700 break-all font-mono">{url}</p>
              </div>

              <a href={url} target="_blank" rel="noreferrer"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                👁️ Ver como cliente
              </a>

              <div className="flex gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(url); toast.success('URL copiada') }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl text-sm transition-colors"
                >
                  📋 Copiar URL
                </button>
                <button
                  onClick={() => {
                    const a = document.createElement('a')
                    a.href = qrSrc
                    a.download = 'QR-Pagina-Publica.png'
                    a.click()
                  }}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl text-sm transition-colors"
                >
                  ⬇️ Descargar QR
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ══ MODAL CONFIGURACIÓN ⚙️ ══════════════════════════════════ */}
      {modalSettings && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-0">
          <div className="bg-white border border-gray-200 w-full max-w-lg rounded-t-3xl max-h-[92vh] flex flex-col overflow-hidden fade-in">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <Settings size={20} className="text-gray-600" />
                <h2 className="text-lg font-black text-gray-900">Configuración</h2>
              </div>
              <button onClick={() => setModalSettings(false)} className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center"><X size={18} className="text-gray-500" /></button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-4 py-2 border-b border-gray-100 shrink-0 overflow-x-auto">
              {([
                ['cuenta',       '👤 Cuenta'],
                ['facturacion',  '💳 Facturación'],
                ['domicilios',   '🛵 Domicilios'],
                ['usuarios',     '👥 Usuarios'],
                ['permisos',     '🔒 Permisos'],
                ['restablecer',  '⚠️ Restablecer'],
              ] as ['cuenta'|'facturacion'|'domicilios'|'usuarios'|'permisos'|'restablecer', string][]).map(([id, label]) => (
                <button key={id} onClick={() => { setSeccionSettings(id); if (id === 'facturacion') cargarFacturacion() }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    seccionSettings === id
                      ? id === 'restablecer' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">

              {/* ── CUENTA ── */}
              {seccionSettings === 'cuenta' && (
                <div className="space-y-4">
                  <div className="bg-orange-50 rounded-2xl p-4 flex items-center gap-4 border border-orange-200">
                    <div className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center text-white text-2xl font-black">G</div>
                    <div>
                      <p className="font-black text-gray-900">Gerencia</p>
                      <p className="text-xs text-gray-400">Administrador del sistema</p>
                    </div>
                  </div>
                  <button onClick={cerrarSesion}
                    className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 border-2 border-red-200 text-red-600 font-bold py-3.5 rounded-2xl transition-colors">
                    <LogOut size={18} /> Cerrar sesión
                  </button>
                </div>
              )}

              {/* ── FACTURACIÓN ── */}
              {seccionSettings === 'facturacion' && (
                <div className="space-y-4">
                  {cargandoFact ? (
                    <div className="flex items-center justify-center py-10">
                      <span className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : facturacion ? (() => {
                    const hasta = facturacion.hasta ? new Date(facturacion.hasta) : null
                    const ahora = new Date()
                    const diasRestantes = hasta ? Math.ceil((hasta.getTime() - ahora.getTime()) / 86400000) : null
                    const vencido = diasRestantes !== null && diasRestantes <= 0
                    const esPro = facturacion.plan === 'pro'
                    const esStarter = facturacion.plan === 'starter'
                    const planLabel = esPro ? '🔥 Plan Pro' : esStarter ? '📦 Plan Básico' : '⭐ Plan Profesional'
                    const planPrecio = esPro ? '$149.000 COP/mes' : esStarter ? '$19.000 COP/mes' : '$89.900 COP/mes'

                    return (
                      <>
                        {/* Tarjeta plan */}
                        <div className={`rounded-2xl p-5 border-2 ${esPro ? 'bg-gray-950 border-gray-800' : esStarter ? 'bg-gray-50 border-gray-200' : 'bg-orange-50 border-orange-300'}`}>
                          <div className="flex items-start justify-between">
                            <div>
                              <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${esPro ? 'text-gray-400' : 'text-gray-500'}`}>Plan actual</p>
                              <p className={`text-2xl font-black ${esPro ? 'text-white' : 'text-gray-900'}`}>{planLabel}</p>
                              <p className={`text-sm mt-1 ${esPro ? 'text-gray-400' : 'text-gray-500'}`}>{planPrecio}</p>
                            </div>
                            <span className={`text-xs font-black px-3 py-1.5 rounded-full mt-1 ${
                              vencido ? 'bg-red-100 text-red-700'
                              : facturacion.activa ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {vencido ? '⚠ Vencido' : facturacion.activa ? '✓ Activo' : '⏳ Prueba'}
                            </span>
                          </div>
                        </div>

                        {/* Próximo pago */}
                        <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4 border border-gray-200">
                          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                            <CalendarDays size={20} className="text-orange-500" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                              {vencido ? 'Venció el' : 'Próximo pago / vence'}
                            </p>
                            <p className="font-black text-gray-900">
                              {hasta
                                ? hasta.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
                                : 'No disponible'}
                            </p>
                            {diasRestantes !== null && !vencido && (
                              <p className={`text-xs mt-0.5 font-semibold ${diasRestantes <= 5 ? 'text-red-500' : 'text-gray-400'}`}>
                                {diasRestantes === 0 ? 'Vence hoy' : `${diasRestantes} días restantes`}
                              </p>
                            )}
                            {vencido && (
                              <p className="text-xs mt-0.5 text-red-500 font-semibold">
                                Venció hace {Math.abs(diasRestantes!)} día{Math.abs(diasRestantes!) !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Pagar ahora — usuario en prueba */}
                        {!facturacion.activa && !vencido && (
                          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 space-y-3">
                            <div>
                              <p className="font-black text-gray-900 mb-0.5">💳 Adquirir plan ahora</p>
                              <p className="text-xs text-gray-400 leading-relaxed">
                                Paga hoy y no pierdes tus días de prueba — la suscripción empieza cuando termine tu período gratis.
                              </p>
                            </div>
                            <div className="space-y-2">
                              <a href="/checkout?plan=starter&tipo=nuevo"
                                className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-xs font-bold border-2 border-gray-200 hover:border-gray-300 text-gray-700 transition-colors">
                                <span>📦 Plan Básico</span>
                                <span className="text-gray-500 font-normal">$19.000/mes</span>
                              </a>
                              <a href="/checkout?plan=basico&tipo=nuevo"
                                className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-xs font-bold border-2 border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors">
                                <span>⭐ Plan Profesional — Recomendado</span>
                                <span className="font-normal">$89.900/mes</span>
                              </a>
                              <a href="/checkout?plan=pro&tipo=nuevo"
                                className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-xs font-bold bg-gray-900 text-white hover:bg-gray-800 transition-colors">
                                <span>🔥 Plan Pro</span>
                                <span className="font-normal text-white/35">$149.000/mes</span>
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Renovar — vence pronto o ya venció */}
                        {facturacion.activa && (vencido || (diasRestantes !== null && diasRestantes <= 7)) && (
                          <a href={`/checkout?plan=${facturacion.plan}&tipo=renovar`}
                            className="block text-center bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl transition-colors text-sm">
                            🔄 {vencido ? 'Reactivar — pagar ahora' : `Renovar (${diasRestantes} días restantes)`}
                          </a>
                        )}

                        {/* Upgrade — si no es Pro y ya pagó */}
                        {facturacion.activa && !esPro && !vencido && (
                          <div className="border-2 border-orange-200 rounded-2xl p-4 space-y-3">
                            <div>
                              <p className="font-black text-gray-900 mb-0.5">⬆️ Subir de plan</p>
                              <p className="text-xs text-gray-400 mb-2">Pagas solo la diferencia proporcional por los días que te quedan.</p>
                            </div>
                            <div className="space-y-2">
                              {esStarter && (
                                <a href="/checkout?plan=basico&tipo=upgrade"
                                  className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-xs font-bold border-2 border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors">
                                  <span>⭐ Subir a Profesional</span>
                                  <span className="font-normal">$89.900/mes</span>
                                </a>
                              )}
                              <a href="/checkout?plan=pro&tipo=upgrade"
                                className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-xs font-bold bg-gray-900 text-white hover:bg-gray-800 transition-colors">
                                <span>🔥 Subir a Pro</span>
                                <span className="font-normal text-white/35">$149.000/mes</span>
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Ayuda */}
                        <a
                          href={`https://wa.me/573205612477?text=${encodeURIComponent('Hola, tengo una pregunta sobre mi suscripción de Restaurant sas')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-500 hover:bg-gray-50 font-semibold py-2.5 rounded-2xl text-xs transition-colors">
                          💬 Ayuda por WhatsApp
                        </a>
                      </>
                    )
                  })() : (
                    <p className="text-center text-gray-400 text-sm py-8">No se pudo cargar la información</p>
                  )}
                </div>
              )}

              {/* ── DOMICILIOS ── */}
              {seccionSettings === 'domicilios' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                        <Bike size={20} className="text-orange-500" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Tarifa de domicilio</h3>
                        <p className="text-xs text-gray-400">Se suma como cargo extra en pedidos a domicilio</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide block mb-1.5">Valor del domicilio</label>
                      <input
                        type="number"
                        min="0"
                        value={tarifaDomicilio}
                        onChange={e => setTarifaDomicilio(e.target.value)}
                        placeholder="Ej: 5000"
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                      />
                    </div>
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                      <p className="text-xs text-orange-700 leading-relaxed">
                        En pedidos online por transferencia, el cliente puede incluir el domicilio en la transferencia o pagarlo en efectivo al recibir. En pedidos internos puedes marcar domicilio gratis.
                      </p>
                    </div>
                    <button
                      onClick={guardarDomicilios}
                      disabled={guardandoDomicilios}
                      className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors">
                      {guardandoDomicilios ? 'Guardando...' : 'Guardar tarifa'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── USUARIOS ── */}
              {seccionSettings === 'usuarios' && (
                <div className="space-y-4">
                  <button onClick={() => setModalUsuario(true)}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors">
                    <Plus size={18} /> Crear nuevo usuario
                  </button>
                  {listaUsuarios.length === 0 ? (
                    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 text-center">
                      <p className="text-gray-400 text-sm">No hay usuarios registrados.</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      {listaUsuarios.map((u, i) => {
                        const ROL_BADGE: Record<string, string> = {
                          gerente: 'bg-orange-50 text-orange-600 border border-orange-200',
                          mesera:  'bg-gray-100 text-gray-600 border border-gray-200',
                          cocina:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
                          domi:    'bg-gray-100 text-gray-600 border border-gray-200',
                        }
                        const ROL_LABEL: Record<string, string> = {
                          gerente: 'Gerente', mesera: 'Mesera', cocina: 'Cocina', domi: 'Domi',
                        }
                        return (
                          <div key={u.id} className={`flex items-center justify-between px-4 py-3.5 ${i !== 0 ? 'border-t border-gray-100' : ''} ${!u.activo ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${u.activo ? 'bg-orange-100 text-orange-600' : 'bg-red-50 text-red-500'}`}>
                                {u.nombre.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{u.nombre}</p>
                                {!u.activo && <p className="text-xs text-red-500 font-medium">Inhabilitado</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ROL_BADGE[u.rol] || 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                                {ROL_LABEL[u.rol] || u.rol}
                              </span>
                              <button onClick={() => setEditandoUsuario({ id: u.id, nombre: u.nombre, rol: u.rol, activo: u.activo ?? true, nuevaPassword: '' })}
                                className="w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center">
                                <Pencil size={13} className="text-gray-500" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* ── Nombres de cocineros ── */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 border border-orange-200 rounded-xl flex items-center justify-center">
                        <ChefHat size={20} className="text-orange-500" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm">Nombres de cocineros/as</h3>
                        <p className="text-xs text-gray-400">Aparecen en el selector al entrar a cocina — sin crear usuario extra</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={nuevoNombreCocinero}
                        onChange={e => setNuevoNombreCocinero(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') agregarNombreCocinero() }}
                        placeholder="Ej: María, Pedro, Cocinera 1..."
                        className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                      />
                      <button
                        onClick={agregarNombreCocinero}
                        disabled={!nuevoNombreCocinero.trim() || guardandoNombresCocineros}
                        className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all flex items-center gap-1.5">
                        <Plus size={14} /> Añadir
                      </button>
                    </div>
                    {nombresCocineros.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">Sin nombres configurados — los cocineros escribirán el suyo al entrar</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {nombresCocineros.map(nombre => (
                          <div key={nombre} className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-xl px-3 py-1.5">
                            <ChefHat size={12} className="text-orange-500" />
                            <span className="text-orange-600 text-sm font-medium">{nombre}</span>
                            <button
                              onClick={() => eliminarNombreCocinero(nombre)}
                              className="text-orange-500/60 hover:text-red-400 ml-1 transition-colors">
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── MARKETING ── */}
              {seccionSettings === 'marketing' && (
                <div className="space-y-4">
                  {/* Sugerido del mes */}
                  <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-5 ${!puedeAcceder('pro') ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 border border-orange-200 rounded-xl flex items-center justify-center text-xl">🌟</div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm">Sugerido del mes</h3>
                          <p className="text-xs text-gray-400">Popup que aparece cuando el cliente abre el menú QR</p>
                        </div>
                      </div>
                      {!puedeAcceder('pro') && (
                        <span className="text-[10px] bg-orange-500/20 text-orange-300 font-bold px-2 py-1 rounded-full shrink-0">Plan Pro</span>
                      )}
                    </div>
                    {!puedeAcceder('pro') ? (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">🔒 El sugerido del mes está disponible en el Plan Pro.</p>
                        <button onClick={abrirUpgrade} className="text-xs text-orange-400 hover:underline mt-1">Actualizar plan →</button>
                      </div>
                    ) : (
                      <>
                        {/* Toggle activo/inactivo */}
                        <div className="flex items-center justify-between gap-4 py-1">
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">Activar popup</p>
                            <p className="text-xs text-gray-400">Los clientes verán este popup al abrir el menú QR</p>
                          </div>
                          <button onClick={() => setSugeridoActivo(v => !v)}
                            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${sugeridoActivo ? 'bg-orange-500' : 'bg-gray-300'}`}>
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${sugeridoActivo ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                        {/* Nombre del plato */}
                        <div>
                          <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide block mb-1.5">Nombre del plato *</label>
                          <input
                            value={sugeridoNombre}
                            onChange={e => setSugeridoNombre(e.target.value)}
                            placeholder="Ej: Burger Master, Bandeja especial..."
                            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                          />
                        </div>
                        {/* Precio */}
                        <div>
                          <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide block mb-1.5">Precio (opcional)</label>
                          <input
                            type="number"
                            value={sugeridoPrecio}
                            onChange={e => setSugeridoPrecio(e.target.value)}
                            placeholder="Ej: 28900"
                            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                          />
                        </div>
                        {/* Descripción */}
                        <div>
                          <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide block mb-1.5">Descripción corta (opcional)</label>
                          <input
                            value={sugeridoDescripcion}
                            onChange={e => setSugeridoDescripcion(e.target.value)}
                            placeholder="Ej: Carne angus, queso cheddar doble, bacon crocante"
                            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                          />
                        </div>
                        {/* URL imagen */}
                        <div>
                          <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide block mb-1.5">URL de imagen (opcional)</label>
                          <input
                            value={sugeridoImagenUrl}
                            onChange={e => setSugeridoImagenUrl(e.target.value)}
                            placeholder="https://... (deja vacío para mostrar emoji 🍽️)"
                            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                          />
                          {sugeridoImagenUrl && (
                            <img src={sugeridoImagenUrl} alt="preview" className="mt-2 h-20 w-full object-cover rounded-xl border border-gray-200" onError={() => setSugeridoImagenUrl('')} />
                          )}
                        </div>
                        {/* Preview miniatura */}
                        {sugeridoNombre && (
                          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                            <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wide">Preview popup</p>
                            <div className="bg-white rounded-2xl overflow-hidden max-w-[220px] mx-auto shadow-xl">
                              <div className={`h-24 flex items-center justify-center ${sugeridoImagenUrl ? '' : 'bg-gradient-to-br from-amber-400 to-orange-500 text-4xl'}`}>
                                {sugeridoImagenUrl
                                  ? <img src={sugeridoImagenUrl} alt={sugeridoNombre} className="w-full h-full object-cover" />
                                  : '🍽️'
                                }
                              </div>
                              <div className="p-3 text-center">
                                <span className="inline-block bg-orange-100 text-orange-600 text-[9px] font-black px-2 py-0.5 rounded-full mb-1 uppercase">⭐ Sugerido del mes</span>
                                <p className="font-black text-gray-900 text-sm leading-tight">{sugeridoNombre}</p>
                                {sugeridoDescripcion && <p className="text-gray-500 text-[10px] mt-0.5 leading-snug">{sugeridoDescripcion}</p>}
                                {sugeridoPrecio && <p className="text-orange-600 font-black text-base mt-1">${parseFloat(sugeridoPrecio).toLocaleString('es-CO')}</p>}
                              </div>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={guardarSugerido}
                          disabled={guardandoSugerido || !sugeridoNombre.trim()}
                          className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-all">
                          {guardandoSugerido ? 'Guardando...' : sugeridoActivo ? '🌟 Guardar y activar' : 'Guardar (inactivo)'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── PERMISOS ── */}
              {seccionSettings === 'permisos' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                        <Lock size={20} className="text-orange-500" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Control de flujo — Cocina</h3>
                        <p className="text-xs text-gray-400">Regula cuántos pedidos ve la cocina a la vez</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 text-sm">Bloqueo de comandas</p>
                        <p className="text-xs text-gray-400 mt-0.5">La cocina solo verá un lote de pedidos a la vez</p>
                      </div>
                      <button onClick={() => setBloqueoActivo(v => !v)}
                        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${bloqueoActivo ? 'bg-orange-500' : 'bg-gray-700'}`}>
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${bloqueoActivo ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    {bloqueoActivo && (
                      <div>
                        <p className="font-semibold text-gray-800 text-sm mb-3">Comandas por lote</p>
                        <div className="flex gap-2">
                          {[2, 3, 4, 5].map(n => (
                            <button key={n} onClick={() => setBloqueoCantidad(n)}
                              className={`flex-1 py-3 rounded-xl font-black text-lg transition-all border-2 ${bloqueoCantidad === n ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-orange-400'}`}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* QR — solo basico/pro */}
                  <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4 ${!puedeQRConsumo ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                          <span className="text-xl">📱</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">Pedidos por QR</h3>
                          <p className="text-xs text-gray-400">Clientes piden desde su celular</p>
                        </div>
                      </div>
                      {!puedeQRConsumo && (
                        <span className="text-[10px] bg-orange-100 text-orange-600 font-bold px-2 py-1 rounded-full shrink-0">Plan Profesional</span>
                      )}
                    </div>
                    {!puedeQRConsumo ? (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">🔒 Disponible desde el plan Profesional.</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800 text-sm">QR — Consumo en el lugar</p>
                            <p className="text-xs text-gray-400 mt-0.5">Clientes en mesa piden desde su celular</p>
                          </div>
                          <button onClick={() => setQrConsumoActivo(v => !v)}
                            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${qrConsumoActivo ? 'bg-orange-500' : 'bg-gray-300'}`}>
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${qrConsumoActivo ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-800 text-sm">QR — Domicilio</p>
                              {!puedeQRDomi && <span className="text-[10px] bg-orange-100 text-orange-600 font-bold px-2 py-0.5 rounded-full">Plan Pro</span>}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">Pedidos a domicilio desde la página pública</p>
                          </div>
                          <button onClick={() => puedeQRDomi ? setQrDomiActivo(v => !v) : abrirUpgrade()}
                            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${puedeQRDomi && qrDomiActivo ? 'bg-orange-500' : 'bg-gray-300'}`}>
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${puedeQRDomi && qrDomiActivo ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <button onClick={guardarConfiguracion} disabled={guardandoPermisos}
                    className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl transition-colors">
                    {guardandoPermisos ? 'Guardando...' : '💾 Guardar configuración'}
                  </button>
                </div>
              )}

              {/* ── RESTABLECER NEGOCIO ── */}
              {seccionSettings === 'restablecer' && (
                <div className="space-y-4">
                  {pasoRestablecer === 'opciones' ? (
                    <>
                      <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-3">
                        <ShieldAlert size={20} className="text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700 leading-relaxed">
                          <strong>Acción irreversible.</strong> Los datos eliminados no se pueden recuperar. Úsalo con precaución.
                        </p>
                      </div>

                      {/* Alcance */}
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">¿Qué período eliminar?</p>
                        <div className="flex gap-2">
                          <button onClick={() => setRestablecerScope('todo')}
                            className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${restablecerScope === 'todo' ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 text-gray-600 hover:border-red-300'}`}>
                            Todo el historial
                          </button>
                          <button onClick={() => setRestablecerScope('desde_fecha')}
                            className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${restablecerScope === 'desde_fecha' ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 text-gray-600 hover:border-red-300'}`}>
                            Desde una fecha
                          </button>
                        </div>
                        {restablecerScope === 'desde_fecha' && (
                          <input type="date" value={restablecerFecha} onChange={e => setRestablecerFecha(e.target.value)}
                            className="w-full mt-2 border-2 border-red-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400" />
                        )}
                      </div>

                      {/* Checklist */}
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">¿Qué datos eliminar?</p>
                        <div className="space-y-2">
                          {([
                            ['pedidos',   '📋 Pedidos y pagos', 'Historial de pedidos, ítems y cobros del período'],
                            ['turnos',    '🔄 Turnos y caja',   'Historial de turnos, movimientos e inventario de turno'],
                            ['clientes',  '👥 Clientes',        'Base de datos de clientes registrados (sin filtro de fecha)'],
                            ['inventario','📦 Inventario',      'Reinicia todas las cantidades disponibles a 0'],
                          ] as [keyof typeof restablecerItems, string, string][]).map(([key, label, desc]) => (
                            <label key={key} className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${restablecerItems[key] ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200 hover:border-red-200'}`}>
                              <input type="checkbox" checked={restablecerItems[key]}
                                onChange={e => setRestablecerItems(prev => ({ ...prev, [key]: e.target.checked }))}
                                className="mt-0.5 w-4 h-4 accent-red-500" />
                              <div>
                                <p className="font-bold text-sm text-gray-900">{label}</p>
                                <p className="text-xs text-gray-400">{desc}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const alguno = Object.values(restablecerItems).some(Boolean)
                          if (!alguno) { toast.error('Selecciona al menos un tipo de datos'); return }
                          if (restablecerScope === 'desde_fecha' && !restablecerFecha) { toast.error('Selecciona una fecha'); return }
                          setPasoRestablecer('confirmar')
                        }}
                        className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors">
                        <AlertTriangle size={18} /> Continuar
                      </button>
                    </>
                  ) : (
                    /* Paso de confirmación */
                    <div className="space-y-4">
                      <div className="bg-red-100 border-2 border-red-400 rounded-2xl p-4 text-center space-y-2">
                        <AlertTriangle size={32} className="text-red-500 mx-auto" />
                        <p className="font-black text-red-700 text-lg">¿Estás completamente seguro?</p>
                        <p className="text-sm text-red-600">
                          Se eliminarán permanentemente:
                        </p>
                        <div className="flex flex-wrap gap-1 justify-center mt-1">
                          {restablecerItems.pedidos   && <span className="text-xs bg-red-200 text-red-700 px-2 py-0.5 rounded-full font-bold">Pedidos y pagos</span>}
                          {restablecerItems.turnos    && <span className="text-xs bg-red-200 text-red-700 px-2 py-0.5 rounded-full font-bold">Turnos y caja</span>}
                          {restablecerItems.clientes  && <span className="text-xs bg-red-200 text-red-700 px-2 py-0.5 rounded-full font-bold">Clientes</span>}
                          {restablecerItems.inventario && <span className="text-xs bg-red-200 text-red-700 px-2 py-0.5 rounded-full font-bold">Inventario (reset a 0)</span>}
                        </div>
                        {restablecerScope === 'desde_fecha' && restablecerFecha && (
                          <p className="text-xs text-red-500 mt-1">Desde: <strong>{new Date(restablecerFecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>
                        )}
                        {restablecerScope === 'todo' && (
                          <p className="text-xs text-red-500 mt-1"><strong>Todo el historial</strong></p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-600 block mb-1.5">Escribe <strong className="text-red-600">BORRAR</strong> para confirmar:</label>
                        <input type="text" value={restablecerConfirm} onChange={e => setRestablecerConfirm(e.target.value)}
                          placeholder="BORRAR"
                          className="w-full border-2 border-red-300 rounded-xl px-4 py-3 font-bold text-center text-lg focus:outline-none focus:border-red-500 tracking-widest" />
                      </div>

                      <button onClick={ejecutarRestablecer} disabled={restableciendo || restablecerConfirm !== 'BORRAR'}
                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors">
                        {restableciendo
                          ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Restableciendo...</>
                          : <><RotateCcw size={18} /> Sí, restablecer definitivamente</>}
                      </button>

                      <button onClick={() => { setPasoRestablecer('opciones'); setRestablecerConfirm('') }}
                        disabled={restableciendo}
                        className="w-full text-gray-500 text-sm py-2 hover:text-gray-700">
                        ← Volver
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: REEMPLAZAR PLATO ═══════════════════════════════════ */}
      {itemReemplazando && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-end justify-center">
          <div className="bg-[#0f0f1e] border border-white/10 w-full max-h-[85vh] rounded-t-3xl flex flex-col overflow-hidden fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <h3 className="font-bold text-white/90">Reemplazar plato</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  <span className="text-orange-600 font-semibold">"{itemReemplazando.nombre}"</span> → ¿por cuál lo cambiamos?
                </p>
              </div>
              <button onClick={() => setItemReemplazando(null)} className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center">
                <X size={18} />
              </button>
            </div>
            {/* Filtro por categoría */}
            <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b shrink-0">
              <button onClick={() => setCategoriaReemplazo('todas')}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${categoriaReemplazo === 'todas' ? 'bg-orange-500 text-white' : 'bg-white/8 text-gray-400'}`}>
                Todas
              </button>
              {categorias.map(c => (
                <button key={c.id} onClick={() => setCategoriaReemplazo(c.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${categoriaReemplazo === c.id ? 'bg-orange-500 text-white' : 'bg-white/8 text-gray-400'}`}>
                  {c.nombre}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {platos
                .filter(p => p.activo && (categoriaReemplazo === 'todas' || p.categoria_id === categoriaReemplazo))
                .map(p => (
                  <button key={p.id}
                    onClick={() => reemplazarItem(itemReemplazando.id, p.id)}
                    disabled={guardandoEdicion}
                    className="w-full text-left bg-white/5 border border-white/10 hover:border-orange-500/40 hover:bg-orange-500/10 rounded-2xl px-4 py-3 transition-all disabled:opacity-50">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white/80 truncate">{p.nombre}</p>
                        {p.descripcion && <p className="text-xs text-white/35 truncate mt-0.5">{p.descripcion}</p>}
                        <p className="text-xs text-white/30 mt-0.5">{categorias.find(c => c.id === p.categoria_id)?.nombre}</p>
                      </div>
                      <span className="font-black text-orange-400 shrink-0">${p.precio.toLocaleString('es-CO')}</span>
                    </div>
                  </button>
                ))}
              {platos.filter(p => p.activo).length === 0 && (
                <p className="text-center text-white/25 text-sm py-8">Sin platos activos en la carta</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: TOMAR PEDIDO DESDE GERENCIA ═══════════════════════ */}
      {modalNuevoPedido && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
          <div className="bg-[#0f0f1e] border border-white/10 w-full max-h-[95vh] rounded-t-3xl flex flex-col overflow-hidden fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <h2 className="text-lg font-black text-white/90">Tomar pedido</h2>
                <p className="text-xs text-white/35">Gerencia</p>
              </div>
              <button onClick={() => { setModalNuevoPedido(false); setNuevoOrdenCarrito({}); setNuevoOrdenItemsMod([]); setNuevoOrdenMesaId(null) }}
                className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center"><X size={18} /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {/* Tipo */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Tipo de pedido</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setNuevoOrdenTipo('mesa')}
                    className={`py-3 rounded-2xl font-bold text-sm border-2 transition-all flex items-center justify-center gap-2 ${nuevoOrdenTipo === 'mesa' ? 'bg-orange-500 text-white border-orange-500' : 'border-white/12 text-gray-400 hover:border-orange-500/40'}`}>
                    🍽️ Mesa
                  </button>
                  <button onClick={() => setNuevoOrdenTipo('domi')}
                    className={`py-3 rounded-2xl font-bold text-sm border-2 transition-all flex items-center justify-center gap-2 ${nuevoOrdenTipo === 'domi' ? 'bg-orange-500 text-white border-orange-500' : 'border-white/12 text-gray-400 hover:border-orange-500/40'}`}>
                    🛵 Domicilio
                  </button>
                </div>
              </div>

              {/* Selector de mesa */}
              {nuevoOrdenTipo === 'mesa' && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Selecciona la mesa</p>
                  {zonasLista.map(zona => (
                    <div key={zona} className="mb-3">
                      <p className="text-xs text-gray-400 font-semibold mb-1.5">{zona}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {mesas.filter(m => (m.zona || 'Sin zona') === zona).sort((a,b) => a.numero - b.numero).map(m => (
                          <button key={m.id} onClick={() => setNuevoOrdenMesaId(m.id)}
                            className={`py-3 rounded-xl font-black text-sm border-2 transition-all ${
                              nuevoOrdenMesaId === m.id
                                ? 'bg-orange-500 text-white border-orange-500'
                                : m.estado === 'libre'
                                  ? 'bg-white/5 border-white/12 text-white/70 hover:border-orange-500/40'
                                  : 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                            }`}>
                            {m.numero}
                            {m.estado !== 'libre' && <span className="block text-[9px] font-normal">ocupada</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {mesas.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">No hay mesas configuradas</p>
                  )}
                </div>
              )}

              {/* Datos del domicilio */}
              {nuevoOrdenTipo === 'domi' && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Datos del domicilio</p>
                  <input type="text" placeholder="Nombre del cliente" value={nuevoOrdenDomi.nombre}
                    onChange={e => setNuevoOrdenDomi(p => ({ ...p, nombre: e.target.value }))}
                    className="w-full bg-white/6 border border-white/12 rounded-xl px-3 py-2 text-white placeholder-white/25.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                  <input type="tel" placeholder="Teléfono" value={nuevoOrdenDomi.telefono}
                    onChange={e => setNuevoOrdenDomi(p => ({ ...p, telefono: e.target.value }))}
                    className="w-full bg-white/6 border border-white/12 rounded-xl px-3 py-2 text-white placeholder-white/25.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                  <input type="text" placeholder="Dirección" value={nuevoOrdenDomi.direccion}
                    onChange={e => setNuevoOrdenDomi(p => ({ ...p, direccion: e.target.value }))}
                    className="w-full bg-white/6 border border-white/12 rounded-xl px-3 py-2 text-white placeholder-white/25.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                  {parseTarifaDomicilio(tarifaDomicilio) > 0 && (
                    <button
                      type="button"
                      onClick={() => setNuevoOrdenDomiGratis(v => !v)}
                      className={`w-full flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-bold transition-all ${
                        nuevoOrdenDomiGratis ? 'bg-green-500/15 border-green-500/40 text-green-300' : 'bg-white/6 border-white/12 text-white/70'
                      }`}>
                      <span>Free domi</span>
                      <span>{nuevoOrdenDomiGratis ? 'Activado' : `$${parseTarifaDomicilio(tarifaDomicilio).toLocaleString('es-CO')}`}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Menú */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Platos</p>
                <div className="flex gap-2 overflow-x-auto mb-3 pb-1">
                  <button onClick={() => setNuevoOrdenCategoria('todas')}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${nuevoOrdenCategoria === 'todas' ? 'bg-orange-500 text-white' : 'bg-white/8 text-gray-400'}`}>
                    Todas
                  </button>
                  {categorias.map(c => (
                    <button key={c.id} onClick={() => setNuevoOrdenCategoria(c.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${nuevoOrdenCategoria === c.id ? 'bg-orange-500 text-white' : 'bg-white/8 text-gray-400'}`}>
                      {c.nombre}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {platos.filter(p => p.activo && (nuevoOrdenCategoria === 'todas' || p.categoria_id === nuevoOrdenCategoria)).map(p => {
                    const inv = inventarioModalMap[p.id]
                    const cantidadConfigurada = nuevoOrdenItemsMod.filter(i => i.plato.id === p.id).reduce((a, i) => a + i.cantidad, 0)
                    const cantidadTotal = (nuevoOrdenCarrito[p.id] ?? 0) + cantidadConfigurada
                    // sinStock solo si este plato TIENE inventario de turno configurado Y está en 0
                    // Si inv es undefined → plato sin restricción de turno → siempre disponible
                    const sinStock  = inv !== undefined && inv.cantidad === 0
                    const stockBajo = inv !== undefined && inv.cantidad > 0 && inv.cantidad <= inv.alerta
                    return (
                    <div key={p.id} className={`flex items-center justify-between bg-white/5 border rounded-2xl px-4 py-2.5 gap-3 transition-all ${
                      sinStock ? 'border-red-500/20 opacity-50' :
                      cantidadTotal > 0 ? 'border-orange-500/30 bg-orange-500/10' : 'border-white/10'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white/80 truncate">{p.nombre}</p>
                        <p className="text-xs font-bold text-orange-400">${p.precio.toLocaleString('es-CO')}</p>
                        {sinStock  && <span className="text-xs text-red-400 font-bold">Sin stock</span>}
                        {stockBajo && <span className="text-xs text-amber-400 font-bold">⚠️ {inv!.cantidad} disponibles</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => quitarNuevoOrdenPlato(p)}
                          className="w-7 h-7 bg-white/8 hover:bg-white/14 border border-white/10 rounded-full flex items-center justify-center text-white/60">
                          <Minus size={12} />
                        </button>
                        <span className="w-6 text-center font-black text-white text-sm">{cantidadTotal}</span>
                        <button
                          disabled={sinStock}
                          onClick={() => {
                            if (turnoConInventario && inv) {
                              const enCarrito = cantidadTotal
                              if (inv.cantidad > 0 && enCarrito >= inv.cantidad) { toast.error(`Solo hay ${inv.cantidad} de ${p.nombre}`); return }
                            }
                            agregarNuevoOrdenPlato(p)
                          }}
                          className="w-7 h-7 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-900/30">
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    )
                  })}
                  {platos.filter(p => p.activo).length === 0 && (
                    <p className="text-center text-white/25 text-sm py-6">Sin platos activos en la carta</p>
                  )}
                </div>
              </div>

              {/* Notas */}
              <div>
                <p className="text-xs font-bold text-white/40 uppercase tracking-wide mb-2">Notas (opcional)</p>
                <textarea value={nuevoOrdenNotas} onChange={e => setNuevoOrdenNotas(e.target.value)}
                  placeholder="Sin sal, alérgico a..."
                  rows={2}
                  className="w-full bg-white/6 border border-white/12 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none" />
              </div>
            </div>

            {/* Footer: resumen + botón enviar */}
            <div className="border-t border-white/10 px-5 py-4 shrink-0 bg-gray-950 space-y-3">
              {(Object.values(nuevoOrdenCarrito).some(v => v > 0) || nuevoOrdenItemsMod.length > 0) && (
                <div className="flex justify-between items-center text-sm bg-white/4 rounded-xl px-4 py-2.5">
                  <span className="text-gray-500 font-medium">
                    {Object.values(nuevoOrdenCarrito).reduce((a, v) => a + v, 0) + nuevoOrdenItemsMod.reduce((a, i) => a + i.cantidad, 0)} platos
                    {nuevoOrdenTipo === 'mesa' && nuevoOrdenMesaId && (
                      <span className="ml-1">· Mesa {mesas.find(m => m.id === nuevoOrdenMesaId)?.numero}</span>
                    )}
                  </span>
                  <span className="font-black text-white/90">
                    ${Object.entries(nuevoOrdenCarrito).reduce((a, [id, qty]) => {
                      const p = platos.find(pl => pl.id === id)
                      return a + (p?.precio ?? 0) * qty
                    }, nuevoOrdenItemsMod.reduce((a, i) => a + i.plato.precio * i.cantidad, 0)).toLocaleString('es-CO')}
                  </span>
                </div>
              )}
              {nuevoOrdenItemsMod.length > 0 && (
                <div className="space-y-1.5">
                  {nuevoOrdenItemsMod.map(item => (
                    <div key={itemKey(item)} className="text-xs text-gray-400 bg-white/4 rounded-lg px-3 py-2">
                      <span className="font-bold text-white/70">{item.cantidad}x {item.plato.nombre}</span>
                      <span className="block">{item.modificadores.map(m => `${m.nombre_grupo}: ${m.nombre_opcion}`).join(' · ')}</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={tomarPedidoGerencia}
                disabled={tomandoPedido || (!Object.values(nuevoOrdenCarrito).some(v => v > 0) && nuevoOrdenItemsMod.length === 0)}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-900/30">
                {tomandoPedido
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando a cocina...</>
                  : <><ChefHat size={18} /> Enviar a cocina</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal editar usuario ── */}
      {editandoUsuario && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm fade-in space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Editar usuario</h3>
              <button onClick={() => setEditandoUsuario(null)}><X size={20} /></button>
            </div>

            {/* Nombre */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Nombre</label>
              <input
                type="text"
                value={editandoUsuario.nombre}
                onChange={e => setEditandoUsuario(p => p ? { ...p, nombre: e.target.value } : p)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-gray-50"
              />
            </div>

            {/* Rol */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Rol / Panel que verá</label>
              <select
                value={editandoUsuario.rol}
                onChange={e => setEditandoUsuario(p => p ? { ...p, rol: e.target.value } : p)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-gray-50">
                <option value="mesera">👩 Mesera — ve el panel de mesas y pedidos</option>
                <option value="cocina">👨‍🍳 Cocina — ve el panel de preparación</option>
                <option value="gerente">👔 Gerente — ve el panel completo</option>
                <option value="domi">🛵 Domi — ve el panel de domicilios</option>
              </select>
              <p className="text-xs text-gray-400 mt-1.5">⚠️ El cambio aplica la próxima vez que el usuario inicie sesión.</p>
            </div>

            {/* Nueva contraseña */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Nueva contraseña <span className="text-gray-400 font-normal">(dejar vacío para no cambiar)</span></label>
              <input
                type="password"
                value={editandoUsuario.nuevaPassword}
                onChange={e => setEditandoUsuario(p => p ? { ...p, nuevaPassword: e.target.value } : p)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 bg-gray-50"
              />
            </div>

            {/* Guardar nombre/rol/contraseña */}
            <button
              onClick={guardarCambiosUsuario}
              disabled={guardandoUsuario || !editandoUsuario.nombre.trim()}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl transition-colors">
              {guardandoUsuario ? 'Guardando...' : '💾 Guardar cambios'}
            </button>

            <div className="border-t pt-4 space-y-3">
              {/* Inhabilitar / Habilitar */}
              <button
                onClick={() => toggleActivoUsuario(editandoUsuario.id, editandoUsuario.activo)}
                className={`w-full font-bold py-3 rounded-xl transition-colors border-2 ${
                  editandoUsuario.activo
                    ? 'border-orange-400 text-orange-600 hover:bg-orange-50'
                    : 'border-green-500 text-green-600 hover:bg-green-50'
                }`}>
                {editandoUsuario.activo ? '🔒 Inhabilitar acceso' : '✅ Habilitar acceso'}
              </button>

              {/* Eliminar */}
              <button
                onClick={() => eliminarUsuario(editandoUsuario.id, editandoUsuario.nombre)}
                disabled={eliminandoUsuario}
                className="w-full bg-red-50 hover:bg-red-100 disabled:bg-white/8 border-2 border-red-300 text-red-600 font-bold py-3 rounded-xl transition-colors">
                {eliminandoUsuario ? 'Eliminando...' : '🗑️ Eliminar usuario definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



