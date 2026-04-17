import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import type { Producto, DireccionEnvio, NotaInterna } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PrintTrigger, PrintButton } from "./print-trigger";

const TIPO_ORDEN_LABEL: Record<string, string> = {
  web: "Venta Web",
  factura_a: "FCA",
  factura_b: "FCB",
  cotizacion: "FC COT",
  orden_venta: "OV",
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  preparacion: "En preparacion",
  listo: "Listo",
  despachado: "Despachado",
};

function formatFecha(fecha: Date | string | null): string {
  if (!fecha) return "-";
  const d = new Date(fecha);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

type Props = { searchParams: Promise<{ ids?: string }> };

export default async function PrintPage({ searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { ids } = await searchParams;
  if (!ids) {
    return (
      <div className="p-8 text-center text-gray-500">
        No se especificaron pedidos para imprimir.
      </div>
    );
  }

  const idList = ids.split(",").filter(Boolean);
  if (idList.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No se especificaron pedidos para imprimir.
      </div>
    );
  }

  const pedidos = await db
    .select()
    .from(orders)
    .where(inArray(orders.id, idList));

  // Mantener el orden original de los IDs
  const pedidosOrdenados = idList
    .map((id) => pedidos.find((p) => p.id === id))
    .filter(Boolean) as typeof pedidos;

  return (
    <>
      <PrintTrigger />
      <div className="print-page">
        <style>{`
          @media print {
            @page {
              margin: 12mm 10mm;
              size: A4;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .no-print {
              display: none !important;
            }
            .print-card {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
          @media screen {
            .print-page {
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              background: #f9fafb;
              min-height: 100vh;
            }
          }
        `}</style>

        {/* Boton volver (solo pantalla) */}
        <div className="no-print mb-4 flex items-center gap-3">
          <a
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            &larr; Volver al dashboard
          </a>
          <PrintButton />
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-lg font-bold text-gray-900">
            Acua &mdash; Pedidos
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            {pedidosOrdenados.length} pedido{pedidosOrdenados.length !== 1 ? "s" : ""} &middot; Impreso el {formatFecha(new Date())}
          </p>
        </div>

        {/* Cards */}
        <div className="space-y-4">
          {pedidosOrdenados.map((order) => {
            const productos = (order.productos as Producto[]) ?? [];
            const direccion = order.envioDireccion as DireccionEnvio | null;
            const notasInternas = (order.notasInternas as NotaInterna[] | null) ?? [];
            const notasImprimibles = notasInternas.filter((n) => n.imprimible);
            const total = productos.reduce(
              (sum, p) => sum + (p.precio ?? 0) * p.cantidad,
              0
            );

            return (
              <div
                key={order.id}
                className="print-card bg-white border border-gray-300 rounded-lg p-5"
              >
                {/* Encabezado */}
                <div className="flex items-start justify-between gap-3 mb-3 border-b border-gray-200 pb-3">
                  <div>
                    <span className="text-base font-bold text-gray-900">
                      {order.referencia}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      {TIPO_ORDEN_LABEL[order.tipoOrden]}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 border border-gray-300">
                    {ESTADO_LABEL[order.estado] ?? order.estado}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {/* Cliente */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      Cliente
                    </p>
                    {order.clienteNombre && (
                      <p className="font-medium text-gray-800">
                        {order.clienteNombre}
                      </p>
                    )}
                    {order.clienteTel && (
                      <p className="text-xs text-gray-600">
                        Tel: {order.clienteTel}
                      </p>
                    )}
                    {order.clienteEmail && (
                      <p className="text-xs text-gray-600">
                        {order.clienteEmail}
                      </p>
                    )}
                    {order.clienteDni && (
                      <p className="text-xs text-gray-600">
                        DNI: {order.clienteDni}
                      </p>
                    )}
                    {!order.clienteNombre && !order.clienteTel && !order.clienteEmail && (
                      <p className="text-xs text-gray-400 italic">Sin datos de cliente</p>
                    )}
                  </div>

                  {/* Envio + Fechas */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      Detalles
                    </p>
                    {order.envioTipo && (
                      <p className="text-xs text-gray-700">
                        {order.envioTipo === "retiro"
                          ? "Retiro en local"
                          : "Envio a domicilio"}
                      </p>
                    )}
                    {direccion && order.envioTipo === "domicilio" && (
                      <p className="text-xs text-gray-600">
                        {[
                          direccion.calle,
                          direccion.altura,
                          direccion.piso ? `Piso ${direccion.piso}` : null,
                          direccion.localidad,
                          direccion.provincia,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                    {order.fechaVenta && (
                      <p className="text-xs text-gray-600">
                        Fecha venta: {formatFecha(order.fechaVenta)}
                      </p>
                    )}
                    {(order.fechaEntregaCustom || order.fechaEntregaEstimada) && (
                      <p className="text-xs text-gray-600">
                        Entrega est.: {formatFecha(order.fechaEntregaCustom ?? order.fechaEntregaEstimada)}
                      </p>
                    )}
                    {order.precio && (
                      <p className="text-xs font-medium text-gray-700 mt-1">
                        Total: ${Number(order.precio).toLocaleString("es-AR")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Productos */}
                {productos.length > 0 && (
                  <div className="mt-3 border-t border-gray-200 pt-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Productos
                    </p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="pb-1 font-medium">Cant.</th>
                          <th className="pb-1 font-medium">Producto</th>
                          <th className="pb-1 font-medium">SKU</th>
                          <th className="pb-1 font-medium text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productos.map((p, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="py-1 text-gray-700">{p.cantidad}</td>
                            <td className="py-1 text-gray-800">{p.nombre}</td>
                            <td className="py-1 text-gray-500">{p.sku || "-"}</td>
                            <td className="py-1 text-gray-700 text-right">
                              {p.precio != null
                                ? `$${(p.precio * p.cantidad).toLocaleString("es-AR")}`
                                : "-"}
                            </td>
                          </tr>
                        ))}
                        {total > 0 && (
                          <tr>
                            <td colSpan={3} className="pt-1 text-right font-semibold text-gray-600">
                              Total:
                            </td>
                            <td className="pt-1 text-right font-semibold text-gray-800">
                              ${total.toLocaleString("es-AR")}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Notas imprimibles */}
                {notasImprimibles.length > 0 && (
                  <div className="mt-3 border-t border-gray-200 pt-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      Notas
                    </p>
                    <div className="space-y-1">
                      {notasImprimibles.map((n) => (
                        <p key={n.id} className="text-xs text-gray-700">
                          <span className="font-semibold">{n.userName}:</span> {n.mensaje}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
