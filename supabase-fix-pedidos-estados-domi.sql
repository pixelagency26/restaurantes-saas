-- Permite todos los estados reales usados por el flujo de pedidos y domicilios.
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;

ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_estado_check
  CHECK (
    estado IN (
      'pendiente',
      'pendiente_pago',
      'en_preparacion',
      'listo',
      'en_camino',
      'entregado',
      'esperando_pago',
      'pagado',
      'cancelado'
    )
  );
