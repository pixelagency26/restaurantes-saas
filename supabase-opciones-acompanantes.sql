-- Opciones, acompanantes e inventario por componentes
-- Ejecuta este archivo completo en el SQL Editor de Supabase.

-- 1. Productos/platos
ALTER TABLE platos
  ADD COLUMN IF NOT EXISTS visible_menu BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS controla_inventario BOOLEAN DEFAULT TRUE;

-- 2. Snapshot de la opcion elegida en cada item vendido
ALTER TABLE items_pedido
  ADD COLUMN IF NOT EXISTS opcion_id UUID,
  ADD COLUMN IF NOT EXISTS opcion_nombre TEXT,
  ADD COLUMN IF NOT EXISTS acompanantes JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3. Opciones de venta por plato: Completo, Solo bandeja, etc.
CREATE TABLE IF NOT EXISTS plato_opciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  plato_id UUID REFERENCES platos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  es_default BOOLEAN DEFAULT FALSE,
  orden INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (plato_id, nombre)
);

-- 4. Componentes que descuenta cada opcion.
-- El componente tambien es un plato/producto. Puede venderse solo o ser acompanante.
CREATE TABLE IF NOT EXISTS plato_opcion_componentes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  opcion_id UUID REFERENCES plato_opciones(id) ON DELETE CASCADE,
  componente_plato_id UUID REFERENCES platos(id) ON DELETE CASCADE,
  cantidad INT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (opcion_id, componente_plato_id)
);

CREATE INDEX IF NOT EXISTS idx_plato_opciones_negocio_plato
  ON plato_opciones (negocio_id, plato_id);

CREATE INDEX IF NOT EXISTS idx_plato_opcion_componentes_opcion
  ON plato_opcion_componentes (opcion_id);

CREATE INDEX IF NOT EXISTS idx_plato_opcion_componentes_componente
  ON plato_opcion_componentes (negocio_id, componente_plato_id);

-- 5. Completar negocio_id de opciones/componentes antes de guardar.
CREATE OR REPLACE FUNCTION set_negocio_plato_opcion()
RETURNS TRIGGER AS $$
BEGIN
  SELECT negocio_id INTO NEW.negocio_id
  FROM platos
  WHERE id = NEW.plato_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_negocio_plato_opcion ON plato_opciones;
CREATE TRIGGER trigger_set_negocio_plato_opcion
  BEFORE INSERT OR UPDATE OF plato_id ON plato_opciones
  FOR EACH ROW EXECUTE FUNCTION set_negocio_plato_opcion();

CREATE OR REPLACE FUNCTION set_negocio_plato_opcion_componente()
RETURNS TRIGGER AS $$
DECLARE
  v_negocio_opcion UUID;
  v_negocio_componente UUID;
BEGIN
  SELECT negocio_id INTO v_negocio_opcion
  FROM plato_opciones
  WHERE id = NEW.opcion_id;

  SELECT negocio_id INTO v_negocio_componente
  FROM platos
  WHERE id = NEW.componente_plato_id;

  IF v_negocio_opcion IS DISTINCT FROM v_negocio_componente THEN
    RAISE EXCEPTION 'La opcion y el componente deben pertenecer al mismo negocio';
  END IF;

  NEW.negocio_id := v_negocio_opcion;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_negocio_plato_opcion_componente ON plato_opcion_componentes;
CREATE TRIGGER trigger_set_negocio_plato_opcion_componente
  BEFORE INSERT OR UPDATE OF opcion_id, componente_plato_id ON plato_opcion_componentes
  FOR EACH ROW EXECUTE FUNCTION set_negocio_plato_opcion_componente();

-- 6. RLS multi-negocio
ALTER TABLE plato_opciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE plato_opcion_componentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "negocio_auth" ON plato_opciones;
CREATE POLICY "negocio_auth" ON plato_opciones
  FOR ALL TO authenticated
  USING (negocio_id IN (SELECT negocio_id FROM usuarios WHERE id = auth.uid()))
  WITH CHECK (negocio_id IN (SELECT negocio_id FROM usuarios WHERE id = auth.uid()));

DROP POLICY IF EXISTS "anon_select" ON plato_opciones;
CREATE POLICY "anon_select" ON plato_opciones
  FOR SELECT TO anon USING (TRUE);

DROP POLICY IF EXISTS "negocio_auth" ON plato_opcion_componentes;
CREATE POLICY "negocio_auth" ON plato_opcion_componentes
  FOR ALL TO authenticated
  USING (negocio_id IN (SELECT negocio_id FROM usuarios WHERE id = auth.uid()))
  WITH CHECK (negocio_id IN (SELECT negocio_id FROM usuarios WHERE id = auth.uid()));

DROP POLICY IF EXISTS "anon_select" ON plato_opcion_componentes;
CREATE POLICY "anon_select" ON plato_opcion_componentes
  FOR SELECT TO anon USING (TRUE);

