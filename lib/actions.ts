"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { orders } from "./db/schema";
import type { EstadoOrden, TipoOrden, TipoProducto, NewOrder } from "./db/schema";
import { auth } from "./auth";
import { redirect } from "next/navigation";

// ─── Avanzar estado de un pedido ──────────────────────────────────────────────

const ESTADOS: EstadoOrden[] = ["pendiente", "preparacion", "listo", "despachado"];

export async function avanzarEstado(orderId: string) {
  const session = await auth();
  if (!session) redirect("/login");

  const [order] = await db
    .select({ estado: orders.estado })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) throw new Error("Pedido no encontrado");

  const idxActual = ESTADOS.indexOf(order.estado);
  if (idxActual === ESTADOS.length - 1) return; // ya está despachado

  const nuevoEstado = ESTADOS[idxActual + 1];

  await db
    .update(orders)
    .set({ estado: nuevoEstado, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  revalidatePath("/");
  revalidatePath(`/orders/${orderId}`);
}

// ─── Retroceder estado de un pedido ───────────────────────────────────────────

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
  if (idxActual === 0) return; // ya está en pendiente

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
  const clienteTel = (formData.get("clienteTel") as string)?.trim() || null;
  const notas = (formData.get("notas") as string)?.trim() || null;

  if (!tipoOrden || !referencia || !tipoProducto) {
    throw new Error("Faltan campos requeridos");
  }

  const newOrder: Omit<NewOrder, "id"> = {
    qloudId: null,
    tipoOrden,
    referencia,
    tipoProducto,
    clienteNombre,
    clienteEmail: null,
    clienteTel,
    clienteDni: null,
    productos: null,
    envioTipo: null,
    envioDireccion: null,
    pagoTipo: null,
    precio: null,
    notas,
    estado: "pendiente",
    fechaVenta: new Date(),
  };

  await db.insert(orders).values(newOrder);
  revalidatePath("/");
  redirect("/");
}

// ─── Eliminar pedido ──────────────────────────────────────────────────────────

export async function eliminarPedido(orderId: string) {
  const session = await auth();
  if (!session) redirect("/login");

  await db.delete(orders).where(eq(orders.id, orderId));

  revalidatePath("/");
  redirect("/");
}
