'use client'
import { useState } from 'react'

type TabId = 'mesas' | 'cocina' | 'caja' | 'informes' | 'chat'

const TABS = [
  { id: 'mesas'    as TabId, label: '🪑 Mesas',    pro: false },
  { id: 'cocina'   as TabId, label: '👨‍🍳 Cocina',   pro: false },
  { id: 'caja'     as TabId, label: '💳 Caja',      pro: false },
  { id: 'informes' as TabId, label: '📊 Informes',  pro: true  },
  { id: 'chat'     as TabId, label: '💬 Chat',       pro: true  },
]

// ── Mesas ────────────────────────────────────────────────
function MesasMockup() {
  const [seleccionada, setSeleccionada] = useState<number | null>(null)
  const mesas = [
    { num: 1, estado: 'ocupada',   total: '$45.000',  tiempo: '45 min' },
    { num: 2, estado: 'ocupada',   total: '$23.000',  tiempo: '20 min' },
    { num: 3, estado: 'esperando', total: null,        tiempo: null     },
    { num: 4, estado: 'libre',     total: null,        tiempo: null     },
    { num: 5, estado: 'ocupada',   total: '$67.000',  tiempo: '1h 10m' },
    { num: 6, estado: 'libre',     total: null,        tiempo: null     },
    { num: 7, estado: 'ocupada',   total: '$31.000',  tiempo: '15 min' },
    { num: 8, estado: 'ocupada',   total: '$89.000',  tiempo: '55 min' },
  ]
  const selMesa = seleccionada !== null ? mesas[seleccionada] : null

  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-black text-gray-900 text-sm">Zona Principal</h3>
          <p className="text-xs text-gray-400 mt-0.5">8 mesas · 5 ocupadas · 2 libres · 1 esperando</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          En vivo
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {mesas.map((m, i) => (
          <button key={m.num} onClick={() => setSeleccionada(seleccionada === i ? null : i)}
            className={`rounded-xl p-2.5 text-center border-2 transition-all ${
              seleccionada === i
                ? 'ring-2 ring-orange-400 ring-offset-1 scale-105'
                : ''
            } ${
              m.estado === 'ocupada'   ? 'bg-red-50 border-red-200 hover:border-red-400' :
              m.estado === 'esperando' ? 'bg-amber-50 border-amber-300 hover:border-amber-400' :
                                         'bg-gray-50 border-gray-200 hover:border-gray-300'
            }`}>
            <div className={`w-6 h-6 rounded-full mx-auto mb-1.5 flex items-center justify-center ${
              m.estado === 'ocupada'   ? 'bg-red-500' :
              m.estado === 'esperando' ? 'bg-amber-400' : 'bg-gray-300'
            }`}>
              <span className="text-white font-black text-[10px]">{m.num}</span>
            </div>
            <p className="text-[11px] font-black text-gray-700 leading-none">Mesa {m.num}</p>
            {m.total && <p className="text-[10px] font-semibold text-gray-500 mt-0.5">{m.total}</p>}
            {m.estado === 'esperando' && <p className="text-[10px] text-amber-600 font-bold mt-0.5">Espera</p>}
            {m.estado === 'libre'     && <p className="text-[10px] text-gray-400 mt-0.5">Libre</p>}
          </button>
        ))}
      </div>
      {selMesa && (
        <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-gray-800">Mesa {selMesa.num} seleccionada</p>
            {selMesa.total && <p className="text-xs text-gray-500">Total: {selMesa.total} · {selMesa.tiempo}</p>}
          </div>
          <button className="bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
            Ver pedido →
          </button>
        </div>
      )}
    </div>
  )
}