-- 7. Vista de disponibilidad por opcion en el turno activo.
-- Si la opcion no tiene componentes configurados, consume el plato principal x1.
CREATE OR REPLACE VIEW vista_plato_opciones_disponibilidad AS
WITH componentes AS (
  SELECT
    po.id AS opcion_id,
    po.negocio_id,
    po.plato_id,
    po.nombre AS opcion_nombre,
    po.es_default,
    po.orden,
    COALESCE(poc.componente_plato_id, po.plato_id) AS componente_plato_id,
    COALESCE(poc.cantidad, 1) AS cantidad
  FROM plato_opciones po
  LEFT JOIN plato_opcion_componentes poc ON poc.opcion_id = po.id
),
stock AS (
  SELECT
    c.*,
    p.nombre AS componente_nombre,
    CASE
      WHEN ti.plato_id IS NULL THEN NULL
      WHEN c.cantidad <= 0 THEN 0
      ELSE FLOOR(COALESCE(i.cantidad_disponible, 0)::numeric / c.cantidad)::int
    END AS disponibles_por_componente
  FROM componentes c
  JOIN platos p ON p.id = c.componente_plato_id
  LEFT JOIN turnos t ON t.negocio_id = c.negocio_id AND t.cerrado_en IS NULL
  LEFT JOIN turnos_inventario ti ON ti.turno_id = t.id AND ti.plato_id = c.componente_plato_id
  LEFT JOIN inventario i ON i.negocio_id = c.negocio_id AND i.plato_id = c.componente_plato_id
)
SELECT
  opcion_id,
  negocio_id,
  plato_id,
  opcion_nombre,
  es_default,
  orden,
  MIN(disponibles_por_componente) FILTER (WHERE disponibles_por_componente IS NOT NULL) AS disponibles,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'plato_id', componente_plato_id,
        'nombre', componente_nombre,
        'cantidad', cantidad,
        'disponibles', disponibles_por_componente
      )
      ORDER BY componente_nombre
    ),
    '[]'::jsonb
  ) AS componentes
FROM stock
GROUP BY opcion_id, negocio_id, plato_id, opcion_nombre, es_default, orden;

-- 8. Descuento por componentes al insertar items_pedido.
-- Mantiene compatibilidad: si no hay opcion o la opcion no tiene componentes, descuenta el plato vendido.
DROP TRIGGER IF EXISTS trigger_descontar_inventario ON items_pedido;
DROP TRIGGER IF EXISTS trg_descontar_inventario ON items_pedido;
DROP TRIGGER IF EXISTS descontar_inv ON items_pedido;
DROP TRIGGER IF EXISTS trig_decrementar_inventario ON items_pedido;

CREATE OR REPLACE FUNCTION descontar_inventario()
RETURNS TRIGGER AS $$
DECLARE
  v_negocio_id UUID;
  r RECORD;
BEGIN
  SELECT negocio_id INTO v_negocio_id
  FROM pedidos
  WHERE id = NEW.pedido_id;

  FOR r IN
    WITH componentes AS (
      SELECT poc.componente_plato_id AS plato_id, poc.cantidad
      FROM plato_opcion_componentes poc
      WHERE poc.opcion_id = NEW.opcion_id
      UNION ALL
      SELECT NEW.plato_id, 1
      WHERE NEW.opcion_id IS NULL
         OR NOT EXISTS (
          SELECT 1 FROM plato_opcion_componentes poc2 WHERE poc2.opcion_id = NEW.opcion_id
        )
    )
    SELECT plato_id, SUM(cantidad) AS cantidad
    FROM componentes
    GROUP BY plato_id
  LOOP
    IF EXISTS (
      SELECT 1
      FROM turnos_inventario ti
      JOIN turnos t ON t.id = ti.turno_id
      WHERE ti.plato_id = r.plato_id
        AND t.negocio_id = v_negocio_id
        AND t.cerrado_en IS NULL
    ) THEN
      UPDATE inventario
      SET cantidad_disponible = GREATEST(0, cantidad_disponible - (r.cantidad * NEW.cantidad)),
          updated_at = NOW()
      WHERE negocio_id = v_negocio_id
        AND plato_id = r.plato_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_descontar_inventario
  AFTER INSERT ON items_pedido
  FOR EACH ROW EXECUTE FUNCTION descontar_inventario();

-- 9. Crear opcion default para platos existentes que no tengan opciones.
INSERT INTO plato_opciones (plato_id, nombre, es_default, orden)
SELECT p.id, 'Normal', TRUE, 0
FROM platos p
WHERE NOT EXISTS (
  SELECT 1 FROM plato_opciones po WHERE po.plato_id = p.id
);

-- 10. Realtime para nuevas tablas, si no estaban publicadas.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE plato_opciones;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE plato_opcion_componentes;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
