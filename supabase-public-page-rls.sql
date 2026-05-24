-- ═══════════════════════════════════════════════════════════════
-- RLS PARA PÁGINA PÚBLICA (clientes sin cuenta)
-- Corre esto en Supabase → SQL Editor
-- Permite que usuarios anónimos lean datos del menú y envíen pedidos
-- ═══════════════════════════════════════════════════════════════

-- ─── LECTURA ANÓNIMA ───────────────────────────────────────────

DO $$ BEGIN
  CREATE POLICY "anon_read_negocios" ON negocios
  FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_categorias" ON categorias
  FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_platos" ON platos
  FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_configuracion" ON configuracion
  FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_resenas" ON resenas
  FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_turnos" ON turnos
  FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_mesas" ON mesas
  FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_inventario" ON inventario
  FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_turnos_inventario" ON turnos_inventario
  FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_clientes" ON clientes
  FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_read_items_pedido" ON items_pedido
  FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── ESCRITURA ANÓNIMA (para que el cliente pueda pedir) ────────

DO $$ BEGIN
  CREATE POLICY "anon_insert_pedidos" ON pedidos
  FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_insert_items_pedido" ON items_pedido
  FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_insert_clientes" ON clientes
  FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_update_mesas" ON mesas
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_insert_resenas" ON resenas
  FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_insert_pqrs" ON pqrs
  FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_insert_reservas" ON reservas
  FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── VERIFICACIÓN ──────────────────────────────────────────────
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE 'anon' = ANY(roles)
ORDER BY tablename, cmd;
