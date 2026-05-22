import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const WA_NUMBER = '573137335448'
const WA_MSG_BASICO = encodeURIComponent('Hola, quiero contratar el plan Básico de Restaurant Pix 🍽️')
const WA_MSG_PRO    = encodeURIComponent('Hola, quiero contratar el plan Pro de Restaurant Pix 🍽️')

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
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/registro"
            className="bg-orange-500 hover:bg-orange-600 text-white font-black px-8 py-4 rounded-2xl text-lg transition-colors shadow-md">
            🚀 Empezar gratis 14 días
          </Link>
          <a href={`https://wa.me/${WA_NUMBER}?text=${WA_MSG_PRO}`} target="_blank" rel="noopener noreferrer"
            className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-colors flex items-center justify-center gap-2">
            <span>💬</span> Contratar ahora
          </a>
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
          Planes simples y transparentes
        </h2>
        <p className="text-center text-gray-500 mb-12">Sin cobros ocultos. Cancela cuando quieras.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Plan Básico */}
          <div className="border-2 border-gray-200 rounded-3xl p-8 space-y-6 hover:border-gray-300 transition-colors">
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Básico</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-gray-900">$89.900</span>
                <span className="text-gray-400 mb-1 text-sm">COP/mes</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">~USD $22/mes</p>
            </div>
            <ul className="space-y-2.5">
              {[
                'Hasta 15 mesas',
                'Panel de meseras + cocina + caja',
                'Pedidos por QR en mesa',
                '2 usuarios incluidos',
                'Soporte por WhatsApp',
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="w-5 h-5 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center text-xs font-black shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="space-y-2">
              <Link href="/registro"
                className="block text-center border-2 border-orange-500 text-orange-500 hover:bg-orange-50 font-bold py-3.5 rounded-2xl transition-colors text-sm">
                Probar gratis 14 días →
              </Link>
              <a href={`https://wa.me/${WA_NUMBER}?text=${WA_MSG_BASICO}`} target="_blank" rel="noopener noreferrer"
                className="block text-center bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 rounded-2xl transition-colors text-sm">
                💬 Contratar ya
              </a>
            </div>
          </div>

          {/* Plan Pro */}
          <div className="border-2 border-orange-500 rounded-3xl p-8 space-y-6 relative bg-orange-50">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-black px-4 py-1 rounded-full whitespace-nowrap">
              ⭐ MÁS POPULAR
            </span>
            <div>
              <p className="text-xs font-black text-orange-500 uppercase tracking-widest mb-2">Pro</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-gray-900">$149.900</span>
                <span className="text-gray-400 mb-1 text-sm">COP/mes</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">~USD $35/mes</p>
            </div>
            <ul className="space-y-2.5">
              {[
                'Mesas ilimitadas',
                'Todo el plan Básico',
                'Domicilios con QR y seguimiento',
                'Usuarios ilimitados',
                'Múltiples zonas',
                'Estadísticas avanzadas',
                'Soporte prioritario 24/7',
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="w-5 h-5 bg-orange-200 text-orange-700 rounded-full flex items-center justify-center text-xs font-black shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="space-y-2">
              <Link href="/registro"
                className="block text-center bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl transition-colors text-sm">
                Probar gratis 14 días →
              </Link>
              <a href={`https://wa.me/${WA_NUMBER}?text=${WA_MSG_PRO}`} target="_blank" rel="noopener noreferrer"
                className="block text-center bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 rounded-2xl transition-colors text-sm">
                💬 Contratar ya
              </a>
            </div>
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
          <a href={`https://wa.me/${WA_NUMBER}?text=${WA_MSG_PRO}`} target="_blank" rel="noopener noreferrer"
            className="inline-block bg-white hover:bg-gray-100 text-gray-900 font-black px-10 py-4 rounded-2xl text-lg transition-colors">
            💬 Hablar con un asesor
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-6 py-8 text-center text-gray-400 text-sm border-t border-gray-100">
        <p className="font-semibold text-gray-900 mb-1">Restaurant Pix</p>
        <p>© 2025 · Hecho con ❤️ en Colombia</p>
      </footer>

    </div>
  )
}
