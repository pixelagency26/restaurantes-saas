import { Plato, PlatoOpcion } from '@/types'

export type ItemConOpcion = {
  plato: Plato
  cantidad: number
  notas: string
  opcion: PlatoOpcion | null
}

export function opcionesDelPlato(plato: Plato): PlatoOpcion[] {
  return (plato.opciones || []).slice().sort((a, b) => {
    if (a.es_default !== b.es_default) return a.es_default ? -1 : 1
    return (a.orden ?? 0) - (b.orden ?? 0)
  })
}

export function opcionDefault(plato: Plato): PlatoOpcion | null {
  const opciones = opcionesDelPlato(plato)
  return opciones.find(o => o.es_default) || opciones[0] || null
}

export function itemKey(platoId: string, opcionId?: string | null) {
  return `${platoId}:${opcionId || 'normal'}`
}

export function keyItem(item: ItemConOpcion) {
  return itemKey(item.plato.id, item.opcion?.id)
}

export function disponiblesOpcion(plato: Plato, opcion: PlatoOpcion | null): number | null {
  if (opcion && opcion.disponibles !== null && opcion.disponibles !== undefined) return opcion.disponibles
  const inv = (plato as Plato & { inventario?: { cantidad_disponible: number }[] }).inventario
  return inv?.[0]?.cantidad_disponible ?? null
}

export function acompanantesOpcion(plato: Plato, opcion: PlatoOpcion | null): string[] {
  if (!opcion) return []
  return (opcion.componentes || [])
    .filter(c => c.plato_id !== plato.id)
    .map(c => c.cantidad > 1 ? `${c.nombre} x${c.cantidad}` : c.nombre)
}

export function elegirOpcion(plato: Plato): PlatoOpcion | null {
  const opciones = opcionesDelPlato(plato)
  if (opciones.length <= 1) return opcionDefault(plato)

  const texto = opciones
    .map((o, i) => {
      const acomp = acompanantesOpcion(plato, o)
      const detalle = acomp.length ? ` (${acomp.join(', ')})` : ''
      return `${i + 1}. ${o.nombre}${detalle}`
    })
    .join('\n')

  const respuesta = window.prompt(`Como va "${plato.nombre}"?\n\n${texto}`, '1')
  if (respuesta === null) return null

  const index = Math.max(0, Math.min(opciones.length - 1, (parseInt(respuesta, 10) || 1) - 1))
  return opciones[index]
}

export function itemPedidoPayload(item: ItemConOpcion, pedidoId: string, pedidoPor?: string | null) {
  return {
    pedido_id: pedidoId,
    plato_id: item.plato.id,
    cantidad: item.cantidad,
    precio_unitario: item.plato.precio,
    notas: item.notas || null,
    opcion_id: item.opcion?.id || null,
    opcion_nombre: item.opcion?.nombre || null,
    acompanantes: acompanantesOpcion(item.plato, item.opcion),
    pedido_por: pedidoPor || null,
  }
}

