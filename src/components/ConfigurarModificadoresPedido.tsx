'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import { ItemConModificadores, gruposDelPlato, seleccionAmodificadores, seleccionDesdeModificadores, SeleccionModificadores, validarSeleccion } from '@/lib/modificadores'

type Props = {
  items: ItemConModificadores[]
  onCancel: () => void
  onConfirm: (items: ItemConModificadores[]) => void
  titulo?: string
}

// Each configurable slot = one unit of one item
type Slot = { origIndex: number; unitIndex: number; item: ItemConModificadores }

export default function ConfigurarModificadoresPedido({ items, onCancel, onConfirm, titulo = 'Configurar complementos' }: Props) {
  // Expand items with cantidad > 1 into individual slots (one per unit)
  const slots: Slot[] = items.flatMap((item, origIndex) => {
    if (gruposDelPlato(item.plato).length === 0) return []
    return Array.from({ length: item.cantidad }, (_, unitIndex) => ({
      origIndex,
      unitIndex,
      item: { ...item, cantidad: 1 },
    }))
  })

  const [selecciones, setSelecciones] = useState<Record<string, SeleccionModificadores>>(() => {
    const inicial: Record<string, SeleccionModificadores> = {}
    slots.forEach(({ origIndex, unitIndex, item }) => {
      // Pre-fill unit 0 from existing modifiers; fresh selection for subsequent units
      const mods = unitIndex === 0 ? item.modificadores : []
      inicial[`${origIndex}-${unitIndex}`] = seleccionDesdeModificadores(item.plato, mods)
    })
    return inicial
  })

  function setSel(origIndex: number, unitIndex: number, upd: (prev: SeleccionModificadores) => SeleccionModificadores) {
    const key = `${origIndex}-${unitIndex}`
    setSelecciones(prev => ({ ...prev, [key]: upd(prev[key] || {}) }))
  }

  function confirmar() {
    for (const { origIndex, unitIndex, item } of slots) {
      const key = `${origIndex}-${unitIndex}`
      const error = validarSeleccion(item.plato, selecciones[key])
      if (error) {
        const label = item.cantidad === 1 ? item.plato.nombre : `${item.plato.nombre} (unidad ${unitIndex + 1})`
        toast.error(`${label}: ${error}`)
        return
      }
    }

    // Build result: items without modifiers pass through; items with modifiers are expanded into individual units
    const origIndexesWithSlots = new Set(slots.map(s => s.origIndex))
    const expandedByOrig: Record<number, ItemConModificadores[]> = {}
    slots.forEach(({ origIndex, unitIndex, item }) => {
      const key = `${origIndex}-${unitIndex}`
      if (!expandedByOrig[origIndex]) expandedByOrig[origIndex] = []
      expandedByOrig[origIndex].push({
        ...item,
        modificadores: seleccionAmodificadores(item.plato, selecciones[key]),
      })
    })

    const resultado: ItemConModificadores[] = []
    items.forEach((item, idx) => {
      if (origIndexesWithSlots.has(idx)) {
        resultado.push(...(expandedByOrig[idx] || []))
      } else {
        resultado.push(item)
      }
    })

    onConfirm(resultado)
  }

  if (slots.length === 0) return null

  // Count how many slots share the same origIndex (to show "Unidad N de M" label)
  const countByOrig: Record<number, number> = {}
  slots.forEach(s => { countByOrig[s.origIndex] = (countByOrig[s.origIndex] || 0) + 1 })

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 sticky top-0 bg-white pb-2">
          <div>
            <h3 className="font-black text-gray-900 text-lg">{titulo}</h3>
            <p className="text-xs text-gray-500">Configura los complementos de cada unidad por separado.</p>
          </div>
          <button onClick={onCancel} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {slots.map(({ origIndex, unitIndex, item }) => {
            const key = `${origIndex}-${unitIndex}`
            const totalUnits = countByOrig[origIndex]
            const labelUnidad = totalUnits > 1 ? ` — Unidad ${unitIndex + 1} de ${totalUnits}` : ''
            const selItem = selecciones[key] || {}

            return (
              <div key={key} className="border border-gray-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-gray-900">{item.plato.nombre}<span className="font-normal text-gray-500 text-sm">{labelUnidad}</span></p>
                    <p className="text-xs text-gray-500">${item.plato.precio.toLocaleString('es-CO')}</p>
                  </div>
                  {item.modificadores.length === 0 && (
                    <span className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-100 rounded-full px-2 py-1">Pendiente</span>
                  )}
                </div>

                {gruposDelPlato(item.plato).map(grupo => {
                  const seleccionGrupo = selItem[grupo.id] || new Set<string>()
                  const opcionesActivas = grupo.opciones.filter(o => !o.es_opcion_no_aplica)
                  const todos = opcionesActivas.length > 0 && opcionesActivas.every(o => seleccionGrupo.has(o.id))
                  const max = grupo.max_selecciones ?? null
                  return (
                    <div key={grupo.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-black text-gray-900">{grupo.nombre}</p>
                        {grupo.tipo === 'checkbox' && max && <p className="text-[11px] text-gray-500">Máximo {max}</p>}
                      </div>
                      {grupo.tipo === 'checkbox' && grupo.tiene_opcion_todos && (
                        <button
                          type="button"
                          onClick={() => setSel(origIndex, unitIndex, prev => {
                            if (todos) return { ...prev, [grupo.id]: new Set() }
                            const ids = opcionesActivas.map(o => o.id)
                            if (max && ids.length > max) toast(`Este grupo permite máximo ${max}`)
                            return { ...prev, [grupo.id]: new Set(max ? ids.slice(0, max) : ids) }
                          })}
                          className={`w-full text-left rounded-xl px-3 py-2.5 text-sm font-bold border transition-colors ${todos ? 'bg-orange-50 border-orange-300 text-gray-900' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                          {todos ? '✓ ' : ''}Todos los acompañantes
                        </button>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {grupo.opciones.map(opcion => {
                          const checked = seleccionGrupo.has(opcion.id)
                          return (
                            <button
                              key={opcion.id}
                              type="button"
                              onClick={() => setSel(origIndex, unitIndex, prev => {
                                const next = new Set(prev[grupo.id] || [])
                                if (grupo.tipo === 'radio') return { ...prev, [grupo.id]: new Set([opcion.id]) }
                                const opcionNoAplica = grupo.opciones.find(o => o.es_opcion_no_aplica)
                                if (opcion.es_opcion_no_aplica) return { ...prev, [grupo.id]: new Set([opcion.id]) }
                                if (checked) next.delete(opcion.id)
                                else {
                                  if (max && next.size >= max) { toast(`Solo puedes escoger ${max} en ${grupo.nombre}`); return prev }
                                  if (opcionNoAplica) next.delete(opcionNoAplica.id)
                                  next.add(opcion.id)
                                }
                                return { ...prev, [grupo.id]: next }
                              })}
                              className={`text-left rounded-xl px-3 py-2.5 text-sm border transition-colors ${checked ? 'bg-orange-50 border-orange-300 text-gray-900 font-bold' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                              {checked ? '✓ ' : ''}{opcion.nombre}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        <button onClick={confirmar} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-xl transition-colors sticky bottom-0">
          Confirmar complementos
        </button>
      </div>
    </div>
  )
}
