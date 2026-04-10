"use server";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  buscarComprobantes,
  buscarOrdenesVenta,
  type TipoFc,
  type ComprobanteResumen,
  type OrdenVentaResumen,
} from "@/lib/contabilium";
import { importarDesdeContabilium } from "@/lib/actions";
import type { TipoProducto } from "@/lib/db/schema";

type DocumentoConTipo = (ComprobanteResumen | OrdenVentaResumen) & { _tipoFc: TipoFc };

export async function buscarContabilium(params: {
  fechaDesde: string;
  fechaHasta: string;
  tipos: TipoFc[];
}): Promise<{ documentos: DocumentoConTipo[] } | { error: string }> {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.rol !== "admin") return { error: "Sin permiso" };

  const { fechaDesde, fechaHasta, tipos } = params;

  try {
    const resultados: DocumentoConTipo[] = [];

    // Buscar comprobantes (FCA, FCB, COT)
    const tiposComprobante = tipos.filter((t) => t !== "OV") as ("FCA" | "FCB" | "COT")[];
    if (tiposComprobante.length > 0) {
      // Traer todos y filtrar por tipo en cliente
      const res = await buscarComprobantes({ fechaDesde, fechaHasta });
      const items = (res.Items ?? []).filter((item) =>
        tiposComprobante.includes(item.TipoFc as "FCA" | "FCB" | "COT")
      );
      for (const item of items) {
        resultados.push({ ...item, _tipoFc: item.TipoFc as TipoFc });
      }
    }

    // Buscar órdenes de venta
    if (tipos.includes("OV")) {
      const res = await buscarOrdenesVenta({ fechaDesde, fechaHasta });
      const items = res.Items ?? [];
      for (const item of items) {
        resultados.push({ ...item, _tipoFc: "OV" as TipoFc });
      }
    }

    // Ordenar por fecha desc
    resultados.sort(
      (a, b) => new Date(b.FechaEmision).getTime() - new Date(a.FechaEmision).getTime()
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
