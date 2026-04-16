"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { orders, reglasProducto, orderHistory } from "./db/schema";
import type { EstadoOrden, TipoOrden, TipoProducto, NewOrder, Producto } from "./db/schema";
import { auth } from "./auth";
import { redirect } from "next/navigation";
import { sendPedidoListoEmail, sendPedidoListoEnvioEmail } from "./email";
import { sendPedidoListoWhatsApp } from "./whatsapp";
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

  // Registrar en historial
  await db.insert(orderHistory).values({
    orderId,
    userId: session.user.id,
    userName: session.user.name ?? "Usuario",
    estadoAnterior: order.estado,
    estadoNuevo: nuevoEstado,
  });

  // Notificaciones automáticas cuando pasa a "listo"
  if (nuevoEstado === "listo") {
    // Email
    if (order.clienteEmail) {
      const emailFn = order.envioTipo === "domicilio"
        ? sendPedidoListoEnvioEmail
        : sendPedidoListoEmail;
      emailFn({
        clienteEmail: order.clienteEmail,
        clienteNombre: order.clienteNombre,
        referencia: order.referencia,
      }).catch(console.error);
    }

    // WhatsApp
    if (order.clienteTel) {
      sendPedidoListoWhatsApp({
        clienteTel: order.clienteTel,
        clienteNombre: order.clienteNombre,
        referencia: order.referencia,
        esRetiro: order.envioTipo === "retiro",
      }).catch(console.error);
    }
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

  // Registrar en historial
  await db.insert(orderHistory).values({
    orderId,
    userId: session.user.id,
    userName: session.user.name ?? "Usuario",
    estadoAnterior: order.estado,
    estadoNuevo: estadoAnterior,
  });

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

// ─── Guardar datos del cliente ────────────────────────────────────────────────

export async function guardarDatosCliente(
  orderId: string,
  datos: {
    clienteNombre: string | null;
    clienteEmail: string | null;
    clienteTel: string | null;
    clienteDni: string | null;
  }
) {
  const session = await auth();
  if (!session) redirect("/login");

  await db
    .update(orders)
    .set({
      clienteNombre: datos.clienteNombre || null,
      clienteEmail: datos.clienteEmail || null,
      clienteTel: datos.clienteTel || null,
      clienteDni: datos.clienteDni || null,
      updatedAt: new Date(),
    })
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

// ─── Importar comprobante de Contabilium ─────────────────────────────────────

export async function importarDesdeContabilium(params: {
  id: number;
  tipoFc: "FCA" | "FCB" | "COT" | "OV";
  tipoProducto: TipoProducto;
}): Promise<{ success: boolean; mensaje: string; orderId?: string }> {
  const session = await auth();
  if (!session) redirect("/login");

  const { id, tipoFc, tipoProducto } = params;

  const { getComprobanteById, getOrdenVentaById, parsearMontoAR, parsearFechaDDMMYYYY } = await import("./contabilium");

  let referencia: string;
  let clienteNombre: string | null = null;
  let clienteEmail: string | null = null;
  let clienteTel: string | null = null;
  let precio: string | null = null;
  let fechaVenta: Date;
  let productos: Producto[] = [];

  try {
    if (tipoFc === "OV") {
      const ov = await getOrdenVentaById(id);
      console.log("[Contabilium OV detalle]", JSON.stringify({ NumeroOrden: ov.NumeroOrden, ItemsCount: ov.Items?.length, Items: ov.Items?.slice(0, 2) }));
      referencia = ov.NumeroOrden;
      clienteNombre = ov.Comprador || null;
      clienteEmail = ov.Email || null;
      clienteTel = ov.Telefono || null;
      precio = String(parsearMontoAR(ov.Total));
      fechaVenta = ov.FechaCreacion.includes("T")
        ? new Date(ov.FechaCreacion)
        : parsearFechaDDMMYYYY(ov.FechaCreacion);
      if (ov.Items?.length) {
        productos = ov.Items.map((item) => ({
          sku: item.Codigo || "",
          nombre: item.Concepto || item.Nombre || "",
          cantidad: item.Cantidad,
          precio: item.PrecioUnitario,
        }));
      }
    } else {
      const comp = await getComprobanteById(id);
      console.log("[Contabilium Comp detalle]", JSON.stringify({ Numero: comp.Numero, ItemsCount: comp.Items?.length, Items: comp.Items?.slice(0, 2) }));
      referencia = comp.Numero;
      clienteNombre = comp.RazonSocial || null;
      clienteEmail = comp.Email || null;
      clienteTel = comp.Telefono || null;
      precio = String(parsearMontoAR(comp.ImporteTotalNeto));
      fechaVenta = new Date(comp.FechaEmision);
      if (comp.Items?.length) {
        productos = comp.Items.map((item) => ({
          sku: item.Codigo || "",
          nombre: item.Concepto || item.Nombre || "",
          cantidad: item.Cantidad,
          precio: item.PrecioUnitario,
        }));
      }
    }
  } catch (err) {
    return { success: false, mensaje: `Error al obtener el comprobante: ${err instanceof Error ? err.message : "error desconocido"}` };
  }

  const tipoOrdenMap: Record<string, TipoOrden> = {
    FCA: "factura_a",
    FCB: "factura_b",
    COT: "cotizacion",
    OV: "orden_venta",
  };

  const tipoOrden: TipoOrden = tipoOrdenMap[tipoFc] ?? "factura_b";
  const cantidadTotal = productos.reduce((s, p) => s + p.cantidad, 0) || 1;
  const fechaEntregaEstimada = calcularFechaEntrega(fechaVenta, tipoProducto, cantidadTotal);

  // Verificar si ya existe (por referencia)
  const [existing] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.referencia, referencia))
    .limit(1);

  if (existing) {
    // Si ya existe pero sin productos, actualizar los items
    if (productos.length > 0) {
      const [existingFull] = await db
        .select({ productos: orders.productos })
        .from(orders)
        .where(eq(orders.id, existing.id))
        .limit(1);

      if (!existingFull?.productos || (Array.isArray(existingFull.productos) && existingFull.productos.length === 0)) {
        await db
          .update(orders)
          .set({ productos, updatedAt: new Date() })
          .where(eq(orders.id, existing.id));
        revalidatePath("/");
        return {
          success: true,
          mensaje: `${referencia} actualizado con ${productos.length} producto(s)`,
          orderId: existing.id,
        };
      }
    }
    return {
      success: false,
      mensaje: `Ya existe un pedido con la referencia ${referencia}`,
      orderId: existing.id,
    };
  }

  const [inserted] = await db
    .insert(orders)
    .values({
      qloudId: null,
      tipoOrden,
      referencia,
      tipoProducto,
      clienteNombre,
      clienteEmail,
      clienteTel,
      clienteDni: null,
      productos: productos.length > 0 ? productos : null,
      envioTipo: null,
      envioDireccion: null,
      pagoTipo: null,
      precio,
      notas: null,
      estado: "pendiente",
      fechaVenta,
      fechaEntregaEstimada,
      fechaEntregaCustom: null,
    })
    .returning({ id: orders.id });

  revalidatePath("/");
  return {
    success: true,
    mensaje: `${referencia} importado correctamente`,
    orderId: inserted.id,
  };
}

// ─── Eliminar pedido ──────────────────────────────────────────────────────────

export async function eliminarPedido(orderId: string) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.rol !== "admin") {
    throw new Error("Solo los administradores pueden eliminar pedidos");
  }

  await db.delete(orders).where(eq(orders.id, orderId));

  revalidatePath("/");
}
