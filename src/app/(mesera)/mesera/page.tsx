'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mesa, Plato, Categoria, Inventario } from '@/types'
import {
  ItemConModificadores,
  SeleccionModificadores,
  gruposDelPlato,
  consumoInventarioCarrito,
  hayConfigPendiente,
  itemKey,
  itemPedidoPayload,
  modificadoresPedidoPayload,
  seleccionAmodificadores,
  seleccionInicial,
  tieneModificadores,
  validarSeleccion,
} from '@/lib/modificadores'
import ConfigurarModificadoresPedido from '@/components/ConfigurarModificadoresPedido'
import toast from 'react-hot-toast'
import { UtensilsCrossed, ShoppingBag, Bell, CheckCircle, X, Plus, Minus, Bike, Search } from 'lucide-react'

type ItemCarrito = ItemConModificadores & { sinCargo?: boolean }

type ItemPedidoActual = {
  id: string
  estado: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado'
  cantidad: number
  notas: string | null
  precio_unitario: number
  plato: { nombre: string }
}

export default function MeseraPage() {
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [platos, setPlatos] = useState<(Plato & { inventario: Inventario[] })[]>([])
  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null)
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [notaGeneral, setNotaGeneral] = useState('')
  const [pedidosListos, setPedidosListos] = useState<{ id: string; mesa: number }[]>([])
  const [vista, setVista] = useState<'mesas' | 'menu' | 'carrito' | 'pedido'>('mesas')
  const [enviando, setEnviando] = useState(false)
  const [modoDomi, setModoDomi] = useState(false)
  const [domiCliente, setDomiCliente] = useState({ nombre: '', cedula: '', telefono: '', direccion: '' })
  const [platoConfig, setPlatoConfig] = useState<Plato | null>(null)
  const [seleccionMods, setSeleccionMods] = useState<SeleccionModificadores>({})
  const [configurandoComplementos, setConfigurandoComplementos] = useState(false)
  const [busquedaPlato, setBusquedaPlato] = useState('')
  const [componentePlatoIds, setComponentePlatoIds] = useState<Set<string>>(new Set())
  const [pedidoActualItems, setPedidoActualItems] = useState<ItemPedidoActual[]>([])
  const [verPedidoId, setVerPedidoId] = useState<string | null>(null)
  const verPedidoIdRef = useRef<string | null>(null)

  // Mesa ocupada — pedido existente
  const [modalMesaOcupada, setModalMesaOcupada] = useState(false)
  const [pedidoExistenteId, setPedidoExistenteId] = useState<string | null>(null)
  const [mesaTemporal, setMesaTemporal] = useState<Mesa | null>(null)

  // Llamadas de clientes
  const [llamadasPendientes, setLlamadasPendientes] = useState<{ id: number; mesa_numero: number }[]>([])

  // Notificaciones de cocina: un plato específico quedó listo
  const [notifsCocina, setNotifsCocina] = useState<{
    id: number; mesa_numero: number; plato_nombre: string; pendientes: string[]
  }[]>([])

  // ID del usuario actual (para filtrar notificaciones propias)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  // Ref para acceder al id en closures de realtime (evita stale closure)
  const usuarioIdRef = useRef<string | null>(null)
  // Plan e ID del negocio
  const [negocioPlan, setNegocioPlan] = useState<'starter' | 'basico' | 'pro'>('pro')
  const [negocioId, setNegocioId] = useState<string | null>(null)
  // plato_ids con inventario de turno configurado (solo estos tienen restricción de stock)
  const [turnoInventarioIds, setTurnoInventarioIds] = useState<Set<string>>(new Set())
  // true si al menos un plato tiene inventario de turno activo
  const turnoConInventario = turnoInventarioIds.size > 0

  const supabase = createClient()

  async function buscarClienteDomi(valor: string, campo: 'cedula' | 'telefono') {
    const limpio = valor.trim()
    if (limpio.replace(/\D/g, '').length < (campo === 'cedula' ? 5 : 7)) return
    let q = supabase.from('clientes').select('id, nombre, telefono, cedula').eq(campo, limpio)
    if (negocioId) q = q.eq('negocio_id', negocioId)
    const { data } = await q.maybeSingle()
    if (data) {
      setDomiCliente(p => ({
        ...p,
        nombre: data.nombre || p.nombre,
        telefono: data.telefono || p.telefono,
        cedula: data.cedula || p.cedula,
      }))
      toast.success(`Cliente encontrado: ${data.nombre}`)
    }
  }

  const cargarDatos = useCallback(async () => {
    const [{ data: mesasData }, { data: catData }, { data: platosData }, { data: invData }, { data: turnoData }, { data: modsData }, { data: compData }] = await Promise.all([
      supabase.from('mesas').select('*').order('numero'),
      supabase.from('categorias').select('*').order('orden'),
      supabase.from('platos').select('*').eq('activo', true).neq('visible_menu', false),
      supabase.from('inventario').select('*'),
      supabase.from('turnos').select('id, abierto_en').is('cerrado_en', null).order('abierto_en', { ascending: false }).limit(1).maybeSingle(),
      supabase
        .from('grupos_modificadores')
        .select('*, opciones:opciones_modificador(*, componente:platos(nombre))')
        .order('orden'),
      supabase.from('opciones_modificador').select('componente_plato_id').not('componente_plato_id', 'is', null),
    ])
    // IDs de platos que son complementarios de otros platos (normalmente sin cargo)
    setComponentePlatoIds(new Set((compData || []).map((r: { componente_plato_id: string }) => r.componente_plato_id)))
    // Cargar IDs de platos con inventario en el turno activo (para restricción por plato)
    let platoIdsConInv = new Set<string>()
    if (turnoData?.id) {
      const { data: tiData } = await supabase.from('turnos_inventario')
        .select('plato_id').eq('turno_id', turnoData.id)
      if (tiData && tiData.length > 0) {
        platoIdsConInv = new Set(tiData.map((r: { plato_id: string }) => r.plato_id))
      }
    }
    setTurnoInventarioIds(platoIdsConInv)
    if (mesasData) setMesas(mesasData)
    if (catData) { setCategorias(catData); if (!categoriaActiva && catData[0]) setCategoriaActiva(catData[0].id) }
    if (platosData) {
      const modsPorPlato = new Map<string, unknown[]>()
      ;((modsData || []) as { plato_id: string }[]).forEach(g => {
        modsPorPlato.set(g.plato_id, [...(modsPorPlato.get(g.plato_id) || []), g])
      })
      // Usar inventario.cantidad_disponible de la BD directamente — los triggers de BD
      // (trigger_descontar_inventario y trigger_descontar_inventario_modificador) lo mantienen
      // actualizado para platos directos Y complementarios via modificadores.
      const invMap = new Map<string, number>()
      ;(invData || []).forEach((i: Inventario) => { invMap.set(i.plato_id, i.cantidad_disponible) })
      const platosConInv = platosData.map(p => ({
        ...p,
        inventario: platoIdsConInv.has(p.id)
          ? [{ plato_id: p.id, cantidad_disponible: invMap.get(p.id) ?? 0 }]
          : (invData || []).filter((i: Inventario) => i.plato_id === p.id),
        modificadores: (modsPorPlato.get(p.id) || []).map((grupo: unknown) => {
          const g = grupo as { id: string; opciones: { componente_plato_id: string | null; descuenta_inventario: boolean; activo: boolean }[] }
          return {
            ...g,
            opciones: (g.opciones || []).map(op => {
              if (!op.descuenta_inventario || !op.componente_plato_id) return op
              const stock = invMap.get(op.componente_plato_id)
              if (stock !== undefined && stock <= 0) return { ...op, activo: false }
              return op
            }),
          }
        }),
      }))
      setPlatos(platosConInv as unknown as (Plato & { inventario: Inventario[] })[])
    }
  }, [supabase, categoriaActiva])

  const cargarPedidoActual = useCallback(async (pedidoId: string) => {
    const { data } = await supabase
      .from('items_pedido')
      .select('id, estado, cantidad, notas, precio_unitario, plato:platos(nombre)')
      .eq('pedido_id', pedidoId)
      .order('created_at')
    if (data) setPedidoActualItems(data as unknown as ItemPedidoActual[])
  }, [supabase])

  const cargarPedidosListos = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('id, mesa:mesas(numero)')
      .eq('estado', 'listo')
    if (data) {
      setPedidosListos(data.map((p: unknown) => {
        const ped = p as { id: string; mesa: { numero: number } }
        return { id: ped.id, mesa: ped.mesa?.numero }
      }))
    }
  }, [supabase])

  useEffect(() => {
    // Cargar el id del usuario actual una sola vez
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUsuarioId(data.user.id)
        usuarioIdRef.current = data.user.id  // accesible en closures de realtime
      }
    })
    // Cargar plan e ID del negocio
    supabase.from('negocios').select('id, plan').single().then(({ data }) => {
      if (data?.plan) setNegocioPlan(data.plan as 'starter' | 'basico' | 'pro')
      if (data?.id) setNegocioId(data.id)
    })
    cargarDatos()
    cargarPedidosListos()
    const canal = supabase.channel('mesera-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, cargarDatos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        cargarPedidosListos(); cargarDatos()
      })
      // Notificación plato a plato cuando cocina marca listo (items_pedido ya está en realtime pub)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items_pedido' }, (payload) => {
        const item = payload.new as { id: string; estado: string; pedido_id: string }
        // Actualizar vista "Ver pedido actual" si estamos viendo este pedido
        if (verPedidoIdRef.current && item.pedido_id === verPedidoIdRef.current) {
          cargarPedidoActual(verPedidoIdRef.current)
        }
        if (item.estado !== 'listo') return

        supabase
          .from('pedidos')
          .select('mesera_id, tipo, mesa:mesas(numero), items:items_pedido(id, estado, plato:platos(nombre))')
          .eq('id', item.pedido_id)
          .maybeSingle()
          .then(({ data: pedido }) => {
            if (!pedido) return
            const p = pedido as unknown as {
              mesera_id: string | null; tipo: string
              mesa: { numero: number } | null
              items: { id: string; estado: string; plato: { nombre: string } }[]
            }
            if (!p.mesa || p.tipo === 'domi') return
            // Solo a la mesera que tomó el pedido (ref evita stale closure)
            if (p.mesera_id && usuarioIdRef.current && p.mesera_id !== usuarioIdRef.current) return

            // Plato que acaba de quedar listo
            const itemListo = p.items.find(i => i.id === item.id)
            const platoNombre = itemListo?.plato?.nombre ?? 'Plato'

            // Platos que SIGUEN pendientes (excluir el que acaba de quedar listo)
            const pendientes = p.items
              .filter(i => i.id !== item.id && (i.estado === 'pendiente' || i.estado === 'en_preparacion'))
              .map(i => i.plato.nombre)

            const notifId = Date.now()
            setNotifsCocina(prev => [...prev, {
              id: notifId,
              mesa_numero: p.mesa!.numero,
              plato_nombre: platoNombre,
              pendientes,
            }])
            setTimeout(() => setNotifsCocina(prev => prev.filter(n => n.id !== notifId)), 30000)
          })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario' }, cargarDatos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_inventario' }, cargarDatos)
      .subscribe()

    // Polling de respaldo cada 20 s (por si algún evento realtime no llega)
    const intervalo = setInterval(() => { cargarDatos(); cargarPedidosListos() }, 20000)

    return () => {
      supabase.removeChannel(canal)
      clearInterval(intervalo)
    }
  }, [cargarDatos, cargarPedidosListos, cargarPedidoActual, supabase])

  // ── SELECCIONAR MESA ─────────────────────────────────────────
  async function seleccionarMesa(mesa: Mesa) {
    if (mesa.estado === 'ocupada' || mesa.estado === 'esperando_pago') {
      // Buscar pedido activo de esta mesa
      const { data: pedidoActivo } = await supabase
        .from('pedidos')
        .select('id')
        .eq('mesa_id', mesa.id)
        .in('estado', ['pendiente', 'en_preparacion', 'listo', 'entregado'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (pedidoActivo) {
        setMesaTemporal(mesa)
        setPedidoExistenteId(pedidoActivo.id)
        setModalMesaOcupada(true)
        return
      }
    }
    // Mesa libre o sin pedido activo — flujo normal
    setMesaSeleccionada(mesa)
    setPedidoExistenteId(null)
    setCarrito([])
    setVista('menu')
  }

  function confirmarAgregarAPedido() {
    setMesaSeleccionada(mesaTemporal)
    setModalMesaOcupada(false)
    setCarrito([])
    setVista('menu')
  }

  function confirmarNuevoPedido() {
    setMesaSeleccionada(mesaTemporal)
    setPedidoExistenteId(null)
    setModalMesaOcupada(false)
    setCarrito([])
    setVista('menu')
  }

  function disponibilidadPlato(plato: Plato & { inventario: Inventario[] }): number {
    if (!turnoInventarioIds.has(plato.id)) return 0
    return plato.inventario?.[0]?.cantidad_disponible ?? 0
  }

  function stockDisponible(plato: Plato): number | null {
    // Solo aplica restricción si el plato está en el inventario del turno ACTUAL
    if (!turnoInventarioIds.has(plato.id)) return null
    const inv = (plato as Plato & { inventario?: Inventario[] }).inventario
    return inv?.[0]?.cantidad_disponible ?? null
  }

  function cantidadEnCarrito(platoId: string) {
    return carrito.filter(i => i.plato.id === platoId).reduce((total, i) => total + i.cantidad, 0)
  }

  function stockDisponiblePorId(platoId: string): number | null {
    // Solo aplica restricción si el plato está en el inventario del turno ACTUAL
    if (!turnoInventarioIds.has(platoId)) return null
    const plato = platos.find(p => p.id === platoId)
    return plato?.inventario?.[0]?.cantidad_disponible ?? null
  }

  function validarConsumo(items: ItemCarrito[]) {
    const consumo = consumoInventarioCarrito(items)
    for (const [platoId, cantidad] of consumo.entries()) {
      const disp = stockDisponiblePorId(platoId)
      if (disp !== null && cantidad > disp) {
        const nombre = platos.find(p => p.id === platoId)?.nombre || 'este producto'
        return `Solo hay ${disp} unidad(es) de ${nombre}`
      }
    }
    return null
  }

  function agregarItem(item: ItemCarrito) {
    const disp = stockDisponible(item.plato)
    const key = itemKey(item)
    const errorConsumo = validarConsumo([...carrito, item])
    if (errorConsumo) { toast.error(errorConsumo); return }
    if (disp !== null) {
      if (disp === 0) { toast.error(`${item.plato.nombre} no está disponible`); return }
      const enCarrito = cantidadEnCarrito(item.plato.id)
      if (enCarrito >= disp) { toast.error(`Solo hay ${disp} unidad(es) de ${item.plato.nombre}`); return }
    }
    const sinCargo = item.sinCargo ?? false
    setCarrito(prev => {
      const existe = prev.find(i => itemKey(i) === key)
      if (existe) return prev.map(i => itemKey(i) === key ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { ...item, sinCargo }]
    })
    toast.success(`${item.plato.nombre} agregado`)
  }

  function toggleSinCargo(key: string) {
    setCarrito(prev => prev.map(i => itemKey(i) === key ? { ...i, sinCargo: !i.sinCargo } : i))
  }

  function agregarAlCarrito(plato: Plato) {
    if (tieneModificadores(plato)) {
      setPlatoConfig(plato)
      setSeleccionMods({})
      return
    }
    agregarItem({ plato, cantidad: 1, notas: '', modificadores: [] })
  }

  function confirmarPlatoConfigurado() {
    if (!platoConfig) return
    const error = validarSeleccion(platoConfig, seleccionMods)
    if (error) { toast.error(error); return }
    agregarItem({
      plato: platoConfig,
      cantidad: 1,
      notas: '',
      modificadores: seleccionAmodificadores(platoConfig, seleccionMods),
    })
    setPlatoConfig(null)
    setSeleccionMods({})
  }

  function cambiarCantidad(key: string, delta: number) {
    const itemActual = carrito.find(i => itemKey(i) === key)
    if (delta > 0 && itemActual) {
      const disp = stockDisponible(itemActual.plato)
      if (disp !== null && cantidadEnCarrito(itemActual.plato.id) >= disp) { toast.error('No hay mas unidades disponibles'); return }
    }
    setCarrito(prev => prev
      .map(i => itemKey(i) === key ? { ...i, cantidad: Math.max(0, i.cantidad + delta) } : i)
      .filter(i => i.cantidad > 0)
    )
  }

  function actualizarNota(key: string, nota: string) {
    setCarrito(prev => prev.map(i => itemKey(i) === key ? { ...i, notas: nota } : i))
  }

  function iniciarDomi() {
    setModoDomi(true)
    setMesaSeleccionada(null)
    setPedidoExistenteId(null)
    setCarrito([])
    setDomiCliente({ nombre: '', cedula: '', telefono: '', direccion: '' })
    setVista('menu')
  }

  async function enviarPedido() {
    if (!modoDomi && !mesaSeleccionada) return
    if (carrito.length === 0) return
    if (modoDomi && !domiCliente.nombre.trim()) { toast.error('El nombre del cliente es obligatorio para domicilios'); return }
    if (hayConfigPendiente(carrito)) { setConfigurandoComplementos(true); return }
    setEnviando(true)

    const { data: { user } } = await supabase.auth.getUser()

    // Asegurar que tenemos el negocio_id antes de crear el pedido
    let myNegocioId = negocioId
    if (!myNegocioId) {
      const { data: neg } = await supabase.from('negocios').select('id').single()
      myNegocioId = neg?.id ?? null
      if (myNegocioId) setNegocioId(myNegocioId)
    }

    // ── VERIFICACIÓN DE STOCK EN DB (previene sobre-pedidos por estado local desactualizado) ──
    // Verificaci?n r?pida del plato principal. Los modificadores se descuentan por trigger estructurado.
    const errorConsumo = validarConsumo(carrito)
    if (errorConsumo) {
      toast.error(errorConsumo, { duration: 5000 })
      await cargarDatos()
      setEnviando(false)
      return
    }

    let clienteDomiId: string | null = null
    if (modoDomi && (domiCliente.cedula.trim() || domiCliente.telefono.trim())) {
      const campo = domiCliente.cedula.trim() ? 'cedula' : 'telefono'
      const valor = domiCliente.cedula.trim() || domiCliente.telefono.trim()
      let q = supabase.from('clientes').select('id').eq(campo, valor)
      if (myNegocioId) q = q.eq('negocio_id', myNegocioId)
      const { data: cl } = await q.maybeSingle()
      if (cl?.id) clienteDomiId = cl.id
      else {
        const { data: nuevo } = await supabase.from('clientes').insert({
          nombre: domiCliente.nombre.trim(),
          cedula: domiCliente.cedula.trim() || null,
          telefono: domiCliente.telefono.trim() || null,
          ...(myNegocioId ? { negocio_id: myNegocioId } : {}),
        }).select('id').single()
        clienteDomiId = nuevo?.id || null
      }
    }

    async function insertarItemsPedido(pedidoId: string) {
      for (const item of carrito) {
        const payload = itemPedidoPayload(item, pedidoId, user?.id)
        if (item.sinCargo) payload.precio_unitario = 0
        const { data: itemCreado, error: itemError } = await supabase
          .from('items_pedido')
          .insert(payload)
          .select('id')
          .single()

        if (itemError || !itemCreado?.id) return itemError || new Error('No se pudo crear item')

        const mods = modificadoresPedidoPayload(itemCreado.id, item)
        if (mods.length > 0) {
          const { error: modsError } = await supabase.from('items_pedido_modificadores').insert(mods)
          if (modsError) return modsError
        }
      }
      return null
    }


    if (pedidoExistenteId) {
      // ── AGREGAR A PEDIDO EXISTENTE ──────────────────────────
      const error = await insertarItemsPedido(pedidoExistenteId)
      if (error) { toast.error('Error al agregar platos'); setEnviando(false); return }
      await supabase.from('pedidos').update({ estado: 'en_preparacion' }).eq('id', pedidoExistenteId)
      toast.success('¡Platos agregados al pedido!')
    } else {
      // ── PEDIDO NUEVO (mesa o domi) ──────────────────────────
      const { data: turno } = await supabase
        .from('turnos').select('id').is('cerrado_en', null)
        .order('abierto_en', { ascending: false }).limit(1).single()

      if (!turno) { toast.error('No hay turno abierto. El gerente debe abrir caja primero.'); setEnviando(false); return }

      const { data: pedido, error } = await supabase
        .from('pedidos')
        .insert({
          mesa_id: modoDomi ? null : mesaSeleccionada!.id,
          mesera_id: user?.id,
          turno_id: turno.id,
          tipo: modoDomi ? 'domi' : 'mesera',
          notas: notaGeneral || null,
          cliente_id: modoDomi ? clienteDomiId : null,
          cliente_nombre: modoDomi ? domiCliente.nombre.trim() : null,
          cliente_cedula: modoDomi && domiCliente.cedula ? domiCliente.cedula.trim() : null,
          cliente_telefono: modoDomi && domiCliente.telefono ? domiCliente.telefono.trim() : null,
          cliente_direccion: modoDomi && domiCliente.direccion ? domiCliente.direccion.trim() : null,
          ...(myNegocioId ? { negocio_id: myNegocioId } : {}),
        })
        .select().single()

      if (error || !pedido) { toast.error('Error al enviar el pedido'); setEnviando(false); return }

      const itemsError = await insertarItemsPedido(pedido.id)
      if (itemsError) { toast.error('Error al enviar platos'); setEnviando(false); return }
      if (!modoDomi && mesaSeleccionada) {
        await supabase.from('mesas').update({ estado: 'ocupada' }).eq('id', mesaSeleccionada.id)
      }
      toast.success(modoDomi ? '¡Domi enviado a cocina! 🛵' : '¡Pedido enviado a cocina!')
    }

    setCarrito([])
    setNotaGeneral('')
    setMesaSeleccionada(null)
    setPedidoExistenteId(null)
    setModoDomi(false)
    setDomiCliente({ nombre: '', cedula: '', telefono: '', direccion: '' })
    setVista('mesas')
    cargarDatos()
    setEnviando(false)
  }

  async function marcarEntregado(pedidoId: string) {
    await supabase.from('pedidos').update({ estado: 'entregado' }).eq('id', pedidoId)
    toast.success('Pedido marcado como entregado')
    cargarPedidosListos()
  }

  const busq = busquedaPlato.trim().toLowerCase()
  const platosFiltrados = (busq
    ? platos.filter(p => p.nombre.toLowerCase().includes(busq) || (p.descripcion || '').toLowerCase().includes(busq))
    : platos.filter(p => p.categoria_id === categoriaActiva)
  ).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const totalCarrito = carrito.reduce((acc, i) => acc + (i.sinCargo ? 0 : i.plato.precio * i.cantidad), 0)
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

  // Paleta de tonos suaves por zona (se asigna por índice)
  const ZONA_TONOS = [
    { fondo: 'bg-sky-50',    borde: 'border-sky-100',    titulo: 'text-sky-700',    badge: 'bg-sky-100' },
    { fondo: 'bg-violet-50', borde: 'border-violet-100', titulo: 'text-violet-700', badge: 'bg-violet-100' },
    { fondo: 'bg-emerald-50',borde: 'border-emerald-100',titulo: 'text-emerald-700',badge: 'bg-emerald-100' },
    { fondo: 'bg-amber-50',  borde: 'border-amber-100',  titulo: 'text-amber-700',  badge: 'bg-amber-100' },
    { fondo: 'bg-rose-50',   borde: 'border-rose-100',   titulo: 'text-rose-700',   badge: 'bg-rose-100' },
    { fondo: 'bg-teal-50',   borde: 'border-teal-100',   titulo: 'text-teal-700',   badge: 'bg-teal-100' },
  ]
  const zonasLista = [...new Set(mesas.map(m => m.zona || 'Sin zona'))].sort((a, b) =>
    a === 'Sin zona' ? 1 : b === 'Sin zona' ? -1 : a.localeCompare(b, 'es')
  )

  // ── VISTA: MESAS ─────────────────────────────────────────────
  if (vista === 'mesas') return (
    <div className="min-h-screen bg-gray-950">
      {modalConfigPedido}

      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-md border-b border-gray-800 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <UtensilsCrossed size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Mesas</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <p className="text-gray-500 text-xs">En tiempo real</p>
              </div>
            </div>
          </div>
          <button onClick={() => {
              if (negocioPlan === 'starter') {
                toast('🔒 Domicilios disponible desde el Plan Profesional', { icon: '⬆️' }); return
              }
              iniciarDomi()
            }}
            className={`flex items-center gap-2 font-bold px-4 py-2.5 rounded-xl text-sm transition-all
              ${negocioPlan === 'starter'
                ? 'bg-gray-800 text-gray-600 cursor-default border border-gray-700'
                : 'bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-900/30'}`}>
            <Bike size={18} /> Domi
            {negocioPlan === 'starter' && <span className="text-xs">🔒</span>}
          </button>
        </div>

        {/* Stats chips + leyenda */}
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          <div className="flex items-center gap-1.5 bg-gray-800/60 border border-gray-700 rounded-lg px-2.5 py-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-[11px] font-semibold text-gray-400">Libre</span>
          </div>
          <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/25 rounded-lg px-2.5 py-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-[11px] font-semibold text-orange-400">Ocupada</span>
          </div>
          <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/25 rounded-lg px-2.5 py-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-[11px] font-semibold text-yellow-400">Cobrando</span>
          </div>
          {pedidosListos.length > 0 && (
            <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 rounded-lg px-2.5 py-1.5 shrink-0 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[11px] font-bold text-green-400">{pedidosListos.length} listo{pedidosListos.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 pb-8 space-y-3">
        {/* Pedidos listos para entregar */}
        {pedidosListos.length > 0 && (
          <div className="space-y-2">
            {pedidosListos.map(p => (
              <div key={p.id} className="bg-green-500/10 border-2 border-green-500/40 text-green-300 rounded-2xl p-3.5 flex items-center justify-between fade-in"
                style={{ boxShadow: '0 0 16px rgba(34,197,94,0.1)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <Bell size={16} className="text-green-400 animate-bounce" />
                  </div>
                  <span className="font-bold text-sm">¡Mesa {p.mesa} lista para recoger!</span>
                </div>
                <button onClick={() => marcarEntregado(p.id)}
                  className="bg-green-500 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-green-400 transition-colors">
                  ✓ Entregado
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Notificaciones de cocina */}
        {notifsCocina.length > 0 && (
          <div className="space-y-2">
            {notifsCocina.map(notif => (
              <div key={notif.id} className="bg-orange-500/10 border-2 border-orange-500/30 rounded-2xl px-4 py-3 flex items-start justify-between gap-3 fade-in">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-orange-300">
                    🍽️ <span className="text-white">{notif.plato_nombre}</span> — Mesa {notif.mesa_numero} listo
                  </p>
                  {notif.pendientes.length > 0 ? (
                    <p className="text-xs text-orange-400 font-semibold mt-1">⏳ Faltan: {notif.pendientes.join(', ')}</p>
                  ) : (
                    <p className="text-xs text-green-400 font-semibold mt-1">✅ ¡Pedido completo! Puedes recoger todo</p>
                  )}
                </div>
                <button onClick={() => setNotifsCocina(prev => prev.filter(n => n.id !== notif.id))}
                  className="text-gray-600 hover:text-gray-400 shrink-0 mt-0.5">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Mesas por zona */}
        <div className="space-y-4">
          {zonasLista.map((zona, idx) => {
            const mesasZona = mesas
              .filter(m => (m.zona || 'Sin zona') === zona)
              .sort((a, b) => a.numero - b.numero)
            const libres   = mesasZona.filter(m => m.estado === 'libre').length
            const ocupadas = mesasZona.filter(m => m.estado === 'ocupada').length
            return (
              <div key={zona} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{zona}</p>
                  <div className="flex gap-2 text-[10px]">
                    {ocupadas > 0 && <span className="text-orange-400 font-bold">{ocupadas} ocupada{ocupadas > 1 ? 's' : ''}</span>}
                    {libres > 0   && <span className="text-gray-600 font-semibold">{libres} libre{libres > 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {mesasZona.map(mesa => (
                    <button key={mesa.id} onClick={() => seleccionarMesa(mesa)}
                      className={`rounded-2xl py-4 px-2 text-center font-bold transition-all border-2 active:scale-95 ${
                        mesa.estado === 'libre'
                          ? 'bg-gray-800/60 border-gray-700 hover:border-orange-500/60 hover:bg-gray-800'
                          : mesa.estado === 'ocupada'
                          ? 'bg-orange-500/10 border-orange-500/40 hover:border-orange-500'
                          : 'bg-yellow-500/10 border-yellow-500/40 hover:border-yellow-400'
                      }`}
                      style={
                        mesa.estado === 'ocupada'
                          ? { boxShadow: '0 0 12px rgba(249,115,22,0.08)' }
                          : {}
                      }>
                      <p className={`text-2xl font-black leading-none mb-1.5 ${
                        mesa.estado === 'libre' ? 'text-gray-500' :
                        mesa.estado === 'ocupada' ? 'text-orange-400' : 'text-yellow-400'
                      }`}>{mesa.numero}</p>
                      <p className={`text-[10px] font-bold leading-none ${
                        mesa.estado === 'libre' ? 'text-gray-600' :
                        mesa.estado === 'ocupada' ? 'text-orange-500/80' : 'text-yellow-500/80'
                      }`}>
                        {mesa.estado === 'libre' ? 'Libre' : mesa.estado === 'ocupada' ? 'Ocupada' : 'Cobrando'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── POPUP: Llamada de cliente ── */}
      {llamadasPendientes.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl p-8 w-full max-w-xs text-center shadow-2xl fade-in">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell size={40} className="text-orange-500 animate-bounce" />
            </div>
            <p className="text-2xl font-black text-gray-900 mb-1">¡Llamada!</p>
            <p className="text-gray-500 mb-1 text-base">
              Mesa <span className="font-black text-gray-900 text-2xl">{llamadasPendientes[0].mesa_numero}</span>
            </p>
            <p className="text-gray-400 text-sm mb-6">El cliente te necesita</p>
            {llamadasPendientes.length > 1 && (
              <p className="text-xs text-orange-500 font-semibold mb-4">
                +{llamadasPendientes.length - 1} llamada{llamadasPendientes.length - 1 > 1 ? 's' : ''} más en espera
              </p>
            )}
            <button
              onClick={async () => {
                const llamadaId = llamadasPendientes[0].id
                setLlamadasPendientes(prev => prev.slice(1))
                await supabase.from('llamadas').update({ atendida: true }).eq('id', llamadaId)
              }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl text-lg transition-colors"
            >
              ✓ Atender
            </button>
          </div>
        </div>
      )}

      {/* Modal mesa ocupada */}
      {modalMesaOcupada && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm fade-in">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-lg">Mesa {mesaTemporal?.numero}</h3>
              <button onClick={() => setModalMesaOcupada(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <p className="text-gray-500 text-sm mb-5">Esta mesa ya tiene un pedido activo. ¿Qué deseas hacer?</p>
            <div className="space-y-3">
              <button onClick={() => {
                  if (!pedidoExistenteId) return
                  setModalMesaOcupada(false)
                  setMesaSeleccionada(mesaTemporal)
                  verPedidoIdRef.current = pedidoExistenteId
                  setVerPedidoId(pedidoExistenteId)
                  cargarPedidoActual(pedidoExistenteId)
                  setVista('pedido')
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2">
                👁 Ver pedido actual
              </button>
              <button onClick={confirmarAgregarAPedido}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2">
                <Plus size={18} /> Agregar platos al pedido actual
              </button>
              <button onClick={confirmarNuevoPedido}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-xl">
                Crear pedido nuevo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── VISTA: MENÚ ──────────────────────────────────────────────
  if (vista === 'menu') return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {modalConfigPedido}
      {/* Header */}
      <div className="bg-gray-950/95 backdrop-blur-md border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => { setVista('mesas'); setCarrito([]); setModoDomi(false) }}
            className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
          <div>
            {modoDomi ? (
              <div className="flex items-center gap-2">
                <span className="bg-orange-500 text-white text-xs font-black px-2.5 py-1 rounded-lg">🛵 DOMI</span>
              </div>
            ) : (
              <h2 className="font-black text-white text-base">Mesa {mesaSeleccionada?.numero}</h2>
            )}
            {pedidoExistenteId && (
              <button
                onClick={() => {
                  verPedidoIdRef.current = pedidoExistenteId
                  setVerPedidoId(pedidoExistenteId)
                  cargarPedidoActual(pedidoExistenteId)
                  setVista('pedido')
                }}
                className="text-[11px] text-indigo-400 font-bold leading-none mt-0.5 underline underline-offset-2">
                👁 Ver pedido actual
              </button>
            )}
          </div>
        </div>
        <button onClick={() => setVista('carrito')}
          className="relative bg-orange-500 hover:bg-orange-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-orange-900/30">
          <ShoppingBag size={16} />
          {carrito.reduce((a, i) => a + i.cantidad, 0) > 0
            ? `Ver pedido (${carrito.reduce((a, i) => a + i.cantidad, 0)})`
            : 'Ver pedido'}
          {carrito.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold animate-bounce">
              {carrito.length}
            </span>
          )}
        </button>
      </div>

      {/* Buscador */}
      <div className="px-4 pt-3 pb-1 bg-gray-900/60 border-b border-gray-800 shrink-0">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={busquedaPlato}
            onChange={e => setBusquedaPlato(e.target.value)}
            placeholder="Buscar plato..."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-9 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
          />
          {busquedaPlato && (
            <button onClick={() => setBusquedaPlato('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Categorías */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-gray-900/60 border-b border-gray-800 shrink-0">
        {categorias.map(cat => (
          <button key={cat.id} onClick={() => { setCategoriaActiva(cat.id); setBusquedaPlato('') }}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              categoriaActiva === cat.id && !busquedaPlato
                ? 'bg-orange-500 text-white shadow-md shadow-orange-900/30'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}>
            {cat.nombre}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 space-y-2.5">
        {busquedaPlato && platosFiltrados.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-8">Sin resultados para &ldquo;{busquedaPlato}&rdquo;</p>
        )}
        {platosFiltrados.map(plato => {
          const disp        = disponibilidadPlato(plato)
          // Solo restringir si este plato específico está en el inventario del turno
          // Y tiene un registro visible de inventario (si RLS lo oculta, no bloqueamos)
          const enTurnoInv  = turnoInventarioIds.has(plato.id)
          const hasInvRec   = (plato.inventario?.length ?? 0) > 0
          const sinStock    = enTurnoInv && hasInvRec && disp === 0
          const stockBajo   = enTurnoInv && hasInvRec && disp > 0 && disp <= (plato.inventario?.[0]?.alerta_minima ?? 3)
          const requiereConfig = tieneModificadores(plato)
          const enCarrito = requiereConfig ? null : carrito.find(i => i.plato.id === plato.id)
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
                ? <img src={plato.imagen_url} alt={plato.nombre} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                : <div className="w-16 h-16 rounded-xl bg-gray-800 flex items-center justify-center text-2xl shrink-0">🍽️</div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate text-sm">{plato.nombre}</p>
                {plato.descripcion && <p className="text-xs text-gray-500 truncate mt-0.5">{plato.descripcion}</p>}
                <p className="text-orange-400 font-black mt-1 text-sm">${plato.precio.toLocaleString('es-CO')}</p>
                {sinStock  && <p className="text-red-400 text-xs font-bold mt-0.5">Sin disponibilidad</p>}
                {stockBajo && <p className="text-amber-400 text-xs font-bold mt-0.5">⚠️ Quedan {disp}</p>}
                {enTurnoInv && hasInvRec && !sinStock && !stockBajo && (
                  <p className="text-green-400 text-xs font-semibold mt-0.5">{disp} disponibles</p>
                )}
              </div>
              {!sinStock && (
                enCarrito ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => cambiarCantidad(itemKey(enCarrito), -1)}
                      className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-white transition-colors">
                      <Minus size={14} />
                    </button>
                    <span className="font-black text-white w-5 text-center">{enCarrito.cantidad}</span>
                    <button onClick={() => cambiarCantidad(itemKey(enCarrito), 1)}
                      className="w-8 h-8 bg-orange-500 hover:bg-orange-400 text-white rounded-full flex items-center justify-center transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => agregarAlCarrito(plato)}
                    className="w-10 h-10 bg-orange-500 hover:bg-orange-400 active:scale-90 text-white rounded-full flex items-center justify-center transition-all shadow-md shadow-orange-900/30 shrink-0">
                    <Plus size={20} />
                  </button>
                )
              )}
            </div>
          )
        })}
        {platosFiltrados.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-sm">No hay platos en esta categoría</p>
          </div>
        )}
      </div>

      {platoConfig && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[88vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-gray-900 text-lg">Configurar {platoConfig.nombre}</h3>
                <p className="text-xs text-gray-500">Quitar sopa o acompañantes no modifica el precio del plato.</p>
              </div>
              <button onClick={() => setPlatoConfig(null)} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                <X size={18} />
              </button>
            </div>

            {gruposDelPlato(platoConfig).map(grupo => {
              const seleccion = seleccionMods[grupo.id] || new Set<string>()
              const opcionesActivas = grupo.opciones.filter(o => !o.es_opcion_no_aplica)
              const todos = opcionesActivas.length > 0 && opcionesActivas.every(o => seleccion.has(o.id))
              return (
                <div key={grupo.id} className="space-y-2">
                  <p className="text-sm font-black text-gray-900">{grupo.nombre}</p>
                  {grupo.tipo === 'checkbox' && grupo.tiene_opcion_todos && (
                    <label className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900">
                      <input
                        type="checkbox"
                        checked={todos}
                        onChange={e => setSeleccionMods(prev => ({
                          ...prev,
                          [grupo.id]: new Set(e.target.checked ? opcionesActivas.map(o => o.id) : []),
                        }))}
                      />
                      Todos los acompañantes
                    </label>
                  )}
                  <div className="space-y-2">
                    {grupo.opciones.map(opcion => (
                      <label key={opcion.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800">
                        <input
                          type={grupo.tipo === 'radio' ? 'radio' : 'checkbox'}
                          name={grupo.id}
                          checked={seleccion.has(opcion.id)}
                          onChange={e => setSeleccionMods(prev => {
                            const next = new Set(prev[grupo.id] || [])
                            if (grupo.tipo === 'radio') return { ...prev, [grupo.id]: new Set([opcion.id]) }
                            const opcionNoAplica = grupo.opciones.find(o => o.es_opcion_no_aplica)
                            if (opcion.es_opcion_no_aplica) return { ...prev, [grupo.id]: new Set([opcion.id]) }
                            if (e.target.checked) {
                              if (opcionNoAplica) next.delete(opcionNoAplica.id)
                              next.add(opcion.id)
                            }
                            else next.delete(opcion.id)
                            return { ...prev, [grupo.id]: next }
                          })}
                        />
                        <span>{opcion.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}

            <button onClick={confirmarPlatoConfigurado} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-xl transition-colors">
              Confirmar plato
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // ── VISTA: PEDIDO ACTUAL ─────────────────────────────────────
  if (vista === 'pedido') {
    const ESTADOS: Record<string, { label: string; dot: string; bg: string; text: string; order: number }> = {
      en_preparacion: { label: 'En cocina',        dot: 'bg-orange-500', bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-300', order: 1 },
      pendiente:      { label: 'Enviado',           dot: 'bg-gray-500',   bg: 'bg-gray-800/60 border-gray-700',       text: 'text-gray-400',   order: 2 },
      listo:          { label: 'Listo para recoger',dot: 'bg-green-500',  bg: 'bg-green-500/10 border-green-500/30',  text: 'text-green-300',  order: 0 },
      entregado:      { label: 'Entregado',         dot: 'bg-gray-600',   bg: 'bg-gray-900/60 border-gray-800',       text: 'text-gray-600',   order: 3 },
    }
    const ordenado = [...pedidoActualItems].sort((a, b) => (ESTADOS[a.estado]?.order ?? 9) - (ESTADOS[b.estado]?.order ?? 9))
    const totalPedido = pedidoActualItems.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
    const hayListos    = pedidoActualItems.some(i => i.estado === 'listo')
    const todosEntregados = pedidoActualItems.length > 0 && pedidoActualItems.every(i => i.estado === 'entregado')

    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        {/* Header */}
        <div className="bg-gray-950/95 backdrop-blur-md border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => { verPedidoIdRef.current = null; setVerPedidoId(null); setVista('mesas') }}
            className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-white text-base">Mesa {mesaSeleccionada?.numero} — Pedido actual</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Se actualiza en tiempo real</p>
          </div>
          <button onClick={() => cargarPedidoActual(verPedidoId!)}
            className="text-xs text-gray-500 hover:text-white font-semibold px-2 py-1 rounded-lg bg-gray-800 transition-colors">
            ↻
          </button>
        </div>

        {/* Resumen de estado */}
        {pedidoActualItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">Cargando...</div>
        ) : (
          <div className="flex-1 p-4 space-y-2 pb-32">
            {todosEntregados && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-4 py-3 text-center">
                <p className="text-green-400 font-black text-sm">✅ Todo entregado</p>
              </div>
            )}
            {hayListos && !todosEntregados && (
              <div className="bg-green-500/10 border-2 border-green-500/40 rounded-2xl px-4 py-3 flex items-center gap-3 animate-pulse">
                <Bell size={18} className="text-green-400 shrink-0" />
                <p className="text-green-300 font-black text-sm">¡Hay platos listos para recoger!</p>
              </div>
            )}

            {ordenado.map(item => {
              const est = ESTADOS[item.estado] ?? ESTADOS.pendiente
              return (
                <div key={item.id} className={`border rounded-2xl px-4 py-3 flex items-start gap-3 ${est.bg}`}>
                  <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${est.dot} ${item.estado === 'listo' ? 'animate-pulse' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm leading-snug">
                      {item.cantidad > 1 ? <span className="text-gray-400 mr-1">{item.cantidad}×</span> : null}
                      {item.plato.nombre}
                    </p>
                    {item.notas && <p className="text-gray-500 text-xs mt-0.5 truncate">📝 {item.notas}</p>}
                  </div>
                  <span className={`text-xs font-black shrink-0 mt-0.5 ${est.text}`}>{est.label}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="fixed bottom-0 left-0 right-0 bg-gray-950/95 backdrop-blur-md border-t border-gray-800 p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm font-medium">Total del pedido</span>
            <span className="text-white font-black">${totalPedido.toLocaleString('es-CO')}</span>
          </div>
          <button onClick={() => {
              verPedidoIdRef.current = null; setVerPedidoId(null)
              setCarrito([]); confirmarAgregarAPedido()
            }}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors">
            <Plus size={18} /> Agregar más platos
          </button>
        </div>
      </div>
    )
  }

  // ── VISTA: CARRITO ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {modalConfigPedido}
      <div className="bg-gray-950/95 backdrop-blur-md border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => setVista('menu')}
          className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors">
          <X size={18} />
        </button>
        <div>
          {modoDomi ? (
            <div className="flex items-center gap-2">
              <span className="bg-orange-500 text-white text-xs font-black px-2.5 py-1 rounded-lg">🛵 DOMI</span>
              <span className="font-black text-white">Confirmar pedido</span>
            </div>
          ) : (
            <h2 className="font-black text-white">Confirmar — Mesa {mesaSeleccionada?.numero}</h2>
          )}
          {pedidoExistenteId && <p className="text-[11px] text-orange-400 font-semibold leading-none mt-0.5">Se agrega al pedido actual</p>}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {carrito.map(item => {
          const key = itemKey(item)
          const dispCarrito = stockDisponible(item.plato) ?? Infinity
          const cantidadPlato = cantidadEnCarrito(item.plato.id)
          return (
          <div key={key} className={`rounded-2xl p-4 border ${item.sinCargo ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{item.plato.nombre}</p>
                {item.modificadores.length > 0 && (
                  <p className="text-xs text-gray-500">
                    {item.modificadores.map(m => `${m.nombre_grupo}: ${m.nombre_opcion}`).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => cambiarCantidad(key, -1)} className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center"><Minus size={12} /></button>
                <span className="font-bold">{item.cantidad}</span>
                <button onClick={() => cambiarCantidad(key, 1)} disabled={cantidadPlato >= dispCarrito} className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center disabled:opacity-40"><Plus size={12} /></button>
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              {item.sinCargo
                ? <p className="text-gray-400 text-sm line-through">${(item.plato.precio * item.cantidad).toLocaleString('es-CO')}</p>
                : <p className="text-orange-600 text-sm font-semibold">${(item.plato.precio * item.cantidad).toLocaleString('es-CO')}</p>
              }
              {componentePlatoIds.has(item.plato.id) && (
                <button
                  onClick={() => toggleSinCargo(key)}
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-all ${item.sinCargo ? 'bg-gray-100 text-gray-500 border-gray-300' : 'bg-orange-100 text-orange-600 border-orange-300'}`}>
                  {item.sinCargo ? 'Incluido — cobrar?' : 'Con cargo ✓'}
                </button>
              )}
            </div>
            <input type="text" placeholder="Nota especial (ej: sin cebolla)" value={item.notas}
              onChange={e => actualizarNota(key, e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300" />
          </div>
          )
        })}

        {modoDomi && (
          <div className="bg-gray-900/60 border border-gray-700 rounded-2xl p-4 space-y-2.5">
            <p className="text-sm font-black text-white">🛵 Datos del cliente (domicilio)</p>
            <input type="text" placeholder="Nombre del cliente *" value={domiCliente.nombre}
              onChange={e => setDomiCliente(p => ({ ...p, nombre: e.target.value }))}
              className="w-full text-sm bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50" />
            <input type="text" placeholder="Cédula (opcional)" value={domiCliente.cedula}
              onChange={e => setDomiCliente(p => ({ ...p, cedula: e.target.value }))}
              onBlur={e => buscarClienteDomi(e.target.value, 'cedula')}
              className="w-full text-sm bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50" />
            <input type="tel" placeholder="Teléfono / Celular" value={domiCliente.telefono}
              onChange={e => setDomiCliente(p => ({ ...p, telefono: e.target.value }))}
              onBlur={e => buscarClienteDomi(e.target.value, 'telefono')}
              className="w-full text-sm bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50" />
            <input type="text" placeholder="Dirección de entrega" value={domiCliente.direccion}
              onChange={e => setDomiCliente(p => ({ ...p, direccion: e.target.value }))}
              className="w-full text-sm bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50" />
          </div>
        )}

        {!pedidoExistenteId && !modoDomi && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <label className="text-sm font-medium text-gray-700 block mb-1">Nota general del pedido</label>
            <textarea value={notaGeneral} onChange={e => setNotaGeneral(e.target.value)}
              placeholder="Observaciones generales..." rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300" />
          </div>
        )}
      </div>

      <div className="bg-white border-t p-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-gray-600 font-medium">{pedidoExistenteId ? 'Adicional' : 'Total estimado'}</span>
          <span className="text-xl font-black text-gray-900">${totalCarrito.toLocaleString('es-CO')}</span>
        </div>
        <button onClick={enviarPedido} disabled={enviando || carrito.length === 0}
          className={`w-full disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all text-lg shadow-md ${modoDomi ? 'bg-orange-500 hover:bg-orange-400 shadow-orange-900/30' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-900/30'}`}>
          {modoDomi ? <Bike size={22} /> : <CheckCircle size={22} />}
          {enviando ? 'Enviando...' : modoDomi ? 'Enviar domi a cocina' : pedidoExistenteId ? 'Agregar a cocina' : 'Enviar a cocina'}
        </button>
      </div>
    </div>
  )
}
