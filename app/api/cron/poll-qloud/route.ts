import { NextRequest, NextResponse } from "next/server";
import { eq, sql, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, cronLogs, clientes } from "@/lib/db/schema";
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
 *
 * Cada ejecución se registra en la tabla cron_logs.
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

  // Permitir forzar ejecución con ?force=true (requiere CRON_SECRET)
  const forceRun = req.nextUrl.searchParams.get("force") === "true";

  // Filtro horario: solo lunes(1) a sábado(6), 7 a 18hs Argentina
  if (!forceRun) {
    const now = new Date();
    const arHour = Number(
      now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires", hour: "numeric", hour12: false })
    );
    const arDay = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
    ).getDay();

    if (arDay === 0) {
      await logCron("skipped", 0, 0, 0, "Domingo — no se trabaja");
      return NextResponse.json({ ok: true, skipped: true, reason: "Domingo — no se trabaja" });
    }
    if (arHour < 7 || arHour >= 19) {
      await logCron("skipped", 0, 0, 0, `Fuera de horario (${arHour}hs AR)`);
      return NextResponse.json({ ok: true, skipped: true, reason: `Fuera de horario (${arHour}hs AR)` });
    }
  }

  try {
    const result = await pollQloudOrders();
    await logCron("ok", result.checked, result.imported, result.updated, `Rango ${result.rangoRevisado}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    await logCron("error", 0, 0, 0, msg);
    console.error("[poll-qloud] Error:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

async function logCron(status: string, checked: number, imported: number, updated: number, detalle: string) {
  try {
    await db.insert(cronLogs).values({
      job: "poll-qloud",
      status,
      checked,
      imported,
      updated,
      detalle,
    });
  } catch (e) {
    console.error("[poll-qloud] Error guardando log:", e);
  }
}

async function pollQloudOrders() {
  const [ultimo] = await db
    .select({ maxId: sql<number>`COALESCE(MAX(${orders.qloudId}), 0)` })
    .from(orders);

  const maxIdConocido = ultimo?.maxId ?? 0;

  if (maxIdConocido === 0) {
    console.log("[poll-qloud] No hay órdenes de Qloud en la BD, no se puede determinar rango");
    return { checked: 0, imported: 0, updated: 0, maxId: 0, rangoRevisado: "N/A" };
  }

  let imported = 0;
  let updated = 0;
  let checked = 0;
  let nuevoMaxId = maxIdConocido;

  const startId = Math.max(1, maxIdConocido - 4);
  const endId = maxIdConocido + LOOKAHEAD;

  console.log(`[poll-qloud] Revisando IDs ${startId} a ${endId} (último conocido: ${maxIdConocido})`);

  for (let id = startId; id <= endId; id++) {
    checked++;
    try {
      const qloudOrder = await fetchQloudOrder(id);
      if (!qloudOrder) continue;

      const tipoProducto = detectarTipoProducto(qloudOrder.productos);
      if (!tipoProducto) continue;

      const [existente] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.qloudId, id))
        .limit(1);

      const orderData = qloudOrderToNewOrder(qloudOrder);
      const cantidadTotal = (orderData.productos as Array<{ cantidad: number }> ?? [])
        .reduce((s, p) => s + p.cantidad, 0);
      const fechaEntregaEstimada = calcularFechaEntrega(new Date(), tipoProducto, cantidadTotal);

      // Vincular cliente
      const clienteId = await buscarOCrearClientePoll({
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
          .where(eq(orders.qloudId, id));
        updated++;
      } else {
        await db.insert(orders).values({ ...orderData, clienteId, fechaEntregaEstimada });
        imported++;
        console.log(`[poll-qloud] Nueva orden #${id} importada (${tipoProducto})`);
      }

      if (id > nuevoMaxId) nuevoMaxId = id;
    } catch (err) {
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

async function buscarOCrearClientePoll(datos: {
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
