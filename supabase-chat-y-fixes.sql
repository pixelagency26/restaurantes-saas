-- ═══════════════════════════════════════════════════════════════
-- RESTAURANT SaaS — Ejecutar en Supabase SQL Editor
-- Crea las tablas de chat interno y usa mi_negocio_id() como
-- el resto del schema
-- ═══════════════════════════════════════════════════════════════

-- ─── CHAT: Grupos ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_grupos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  negocio_id  UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('general','directo','grupo')),
  creado_por  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CHAT: Miembros ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_miembros (
  id          BIGSERIAL PRIMARY KEY,
  negocio_id  UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  grupo_id    UUID NOT NULL REFERENCES chat_grupos(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (grupo_id, usuario_id)
);

-- ─── CHAT: Mensajes ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensajes_internos (
  id             BIGSERIAL PRIMARY KEY,
  negocio_id     UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  grupo_id       UUID REFERENCES chat_grupos(id) ON DELETE CASCADE,
  usuario_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nombre TEXT NOT NULL,
  rol            TEXT NOT NULL DEFAULT 'equipo',
  mensaje        TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mensajes_negocio  ON mensajes_internos(negocio_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_grupo    ON mensajes_internos(grupo_id);
CREATE INDEX IF NOT EXISTS idx_miembros_usuario  ON chat_miembros(usuario_id);
CREATE INDEX IF NOT EXISTS idx_miembros_grupo    ON chat_miembros(grupo_id);

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE chat_grupos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_miembros     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes_internos ENABLE ROW LEVEL SECURITY;

-- chat_grupos
CREATE POLICY "negocio" ON chat_grupos FOR ALL TO authenticated
  USING (negocio_id = mi_negocio_id()) WITH CHECK (negocio_id = mi_negocio_id());

-- chat_miembros
CREATE POLICY "negocio" ON chat_miembros FOR ALL TO authenticated
  USING (negocio_id = mi_negocio_id()) WITH CHECK (negocio_id = mi_negocio_id());

-- mensajes_internos
CREATE POLICY "negocio" ON mensajes_internos FOR ALL TO authenticated
  USING (negocio_id = mi_negocio_id()) WITH CHECK (negocio_id = mi_negocio_id());

-- ─── Realtime (necesario para chat en vivo) ───────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE mensajes_internos;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_miembros;
