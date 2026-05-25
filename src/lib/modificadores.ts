import { GrupoModificador, ModificadorSeleccionado, Plato } from '@/types'

export type ItemConModificadores = {
  plato: Plato
  cantidad: number
  notas: string
  modificadores: ModificadorSeleccionado[]
}

export type SeleccionModificadores = Record<string, Set<string>>

export function gruposDelPlato(plato: Plato): GrupoModificador[] {
  return (plato.modificadores || [])
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map(g => ({
      ...g,
      opciones: (g.opciones || [])
        .filter(o => o.activo !== false)
        .slice()
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
    }))
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
      seleccion[grupo.id] = new Set(grupo.opciones.map(o => o.id))
      return
    }
    seleccion[grupo.id] = new Set()
  })
  return seleccion
}

export function elegirModificadoresPrompt(plato: Plato): ModificadorSeleccionado[] | null {
  const grupos = gruposDelPlato(plato)
  if (grupos.length === 0) return []

  const seleccion = seleccionInicial(plato)
  for (const grupo of grupos) {
    if (grupo.tipo === 'radio') {
      const texto = grupo.opciones.map((o, i) => `${i + 1}. ${o.nombre}`).join('\n')
      const respuesta = window.prompt(`${plato.nombre}\n\n${grupo.nombre}:\n${texto}`, '1')
      if (respuesta === null) return null
      const index = Math.max(0, Math.min(grupo.opciones.length - 1, (parseInt(respuesta, 10) || 1) - 1))
      seleccion[grupo.id] = new Set([grupo.opciones[index].id])
      continue
    }

    const activas = grupo.opciones.filter(o => !o.es_opcion_no_aplica)
    const texto = grupo.opciones.map((o, i) => `${i + 1}. ${o.nombre}`).join('\n')
    const valorInicial = grupo.tiene_opcion_todos ? 'todos' : ''
    const respuesta = window.prompt(
      `${plato.nombre}\n\n${grupo.nombre}:\n${texto}\n\nEscribe "todos" o números separados por coma.`,
      valorInicial,
    )
    if (respuesta === null) return null
    if (respuesta.trim().toLowerCase() === 'todos') {
      seleccion[grupo.id] = new Set(activas.map(o => o.id))
    } else {
      const ids = respuesta.split(',')
        .map(v => grupo.opciones[(parseInt(v.trim(), 10) || 0) - 1]?.id)
        .filter(Boolean) as string[]
      seleccion[grupo.id] = new Set(ids)
    }
  }

  const error = validarSeleccion(plato, seleccion)
  if (error) {
    window.alert(error)
    return null
  }
  return seleccionAmodificadores(plato, seleccion)
}

export function seleccionAmodificadores(plato: Plato, seleccion: SeleccionModificadores): ModificadorSeleccionado[] {
  return gruposDelPlato(plato).flatMap(grupo => {
    const ids = seleccion[grupo.id] || new Set<string>()
    return grupo.opciones
      .filter(opcion => ids.has(opcion.id))
      .map(opcion => ({
        grupo_id: grupo.id,
        opcion_id: opcion.id,
        nombre_grupo: grupo.nombre,
        nombre_opcion: opcion.nombre,
        cantidad_descontada: opcion.descuenta_inventario ? opcion.cantidad_descontar : 0,
        descuenta_inventario: opcion.descuenta_inventario,
        componente_plato_id: opcion.componente_plato_id,
      }))
  })
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
  const mods = item.modificadores.map(m => m.opcion_id).sort().join(',')
  return `${item.plato.id}:${mods || 'normal'}`
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
