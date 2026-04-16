"use server";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  buscarComprobantes,
  buscarOrdenesVenta,
  parsearMontoAR,
  parsearFechaDDMMYYYY,
  type TipoFc,
} from "@/lib/contabilium";
import { importarDesdeContabilium } from "@/lib/actions";
import type { TipoProducto } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

/** Formato normalizado que el cliente muestra */
export type DocumentoNormalizado = {
  id: number;
  tipoFc: TipoFc;
  numero: string;
  razonSocial: string;
  fechaEmision: string;   // ISO string para consistencia
  monto: number;
  existeEnAcua?: {
    orderId: string;
    estado: string;
  } | null;
};

export async function buscarContabilium(params: {
  fechaDesde: string;
  fechaHasta: string;
  tipos: TipoFc[];
  filtro?: string;
}): Promise<{ documentos: DocumentoNormalizado[] } | { error: string }> {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.rol !== "admin") return { error: "Sin permiso" };

  const { fechaDesde, fechaHasta, tipos, filtro = "" } = params;

  try {
    const resultados: DocumentoNormalizado[] = [];

    // Buscar comprobantes (FCA, FCB, COT)
    const tiposComprobante = tipos.filter((t) => t !== "OV") as ("FCA" | "FCB" | "COT")[];
    if (tiposComprobante.length > 0) {
      const res = await buscarComprobantes({ fechaDesde, fechaHasta, filtro });
      const items = (res.Items ?? []).filter((item) =>
        tiposComprobante.includes(item.TipoFc as "FCA" | "FCB" | "COT")
      );
      for (const item of items) {
        resultados.push({
          id: item.Id,
          tipoFc: item.TipoFc as TipoFc,
          numero: item.Numero,
          razonSocial: item.RazonSocial,
          fechaEmision: item.FechaEmision,
          monto: parsearMontoAR(item.ImporteTotalNeto),
        });
      }
    }

    // Buscar órdenes de venta
    if (tipos.includes("OV")) {
      const res = await buscarOrdenesVenta({ fechaDesde, fechaHasta, filtro });
      const items = res.Items ?? [];
      for (const item of items) {
        resultados.push({
          id: item.ID,
          tipoFc: "OV",
          numero: item.NumeroOrden,
          razonSocial: item.Comprador,
          fechaEmision: item.FechaCreacion.includes("T")
            ? item.FechaCreacion
            : parsearFechaDDMMYYYY(item.FechaCreacion).toISOString(),
          monto: parsearMontoAR(item.Total),
        });
      }
    }

    // Verificar cuáles ya existen en Acua
    if (resultados.length > 0) {
      const referencias = resultados.map((r) => r.numero);
      const existentes = await db
        .select({
          id: orders.id,
          referencia: orders.referencia,
          estado: orders.estado,
        })
        .from(orders)
        .where(inArray(orders.referencia, referencias));

      const mapaExistentes = new Map(
        existentes.map((e) => [e.referencia, { orderId: e.id, estado: e.estado }])
      );

      for (const doc of resultados) {
        doc.existeEnAcua = mapaExistentes.get(doc.numero) ?? null;
      }
    }

    // Ordenar por fecha desc
    resultados.sort(
      (a, b) => new Date(b.fechaEmision).getTime() - new Date(a.fechaEmision).getTime()
    );

    return { documentos: resultados };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error al conectar con Contabilium" };
  }
}

export async function importarContabilium(params: {
  id: number;
  tipoFc: TipoFc;
  tipoProducto: TipoProducto;
}): Promise<{ success: boolean; mensaje: string; orderId?: string }> {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.rol !== "admin") return { success: false, mensaje: "Sin permiso" };

  return importarDesdeContabilium(params);
}
