-- Blindaje en base de datos para el flujo correcto:
-- 1. Domi en efectivo entra directo a cocina.
-- 2. Domi con pago digital queda en Gerencia con pago_domi_aprobado = false.
-- 3. Solo Gerencia lo manda a cocina poniendo pago_domi_aprobado = true
--    y estado = 'pendiente'.

CREATE OR REPLACE FUNCTION asegurar_domi_pago_digital_pendiente()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'domi' THEN
    IF NEW.metodo_pago_cliente IN ('transferencia', 'nequi', 'daviplata', 'bancolombia') THEN
      IF COALESCE(NEW.pago_domi_aprobado, false) <> true THEN
        NEW.pago_domi_aprobado := false;
      END IF;
    ELSIF NEW.metodo_pago_cliente = 'efectivo' THEN
      NEW.pago_domi_aprobado := true;
    END IF;

    IF NEW.estado = 'pendiente_pago' THEN
      NEW.estado := 'pendiente';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_asegurar_domi_pago_digital_pendiente ON pedidos;
CREATE TRIGGER trigger_asegurar_domi_pago_digital_pendiente
  BEFORE INSERT OR UPDATE ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION asegurar_domi_pago_digital_pendiente();

-- Correccion puntual para pedidos activos que hayan entrado antes del trigger.
-- Si alguno ya fue confirmado manualmente en gerencia, puedes volver a aprobarlo desde Gerencia.
UPDATE pedidos
SET pago_domi_aprobado = false,
    estado = 'pendiente'
WHERE tipo = 'domi'
  AND metodo_pago_cliente IN ('transferencia', 'nequi', 'daviplata', 'bancolombia')
  AND estado IN ('pendiente', 'en_preparacion')
  AND pago_domi_aprobado IS DISTINCT FROM true;
