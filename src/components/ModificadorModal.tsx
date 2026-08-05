'use client'

import { X } from 'lucide-react'
import { ModificadorSeleccionado, Plato } from '@/types'
import {
  gruposDelPlato,
  seleccionAmodificadores,
  SeleccionModificadores,
  validarSeleccion,
} from '@/lib/modificadores'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function ModificadorModal({
  plato,
  onCancel,
  onConfirm,
}: {
  plato: Plato
  onCancel: () => void
  onConfirm: (mods: ModificadorSeleccionado[]) => void
}) {
  const [seleccion, setSeleccion] = useState<SeleccionModificadores>({})

  function confirmar() {
    const error = validarSeleccion(plato, seleccion)
    if (error) { toast.error(error); return }
    onConfirm(seleccionAmodificadores(plato, seleccion))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[88vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-gray-900 text-lg">Configurar {plato.nombre}</h3>
            <p className="text-xs text-gray-500">Quitar sopa o acompañantes no modifica el precio.</p>
          </div>
          <button onClick={onCancel} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
            <X size={18} />
          </button>
        </div>

        {gruposDelPlato(plato).map(grupo => {
          const seleccionGrupo = seleccion[grupo.id] || new Set<string>()
          const opcionesActivas = grupo.opciones.filter(o => !o.es_opcion_no_aplica)
          const todos = opcionesActivas.length > 0 && opcionesActivas.every(o => seleccionGrupo.has(o.id))
          const max = grupo.max_selecciones ?? null
          return (
            <div key={grupo.id} className="space-y-2">
              <div>
                <p className="text-sm font-black text-gray-900">{grupo.nombre}</p>
                {grupo.tipo === 'checkbox' && max && <p className="text-[11px] text-gray-500">Escoge maximo {max}</p>}
              </div>
              {grupo.tipo === 'checkbox' && grupo.tiene_opcion_todos && (
                <button
                  onClick={() => setSeleccion(prev => {
                    if (todos) return { ...prev, [grupo.id]: new Set() }
                    const ids = opcionesActivas.map(o => o.id)
                    if (max && ids.length > max) toast(`Este grupo permite maximo ${max}`)
                    return { ...prev, [grupo.id]: new Set(max ? ids.slice(0, max) : ids) }
                  })}
                  className={`w-full text-left rounded-xl px-3 py-2.5 text-sm font-bold border transition-colors ${todos ? 'bg-orange-50 border-orange-300 text-gray-900' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                  {todos ? '✓ ' : ''}Todos los acompañantes
                </button>
              )}
              <div className="grid grid-cols-1 gap-2">
                {grupo.opciones.map(opcion => {
                  const checked = seleccionGrupo.has(opcion.id)
                  return (
                    <button
                      key={opcion.id}
                      onClick={() => setSeleccion(prev => {
                        const next = new Set(prev[grupo.id] || [])
                        if (grupo.tipo === 'radio') return { ...prev, [grupo.id]: new Set([opcion.id]) }
                        const opcionNoAplica = grupo.opciones.find(o => o.es_opcion_no_aplica)
                        if (opcion.es_opcion_no_aplica) return { ...prev, [grupo.id]: new Set([opcion.id]) }
                        if (checked) next.delete(opcion.id)
                        else {
                          if (max && next.size >= max) {
                            toast(`Solo puedes escoger ${max} en ${grupo.nombre}`)
                            return prev
                          }
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

        <button onClick={confirmar} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-xl transition-colors">
          Confirmar plato
        </button>
      </div>
    </div>
  )
}
