-- Modificadores inventariables por plato
-- Ejecutar en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS grupos_modificadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  plato_id UUID NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('radio', 'checkbox')),
  min_selecciones INT NOT NULL DEFAULT 0,
  max_selecciones INT,
  tiene_opcion_todos BOOLEAN NOT NULL DEFAULT FALSE,
  obligatorio BOOLEAN NOT NULL DEFAULT FALSE,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opciones_modificador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  grupo_id UUID NOT NULL REFERENCES grupos_modificadores(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  componente_plato_id UUID REFERENCES platos(id) ON DELETE SET NULL,
  cantidad_descontar INT NOT NULL DEFAULT 1,
  descuenta_inventario BOOLEAN NOT NULL DEFAULT TRUE,
  es_opcion_no_aplica BOOLEAN NOT NULL DEFAULT FALSE,
  orden INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items_pedido_modificadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_pedido_id UUID NOT NULL REFERENCES items_pedido(id) ON DELETE CASCADE,
  grupo_id UUID REFERENCES grupos_modificadores(id) ON DELETE SET NULL,
  opcion_id UUID REFERENCES opciones_modificador(id) ON DELETE SET NULL,
  nombre_grupo TEXT NOT NULL,
  nombre_opcion TEXT NOT NULL,
  cantidad_descontada INT NOT NULL DEFAULT 0,
  descuenta_inventario BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grupos_modificadores_negocio_plato
  ON grupos_modificadores (negocio_id, plato_id, orden);

CREATE INDEX IF NOT EXISTS idx_opciones_modificador_grupo
  ON opciones_modificador (grupo_id, orden);

CREATE INDEX IF NOT EXISTS idx_items_pedido_modificadores_item
  ON items_pedido_modificadores (item_pedido_id);

CREATE OR REPLACE FUNCTION set_negocio_grupo_modificador()
RETURNS TRIGGER AS $$
BEGIN
  SELECT negocio_id INTO NEW.negocio_id FROM platos WHERE id = NEW.plato_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_negocio_grupo_modificador ON grupos_modificadores;
CREATE TRIGGER trigger_set_negocio_grupo_modificador
  BEFORE INSERT OR UPDATE OF plato_id ON grupos_modificadores
  FOR EACH ROW EXECUTE FUNCTION set_negocio_grupo_modificador();

CREATE OR REPLACE FUNCTION set_negocio_opcion_modificador()
RETURNS TRIGGER AS $$
BEGIN
  SELECT negocio_id INTO NEW.negocio_id FROM grupos_modificadores WHERE id = NEW.grupo_id;

  IF NEW.es_opcion_no_aplica THEN
    NEW.descuenta_inventario := FALSE;
    NEW.componente_plato_id := NULL;
    NEW.cantidad_descontar := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_negocio_opcion_modificador ON opciones_modificador;
CREATE TRIGGER trigger_set_negocio_opcion_modificador
  BEFORE INSERT OR UPDATE OF grupo_id, es_opcion_no_aplica ON opciones_modificador
  FOR EACH ROW EXECUTE FUNCTION set_negocio_opcion_modificador();

ALTER TABLE grupos_modificadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE opciones_modificador ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_pedido_modificadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "negocio_auth" ON grupos_modificadores;
CREATE POLICY "negocio_auth" ON grupos_modificadores FOR ALL TO authenticated
USING (negocio_id IN (SELECT negocio_id FROM usuarios WHERE id = auth.uid()))
WITH CHECK (negocio_id IN (SELECT negocio_id FROM usuarios WHERE id = auth.uid()) OR negocio_id IS NULL);

DROP POLICY IF EXISTS "negocio_auth" ON opciones_modificador;
CREATE POLICY "negocio_auth" ON opciones_modificador FOR ALL TO authenticated
USING (negocio_id IN (SELECT negocio_id FROM usuarios WHERE id = auth.uid()))
WITH CHECK (negocio_id IN (SELECT negocio_id FROM usuarios WHERE id = auth.uid()) OR negocio_id IS NULL);

DROP POLICY IF EXISTS "items_mod_auth" ON items_pedido_modificadores;
CREATE POLICY "items_mod_auth" ON items_pedido_modificadores FOR ALL TO authenticated
USING (
  item_pedido_id IN (
    SELECT ip.id
    FROM items_pedido ip
    JOIN pedidos p ON p.id = ip.pedido_id
    JOIN usuarios u ON u.negocio_id = p.negocio_id
    WHERE u.id = auth.uid()
  )
)
WITH CHECK (
  item_pedido_id IN (
    SELECT ip.id
    FROM items_pedido ip
    JOIN pedidos p ON p.id = ip.pedido_id
    JOIN usuarios u ON u.negocio_id = p.negocio_id
    WHERE u.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "anon_select" ON grupos_modificadores;
CREATE POLICY "anon_select" ON grupos_modificadores FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_select" ON opciones_modificador;
CREATE POLICY "anon_select" ON opciones_modificador FOR SELECT TO anon USING (activo = TRUE);

DROP POLICY IF EXISTS "anon_select" ON items_pedido_modificadores;
CREATE POLICY "anon_select" ON items_pedido_modificadores FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_insert" ON items_pedido_modificadores;
CREATE POLICY "anon_insert" ON items_pedido_modificadores FOR INSERT TO anon WITH CHECK (true);

CREATE OR REPLACE FUNCTION descontar_inventario()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM turnos_inventario ti
    JOIN turnos t ON t.id = ti.turno_id
    WHERE ti.plato_id = NEW.plato_id
      AND t.cerrado_en IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE inventario
  SET cantidad_disponible = GREATEST(0, cantidad_disponible - NEW.cantidad),
      updated_at = NOW()
  WHERE plato_id = NEW.plato_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_descontar_inventario ON items_pedido;
CREATE TRIGGER trigger_descontar_inventario
  AFTER INSERT ON items_pedido
  FOR EACH ROW EXECUTE FUNCTION descontar_inventario();

CREATE OR REPLACE FUNCTION descontar_inventario_modificador()
RETURNS TRIGGER AS $$
DECLARE
  v_plato_id UUID;
  v_qty INT;
BEGIN
  IF NOT NEW.descuenta_inventario OR NEW.cantidad_descontada <= 0 OR NEW.opcion_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT componente_plato_id INTO v_plato_id
  FROM opciones_modificador
  WHERE id = NEW.opcion_id;

  IF v_plato_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cantidad INTO v_qty
  FROM items_pedido
  WHERE id = NEW.item_pedido_id;

  IF NOT EXISTS (
    SELECT 1
    FROM turnos_inventario ti
    JOIN turnos t ON t.id = ti.turno_id
    WHERE ti.plato_id = v_plato_id
      AND t.cerrado_en IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE inventario
  SET cantidad_disponible = GREATEST(0, cantidad_disponible - (NEW.cantidad_descontada * COALESCE(v_qty, 1))),
      updated_at = NOW()
  WHERE plato_id = v_plato_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_descontar_inventario_modificador ON items_pedido_modificadores;
CREATE TRIGGER trigger_descontar_inventario_modificador
  AFTER INSERT ON items_pedido_modificadores
  FOR EACH ROW EXECUTE FUNCTION descontar_inventario_modificador();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE grupos_modificadores;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE opciones_modificador;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE items_pedido_modificadores;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
