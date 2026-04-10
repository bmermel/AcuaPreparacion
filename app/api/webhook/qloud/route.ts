import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import {
  fetchQloudOrder,
  qloudOrderToNewOrder,
  detectarTipoProducto,
} from "@/lib/qloud";

export async function POST(req: NextRequest) {
  // Qloud espera HTTP 200 inmediato
  const body = await req.json().catch(() => null);

  if (!body || body.topic !== "ordenes" || !body.resource) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const qloudId = Number(body.resource);

  // Responder 200 y procesar en background
  procesarOrden(qloudId).catch(console.error);

  return NextResponse.json({ ok: true });
}

async function procesarOrden(qloudId: number) {
  // 1. Fetchear la orden de Qloud
  const qloudOrder = await fetchQloudOrder(qloudId);
  if (!qloudOrder) {
    console.error(`[webhook] No se pudo obtener la orden ${qloudId} de Qloud`);
    return;
  }

  // 2. Verificar que tenga un producto de la categoría Computadoras
  const tipoProducto = detectarTipoProducto(qloudOrder.productos);
  if (!tipoProducto) {
    console.log(
      `[webhook] Orden ${qloudId} ignorada: no contiene productos de Computadoras`
    );
    return;
  }

  // 3. Verificar si ya existe (idempotencia)
  const [existente] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.qloudId, qloudId))
    .limit(1);

  const orderData = qloudOrderToNewOrder(qloudOrder);

  if (existente) {
    // Actualizar datos (no el estado — no pisar lo que pusieron los técnicos)
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
    // Insertar nueva orden
    await db.insert(orders).values(orderData);
    console.log(`[webhook] Orden ${qloudId} creada (${tipoProducto})`);
  }
}
