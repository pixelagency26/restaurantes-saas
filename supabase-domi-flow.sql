-- ═══════════════════════════════════════════════════════════════
-- FLUJO DOMI / QR — Nuevos estados y campo pago_domi_aprobado
-- Corre esto en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Columna pago_domi_aprobado ────────────────────────────
-- TRUE  = gerencia confirmó recepción del pago → domi puede salir
-- FALSE = bloquea al domi (solo para pedidos con transferencia)
-- DEFAULT TRUE mantiene compatibilidad con pedidos existentes y
-- con pedidos internos (domi/mesera crean pedidos directamente).
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_domi_aprobado BOOLEAN NOT NULL DEFAULT TRUE;

-- ─── 2. Política anon SELECT en pedidos ───────────────────────
-- El cliente necesita leer el estado de su pedido en la pantalla
-- de seguimiento (realtime subscription filtrada por id).
DO $$ BEGIN
  CREATE POLICY "anon_read_pedidos" ON pedidos
  FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── VERIFICACIÓN ──────────────────────────────────────────────
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'pedidos' AND column_name = 'pago_domi_aprobado';

SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'pedidos' AND 'anon' = ANY(roles);
