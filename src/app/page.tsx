import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const WA_NUMBER = '573137335448'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: u } = await supabase
      .from('usuarios')
      .select('rol, negocio:negocios(onboarding_completo)')
      .eq('id', user.id)
      .single()

    if (!u) redirect('/login')
    const neg = u.negocio as { onboarding_completo: boolean } | null
    if (neg && neg.onboarding_completo === false) redirect('/onboarding')
    const rutas: Record<string, string> = { gerente: '/gerencia', mesera: '/mesera', cocina: '/cocina' }
    redirect(rutas[u.rol] || '/login')
  }

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── NAV ── */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-lg">🍽️</span>
          </div>
          <span className="font-black text-gray-900 text-lg tracking-tight">Restaurant Pix</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">
            Iniciar sesión
          </Link>
          <Link href="/registro"
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm">
            Empezar gratis
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="px-6 pt-20 pb-16 text-center max-w-4xl mx-auto">
        <span className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-600 text-xs font-bold px-4 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
          14 días gratis — Sin tarjeta de crédito
        </span>
        <h1 className="text-5xl md:text-6xl font-black text-gray-900 leading-tight mb-6 tracking-tight">
          El sistema que tu<br />
          <span className="text-orange-500">restaurante necesita</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          Gestiona mesas, pedidos, cocina, domicilios y caja — todo en tiempo real desde cualquier dispositivo.
        </p>
        <div className="flex justify-center">
          <Link href="/registro"
            className="bg-orange-500 hover:bg-orange-600 text-white font-black px-10 py-4 rounded-2xl text-lg transition-colors shadow-md">
            🚀 Empezar gratis 14 días
          </Link>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="px-6 py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-gray-900 text-center mb-3 tracking-tight">
            Todo lo que necesitas en un solo sistema
          </h2>
          <p className="text-center text-gray-500 mb-12">Sin apps adicionales. Sin complicaciones.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: '🪑', title: 'Mesas en tiempo real',   desc: 'Ve el estado de cada mesa al instante. Meseras y gerencia siempre sincronizadas.' },
              { icon: '👨‍🍳', title: 'Panel de cocina',        desc: 'Los pedidos llegan solos a la pantalla. El cocinero marca cuando está listo y la mesera recibe aviso.' },
              { icon: '💳', title: 'Caja y pagos',           desc: 'Cobra en efectivo, Nequi, Daviplata o Bancolombia. Cuadre automático al cerrar turno.' },
              { icon: '📊', title: 'Informes y estadísticas',desc: 'Ventas del día, platos más pedidos, tiempos de cocina. Todo en gráficas claras.' },
              { icon: '👥', title: 'Multi-usuario',          desc: 'Gerente, mesera, cocina y domi — cada uno con su panel y permisos propios.' },
              { icon: '📱', title: 'Desde cualquier device', desc: 'Funciona en celular, tablet o computador. No requiere instalar nada.' },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mb-4 text-2xl">{f.icon}</div>
                <h3 className="font-black text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="px-6 py-20 max-w-4xl mx-auto">
        <h2 className="text-3xl font-black text-gray-900 text-center mb-3 tracking-tight">
          Planes para cada etapa de tu restaurante
        </h2>
        <p className="text-center text-gray-500 mb-12">14 días gratis en todos los planes · Sin tarjeta de crédito · Cancela cuando quieras.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* ── Plan Básico ── */}
          <div className="border-2 border-gray-200 rounded-3xl p-7 space-y-5 hover:border-gray-300 transition-colors flex flex-col">
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Básico</p>
              <div className="flex items-end gap-1.5">
                <span className="text-3xl font-black text-gray-900">$19.000</span>
                <span className="text-gray-400 mb-1 text-sm">COP/mes</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Para negocios pequeños que arrancan</p>
            </div>
            <ul className="space-y-2.5 flex-1">
              {[
                '4 mesas máximo',
                '4 usuarios (gerente + 2 meseras + cocina)',
                'Pedidos y panel de cocina',
                'Caja básica (efectivo)',
                '⏰ Alerta de demora en cocina',
                '🔔 Aviso a mesera cuando el pedido está listo',
                'Soporte por WhatsApp',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                  <span className="w-5 h-5 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
              {[
                'Sin domicilios',
                'Sin QR para clientes',
                'Sin informes',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                  <span className="w-5 h-5 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">✕</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/registro"
              className="block text-center border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-bold py-3.5 rounded-2xl transition-colors text-sm">
              Probar gratis 14 días →
            </Link>
          </div>

          {/* ── Plan Profesional (Recomendado) ── */}
          <div className="border-2 border-orange-500 rounded-3xl p-7 space-y-5 relative bg-orange-50 flex flex-col shadow-lg">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-black px-4 py-1 rounded-full whitespace-nowrap">
              ⭐ RECOMENDADO
            </span>
            <div>
              <p className="text-xs font-black text-orange-500 uppercase tracking-widest mb-2">Profesional</p>
              <div className="flex items-end gap-1.5">
                <span className="text-3xl font-black text-gray-900">$89.900</span>
                <span className="text-gray-400 mb-1 text-sm">COP/mes</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Para restaurantes en crecimiento</p>
            </div>
            <ul className="space-y-2.5 flex-1">
              {[
                'Hasta 20 mesas · 3 zonas',
                'Hasta 10 usuarios',
                'Domicilios con seguimiento en vivo',
                'QR en mesa — el cliente pide y ve el estado',
                'Todos los métodos de pago (Nequi, Daviplata…)',
                'Base de datos de clientes y cumpleaños',
                'Informes de ventas por período',
                'Inventario por turno y menús preconfigurados',
                '⏰ Alerta de demora en cocina',
                '🔔 Aviso a mesera cuando el pedido está listo',
                'Soporte prioritario',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="w-5 h-5 bg-orange-200 text-orange-700 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/registro"
              className="block text-center bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl transition-colors text-sm">
              Probar gratis 14 días →
            </Link>
          </div>

          {/* ── Plan Pro ── */}
          <div className="border-2 border-gray-900 rounded-3xl p-7 space-y-5 bg-gray-900 flex flex-col">
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Pro</p>
              <div className="flex items-end gap-1.5">
                <span className="text-3xl font-black text-white">$149.000</span>
                <span className="text-gray-500 mb-1 text-sm">COP/mes</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Para restaurantes consolidados</p>
            </div>
            <ul className="space-y-2.5 flex-1">
              {[
                'Mesas, zonas y usuarios ilimitados',
                'Todo el plan Profesional +',
                '⏰ Alerta de demora en cocina',
                '🔔 Aviso a mesera cuando el pedido está listo',
                'Análisis de tiempos de cocina por plato',
                'Rendimiento por cocinero y mesera',
                'Estadísticas avanzadas de rentabilidad',
                'Gráficas de horas pico y días más rentables',
                'Comparativo establecimiento vs domicilios',
                '📱 Domicilios con verificación de comprobante de pago',
                '📊 Exportar base de datos de clientes a Excel',
                '💬 Chat interno del equipo en tiempo real',
                'Soporte 24/7 prioritario',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                  <span className="w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/registro"
              className="block text-center bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl transition-colors text-sm">
              Probar gratis 14 días →
            </Link>
          </div>

        </div>

        <p className="text-center text-gray-400 text-sm mt-8">
          ¿Tienes más de 3 restaurantes?{' '}
          <a href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Hola, quiero info sobre el plan agencia de Restaurant Pix')}`}
            target="_blank" rel="noopener noreferrer"
            className="text-orange-500 font-semibold hover:underline">
            Contáctanos para plan agencia →
          </a>
        </p>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="bg-gray-900 px-6 py-16 text-center">
        <h2 className="text-3xl font-black text-white mb-4 tracking-tight">
          ¿Listo para modernizar tu restaurante?
        </h2>
        <p className="text-gray-400 mb-8 text-lg">Configura tu negocio en menos de 5 minutos. 14 días gratis.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/registro"
            className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-black px-10 py-4 rounded-2xl text-lg transition-colors">
            🚀 Crear mi cuenta gratis
          </Link>
          <a href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Hola, quiero información sobre Restaurant Pix 🍽️')}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-block bg-white hover:bg-gray-100 text-gray-900 font-black px-10 py-4 rounded-2xl text-lg transition-colors">
            💬 Hablar con un asesor
          </a>
        </div>
      </section>

      {/* ── BOTÓN FLOTANTE WHATSAPP ── */}
      <a href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Hola, quiero información sobre Restaurant Pix 🍽️')}`}
        target="_blank" rel="noopener noreferrer"
        style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}
        className="flex items-center gap-2.5 bg-green-500 hover:bg-green-600 text-white font-bold px-4 py-3.5 rounded-2xl shadow-xl transition-all hover:scale-105">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.523 5.845L.057 23.514a.5.5 0 0 0 .609.61l5.757-1.51A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.9 9.9 0 0 1-5.031-1.371l-.36-.214-3.733.979.995-3.637-.235-.374A9.861 9.861 0 0 1 2.1 12C2.1 6.533 6.533 2.1 12 2.1S21.9 6.533 21.9 12 17.467 21.9 12 21.9z"/>
        </svg>
        Habla con un asesor
      </a>

      {/* ── FOOTER ── */}
      <footer className="px-6 py-8 text-center text-gray-400 text-sm border-t border-gray-100">
        <p className="font-semibold text-gray-900 mb-1">Restaurant Pix</p>
        <p>© 2025 · Hecho con ❤️ en Colombia</p>
      </footer>

    </div>
  )
}
