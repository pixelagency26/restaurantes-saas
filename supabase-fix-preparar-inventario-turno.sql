-- Fix definitivo: inventario/cierre de turno por RPC sin sobrecargas.
-- Ejecutar TODO en Supabase SQL Editor.

DROP FUNCTION IF EXISTS preparar_inventario_turno(UUID, JSONB);
DROP FUNCTION IF EXISTS preparar_inventario_turno(JSONB, UUID);
DROP FUNCTION IF EXISTS preparar_inventario_turno_v2(JSONB, UUID);
DROP FUNCTION IF EXISTS cerrar_turno_seguro(UUID, NUMERIC);

CREATE OR REPLACE FUNCTION preparar_inventario_turno_v2(
  p_items JSONB,
  p_negocio_id UUID
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
    p.id,
    GREATEST(0, COALESCE((item.item->>'cantidad')::INT, 0)),
    3,
    p_negocio_id,
    NOW()
  FROM jsonb_array_elements(p_items) AS item(item)
  JOIN platos p
    ON p.id = (item.item->>'plato_id')::UUID
   AND p.negocio_id = p_negocio_id
  WHERE COALESCE((item.item->>'cantidad')::INT, 0) > 0
  ON CONFLICT (negocio_id, plato_id) DO UPDATE
    SET cantidad_disponible = EXCLUDED.cantidad_disponible,
        alerta_minima = EXCLUDED.alerta_minima,
        negocio_id = EXCLUDED.negocio_id,
        updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION preparar_inventario_turno_v2(JSONB, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION cerrar_turno_seguro(
  p_turno_id UUID,
  p_monto_final NUMERIC
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE turnos
  SET cerrado_en = COALESCE(cerrado_en, NOW()),
      monto_final = p_monto_final
  WHERE id = p_turno_id
    AND cerrado_en IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION cerrar_turno_seguro(UUID, NUMERIC) TO authenticated;

-- Fuerza a la API de Supabase/PostgREST a recargar el schema cache.
NOTIFY pgrst, 'reload schema';