// ── Cocina ────────────────────────────────────────────────
function CocinaMockup() {
  const [listos, setListos] = useState<number[]>([])
  const pedidos = [
    { mesa: 3, num: 47, items: ['Bandeja paisa x1', 'Limonada natural x2'], min: 12, urgente: true  },
    { mesa: 7, num: 48, items: ['Pollo al ajillo x2', 'Arroz con leche x1'], min: 5, urgente: false },
    { mesa: 1, num: 49, items: ['Churrasco especial x1', 'Jugo natural x1'], min: 2, urgente: false },
  ]
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-gray-900 text-sm">
          {pedidos.length - listos.length} pedidos pendientes
        </h3>
        <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          En vivo
        </span>
      </div>
      <div className="space-y-2.5">
        {pedidos.map(p => (
          <div key={p.num} className={`rounded-xl border-2 p-3 transition-all ${
            listos.includes(p.num)
              ? 'opacity-40 border-gray-200 bg-gray-50'
              : p.urgente
              ? 'border-red-300 bg-red-50'
              : 'border-gray-200 bg-white'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${p.urgente ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'}`}>
                  Mesa {p.mesa}
                </span>
                <span className="text-xs text-gray-400">#{p.num}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${p.min > 10 ? 'text-red-600' : 'text-gray-500'}`}>
                  ⏱ {p.min} min
                </span>
                <button
                  onClick={() => setListos(prev => prev.includes(p.num) ? prev.filter(x => x !== p.num) : [...prev, p.num])}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${
                    listos.includes(p.num) ? 'bg-gray-300 text-gray-500' : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}>
                  {listos.includes(p.num) ? 'Deshacer' : '✓ Listo'}
                </button>
              </div>
            </div>
            <ul className="space-y-0.5">
              {p.items.map((item, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-gray-400 rounded-full shrink-0" />{item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Caja ─────────────────────────────────────────────────
function CajaMockup() {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-black text-gray-900 text-sm">Caja — Turno Noche</h3>
          <p className="text-xs text-gray-400 mt-0.5">Sáb 15 Jun · 6:00 pm — activo</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Abierto
        </span>
      </div>
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-4 text-white text-center mb-3">
        <p className="text-xs font-bold opacity-80 mb-1">Total del turno</p>
        <p className="text-3xl font-black tracking-tight">$847.000</p>
        <p className="text-xs opacity-70 mt-1">34 pedidos cerrados</p>
      </div>
      <div className="space-y-2">
        {[
          { icon: '💵', label: 'Efectivo',  val: '$234.000', pct: 28 },
          { icon: '📱', label: 'Nequi',     val: '$456.000', pct: 54 },
          { icon: '🏦', label: 'Daviplata', val: '$157.000', pct: 18 },
        ].map(m => (
          <div key={m.label} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-700">{m.icon} {m.label}</span>
              <span className="text-xs font-black text-gray-900">{m.val}</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-orange-400 rounded-full" style={{ width: `${m.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold py-2.5 rounded-xl transition-colors">
          ⬇ Exportar Excel
        </button>
        <button className="flex-1 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold py-2.5 rounded-xl transition-colors">
          Cerrar turno →
        </button>
      </div>
    </div>
  )
}

// ── Informes ──────────────────────────────────────────────
function InformesMockup() {
  const dias = [
    { dia: 'Lun', val: 234, max: 1200 },
    { dia: 'Mar', val: 189, max: 1200 },
    { dia: 'Mié', val: 445, max: 1200 },
    { dia: 'Jue', val: 312, max: 1200 },
    { dia: 'Vie', val: 678, max: 1200 },
    { dia: 'Sáb', val: 1200, max: 1200 },
  ]
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-black text-gray-900 text-sm">Ventas — Esta semana</h3>
          <p className="text-xs text-gray-400 mt-0.5">🏆 Plato top: Bandeja paisa (47 pedidos)</p>
        </div>
        <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">⭐ Pro</span>
      </div>
      <div className="space-y-2 mb-4">
        {dias.map(d => (
          <div key={d.dia} className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 w-8 shrink-0">{d.dia}</span>
            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full flex items-center justify-end pr-2 transition-all ${
                  d.val === d.max ? 'bg-gradient-to-r from-orange-400 to-orange-600' : 'bg-orange-300'
                }`}
                style={{ width: `${(d.val / d.max) * 100}%` }}>
                <span className="text-[9px] font-black text-white">${(d.val / 1000 >= 1 ? (d.val / 1000).toFixed(1) + 'M' : d.val + 'k')}</span>
              </div>
            </div>
            {d.val === d.max && <span className="text-sm">🔥</span>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-2.5 text-center">
          <p className="text-sm font-black text-blue-600">7–9pm</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Hora pico</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-2.5 text-center">
          <p className="text-sm font-black text-orange-500">Sábado</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Mejor día</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-2.5 text-center">
          <p className="text-sm font-black text-green-600">+23%</p>
          <p className="text-[10px] text-gray-500 mt-0.5">vs semana ant.</p>
        </div>
      </div>
    </div>
  )
}

// ── Chat ──────────────────────────────────────────────────
function ChatMockup() {
  const mensajes = [
    { color: 'bg-purple-600', emoji: '👔', nombre: 'Laura',  rol: 'Gerencia', msg: 'Mesa 5 pide la cuenta 💳', tiempo: '2 min' },
    { color: 'bg-orange-500', emoji: '👩',  nombre: 'María',  rol: 'Mesera',   msg: '✓ Ya voy, en un momento', tiempo: '1 min' },
    { color: 'bg-amber-600',  emoji: '👨‍🍳', nombre: 'Carlos', rol: 'Cocina',   msg: '🍽️ Bandeja mesa 3 lista!', tiempo: '30 seg' },
  ]
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm">📢</div>
          <div>
            <p className="font-black text-gray-900 text-sm">General</p>
            <p className="text-xs text-gray-400">Todo el personal</p>
          </div>
        </div>
        <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">⭐ Pro</span>
      </div>
      <div className="space-y-3 mb-4">
        {mensajes.map((m, i) => (
          <div key={i} className="flex gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${m.color} text-white`}>
              {m.emoji}
            </div>
            <div>
              <p className="text-[11px] text-gray-500 font-semibold mb-0.5">
                {m.nombre}
                <span className="font-normal text-gray-400"> · {m.rol} · {m.tiempo}</span>
              </p>
              <div className="bg-white border border-gray-200 px-3 py-2 rounded-2xl rounded-tl-sm shadow-sm inline-block">
                <p className="text-xs text-gray-800">{m.msg}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 items-center border-2 border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus-within:border-purple-300 transition-colors">
        <div className="flex-1 text-xs text-gray-400">Escribe un mensaje…</div>
        <div className="bg-purple-600 text-white p-1.5 rounded-lg">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────
export default function AppPreviewTabs() {
  const [tab, setTab] = useState<TabId>('mesas')

  return (
    <div className="max-w-2xl mx-auto">
      {/* Barra del browser */}
      <div className="bg-gray-800 rounded-t-2xl px-4 py-3 flex items-center gap-3">
        <div className="flex gap-1.5 shrink-0">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <div className="flex-1 bg-gray-700 rounded-lg px-3 py-1.5 flex items-center gap-2 min-w-0">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" className="shrink-0">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="#9ca3af" strokeWidth="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#9ca3af" strokeWidth="2"/>
          </svg>
          <span className="text-gray-400 text-xs font-mono truncate">restaurantpix.app/gerencia</span>
        </div>
      </div>

      {/* Contenido app */}
      <div className="bg-white border-x-2 border-b-2 border-gray-200 rounded-b-2xl overflow-hidden shadow-2xl shadow-black/10">
        {/* Nav de tabs (simula la app) */}
        <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 flex gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                tab === t.id
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
              }`}>
              {t.label}
              {t.pro && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none ${
                  tab === t.id ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  Pro
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Mockup según tab */}
        <div className="min-h-[300px]">
          {tab === 'mesas'    && <MesasMockup />}
          {tab === 'cocina'   && <CocinaMockup />}
          {tab === 'caja'     && <CajaMockup />}
          {tab === 'informes' && <InformesMockup />}
          {tab === 'chat'     && <ChatMockup />}
        </div>
      </div>
    </div>
  )
}
