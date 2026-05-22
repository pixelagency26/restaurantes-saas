import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

async function verificarAdmin(puedeCrear = false) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const isSuperAdmin = user.email === process.env.ADMIN_EMAIL
  if (isSuperAdmin) return { user, isSuperAdmin: true, puede_crear_admins: true }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: rec } = await admin.from('admins').select('*').eq('email', user.email).single()
  if (!rec) return null
  if (puedeCrear && !rec.puede_crear_admins) return null
  return { user, isSuperAdmin: false, ...rec }
}

const adminClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET — listar admins
export async function GET() {
  const auth = await verificarAdmin()
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { data, error } = await adminClient().from('admins').select('*').order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ admins: data })
}

// POST — crear admin
export async function POST(req: Request) {
  const auth = await verificarAdmin(true)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { email, nombre, puede_suscripciones = true, puede_crear_admins = false } = await req.json()
  if (!email || !nombre) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const { error } = await adminClient().from('admins').insert({
    email: email.toLowerCase().trim(),
    nombre,
    puede_suscripciones,
    puede_crear_admins,
    creado_por: auth.user.email,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

// DELETE — eliminar admin
export async function DELETE(req: Request) {
  const auth = await verificarAdmin(true)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const { error } = await adminClient().from('admins').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
