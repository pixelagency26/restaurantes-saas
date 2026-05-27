-- ============================================================
-- CLIENTES: NOTAS, ADVERTENCIAS Y BUSQUEDA FLEXIBLE
-- Ejecutar en Supabase SQL Editor una sola vez.
-- ============================================================

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS notas TEXT,
  ADD COLUMN IF NOT EXISTS advertencias TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_clientes_negocio_telefono
  ON clientes(negocio_id, telefono)
  WHERE telefono IS NOT NULL AND telefono <> '';

CREATE INDEX IF NOT EXISTS idx_clientes_negocio_nombre
  ON clientes(negocio_id, nombre);

CREATE OR REPLACE FUNCTION set_clientes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clientes_updated_at ON clientes;
CREATE TRIGGER trg_clientes_updated_at
BEFORE UPDATE ON clientes
FOR EACH ROW
EXECUTE FUNCTION set_clientes_updated_at();
