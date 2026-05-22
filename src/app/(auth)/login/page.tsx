'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [vista, setVista]       = useState<'login' | 'recuperar'>('login')
  const [enviado, setEnviado]   = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol, negocio:negocios(onboarding_completo)')
      .eq('id', data.user.id)
      .single()
    if (!usuario) { toast.error('Usuario no encontrado'); setLoading(false); return }

    const neg = usuario.negocio as { onboarding_completo: boolean } | null
    if (neg && neg.onboarding_completo === false) { router.push('/onboarding'); return }

    const rutas: Record<string, string> = { gerente: '/gerencia', mesera: '/mesera', cocina: '/cocina', domi: '/domi' }
    router.push(rutas[usuario.rol] || '/login')
  }

  async function handleRecuperar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { toast.error('Escribe tu correo'); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) { toast.error(error.message || 'Error al enviar el correo'); return }
    setEnviado(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">🍽️</span>
            </div>
            <span className="font-black text-gray-900 text-xl">RestaurantOS</span>
          </Link>
          <h1 className="text-2xl font-black text-gray-900">Bienvenido de nuevo</h1>
          <p className="text-gray-500 text-sm mt-1">Ingresa a tu panel de gestión</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">

          {/* ── Vista: LOGIN ── */}
          {vista === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
                  Correo electrónico
                </label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com" required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
                  Contraseña
                </label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-black py-4 rounded-2xl text-base transition-colors">
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
              <button type="button" onClick={() => { setVista('recuperar'); setEnviado(false) }}
                className="w-full text-center text-sm text-purple-600 hover:text-purple-700 font-medium py-1">
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          )}

          {/* ── Vista: RECUPERAR ── */}
          {vista === 'recuperar' && (
            <div>
              <button onClick={() => setVista('login')}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-5">
                ← Volver
              </button>

              {!enviado ? (
                <form onSubmit={handleRecuperar} className="space-y-4">
                  <div className="text-center mb-4">
                    <p className="text-lg font-black text-gray-900">¿Olvidaste tu contraseña?</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Escribe tu correo y te enviamos un enlace para crear una nueva
                    </p>
                  </div>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="tu-correo@ejemplo.com" required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  <button type="submit" disabled={loading}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-black py-4 rounded-2xl transition-colors text-sm">
                    {loading ? 'Enviando...' : 'Enviar enlace'}
                  </button>
                </form>
              ) : (
                <div className="text-center space-y-4 py-4">
                  <div className="text-5xl">📬</div>
                  <p className="text-lg font-black text-gray-900">¡Correo enviado!</p>
                  <p className="text-sm text-gray-500">
                    Revisa tu bandeja de entrada en <span className="font-semibold text-gray-700">{email}</span> y
                    haz clic en el enlace para crear tu nueva contraseña.
                  </p>
                  <p className="text-xs text-gray-400">Si no lo ves, revisa spam.</p>
                  <button onClick={() => { setVista('login'); setEnviado(false) }}
                    className="w-full bg-purple-600 text-white font-black py-4 rounded-2xl text-sm mt-2">
                    Volver al inicio
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿No tienes cuenta?{' '}
          <Link href="/registro" className="text-purple-600 font-bold hover:underline">
            Empieza gratis 14 días
          </Link>
        </p>

      </div>
    </div>
  )
}
