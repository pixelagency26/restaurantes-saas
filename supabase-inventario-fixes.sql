-- ═══════════════════════════════════════════════════════════════
-- FIX DEFINITIVO INVENTARIO — Supabase SQL Editor
-- Corre TODO este bloque de una vez
-- ═══════════════════════════════════════════════════════════════

-- ─── PASO 1: Eliminar CUALQUIER trigger de inventario existente ──
DROP TRIGGER IF EXISTS trigger_descontar_inventario ON items_pedido;
DROP TRIGGER IF EXISTS trg_descontar_inventario ON items_pedido;
DROP TRIGGER IF EXISTS descontar_inv ON items_pedido;
DROP TRIGGER IF EXISTS trig_decrementar_inventario ON items_pedido;

-- ─── PASO 2: Función que descuenta inventario al insertar items ─
-- SECURITY DEFINER: corre como dueño (bypassa RLS)
-- Solo descuenta platos configurados en el turno activo
CREATE OR REPLACE FUNCTION descontar_inventario()
RETURNS TRIGGER AS $$
DECLARE v_stock INT;
BEGIN
  -- Solo actuar si el plato fue configurado en un turno activo
  IF NOT EXISTS (
    SELECT 1 FROM turnos_inventario ti
    JOIN turnos t ON t.id = ti.turno_id
    WHERE ti.plato_id = NEW.plato_id
      AND t.cerrado_en IS NULL
  ) THEN
    RETURN NEW;  -- plato sin inventario de turno → ignorar
  END IF;

  SELECT cantidad_disponible INTO v_stock
  FROM inventario WHERE plato_id = NEW.plato_id FOR UPDATE;

  IF FOUND THEN
    UPDATE inventario
    SET
      cantidad_disponible = GREATEST(0, cantidad_disponible - NEW.cantidad),
      updated_at = NOW()
    WHERE plato_id = NEW.plato_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── PASO 3: Trigger limpio para descontar inventario ──────────
CREATE TRIGGER trigger_descontar_inventario
  AFTER INSERT ON items_pedido
  FOR EACH ROW EXECUTE FUNCTION descontar_inventario();

-- ─── PASO 4: Función que sincroniza inventario al abrir turno ──
-- Cuando gerencia guarda turnos_inventario, este trigger copia
-- la cantidad_inicial → inventario automáticamente (bypassa RLS)
CREATE OR REPLACE FUNCTION sync_inventario_desde_turno()
RETURNS TRIGGER AS $$
DECLARE v_negocio_id UUID;
BEGIN
  -- Obtener negocio_id desde el plato para cumplir con el schema
  SELECT negocio_id INTO v_negocio_id FROM platos WHERE id = NEW.plato_id;

INSERT INTO inventario (plato_id, cantidad_disponible, alerta_minima, negocio_id, updated_at)
VALUES (NEW.plato_id, NEW.cantidad_inicial, 3, v_negocio_id, NOW())
 ON CONFLICT (negocio_id, plato_id) DO UPDATE
    SET cantidad_disponible = EXCLUDED.cantidad_disponible,
        negocio_id          = EXCLUDED.negocio_id,
        updated_at          = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── PASO 5: Trigger en turnos_inventario ──────────────────────
DROP TRIGGER IF EXISTS trigger_sync_inventario ON turnos_inventario;
CREATE TRIGGER trigger_sync_inventario
  AFTER INSERT ON turnos_inventario
  FOR EACH ROW EXECUTE FUNCTION sync_inventario_desde_turno();

-- ─── PASO 6: Sincronizar inventario del turno activo ahora mismo
-- (por si ya hay datos en turnos_inventario sin su inventario)
INSERT INTO inventario (plato_id, cantidad_disponible, negocio_id, updated_at)
SELECT
  ti.plato_id,
  ti.cantidad_inicial,
  p.negocio_id,
  NOW()
FROM turnos_inventario ti
JOIN turnos t ON t.id = ti.turno_id
JOIN platos p ON p.id = ti.plato_id
WHERE t.cerrado_en IS NULL
ON CONFLICT (plato_id) DO UPDATE
  SET cantidad_disponible = EXCLUDED.cantidad_disponible,
      negocio_id          = EXCLUDED.negocio_id,
      updated_at          = EXCLUDED.updated_at;

-- ─── PASO 7: Corregir stock negativo existente ─────────────────
UPDATE inventario SET cantidad_disponible = 0 WHERE cantidad_disponible < 0;

-- ─── PASO 8: Verificación ──────────────────────────────────────
SELECT 'triggers items_pedido' AS tabla, COUNT(*) AS total
FROM information_schema.triggers
WHERE event_object_table = 'items_pedido'
  AND trigger_name LIKE '%inventario%';

SELECT 'triggers turnos_inventario' AS tabla, COUNT(*) AS total
FROM information_schema.triggers
WHERE event_object_table = 'turnos_inventario'
  AND trigger_name LIKE '%inventario%';

SELECT 'inventario actual' AS tabla, p.nombre, i.cantidad_disponible
FROM inventario i JOIN platos p ON p.id = i.plato_id
ORDER BY i.updated_at DESC NULLS LAST;
