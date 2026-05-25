-- Fix: preparar inventario de turno sin chocar con RLS.
-- Ejecutar en Supabase SQL Editor.

CREATE OR REPLACE FUNCTION preparar_inventario_turno(
  p_negocio_id UUID,
  p_items JSONB
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO inventario (
    plato_id,
    cantidad_disponible,
    alerta_minima,
    negocio_id,
    updated_at
  )
  SELECT
    (item->>'plato_id')::UUID,
    GREATEST(0, COALESCE((item->>'cantidad')::INT, 0)),
    3,
    p_negocio_id,
    NOW()
  FROM jsonb_array_elements(p_items) AS item
  WHERE COALESCE((item->>'cantidad')::INT, 0) > 0
  ON CONFLICT (negocio_id, plato_id) DO UPDATE
    SET cantidad_disponible = EXCLUDED.cantidad_disponible,
        alerta_minima = EXCLUDED.alerta_minima,
        negocio_id = EXCLUDED.negocio_id,
        updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION preparar_inventario_turno(UUID, JSONB) TO authenticated;

-- Compatibilidad para PostgREST/Supabase cuando resuelve RPC por nombres en otro orden.
CREATE OR REPLACE FUNCTION preparar_inventario_turno(
  p_items JSONB,
  p_negocio_id UUID
)
RETURNS VOID AS $$
BEGIN
  PERFORM preparar_inventario_turno(p_negocio_id, p_items);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION preparar_inventario_turno(JSONB, UUID) TO authenticated;

-- Fuerza a la API de Supabase/PostgREST a recargar el schema cache.
NOTIFY pgrst, 'reload schema';
