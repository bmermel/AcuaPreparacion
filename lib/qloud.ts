import type { TipoProducto, Producto, NewOrder } from "./db/schema";

const QLOUD_USER = process.env.QLOUD_USER!;
const QLOUD_PASS = process.env.QLOUD_PASS!;
const QLOUD_API_URL = process.env.QLOUD_API_URL!;

// ─── Tipos de respuesta de la API ─────────────────────────────────────────────

type QloudCliente = {
  id: number;
  DNI: string;
  CUIT: string;
  nombre: string;
  email: string;
  tel: string;
};

type QloudProducto = {
  sku: string;
  nombre: string;
  cantidad: string | number;
  precio: number;
  precio_financiado?: number;
};

type QloudDireccion = {
  calle?: string;
  altura?: string;
  piso?: string;
  puerta?: string;
  localidad?: string;
  provincia?: string;
  CP?: string;
};

type QloudEnvio = {
  tipo: string;
  costo: string | number;
  free: number;
  direccion?: QloudDireccion | null;
};

type QloudPago = {
  tipo: string;
  pagos?: Array<{
    ID: string;
    fecha: string;
    valor: number;
    estatus: string;
    estatusDetalle: string;
    detalle?: {
      tipo: string;
      banco: string;
      cuotas: number;
      valor_cuota: number;
    };
  }>;
  comprobante?: Array<{
    archivo: string;
    titular: string;
    fecha: string;
  }>;
};

export type QloudOrder = {
  ventaWeb: number;
  ciente: QloudCliente;
  fecha: string;
  productos: QloudProducto[];
  envio: QloudEnvio;
  precio: string | number;
  precio_financiado: number;
  descuento: string | number;
  descuentoCupon?: string | number;
  pago: QloudPago;
  facturaA?: number;
  mensaje?: string;
  estado: string;
  finalizada: number;
};

// ─── Fetch de orden ───────────────────────────────────────────────────────────

export async function fetchQloudOrder(id: number): Promise<QloudOrder | null> {
  const credentials = Buffer.from(`${QLOUD_USER}:${QLOUD_PASS}`).toString(
    "base64"
  );

  const res = await fetch(`${QLOUD_API_URL}/orders/${id}/`, {
    headers: { Authorization: `Basic ${credentials}` },
    // No cachear — siempre datos frescos
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = await res.json();
  // La API devuelve un array con un elemento
  return Array.isArray(data) ? data[0] : data;
}

// ─── Clasificación de productos ───────────────────────────────────────────────

/**
 * Determina si un producto de Qloud corresponde a la categoría Computadoras
 * y si es notebook o computadora de escritorio/all-in-one.
 *
 * Subcategorías del sitio que SE INCLUYEN:
 *   Notebooks → 'notebook'
 *   All in one, Mini PC, PC Con Monitor, PC Gamer, PC Gamer Pro, PC Oficina → 'computadora'
 *
 * Se IGNORAN: Fundas, Base Cooler, accesorios
 */
export function clasificarProducto(
  nombre: string
): TipoProducto | null {
  const n = nombre.toLowerCase();

  // Notebooks
  if (n.includes("notebook") || n.includes("laptop")) return "notebook";

  // All in One
  if (n.includes("all in one") || n.includes("all-in-one") || n.includes("allinone")) return "all_in_one";

  // Computadoras de escritorio / Mini PC
  const keywordsComputadora = [
    "mini pc",
    "minipc",
    "pc gamer",
    "pc con monitor",
    "pc oficina",
    "pc escritorio",
    "desktop",
    "computadora de escritorio",
  ];

  if (keywordsComputadora.some((k) => n.includes(k))) return "computadora";

  return null; // funda, cooler, accesorio → ignorar
}

/**
 * Analiza todos los productos de la orden y determina el tipo global.
 * Si hay mezcla de tipos, usa el primero encontrado.
 */
export function detectarTipoProducto(
  productos: QloudProducto[]
): TipoProducto | null {
  const tipos = new Set<TipoProducto>();
  for (const p of productos) {
    const tipo = clasificarProducto(p.nombre);
    if (tipo) tipos.add(tipo);
  }
  if (tipos.size === 0) return null;
  if (tipos.size === 1) return [...tipos][0];
  // Mezcla: priorizar notebook > all_in_one > computadora
  if (tipos.has("notebook")) return "notebook";
  if (tipos.has("all_in_one")) return "all_in_one";
  return "computadora";
}

// ─── Conversión a formato interno ─────────────────────────────────────────────

export function qloudOrderToNewOrder(order: QloudOrder): Omit<NewOrder, "id"> {
  const tipoProducto = detectarTipoProducto(order.productos);
  if (!tipoProducto) {
    throw new Error("La orden no contiene productos de la categoría Computadoras");
  }

  const productos: Producto[] = order.productos.map((p) => ({
    sku: p.sku,
    nombre: p.nombre,
    cantidad: Number(p.cantidad),
    precio: p.precio,
  }));

  const esRetiro =
    order.envio.tipo.toLowerCase().includes("retiro") ||
    order.envio.tipo.toLowerCase().includes("local");

  return {
    qloudId: order.ventaWeb,
    tipoOrden: "web",
    referencia: `#${order.ventaWeb}`,
    tipoProducto,
    clienteNombre: order.ciente.nombre,
    clienteEmail: order.ciente.email,
    clienteTel: order.ciente.tel,
    clienteDni: order.ciente.DNI,
    productos,
    envioTipo: esRetiro ? "retiro" : "domicilio",
    envioDireccion: esRetiro
      ? null
      : {
          calle: order.envio.direccion?.calle,
          altura: order.envio.direccion?.altura,
          piso: order.envio.direccion?.piso,
          puerta: order.envio.direccion?.puerta,
          localidad: order.envio.direccion?.localidad,
          provincia: order.envio.direccion?.provincia,
          cp: order.envio.direccion?.CP,
        },
    pagoTipo: order.pago.tipo,
    precio: String(order.precio),
    notas: order.mensaje || null,
    estado: "pendiente",
    fechaVenta: new Date(order.fecha),
  };
}
