"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { orders, reglasProducto } from "./db/schema";
import type { EstadoOrden, TipoOrden, TipoProducto, NewOrder } from "./db/schema";
import { auth } from "./auth";
import { redirect } from "next/navigation";
import { sendPedidoListoEmail } from "./email";
import { calcularFechaEntrega } from "./delivery";
import { fetchQloudOrder, qloudOrderToNewOrder } from "./qloud";

// ─── Avanzar estado ───────────────────────────────────────────────────────────

const ESTADOS: EstadoOrden[] = ["pendiente", "preparacion", "listo", "despachado"];

export async function avanzarEstado(orderId: string) {
  const session = await auth();
  if (!session) redirect("/login");

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) throw new Error("Pedido no encontrado");

  const idxActual = ESTADOS.indexOf(order.estado);
  if (idxActual === ESTADOS.length - 1) return;

  const nuevoEstado = ESTADOS[idxActual + 1];

  await db
    .update(orders)
    .set({ estado: nuevoEstado, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  // Email automático cuando pasa a "listo" y es retiro en local
  if (nuevoEstado === "listo" && order.envioTipo === "retiro" && order.clienteEmail) {
    sendPedidoListoEmail({
      clienteEmail: order.clienteEmail,
      clienteNombre: order.clienteNombre,
      referencia: order.referencia,
    }).catch(console.error);
  }

  revalidatePath("/");
  revalidatePath(`/orders/${orderId}`);
}

// ─── Retroceder estado ────────────────────────────────────────────────────────

export async function retrocederEstado(orderId: string) {
  const session = await auth();
  if (!session) redirect("/login");

  const [order] = await db
    .select({ estado: orders.estado })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) throw new Error("Pedido no encontrado");

  const idxActual = ESTADOS.indexOf(order.estado);
  if (idxActual === 0) return;

  const estadoAnterior = ESTADOS[idxActual - 1];

  await db
    .update(orders)
    .set({ estado: estadoAnterior, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  revalidatePath("/");
  revalidatePath(`/orders/${orderId}`);
}

// ─── Guardar notas ────────────────────────────────────────────────────────────

export async function guardarNotas(orderId: string, notas: string) {
  const session = await auth();
  if (!session) redirect("/login");

  await db
    .update(orders)
    .set({ notas, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  revalidatePath("/");
  revalidatePath(`/orders/${orderId}`);
}

// ─── Crear pedido manual ──────────────────────────────────────────────────────

export async function crearPedidoManual(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

  const tipoOrden = formData.get("tipoOrden") as TipoOrden;
  const referencia = (formData.get("referencia") as string).trim();
  const tipoProducto = formData.get("tipoProducto") as TipoProducto;
  const clienteNombre = (formData.get("clienteNombre") as string)?.trim() || null;
  const clienteEmail = (formData.get("clienteEmail") as string)?.trim() || null;
  const clienteTel = (formData.get("clienteTel") as string)?.trim() || null;
  const notas = (formData.get("notas") as string)?.trim() || null;
  const fechaCustomStr = formData.get("fechaEntregaCustom") as string;

  if (!tipoOrden || !referencia || !tipoProducto) {
    throw new Error("Faltan campos requeridos");
  }

  const ahora = new Date();
  const fechaEntregaEstimada = calcularFechaEntrega(ahora, tipoProducto, 1);
  const fechaEntregaCustom = fechaCustomStr ? new Date(fechaCustomStr) : null;

  const newOrder: Omit<NewOrder, "id"> = {
    qloudId: null,
    tipoOrden,
    referencia,
    tipoProducto,
    clienteNombre,
    clienteEmail,
    clienteTel,
    clienteDni: null,
    productos: null,
    envioTipo: null,
    envioDireccion: null,
    pagoTipo: null,
    precio: null,
    notas,
    estado: "pendiente",
    fechaVenta: ahora,
    fechaEntregaEstimada,
    fechaEntregaCustom,
  };

  await db.insert(orders).values(newOrder);
  revalidatePath("/");
  redirect("/");
}

// ─── Actualizar fecha de entrega custom ───────────────────────────────────────

export async function actualizarFechaEntregaCustom(orderId: string, fecha: Date | null) {
  const session = await auth();
  if (!session) redirect("/login");

  await db
    .update(orders)
    .set({ fechaEntregaCustom: fecha, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  revalidatePath("/");
  revalidatePath(`/orders/${orderId}`);
}

// ─── Importar pedido desde Qloud por ID ──────────────────────────────────────

export async function importarDesdeQloud(qloudId: number): Promise<{
  success: boolean;
  mensaje: string;
  orderId?: string;
  productosNoClasificados?: string[];
}> {
  const session = await auth();
  if (!session) redirect("/login");

  const qloudOrder = await fetchQloudOrder(qloudId);
  if (!qloudOrder) {
    return { success: false, mensaje: `No se encontró el pedido #${qloudId} en Qloud` };
  }

  // Detectar productos no clasificados para mostrar al usuario
  const { clasificarProducto } = await import("./qloud");
  const productosNoClasificados = qloudOrder.productos
    .filter((p) => clasificarProducto(p.nombre) === null)
    .map((p) => p.nombre);

  let newOrder: Omit<NewOrder, "id">;
  try {
    newOrder = qloudOrderToNewOrder(qloudOrder);
  } catch {
    return {
      success: false,
      mensaje: `El pedido #${qloudId} no tiene productos de computadoras`,
      productosNoClasificados,
    };
  }

  // Calcular fecha estimada
  const cantidadTotal = (newOrder.productos as Array<{ cantidad: number }> ?? [])
    .reduce((s, p) => s + p.cantidad, 0);
  const fechaEntregaEstimada = calcularFechaEntrega(
    new Date(),
    newOrder.tipoProducto,
    cantidadTotal
  );

  // Upsert
  const [existing] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.qloudId, qloudId))
    .limit(1);

  let orderId: string;
  if (existing) {
    await db
      .update(orders)
      .set({ ...newOrder, fechaEntregaEstimada, updatedAt: new Date() })
      .where(eq(orders.qloudId, qloudId));
    orderId = existing.id;
  } else {
    const [inserted] = await db
      .insert(orders)
      .values({ ...newOrder, fechaEntregaEstimada })
      .returning({ id: orders.id });
    orderId = inserted.id;
  }

  revalidatePath("/");
  return {
    success: true,
    mensaje: existing
      ? `Pedido #${qloudId} actualizado correctamente`
      : `Pedido #${qloudId} importado correctamente`,
    orderId,
    productosNoClasificados: productosNoClasificados.length > 0 ? productosNoClasificados : undefined,
  };
}

// ─── Guardar regla de clasificación ──────────────────────────────────────────

export async function guardarReglaProducto(patron: string, tipoProducto: TipoProducto) {
  const session = await auth();
  if (!session) redirect("/login");

  await db.insert(reglasProducto).values({
    patron: patron.toLowerCase().trim(),
    tipoProducto,
    creadoPor: session.user.email ?? "desconocido",
  });
}

// ─── Eliminar pedido ──────────────────────────────────────────────────────────

export async function eliminarPedido(orderId: string) {
  const session = await auth();
  if (!session) redirect("/login");

  await db.delete(orders).where(eq(orders.id, orderId));

  revalidatePath("/");
  redirect("/");
}
