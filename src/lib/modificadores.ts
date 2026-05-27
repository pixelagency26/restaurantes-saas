import { GrupoModificador, ModificadorSeleccionado, Plato } from '@/types'

export type ItemConModificadores = {
  plato: Plato
  cantidad: number
  notas: string
  modificadores: ModificadorSeleccionado[]
}

export type SeleccionModificadores = Record<string, Set<string>>

const NO_APLICA_PREFIX = '__no_aplica__'

export function gruposDelPlato(plato: Plato): GrupoModificador[] {
  return (plato.modificadores || [])
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map(g => {
      const opciones = (g.opciones || [])
        .filter(o => o.activo !== false)
        .slice()
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      const tieneNoAplica = opciones.some(o => o.es_opcion_no_aplica)
      if (!tieneNoAplica) {
        opciones.push({
          id: `${NO_APLICA_PREFIX}${g.id}`,
          negocio_id: g.negocio_id,
          grupo_id: g.id,
          nombre: `No quiero ${g.nombre.toLowerCase()}`,
          componente_plato_id: null,
          cantidad_descontar: 0,
          descuenta_inventario: false,
          es_opcion_no_aplica: true,
          orden: 9999,
          activo: true,
        })
      }
      return { ...g, opciones }
    })
}

export function tieneModificadores(plato: Plato): boolean {
  return gruposDelPlato(plato).some(g => g.opciones.length > 0)
}

export function seleccionInicial(plato: Plato): SeleccionModificadores {
  const seleccion: SeleccionModificadores = {}
  gruposDelPlato(plato).forEach(grupo => {
    if (grupo.tipo === 'radio') {
      const opcion = grupo.opciones.find(o => !o.es_opcion_no_aplica) || grupo.opciones[0]
      seleccion[grupo.id] = new Set(opcion ? [opcion.id] : [])
      return
    }
    if (grupo.tiene_opcion_todos) {
      const ids = grupo.opciones.filter(o => !o.es_opcion_no_aplica).map(o => o.id)
      seleccion[grupo.id] = new Set(grupo.max_selecciones ? ids.slice(0, grupo.max_selecciones) : ids)
      return
    }
    seleccion[grupo.id] = new Set()
  })
  return seleccion
}

export function seleccionAmodificadores(plato: Plato, seleccion: SeleccionModificadores): ModificadorSeleccionado[] {
  return gruposDelPlato(plato).flatMap(grupo => {
    const ids = seleccion[grupo.id] || new Set<string>()
    return grupo.opciones
      .filter(opcion => ids.has(opcion.id))
      .map(opcion => ({
        grupo_id: grupo.id,
        opcion_id: opcion.id.startsWith(NO_APLICA_PREFIX) ? null : opcion.id,
        nombre_grupo: grupo.nombre,
        nombre_opcion: opcion.nombre,
        cantidad_descontada: opcion.descuenta_inventario ? opcion.cantidad_descontar : 0,
        descuenta_inventario: opcion.descuenta_inventario,
        componente_plato_id: opcion.componente_plato_id,
      }))
  })
}

export function seleccionDesdeModificadores(plato: Plato, modificadores: ModificadorSeleccionado[]): SeleccionModificadores {
  if (!modificadores.length) return seleccionInicial(plato)
  const seleccion = seleccionInicial(plato)
  gruposDelPlato(plato).forEach(grupo => {
    const ids = modificadores
      .filter(m => m.grupo_id === grupo.id)
      .map(m => m.opcion_id)
      .filter((id): id is string => Boolean(id))
    if (ids.length > 0) seleccion[grupo.id] = new Set(ids)
  })
  return seleccion
}

export function itemRequiereConfig(item: ItemConModificadores): boolean {
  return tieneModificadores(item.plato) && item.modificadores.length === 0
}

export function hayConfigPendiente(items: ItemConModificadores[]): boolean {
  return items.some(itemRequiereConfig)
}

export function validarSeleccion(plato: Plato, seleccion: SeleccionModificadores): string | null {
  for (const grupo of gruposDelPlato(plato)) {
    const total = seleccion[grupo.id]?.size || 0
    if (grupo.obligatorio && total < Math.max(1, grupo.min_selecciones || 0)) {
      return `Selecciona una opción en ${grupo.nombre}`
    }
    if ((grupo.min_selecciones || 0) > total) return `Selecciona al menos ${grupo.min_selecciones} en ${grupo.nombre}`
    if (grupo.max_selecciones !== null && grupo.max_selecciones !== undefined && total > grupo.max_selecciones) {
      return `Selecciona máximo ${grupo.max_selecciones} en ${grupo.nombre}`
    }
  }
  return null
}

export function itemKey(item: ItemConModificadores): string {
  const mods = item.modificadores.map(m => m.opcion_id || `${m.grupo_id}:no_aplica`).sort().join(',')
  return `${item.plato.id}:${mods || 'normal'}`
}

export function consumoInventarioItem(item: ItemConModificadores): Map<string, number> {
  const consumo = new Map<string, number>()
  consumo.set(item.plato.id, (consumo.get(item.plato.id) || 0) + item.cantidad)
  item.modificadores.forEach(mod => {
    if (!mod.descuenta_inventario || !mod.componente_plato_id || mod.cantidad_descontada <= 0) return
    consumo.set(
      mod.componente_plato_id,
      (consumo.get(mod.componente_plato_id) || 0) + (mod.cantidad_descontada * item.cantidad),
    )
  })
  return consumo
}

export function consumoInventarioCarrito(items: ItemConModificadores[]): Map<string, number> {
  const consumo = new Map<string, number>()
  items.forEach(item => {
    consumoInventarioItem(item).forEach((cantidad, platoId) => {
      consumo.set(platoId, (consumo.get(platoId) || 0) + cantidad)
    })
  })
  return consumo
}

export function itemPedidoPayload(item: ItemConModificadores, pedidoId: string, pedidoPor?: string | null) {
  return {
    pedido_id: pedidoId,
    plato_id: item.plato.id,
    cantidad: item.cantidad,
    precio_unitario: item.plato.precio,
    notas: item.notas || null,
    opcion_id: null,
    opcion_nombre: null,
    acompanantes: item.modificadores.map(m => `${m.nombre_grupo}: ${m.nombre_opcion}`),
    pedido_por: pedidoPor || null,
  }
}

export function modificadoresPedidoPayload(itemPedidoId: string, item: ItemConModificadores) {
  return item.modificadores.map(m => ({
    item_pedido_id: itemPedidoId,
    grupo_id: m.grupo_id,
    opcion_id: m.opcion_id,
    nombre_grupo: m.nombre_grupo,
    nombre_opcion: m.nombre_opcion,
    cantidad_descontada: m.cantidad_descontada,
    descuenta_inventario: m.descuenta_inventario,
  }))
}
