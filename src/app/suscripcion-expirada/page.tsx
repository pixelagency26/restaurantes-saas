'use client'
import Link from 'next/link'

const WA_NUMBER = '573137335448'
const WA_MSG = encodeURIComponent('Hola, quiero renovar mi suscripción de Restaurant Pix 🍽️')

export default function SuscripcionExpiradaPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">

        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
          <span className="text-4xl">⏰</span>
        </div>

        <div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Tu prueba ha terminado</h1>
          <p className="text-gray-500 leading-relaxed">
            Los 14 días de prueba gratuita han finalizado. Para seguir usando Restaurant Pix elige un plan.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 text-left">
          <div className="flex justify-between items-center pb-3 border-b">
            <div>
              <p className="font-black text-gray-900">Plan Básico</p>
              <p className="text-xs text-gray-400">Hasta 15 mesas · 2 usuarios</p>
            </div>
            <span className="font-black text-gray-900">$89.900<span className="text-gray-400 font-normal text-xs">/mes</span></span>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-black text-gray-900">Plan Pro</p>
              <p className="text-xs text-gray-400">Ilimitado · Domicilios · Estadísticas</p>
            </div>
            <span className="font-black text-orange-500">$149.900<span className="text-gray-400 font-normal text-xs">/mes</span></span>
          </div>
        </div>

        <div className="space-y-3">
          <a href={`https://wa.me/${WA_NUMBER}?text=${WA_MSG}`} target="_blank" rel="noopener noreferrer"
            className="block w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl text-base transition-colors">
            💬 Contratar por WhatsApp
          </a>
          <Link href="/" className="block w-full text-center text-sm text-gray-400 hover:text-gray-600 py-2">
            Volver al inicio
          </Link>
        </div>

        <p className="text-xs text-gray-400">
          ¿Ya pagaste y ves este mensaje? Escríbenos al WhatsApp y lo resolvemos en minutos.
        </p>
      </div>
    </div>
  )
}
