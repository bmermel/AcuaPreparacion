import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import {
  fetchQloudOrder,
  qloudOrderToNewOrder,
  detectarTipoProducto,
} from "@/lib/qloud";
import { calcularFechaEntrega } from "@/lib/delivery";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || body.topic !== "ordenes" || !body.resource) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const qloudId = Number(body.resource);

  // Responder 200 inmediatamente (Qloud requiere respuesta rápida)
  procesarOrden(qloudId).catch(console.error);

  return NextResponse.json({ ok: true });
}

async function procesarOrden(qloudId: number) {
  const qloudOrder = await fetchQloudOrder(qloudId);
  if (!qloudOrder) {
    console.error(`[webhook] No se pudo obtener la orden ${qloudId} de Qloud`);
    return;
  }

  const tipoProducto = detectarTipoProducto(qloudOrder.productos);
  if (!tipoProducto) {
    console.log(`[webhook] Orden ${qloudId} ignorada: no contiene productos de Computadoras`);
    return;
  }

  const [existente] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.qloudId, qloudId))
    .limit(1);

  const orderData = qloudOrderToNewOrder(qloudOrder);

  const cantidadTotal = (orderData.productos as Array<{ cantidad: number }> ?? [])
    .reduce((s, p) => s + p.cantidad, 0);
  const fechaEntregaEstimada = calcularFechaEntrega(new Date(), tipoProducto, cantidadTotal);

  if (existente) {
    await db
      .update(orders)
      .set({
        clienteNombre: orderData.clienteNombre,
        clienteEmail: orderData.clienteEmail,
        clienteTel: orderData.clienteTel,
        productos: orderData.productos,
        envioTipo: orderData.envioTipo,
        envioDireccion: orderData.envioDireccion,
        pagoTipo: orderData.pagoTipo,
        precio: orderData.precio,
        updatedAt: new Date(),
      })
      .where(eq(orders.qloudId, qloudId));

    console.log(`[webhook] Orden ${qloudId} actualizada`);
  } else {
    await db.insert(orders).values({ ...orderData, fechaEntregaEstimada });
    console.log(`[webhook] Orden ${qloudId} creada (${tipoProducto})`);
  }
}
