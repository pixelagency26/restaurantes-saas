-- Agrega columna para rastrear unidades añadidas durante el turno (sin tocar cantidad_inicial)
ALTER TABLE turnos_inventario
  ADD COLUMN IF NOT EXISTS cantidad_agregada INT NOT NULL DEFAULT 0;
