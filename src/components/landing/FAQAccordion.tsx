'use client'
import { useState } from 'react'

const FAQS = [
  {
    q: '¿Necesito instalar alguna app?',
    a: 'No. Restaurant Pix funciona 100 % desde el navegador — Chrome, Safari, cualquiera. Lo abres desde el celular o la tablet y ya está. Sin descargas, sin actualizaciones manuales.',
  },
  {
    q: '¿Funciona bien desde el celular?',
    a: 'Sí. Está diseñado mobile-first. Las meseras lo usan desde su celular, cocina desde una tablet o un TV con navegador, y gerencia desde cualquier dispositivo.',
  },
  {
    q: '¿Qué pasa cuando se acaban los 14 días de prueba?',
    a: 'Puedes elegir un plan y pagar directamente con MercadoPago desde la plataforma. Si pagas mientras todavía tienes días de prueba, tu suscripción empieza a correr al terminarlos — no pierdes nada.',
  },
  {
    q: '¿Puedo cambiar de plan después?',
    a: 'Sí, cuando quieras. Si subes de plan (por ejemplo de Básico a Pro), te descontamos los días que te quedan del plan actual — solo pagas la diferencia proporcional.',
  },
  {
    q: '¿Mis datos y los de mis clientes están seguros?',
    a: 'Sí. Usamos Supabase con cifrado en tránsito y en reposo. Cada restaurante tiene sus datos completamente aislados. No compartimos información con terceros.',
  },
  {
    q: '¿Necesito internet todo el tiempo?',
    a: 'Sí, el sistema trabaja en tiempo real y requiere conexión. Recomendamos WiFi estable en el local. Con datos móviles también funciona bien para las meseras que se desplazan.',
  },
  {
    q: '¿Puedo tener varios restaurantes?',
    a: 'Cada restaurante tiene su propia cuenta y plan. Si tienes 3 o más sedes, contáctanos por WhatsApp para un plan agencia con descuento especial.',
  },
  {
    q: '¿Qué tan rápido puedo tener todo configurado?',
    a: 'La configuración inicial toma menos de 5 minutos: registras el negocio, creas las mesas y usuarios, y ya estás listo para operar. El onboarding guiado te lleva paso a paso.',
  },
]

export default function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      {FAQS.map((faq, i) => (
        <div
          key={i}
          className={`border-2 rounded-2xl overflow-hidden transition-all duration-200 ${
            open === i
              ? 'border-orange-300 shadow-md shadow-orange-100'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full text-left px-5 py-4 flex items-center justify-between gap-4">
            <span className={`font-bold text-sm leading-snug ${open === i ? 'text-orange-600' : 'text-gray-800'}`}>
              {faq.q}
            </span>
            <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-base font-black transition-all duration-200 ${
              open === i ? 'bg-orange-500 text-white rotate-45' : 'bg-gray-100 text-gray-400'
            }`}>
              +
            </span>
          </button>
          {open === i && (
            <div className="px-5 pb-5 bg-orange-50">
              <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
