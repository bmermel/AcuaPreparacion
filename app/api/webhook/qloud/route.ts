import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, clientes } from "@/lib/db/schema";
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

  // Procesar la orden después de enviar la respuesta (Vercel mantiene la función viva)
  after(async () => {
    try {
      await procesarOrden(qloudId);
    } catch (err) {
      console.error("[webhook] Error procesando orden:", err);
    }
  });

  return NextResponse.json({ ok: true });
}

async function procesarOrden(qloudId: number) {
  const qloudOrder = await fetchQloudOrder(qloudId);
  if (!qloudOrder) {
    console.error(`[webhook] No se pudo obtener la orden ${qloudId} de Qloud`);
    return;
  }

  // Solo importar órdenes procesadas (estado "1")
  if (String(qloudOrder.estado) !== "1") {
    console.log(`[webhook] Orden ${qloudId} ignorada: no está procesada (estado: ${qloudOrder.estado})`);
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

  // Buscar o crear cliente
  const clienteId = await buscarOCrearClienteWebhook({
    nombre: orderData.clienteNombre,
    email: orderData.clienteEmail,
    telefono: orderData.clienteTel,
    dni: orderData.clienteDni,
  });

  if (existente) {
    await db
      .update(orders)
      .set({
        clienteId,
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
    await db.insert(orders).values({ ...orderData, clienteId, fechaEntregaEstimada });
    console.log(`[webhook] Orden ${qloudId} creada (${tipoProducto})`);
  }
}

/** Versión sin auth para el webhook (no hay sesión) */
async function buscarOCrearClienteWebhook(datos: {
  nombre?: string | null;
  email?: string | null;
  telefono?: string | null;
  dni?: string | null;
}): Promise<string | null> {
  const { nombre, email, telefono, dni } = datos;
  if (!email && !telefono && !dni && !nombre) return null;

  const condiciones = [];
  if (email) condiciones.push(eq(clientes.email, email));
  if (dni) condiciones.push(eq(clientes.dni, dni));
  if (telefono) condiciones.push(eq(clientes.telefono, telefono));

  if (condiciones.length > 0) {
    const [existente] = await db
      .select({ id: clientes.id })
      .from(clientes)
      .where(condiciones.length === 1 ? condiciones[0] : or(...condiciones))
      .limit(1);

    if (existente) {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (nombre) updates.nombre = nombre;
      if (email) updates.email = email;
      if (telefono) updates.telefono = telefono;
      if (dni) updates.dni = dni;
      await db.update(clientes).set(updates).where(eq(clientes.id, existente.id));
      return existente.id;
    }
  }

  const [nuevo] = await db
    .insert(clientes)
    .values({ nombre: nombre || null, email: email || null, telefono: telefono || null, dni: dni || null })
    .returning({ id: clientes.id });

  return nuevo.id;
}
