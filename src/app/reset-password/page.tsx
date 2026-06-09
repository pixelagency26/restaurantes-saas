'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { CheckCircle, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [listo, setListo] = useState(false)
  const [sesionLista, setSesionLista] = useState(false)
  const [errorEnlace, setErrorEnlace] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let activo = true

    async function verificarEnlace() {
      const params = new URLSearchParams(window.location.search)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const code = params.get('code')
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      const errorDescripcion = params.get('error_description') || hash.get('error_description')

      if (errorDescripcion) {
        toast.error('Enlace invalido o expirado. Solicita uno nuevo.')
        if (activo) setErrorEnlace(true)
        return
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          toast.error('Enlace invalido o expirado. Solicita uno nuevo.')
          if (activo) setErrorEnlace(true)
          return
        }

        window.history.replaceState({}, document.title, window.location.pathname)
        if (activo) setSesionLista(true)
        return
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (error) {
          toast.error('Enlace invalido o expirado. Solicita uno nuevo.')
          if (activo) setErrorEnlace(true)
          return
        }

        window.history.replaceState({}, document.title, window.location.pathname)
        if (activo) setSesionLista(true)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (session && activo) setSesionLista(true)
    }

    verificarEnlace()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSesionLista(true)
    })

    return () => {
      activo = false
      subscription.unsubscribe()
    }
  }, [supabase])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return }
    if (password !== confirmar) { toast.error('Las contraseñas no coinciden'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) { toast.error('Error al cambiar la contraseña'); return }
    setListo(true)
    setTimeout(() => router.push('/login'), 3000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 px-4">
      <div className="w-full max-w-md fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">🍽️</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900">Restaurant sas</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {listo ? (
            <div className="text-center space-y-4 py-4">
              <CheckCircle size={56} className="mx-auto text-green-500" />
              <p className="text-xl font-bold text-gray-900">Contraseña cambiada</p>
              <p className="text-sm text-gray-500">En un momento te llevamos al inicio de sesión...</p>
            </div>
          ) : errorEnlace ? (
            <div className="text-center space-y-4 py-4">
              <p className="text-lg font-bold text-gray-900">Enlace vencido</p>
              <p className="text-sm text-gray-500">Solicita un nuevo enlace para cambiar tu contraseña.</p>
              <button onClick={() => router.push('/login')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                Volver al login
              </button>
            </div>
          ) : !sesionLista ? (
            <div className="text-center space-y-4 py-6">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 text-sm">Verificando enlace...</p>
              <p className="text-xs text-gray-400">
                Si esta pantalla no avanza, solicita un nuevo enlace desde el login.
              </p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
              <div className="text-center mb-2">
                <p className="text-lg font-bold text-gray-900">Nueva contraseña</p>
                <p className="text-sm text-gray-500 mt-1">Elige una contraseña que puedas recordar</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres" required
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Repetir contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)}
                    placeholder="Escribe la misma contraseña" required
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm" />
                </div>
                {confirmar && password !== confirmar && (
                  <p className="text-red-500 text-xs mt-1">Las contraseñas no coinciden</p>
                )}
                {confirmar && password === confirmar && (
                  <p className="text-green-600 text-xs mt-1">Coinciden</p>
                )}
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
