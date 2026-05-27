export function parseTarifaDomicilio(valor: string | null | undefined): number {
  const tarifa = Math.round(Number(valor || 0))
  return Number.isFinite(tarifa) && tarifa > 0 ? tarifa : 0
}

export function itemDomicilioPayload(pedidoId: string, tarifa: number, pedidoPor?: string | null) {
  return {
    pedido_id: pedidoId,
    plato_id: null,
    pedido_por: pedidoPor || null,
    cantidad: 1,
    precio_unitario: tarifa,
    notas: 'Cargo extra: Domicilio',
    estado: 'listo',
  }
}
