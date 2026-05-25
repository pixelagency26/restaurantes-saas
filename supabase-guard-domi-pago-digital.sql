-- Blindaje en base de datos: los domicilios con pago digital nunca deben
-- entrar aprobados por defecto. Gerencia los desbloquea poniendo
-- pago_domi_aprobado = true.

CREATE OR REPLACE FUNCTION asegurar_domi_pago_digital_pendiente()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'domi'
     AND NEW.metodo_pago_cliente IN ('transferencia', 'nequi', 'daviplata', 'bancolombia')
     AND TG_OP = 'INSERT'
  THEN
    NEW.pago_domi_aprobado := false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_asegurar_domi_pago_digital_pendiente ON pedidos;
CREATE TRIGGER trigger_asegurar_domi_pago_digital_pendiente
  BEFORE INSERT ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION asegurar_domi_pago_digital_pendiente();

-- Correccion puntual para pedidos activos que hayan entrado antes del trigger.
-- Si alguno ya fue confirmado manualmente en gerencia, puedes volver a ponerlo en TRUE.
UPDATE pedidos
SET pago_domi_aprobado = false
WHERE tipo = 'domi'
  AND metodo_pago_cliente IN ('transferencia', 'nequi', 'daviplata', 'bancolombia')
  AND estado IN ('pendiente', 'en_preparacion')
  AND pago_domi_aprobado IS DISTINCT FROM false;
