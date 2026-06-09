-- Auditoria rapida de seguridad para Supabase / Restaurant sas.
-- Ejecutar en SQL Editor. No modifica datos.

-- 1. Tablas publicas sin RLS. Debe devolver 0 filas.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
order by tablename;

-- 2. Politicas RLS existentes por tabla.
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3. Tablas con grants directos al rol anon.
-- Revisar especialmente INSERT/UPDATE/DELETE en tablas privadas.
select table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'anon'
order by table_name, privilege_type;

-- 4. Funciones expuestas en public.
select n.nspname as schema, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;

-- 5. Tablas grandes: ayuda a detectar endpoints sin paginacion o lecturas excesivas.
select schemaname, relname as table_name, n_live_tup as estimated_rows
from pg_stat_user_tables
where schemaname = 'public'
order by n_live_tup desc;
