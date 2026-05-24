-- ═══════════════════════════════════════════════════════════════
-- HABILITAR REALTIME EN TABLAS NECESARIAS
-- Corre esto en Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Asegura que estas tablas estén en la publicación de realtime.
-- Si ya están, el DO NOTHING las ignora (no da error).

ALTER PUBLICATION supabase_realtime ADD TABLE mesas;
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE items_pedido;
ALTER PUBLICATION supabase_realtime ADD TABLE inventario;
ALTER PUBLICATION supabase_realtime ADD TABLE turnos_inventario;

-- Verificar cuáles quedaron registradas:
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
