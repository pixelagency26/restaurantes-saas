import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AppPreviewTabs       from '@/components/landing/AppPreviewTabs'
import FAQAccordion         from '@/components/landing/FAQAccordion'
import ClientPreviewPhone   from '@/components/landing/ClientPreviewPhone'

const WA_NUMBER = '573137335448'
const WA_ASESOR = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Hola, quiero información sobre Restaurant Pix 🍽️')}`
const WA_AGENCIA = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Hola, quiero info sobre el plan agencia de Restaurant Pix')}`

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

      {/* ══ NAV ══════════════════════════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-lg">🍽️</span>
            </div>
            <span className="font-black text-gray-900 text-lg tracking-tight">Restaurant Pix</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-gray-500">
            <a href="#preview"   className="hover:text-gray-900 transition-colors">Demo</a>
            <a href="#casos"     className="hover:text-gray-900 transition-colors">Casos de uso</a>
            <a href="#precios"   className="hover:text-gray-900 transition-colors">Precios</a>
            <a href="#faq"       className="hover:text-gray-900 transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors hidden sm:block">
              Iniciar sesión
            </Link>
            <Link href="/registro"
              className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm">
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ══ HERO ═════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gray-900 px-6 pt-24 pb-28 text-center">
        {/* Glow decorativo */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute top-0 right-1/4 w-48 h-48 bg-orange-500/5 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-orange-400/5 rounded-full blur-2xl" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(rgba(251,146,60,1) 1px, transparent 1px), linear-gradient(to right, rgba(251,146,60,1) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }} />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <span className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold px-4 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
            14 días gratis — Sin tarjeta de crédito
          </span>

          <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.05] mb-6 tracking-tight">
            El sistema que tu<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
              restaurante necesita
            </span>
          </h1>

          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Mesas, pedidos, cocina, domicilios y caja — todo en tiempo real desde cualquier dispositivo. Sin instalar nada.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/registro"
              className="bg-orange-500 hover:bg-orange-600 text-white font-black px-10 py-4 rounded-2xl text-lg transition-all shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-105">
              🚀 Empezar gratis 14 días
            </Link>
            <a href="#preview"
              className="border-2 border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-bold px-10 py-4 rounded-2xl text-lg transition-colors">
              Ver cómo funciona ↓
            </a>
          </div>

          <p className="text-gray-600 text-sm mt-6">
            Más de <span className="text-orange-400 font-bold">200 restaurantes</span> en Colombia ya lo usan
          </p>
        </div>
      </section>

      {/* ══ STATS BAR ════════════════════════════════════════════════════════════ */}
      <section className="bg-orange-500 px-6 py-8">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-white">
          {[
            { num: '200+',   label: 'Restaurantes activos'     },
            { num: '500K+',  label: 'Pedidos procesados'        },
            { num: '99.9%',  label: 'Uptime garantizado'        },
            { num: '< 5min', label: 'Configuración inicial'     },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-3xl md:text-4xl font-black mb-1">{s.num}</p>
              <p className="text-orange-100 text-sm font-semibold">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ APP PREVIEW ══════════════════════════════════════════════════════════ */}
      <section id="preview" className="px-6 py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block bg-orange-100 text-orange-600 text-xs font-black px-4 py-1.5 rounded-full mb-4 uppercase tracking-widest">
              Vista interna
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 tracking-tight">
              Así se ve por dentro — interactúa tú mismo
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Haz clic en cada módulo. Lo que ves es exactamente lo que usan tus meseras, cocineros y tú como gerente.
            </p>
          </div>
          <AppPreviewTabs />
        </div>
      </section>

      {/* ══ VISTA DEL CLIENTE (QR) ═══════════════════════════════════════════════ */}
      <section className="px-6 py-20 bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Texto */}
            <div>
              <span className="inline-block bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-black px-4 py-1.5 rounded-full mb-5 uppercase tracking-widest">
                Experiencia del cliente
              </span>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-5 leading-tight tracking-tight">
                Tus clientes piden desde<br />
                <span className="text-orange-400">su propio celular</span>
              </h2>
              <p className="text-gray-400 mb-8 leading-relaxed">
                Con un simple QR en la mesa, el cliente abre el menú, arma su pedido y lo envía directo a cocina — sin esperar al mesero para lo básico.
              </p>
              <div className="space-y-4 mb-8">
                {[
                  { icon: '📱', title: 'Sin app que descargar', desc: 'El cliente escanea el QR y ya. Funciona desde cualquier celular.' },
                  { icon: '📍', title: 'Seguimiento en vivo', desc: 'Ve en tiempo real si su pedido está pendiente, preparándose o listo.' },
                  { icon: '🔔', title: 'Llama a la mesera', desc: 'Un botón en pantalla notifica al instante sin que tenga que gritar.' },
                ].map((f, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-gray-800 border border-gray-700 rounded-xl flex items-center justify-center text-xl shrink-0">
                      {f.icon}
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">{f.title}</p>
                      <p className="text-gray-500 text-sm mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/registro"
                className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-black px-8 py-3.5 rounded-2xl text-sm transition-all shadow-lg shadow-orange-500/20 hover:scale-105">
                🚀 Probar gratis 14 días →
              </Link>
            </div>

            {/* Phone mockup interactivo */}
            <div className="flex justify-center">
              <ClientPreviewPhone />
            </div>
          </div>
        </div>
      </section>

      {/* ══ CASOS DE USO ═════════════════════════════════════════════════════════ */}
      <section id="casos" className="px-6 py-20 bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-black px-4 py-1.5 rounded-full mb-4 uppercase tracking-widest">
              Casos de uso reales
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">
              Situaciones que vives todos los días
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Restaurant Pix no es un software de escritorio pensado para computadores. Está hecho para el caos del mundo real.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Caso 1 */}
            <div className="bg-gray-800 border border-gray-700 rounded-3xl p-7 space-y-5 hover:border-orange-500/40 transition-colors group">
              <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-3xl">
                🔥
              </div>
              <div>
                <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">Viernes 8pm</p>
                <h3 className="text-xl font-black text-white mb-3 leading-snug">
                  15 mesas activas al mismo tiempo
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Cada mesera ve sus mesas en su celular. Los pedidos llegan solos a cocina sin que nadie grite. Gerencia monitorea todo en tiempo real desde su teléfono.
                </p>
              </div>
              <div className="pt-2 border-t border-gray-700">
                <p className="text-xs text-gray-500 mb-3">Disponible desde:</p>
                <span className="inline-block bg-gray-700 text-gray-300 text-xs font-bold px-3 py-1.5 rounded-xl">Plan Profesional</span>
              </div>
            </div>

            {/* Caso 2 — Pro */}
            <div className="bg-gray-800 border-2 border-orange-500/40 rounded-3xl p-7 space-y-5 relative hover:border-orange-500 transition-colors group">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[11px] font-black px-4 py-1 rounded-full whitespace-nowrap">
                ⭐ Exclusivo Pro
              </span>
              <div className="w-14 h-14 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-center text-3xl">
                🛵
              </div>
              <div>
                <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-2">Domicilios</p>
                <h3 className="text-xl font-black text-white mb-3 leading-snug">
                  El cliente rastrea su pedido en vivo
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  El cliente hace el pedido con QR, paga con Nequi o Daviplata, y sigue el estado desde su celular. El domiciliario sale y el sistema registra el comprobante automáticamente.
                </p>
              </div>
              <div className="pt-2 border-t border-gray-700">
                <p className="text-xs text-gray-500 mb-3">Con verificación de pago incluida</p>
                <Link href="/registro"
                  className="inline-block bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors">
                  ⬆️ Quiero Plan Pro →
                </Link>
              </div>
            </div>

            {/* Caso 3 — Pro */}
            <div className="bg-gray-800 border-2 border-orange-500/40 rounded-3xl p-7 space-y-5 relative hover:border-orange-500 transition-colors group">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[11px] font-black px-4 py-1 rounded-full whitespace-nowrap">
                ⭐ Exclusivo Pro
              </span>
              <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center text-3xl">
                📊
              </div>
              <div>
                <p className="text-xs font-bold text-green-400 uppercase tracking-widest mb-2">Cierre de turno</p>
                <h3 className="text-xl font-black text-white mb-3 leading-snug">
                  Descubre qué plato te deja más plata
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Al cerrar el turno ves efectivo, Nequi y Daviplata totalizados. Exportas a Excel en un clic. Y los informes te dicen cuáles platos y qué horas son las más rentables.
                </p>
              </div>
              <div className="pt-2 border-t border-gray-700">
                <p className="text-xs text-gray-500 mb-3">Análisis avanzado de rentabilidad</p>
                <Link href="/registro"
                  className="inline-block bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors">
                  ⬆️ Quiero Plan Pro →
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══ FEATURES ═════════════════════════════════════════════════════════════ */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block bg-gray-100 text-gray-500 text-xs font-black px-4 py-1.5 rounded-full mb-4 uppercase tracking-widest">
              Todo en uno
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 tracking-tight">
              Sin apps adicionales. Sin complicaciones.
            </h2>
            <p className="text-gray-500">Un solo sistema para toda la operación de tu restaurante.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: '🪑', title: 'Mesas en tiempo real',        desc: 'Ve el estado de cada mesa al instante. Meseras y gerencia siempre sincronizadas, sin llamadas ni carreras.' },
              { icon: '👨‍🍳', title: 'Panel de cocina inteligente', desc: 'Los pedidos llegan solos a la pantalla. El cocinero marca cuando está listo y la mesera recibe aviso inmediato.' },
              { icon: '💳', title: 'Caja y cuadre automático',    desc: 'Cobra en efectivo, Nequi, Daviplata o Bancolombia. Cuadre automático al cerrar turno — sin diferencias.' },
              { icon: '📊', title: 'Informes que sí entiendes',   desc: 'Ventas del día, platos más pedidos, tiempos de cocina y horas pico. Todo en gráficas claras, no en tablas confusas.' },
              { icon: '🛵', title: 'Domicilios con seguimiento',  desc: 'El cliente sigue su pedido en vivo. Registro de comprobantes de pago integrado para domicilios seguros.' },
              { icon: '💬', title: 'Chat interno del equipo',     desc: 'Comunicación en tiempo real entre meseras, cocina y gerencia. Sin WhatsApp personal, sin distracciones.' },
              { icon: '📱', title: 'QR en mesa para el cliente',  desc: 'El cliente escanea, ve el menú, hace el pedido y sigue el estado. Sin mesera para esa parte.' },
              { icon: '👥', title: 'Multi-usuario y roles',       desc: 'Gerente, mesera, cocina y domi — cada uno con su panel y permisos propios. Nada de más.' },
              { icon: '⏰', title: 'Alertas de demora en cocina', desc: 'Si un pedido lleva más del tiempo establecido, el sistema avisa automáticamente — antes de que el cliente se moleste.' },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-50 transition-all group">
                <div className="w-12 h-12 bg-orange-50 group-hover:bg-orange-100 rounded-xl flex items-center justify-center mb-4 text-2xl transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-black text-gray-900 mb-2 text-sm">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRICING ══════════════════════════════════════════════════════════════ */}
      <section id="precios" className="px-6 py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block bg-orange-100 text-orange-600 text-xs font-black px-4 py-1.5 rounded-full mb-4 uppercase tracking-widest">
              Precios
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 tracking-tight">
              Planes para cada etapa de tu restaurante
            </h2>
            <p className="text-gray-500">14 días gratis en todos los planes · Sin tarjeta · Cancela cuando quieras.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Plan Básico */}
            <div className="border-2 border-gray-200 rounded-3xl p-7 space-y-5 hover:border-gray-300 transition-colors flex flex-col bg-white">
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
                {['Sin domicilios', 'Sin QR para clientes', 'Sin informes'].map((f, i) => (
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

            {/* Plan Profesional */}
            <div className="border-2 border-orange-500 rounded-3xl p-7 space-y-5 relative bg-orange-50 flex flex-col shadow-xl shadow-orange-100">
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
                className="block text-center bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl transition-colors text-sm shadow-lg shadow-orange-200">
                Probar gratis 14 días →
              </Link>
            </div>

            {/* Plan Pro */}
            <div className="border-2 border-gray-800 rounded-3xl p-7 space-y-5 bg-gray-900 flex flex-col">
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
            <a href={WA_AGENCIA} target="_blank" rel="noopener noreferrer"
              className="text-orange-500 font-semibold hover:underline">
              Contáctanos para plan agencia →
            </a>
          </p>
        </div>
      </section>

      {/* ══ PRUEBA SOCIAL ════════════════════════════════════════════════════════ */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block bg-green-100 text-green-600 text-xs font-black px-4 py-1.5 rounded-full mb-4 uppercase tracking-widest">
              Lo dicen ellos
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 tracking-tight">
              Restaurantes que ya lo usan
            </h2>
            <div className="flex items-center justify-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-orange-400 text-xl">★</span>
              ))}
              <span className="ml-2 text-gray-500 text-sm font-semibold">4.9 / 5 · 200+ reseñas</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {[
              {
                nombre: 'Andrés García',
                negocio: 'Restaurante El Sabor — Medellín',
                foto: 'AG',
                color: 'bg-blue-600',
                texto: '"Antes cuadraba la caja en 2 horas, con boletas por todo lado. Ahora lo hago en 5 minutos desde el celular y ya sé exactamente cuánto entró en efectivo y cuánto en Nequi."',
                plan: 'Plan Profesional',
              },
              {
                nombre: 'Claudia Hernández',
                negocio: 'Fonda La Esperanza — Bogotá',
                foto: 'CH',
                color: 'bg-purple-600',
                texto: '"Los clientes de domicilio ya no llaman a preguntar dónde está su pedido. El seguimiento en vivo fue un cambio total. Y lo del QR en mesa... mis meseras quedaron felices."',
                plan: 'Plan Pro',
              },
              {
                nombre: 'Jorge Moreno',
                negocio: 'Asadero Don Jorge — Cali',
                foto: 'JM',
                color: 'bg-green-700',
                texto: '"El plan Pro valió cada peso. Los informes me mostraron que el sábado vendía 5 veces más que el martes — cambié el menú del martes y ahora ese día también es rentable."',
                plan: 'Plan Pro',
              },
            ].map((t, i) => (
              <div key={i} className="bg-gray-50 border-2 border-gray-100 rounded-3xl p-6 space-y-4 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-50 transition-all">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, j) => (
                    <span key={j} className="text-orange-400 text-sm">★</span>
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed italic">{t.texto}</p>
                <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                  <div className={`w-10 h-10 ${t.color} rounded-full flex items-center justify-center text-white text-xs font-black shrink-0`}>
                    {t.foto}
                  </div>
                  <div>
                    <p className="font-black text-gray-900 text-sm">{t.nombre}</p>
                    <p className="text-xs text-gray-500">{t.negocio}</p>
                  </div>
                  <span className="ml-auto bg-orange-100 text-orange-600 text-[10px] font-black px-2 py-1 rounded-lg whitespace-nowrap">
                    {t.plan}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Logos / métricas de confianza */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '🔒', label: 'Datos cifrados y seguros' },
              { icon: '☁️', label: 'Sin servidores que mantener' },
              { icon: '📲', label: 'Funciona desde cualquier celular' },
              { icon: '🇨🇴', label: 'Hecho en Colombia para Colombia' },
            ].map((m, i) => (
              <div key={i} className="flex flex-col items-center gap-2 text-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-2xl">{m.icon}</span>
                <p className="text-xs font-semibold text-gray-600 leading-snug">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FAQ ══════════════════════════════════════════════════════════════════ */}
      <section id="faq" className="px-6 py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block bg-gray-200 text-gray-600 text-xs font-black px-4 py-1.5 rounded-full mb-4 uppercase tracking-widest">
              Preguntas frecuentes
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 tracking-tight">
              ¿Tienes dudas? Las respondemos
            </h2>
            <p className="text-gray-500">
              Y si no está aquí,{' '}
              <a href={WA_ASESOR} target="_blank" rel="noopener noreferrer"
                className="text-orange-500 font-semibold hover:underline">
                escríbenos por WhatsApp →
              </a>
            </p>
          </div>
          <FAQAccordion />
        </div>
      </section>

      {/* ══ CTA FINAL ════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gray-900 px-6 py-24 text-center">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(rgba(251,146,60,1) 1px, transparent 1px), linear-gradient(to right, rgba(251,146,60,1) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }} />
        </div>
        <div className="relative max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
            ¿Listo para ordenar tu<br />
            <span className="text-orange-400">restaurante de una vez?</span>
          </h2>
          <p className="text-gray-400 mb-10 text-lg max-w-xl mx-auto leading-relaxed">
            Configura tu negocio en menos de 5 minutos. 14 días gratis. Sin tarjeta de crédito.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/registro"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-black px-10 py-4 rounded-2xl text-lg transition-all shadow-xl shadow-orange-500/25 hover:scale-105">
              🚀 Crear mi cuenta gratis
            </Link>
            <a href={WA_ASESOR} target="_blank" rel="noopener noreferrer"
              className="inline-block bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black px-10 py-4 rounded-2xl text-lg transition-colors">
              💬 Hablar con un asesor
            </a>
          </div>
          <p className="text-gray-600 text-xs mt-8">
            Sin contratos · Cancela cuando quieras · Soporte en español
          </p>
        </div>
      </section>

      {/* ══ BOTÓN FLOTANTE WHATSAPP ══════════════════════════════════════════════ */}
      <a href={WA_ASESOR} target="_blank" rel="noopener noreferrer"
        style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}
        className="flex items-center gap-2.5 bg-green-500 hover:bg-green-600 text-white font-bold px-4 py-3.5 rounded-2xl shadow-xl shadow-green-500/30 transition-all hover:scale-105">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.523 5.845L.057 23.514a.5.5 0 0 0 .609.61l5.757-1.51A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.9 9.9 0 0 1-5.031-1.371l-.36-.214-3.733.979.995-3.637-.235-.374A9.861 9.861 0 0 1 2.1 12C2.1 6.533 6.533 2.1 12 2.1S21.9 6.533 21.9 12 17.467 21.9 12 21.9z"/>
        </svg>
        Habla con un asesor
      </a>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════════════ */}
      <footer className="px-6 py-10 border-t border-gray-100">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center">
              <span className="text-base">🍽️</span>
            </div>
            <span className="font-black text-gray-900">Restaurant Pix</span>
          </div>
          <p className="text-gray-400 text-sm text-center">© 2025 · Hecho con ❤️ en Colombia · Todos los derechos reservados</p>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <a href={WA_ASESOR} target="_blank" rel="noopener noreferrer"
              className="hover:text-gray-700 transition-colors">Soporte</a>
            <Link href="/login" className="hover:text-gray-700 transition-colors">Iniciar sesión</Link>
            <Link href="/registro" className="hover:text-orange-500 font-semibold transition-colors">Registrarse</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
