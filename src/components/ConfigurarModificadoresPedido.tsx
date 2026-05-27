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

export default function ConfigurarModificadoresPedido({ items, onCancel, onConfirm, titulo = 'Configurar complementos' }: Props) {
  const configurables = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => gruposDelPlato(item.plato).length > 0)

  const [selecciones, setSelecciones] = useState<Record<number, SeleccionModificadores>>(() => {
    const inicial: Record<number, SeleccionModificadores> = {}
    configurables.forEach(({ item, index }) => {
      inicial[index] = seleccionDesdeModificadores(item.plato, item.modificadores)
    })
    return inicial
  })

  function confirmar() {
    for (const { item, index } of configurables) {
      const error = validarSeleccion(item.plato, selecciones[index])
      if (error) { toast.error(`${item.plato.nombre}: ${error}`); return }
    }
    onConfirm(items.map((item, index) => {
      if (!selecciones[index]) return item
      return { ...item, modificadores: seleccionAmodificadores(item.plato, selecciones[index]) }
    }))
  }

  if (configurables.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 sticky top-0 bg-white pb-2">
          <div>
            <h3 className="font-black text-gray-900 text-lg">{titulo}</h3>
            <p className="text-xs text-gray-500">Quitar sopa o acompañantes no modifica el precio. Puedes escoger "No quiero" cuando aplique.</p>
          </div>
          <button onClick={onCancel} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {configurables.map(({ item, index }) => (
            <div key={`${item.plato.id}-${index}`} className="border border-gray-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-gray-900">{item.cantidad}x {item.plato.nombre}</p>
                  <p className="text-xs text-gray-500">Precio unificado: ${item.plato.precio.toLocaleString('es-CO')}</p>
                </div>
                {item.modificadores.length === 0 && (
                  <span className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-100 rounded-full px-2 py-1">Pendiente</span>
                )}
              </div>

              {gruposDelPlato(item.plato).map(grupo => {
                const seleccionGrupo = selecciones[index]?.[grupo.id] || new Set<string>()
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
                        onClick={() => setSelecciones(prev => {
                          if (todos) return { ...prev, [index]: { ...prev[index], [grupo.id]: new Set() } }
                          const ids = opcionesActivas.map(o => o.id)
                          if (max && ids.length > max) toast(`Este grupo permite máximo ${max}`)
                          return { ...prev, [index]: { ...prev[index], [grupo.id]: new Set(max ? ids.slice(0, max) : ids) } }
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
                            onClick={() => setSelecciones(prev => {
                              const itemSel = prev[index] || {}
                              const next = new Set(itemSel[grupo.id] || [])
                              if (grupo.tipo === 'radio') return { ...prev, [index]: { ...itemSel, [grupo.id]: new Set([opcion.id]) } }
                              const opcionNoAplica = grupo.opciones.find(o => o.es_opcion_no_aplica)
                              if (opcion.es_opcion_no_aplica) return { ...prev, [index]: { ...itemSel, [grupo.id]: new Set([opcion.id]) } }
                              if (checked) next.delete(opcion.id)
                              else {
                                if (max && next.size >= max) {
                                  toast(`Solo puedes escoger ${max} en ${grupo.nombre}`)
                                  return prev
                                }
                                if (opcionNoAplica) next.delete(opcionNoAplica.id)
                                next.add(opcion.id)
                              }
                              return { ...prev, [index]: { ...itemSel, [grupo.id]: next } }
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
          ))}
        </div>

        <button onClick={confirmar} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-xl transition-colors sticky bottom-0">
          Confirmar complementos
        </button>
      </div>
    </div>
  )
}
