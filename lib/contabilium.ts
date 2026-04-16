/**
 * Cliente Contabilium — autenticación y consultas de comprobantes / órdenes de venta.
 * Documentación: API REST Contabilium (Postman collection del equipo)
 */

const BASE_URL = "https://rest.contabilium.com";

// ─── Auth ─────────────────────────────────────────────────────────────────────

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const clientId = process.env.CONTABILIUM_CLIENT_ID;
  const clientSecret = process.env.CONTABILIUM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Faltan variables de entorno CONTABILIUM_CLIENT_ID / CONTABILIUM_CLIENT_SECRET");
  }

  const res = await fetch(`${BASE_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`Contabilium auth error: ${res.status}`);
  }

  const data = await res.json();
  // expires_in en segundos; restamos 60s de margen
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.value;
}

async function apiFetch(path: string): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    // No cachear en Next.js
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Contabilium API error ${res.status}: ${path}`);
  }

  return res.json();
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoFc = "FCA" | "FCB" | "COT" | "OV";

export interface ComprobanteResumen {
  Id: number;
  RazonSocial: string;
  FechaEmision: string;      // "YYYY-MM-DDT00:00:00"
  Numero: string;            // "0007-00065017"
  ImporteTotalNeto: string;  // "493.023,46" (string con formato AR)
  TipoFc: string;            // "FCA", "FCB", "COT", etc.
}

export interface ComprobanteItem {
  Codigo: string;
  Nombre: string;
  Concepto?: string;
  Cantidad: number;
  PrecioUnitario: number;
  Total: number;
}

export interface ComprobanteDetalle {
  Id: number;
  RazonSocial: string;
  Email: string | null;
  Telefono: string | null;
  FechaEmision: string;
  Numero: string;
  TipoFc: string;
  ImporteTotalNeto: string;
  Items: ComprobanteItem[];
}

export interface OrdenVentaResumen {
  ID: number;
  Comprador: string;
  FechaCreacion: string;   // "DD/MM/YYYY"
  NumeroOrden: string;     // "00004122"
  Total: string;           // "2.720,00"
  Estado: string;
}

export interface OrdenVentaDetalle {
  ID: number;
  Comprador: string;
  Email: string | null;
  Telefono: string | null;
  FechaCreacion: string;
  NumeroOrden: string;
  Total: string;
  Estado: string;
  Items: ComprobanteItem[];
}

export interface BusquedaResult {
  Items: ComprobanteResumen[];
  PageCount: number;
  PageIndex: number;
  TotalItems: number;
}

// ─── Comprobantes (Facturas A, B, Cotizaciones) ───────────────────────────────

export async function buscarComprobantes(params: {
  fechaDesde: string;   // "YYYY-MM-DD"
  fechaHasta: string;
  tipoFc?: TipoFc;
  page?: number;
  filtro?: string;
}): Promise<BusquedaResult> {
  const { fechaDesde, fechaHasta, tipoFc, page = 1, filtro = "" } = params;

  const qs = new URLSearchParams({
    fechaDesde,
    fechaHasta,
    page: String(page),
    filtro,
  });

  if (tipoFc && tipoFc !== "OV") {
    qs.set("tipo", tipoFc);
  }

  const data = await apiFetch(`/api/comprobantes/search?${qs.toString()}`);
  return data as BusquedaResult;
}

export async function getComprobanteById(id: number): Promise<ComprobanteDetalle> {
  const data = await apiFetch(`/api/comprobantes/?id=${id}`);
  return data as ComprobanteDetalle;
}

// ─── Órdenes de Venta ─────────────────────────────────────────────────────────

export interface OVBusquedaResult {
  Items: OrdenVentaResumen[];
  PageCount: number;
  PageIndex: number;
  TotalItems: number;
}

export async function buscarOrdenesVenta(params: {
  fechaDesde: string;
  fechaHasta: string;
  page?: number;
  filtro?: string;
}): Promise<OVBusquedaResult> {
  const { fechaDesde, fechaHasta, page = 1, filtro = "" } = params;

  const qs = new URLSearchParams({
    fechaDesde,
    fechaHasta,
    page: String(page),
    filtro,
  });

  const data = await apiFetch(`/api/ordenesVenta/search?${qs.toString()}`);
  return data as OVBusquedaResult;
}

export async function getOrdenVentaById(id: number): Promise<OrdenVentaDetalle> {
  const data = await apiFetch(`/api/ordenesVenta/?id=${id}`);
  return data as OrdenVentaDetalle;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parsea montos en formato AR ("493.023,46") a number */
export function parsearMontoAR(str: string | number | null | undefined): number {
  if (str == null) return 0;
  if (typeof str === "number") return str;
  // Quitar puntos de miles, cambiar coma decimal a punto
  const limpio = str.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpio);
  return isNaN(n) ? 0 : n;
}

/** Parsea fecha DD/MM/YYYY a Date */
export function parsearFechaDDMMYYYY(str: string): Date {
  const [d, m, y] = str.split("/");
  return new Date(`${y}-${m}-${d}T00:00:00`);
}

export function formatFechaContabilium(fechaStr: string): string {
  // Puede venir como "YYYY-MM-DDT00:00:00" o "DD/MM/YYYY"
  const fecha = fechaStr.includes("T") ? new Date(fechaStr) : parsearFechaDDMMYYYY(fechaStr);
  return fecha.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatMoneda(monto: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(monto);
}
