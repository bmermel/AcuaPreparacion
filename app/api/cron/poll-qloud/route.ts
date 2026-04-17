import { NextRequest, NextResponse } from "next/server";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import {
  fetchQloudOrder,
  qloudOrderToNewOrder,
  detectarTipoProducto,
} from "@/lib/qloud";
import { calcularFechaEntrega } from "@/lib/delivery";

/**
 * Polling de órdenes de Qloud.
 *
 * Estrategia: busca el qloudId más alto en la BD y prueba los siguientes
 * IDs secuenciales. Si encuentra órdenes válidas (con productos de
 * computadoras), las importa automáticamente.
 *
 * Se ejecuta cada 5 minutos vía Vercel Cron, solo en horario laboral
 * (lun-sáb 7:55 a 18:05 AR). El filtro horario lo maneja vercel.json.
 */

// Cuántos IDs hacia adelante probar desde el último conocido
const LOOKAHEAD = 30;

// Token secreto para proteger el endpoint
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Verificar autenticación del cron
  if (CRON_SECRET) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Filtro horario: solo lunes(1) a sábado(6), 7:55 a 18:05 Argentina (UTC-3)
  const now = new Date();
  const arHour = Number(
    now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires", hour: "numeric", hour12: false })
  );
  const arDay = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
  ).getDay();

  // Domingo (0) = no trabajamos
  if (arDay === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Domingo — no se trabaja" });
  }
  // Fuera de horario (antes de 7 o después de 18)
  if (arHour < 7 || arHour >= 19) {
    return NextResponse.json({ ok: true, skipped: true, reason: `Fuera de horario (${arHour}hs AR)` });
  }

  try {
    const result = await pollQloudOrders();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[poll-qloud] Error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

async function pollQloudOrders() {
  // Obtener el qloudId más alto que tenemos
  const [ultimo] = await db
    .select({ maxId: sql<number>`COALESCE(MAX(${orders.qloudId}), 0)` })
    .from(orders);

  const maxIdConocido = ultimo?.maxId ?? 0;

  if (maxIdConocido === 0) {
    console.log("[poll-qloud] No hay órdenes de Qloud en la BD, no se puede determinar rango");
    return { checked: 0, imported: 0, updated: 0, maxId: 0 };
  }

  let imported = 0;
  let updated = 0;
  let checked = 0;
  let nuevoMaxId = maxIdConocido;

  // Probar IDs desde maxId+1 hasta maxId+LOOKAHEAD
  // También reprobar algunos anteriores por si se saltaron (últimos 5)
  const startId = Math.max(1, maxIdConocido - 4);
  const endId = maxIdConocido + LOOKAHEAD;

  console.log(`[poll-qloud] Revisando IDs ${startId} a ${endId} (último conocido: ${maxIdConocido})`);

  for (let id = startId; id <= endId; id++) {
    checked++;
    try {
      const qloudOrder = await fetchQloudOrder(id);
      if (!qloudOrder) continue; // No existe este ID

      const tipoProducto = detectarTipoProducto(qloudOrder.productos);
      if (!tipoProducto) continue; // No tiene productos de computadoras

      // Verificar si ya existe
      const [existente] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.qloudId, id))
        .limit(1);

      const orderData = qloudOrderToNewOrder(qloudOrder);
      const cantidadTotal = (orderData.productos as Array<{ cantidad: number }> ?? [])
        .reduce((s, p) => s + p.cantidad, 0);
      const fechaEntregaEstimada = calcularFechaEntrega(new Date(), tipoProducto, cantidadTotal);

      if (existente) {
        // Actualizar datos (por si cambió algo en Qloud)
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
          .where(eq(orders.qloudId, id));
        updated++;
      } else {
        // Nueva orden
        await db.insert(orders).values({ ...orderData, fechaEntregaEstimada });
        imported++;
        console.log(`[poll-qloud] Nueva orden #${id} importada (${tipoProducto})`);
      }

      if (id > nuevoMaxId) nuevoMaxId = id;
    } catch (err) {
      // Si falla un ID individual, seguir con los demás
      console.error(`[poll-qloud] Error procesando ID ${id}:`, err);
    }
  }

  console.log(`[poll-qloud] Finalizado: ${checked} verificados, ${imported} nuevas, ${updated} actualizadas`);

  return {
    checked,
    imported,
    updated,
    rangoRevisado: `${startId}-${endId}`,
    maxIdConocido,
  };
}
