import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Descuenta del inventario las cantidades pedidas.
 * Solo descuenta los platos que tengan entrada en turnos_inventario
 * (los que no tienen entrada no tienen restricción de stock).
 *
 * Usa read-then-update: lee cantidades actuales del DB justo antes de actualizar
 * para minimizar race conditions.
 */
export async function descontarInventario(
  supabase: SupabaseClient,
  items: { plato_id: string; cantidad: number }[],
  platosEnTurno: Set<string>
) {
  if (!items.length || !platosEnTurno.size) return

  // Solo descontar platos que están en el inventario de turno
  const itemsConInv = items.filter(i => platosEnTurno.has(i.plato_id))
  if (!itemsConInv.length) return

  // Leer cantidades actuales del DB (no del estado local) para ser más preciso
  const { data: invActual } = await supabase
    .from('inventario')
    .select('plato_id, cantidad_disponible')
    .in('plato_id', itemsConInv.map(i => i.plato_id))

  if (!invActual || invActual.length === 0) return

  // Actualizar cada plato con la nueva cantidad
  await Promise.all(
    itemsConInv.map(item => {
      const current = (invActual as { plato_id: string; cantidad_disponible: number }[])
        .find(i => i.plato_id === item.plato_id)
      if (!current) return Promise.resolve()
      const newQty = Math.max(0, current.cantidad_disponible - item.cantidad)
      return supabase.from('inventario')
        .update({ cantidad_disponible: newQty })
        .eq('plato_id', item.plato_id)
    })
  )
}

/**
 * Carga el Set de plato_ids que tienen inventario configurado para el turno activo.
 * Retorna Set vacío si no hay turno o no tiene inventario.
 */
export async function cargarPlatosEnTurno(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data: turnoData } = await supabase
    .from('turnos')
    .select('id')
    .is('cerrado_en', null)
    .order('abierto_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!turnoData?.id) return new Set()

  const { data: tiData } = await supabase
    .from('turnos_inventario')
    .select('plato_id')
    .eq('turno_id', turnoData.id)

  return new Set((tiData || []).map((t: { plato_id: string }) => t.plato_id))
}
