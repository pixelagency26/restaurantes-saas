'use client'
import { useState } from 'react'

type Paso = 'menu' | 'seguimiento'

const PLATOS = [
  { nombre: 'Bandeja Paisa',     precio: 28000, desc: 'Arroz, frijoles, chicharrón, huevo',  emoji: '🍛' },
  { nombre: 'Pollo al Ajillo',   precio: 22000, desc: 'Papas, ensalada fresca',               emoji: '🍗' },
  { nombre: 'Churrasco Especial',precio: 35000, desc: 'Término a tu gusto + guarnición',      emoji: '🥩' },
  { nombre: 'Limonada Natural',  precio: 7000,  desc: 'Grande, con o sin panela',             emoji: '🍋' },
]

const PEDIDO_EJEMPLO = [
  { nombre: 'Bandeja Paisa x1',    estado: 'listo'          },
  { nombre: 'Pollo al Ajillo x1',  estado: 'en_preparacion' },
  { nombre: 'Limonada Natural x2', estado: 'pendiente'      },
]

const ESTADO: Record<string, { label: string; dot: string; texto: string }> = {
  pendiente:      { label: 'En espera',   dot: 'bg-gray-300',                  texto: 'text-gray-400'  },
  en_preparacion: { label: 'Preparando…', dot: 'bg-orange-400 animate-pulse',  texto: 'text-orange-500' },
  listo:          { label: '¡Listo! ✓',   dot: 'bg-green-500',                 texto: 'text-green-600' },
}

export default function ClientPreviewPhone() {
  const [paso, setPaso]     = useState<Paso>('menu')
  const [carrito, setCarrito] = useState<Record<string, number>>({})
  const [llamado, setLlamado] = useState(false)

  const totalItems = Object.values(carrito).reduce((a, b) => a + b, 0)

  function toggle(nombre: string) {
    setCarrito(prev => ({ ...prev, [nombre]: prev[nombre] ? 0 : 1 }))
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* ── Phone frame ── */}
      <div className="relative w-[270px] shrink-0">
        {/* Glow bajo el phone */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-48 h-10 bg-orange-400/20 blur-2xl rounded-full" />

        <div className="relative bg-gray-950 rounded-[44px] p-2.5 shadow-2xl shadow-black/50 ring-1 ring-white/10">
          {/* Notch */}
          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-gray-950 rounded-full z-20 flex items-center justify-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-800" />
            <div className="w-10 h-2.5 bg-gray-800 rounded-full" />
          </div>

          {/* Screen */}
          <div className="bg-gray-50 rounded-[36px] overflow-hidden h-[540px] flex flex-col">

            {/* ══ MENÚ ══ */}
            {paso === 'menu' && (
              <>
                <div className="bg-white border-b px-4 pt-8 pb-3 flex items-center justify-between shrink-0">
                  <div>
                    <p className="font-black text-gray-900 text-sm leading-tight">Restaurante El Sabor</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      <p className="text-[10px] text-gray-400">Mesa 5 — abierto</p>
                    </div>
                  </div>
                  <button onClick={() => totalItems > 0 && setPaso('seguimiento')}
                    className="relative bg-orange-500 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
                    🛒 Pedido
                    {totalItems > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black animate-bounce">
                        {totalItems}
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex gap-1.5 px-3 py-2 bg-white border-b shrink-0">
                  {['Platos', 'Bebidas'].map((c, i) => (
                    <button key={c} className={`px-3 py-1 rounded-full text-[11px] font-bold ${i === 0 ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{c}</button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {PLATOS.slice(0, 3).map(p => (
                    <div key={p.nombre} className={`bg-white rounded-xl p-2.5 border-2 flex items-center gap-2 transition-all ${carrito[p.nombre] ? 'border-orange-300 bg-orange-50' : 'border-gray-100'}`}>
                      <span className="text-2xl shrink-0">{p.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-[11px] leading-tight truncate">{p.nombre}</p>
                        <p className="text-[9px] text-gray-400 truncate mt-0.5">{p.desc}</p>
                        <p className="text-orange-500 font-black text-[11px] mt-0.5">${(p.precio / 1000).toFixed(0)}k</p>
                      </div>
                      <button onClick={() => toggle(p.nombre)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-black shrink-0 transition-all ${
                          carrito[p.nombre] ? 'bg-orange-500 text-white scale-110' : 'bg-gray-100 text-gray-500'
                        }`}>
                        {carrito[p.nombre] ? '✓' : '+'}
                      </button>
                    </div>
                  ))}
                </div>

                {totalItems > 0 && (
                  <div className="p-3 bg-white border-t shrink-0">
                    <button onClick={() => setPaso('seguimiento')}
                      className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-xs shadow-lg shadow-orange-200">
                      Ver pedido ({totalItems}) y confirmar →
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ══ SEGUIMIENTO ══ */}
            {paso === 'seguimiento' && (
              <>
                <div className="bg-gradient-to-b from-green-500 to-green-600 px-4 pt-8 pb-5 text-center shrink-0">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-white text-xl">✓</span>
                  </div>
                  <p className="font-black text-white text-sm">¡Pedido enviado a cocina!</p>
                  <p className="text-white/70 text-[10px] mt-0.5">Mesa 5 · sigue el estado aquí</p>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Estado de tu pedido</p>
                  {PEDIDO_EJEMPLO.map((item, i) => {
                    const cfg = ESTADO[item.estado]
                    return (
                      <div key={i} className="bg-white rounded-xl px-3 py-3 border border-gray-100 flex items-center justify-between shadow-sm">
                        <p className="text-[11px] font-semibold text-gray-800">{item.nombre}</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                          <span className={`text-[10px] font-bold ${cfg.texto}`}>{cfg.label}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="p-3 bg-white border-t space-y-2 shrink-0">
                  <button
                    onClick={() => { setLlamado(true); setTimeout(() => setLlamado(false), 3000) }}
                    className={`w-full font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all ${llamado ? 'bg-gray-100 text-gray-400' : 'bg-orange-500 text-white shadow-md shadow-orange-200'}`}>
                    🔔 {llamado ? 'Mesera notificada ✓' : 'Llamar a la mesera'}
                  </button>
                  <button onClick={() => { setPaso('menu'); setCarrito({}) }}
                    className="w-full text-[10px] text-gray-400 py-1">
                    ← Agregar más platos
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
        <button onClick={() => { setPaso('menu'); setCarrito({}) }}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${paso === 'menu' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
          🍽️ Ver menú
        </button>
        <button onClick={() => setPaso('seguimiento')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${paso === 'seguimiento' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
          📍 Mi pedido
        </button>
      </div>
    </div>
  )
}
