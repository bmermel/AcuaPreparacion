import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, orderHistory } from "@/lib/db/schema";
import type { Producto, DireccionEnvio, NotaInterna } from "@/lib/db/schema";
import { StatusStepper } from "@/components/status-stepper";
import { OrderActions } from "@/components/order-actions";
import { ClientEditor } from "@/components/client-editor";
import { NotasFull } from "@/components/notas-internas";

type Props = { params: Promise<{ id: string }> };

const TIPO_ORDEN_LABEL: Record<string, string> = {
  web: "Venta Web",
  factura_a: "FCA",
  factura_b: "FCB",
  cotizacion: "FC COT",
  orden_venta: "OV",
};

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) notFound();

  const historial = await db
    .select()
    .from(orderHistory)
    .where(eq(orderHistory.orderId, id))
    .orderBy(desc(orderHistory.createdAt));

  const productos = (order.productos as Producto[]) ?? [];
  const direccion = order.envioDireccion as DireccionEnvio | null;
  const notasInternas = (order.notasInternas as NotaInterna[] | null) ?? [];

  const total = productos.reduce(
    (sum, p) => sum + (p.precio ?? 0) * p.cantidad,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
            aria-label="Volver"
          >
            ←
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 truncate">
              {order.referencia}
            </h1>
            <p className="text-xs text-gray-400">{TIPO_ORDEN_LABEL[order.tipoOrden]}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Estado */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Estado
          </p>
          <StatusStepper estado={order.estado} />
        </div>

        {/* Acciones de estado */}
        <OrderActions order={order} />

        {/* Notas internas */}
        <NotasFull orderId={order.id} notas={notasInternas} />

        {/* Cliente (editable) */}
        <ClientEditor order={order} />

        {/* Productos */}
        {productos.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Productos
            </p>
            <div className="space-y-2">
              {productos.map((p, i) => (
                <div key={i} className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">
                      <span className="font-medium text-gray-600">{p.cantidad}x</span>{" "}
                      {p.nombre}
                    </p>
                    {p.sku && (
                      <p className="text-xs text-gray-400 mt-0.5">SKU: {p.sku}</p>
                    )}
                  </div>
                  {p.precio != null && (
                    <p className="text-sm text-gray-700 whitespace-nowrap">
                      ${(p.precio * p.cantidad).toLocaleString("es-AR")}
                    </p>
                  )}
                </div>
              ))}
              {total > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
                  <p className="text-xs font-semibold text-gray-500">Total</p>
                  <p className="text-sm font-semibold text-gray-800">
                    ${total.toLocaleString("es-AR")}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Envío */}
        {order.envioTipo && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Envío
            </p>
            {order.envioTipo === "retiro" ? (
              <p className="text-sm text-gray-700">🏪 Retiro en local</p>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-gray-700">🚚 Envío a domicilio</p>
                {direccion && (
                  <div className="text-xs text-gray-500 space-y-0.5 mt-1">
                    {direccion.calle && (
                      <p>
                        {direccion.calle}
                        {direccion.altura ? ` ${direccion.altura}` : ""}
                        {direccion.piso ? `, Piso ${direccion.piso}` : ""}
                        {direccion.puerta ? ` Depto ${direccion.puerta}` : ""}
                      </p>
                    )}
                    {(direccion.localidad || direccion.provincia) && (
                      <p>
                        {[direccion.localidad, direccion.provincia]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                    {direccion.cp && <p>CP: {direccion.cp}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pago */}
        {order.pagoTipo && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Pago
            </p>
            <p className="text-sm text-gray-700">💳 {order.pagoTipo}</p>
          </div>
        )}

        {/* Fechas */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Fechas
          </p>
          <div className="space-y-1.5">
            {order.fechaVenta && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Fecha de venta</span>
                <span className="text-gray-700 font-medium">
                  {new Date(order.fechaVenta).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Ingresado</span>
              <span className="text-gray-700 font-medium">
                {new Date(order.createdAt).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Última actualización</span>
              <span className="text-gray-700 font-medium">
                {new Date(order.updatedAt).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Historial de cambios */}
        {historial.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Historial de cambios
            </p>
            <div className="space-y-3">
              {historial.map((h) => (
                <div key={h.id} className="flex gap-3 items-start">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700">
                      <span className="font-medium">{h.userName}</span>
                      {h.estadoAnterior && h.estadoNuevo ? (
                        <> cambió de <span className="font-medium">{h.estadoAnterior}</span> a <span className="font-medium">{h.estadoNuevo}</span></>
                      ) : h.campo ? (
                        <> modificó <span className="font-medium">{h.campo}</span></>
                      ) : (
                        <> realizó un cambio</>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(h.createdAt).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Zona peligrosa */}
        <div className="bg-white rounded-xl border border-red-100 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Zona peligrosa
          </p>
          <form
            action={async () => {
              "use server";
              const { eliminarPedido } = await import("@/lib/actions");
              await eliminarPedido(id);
            }}
          >
            <button
              type="submit"
              className="w-full py-2 px-3 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg transition-colors"
            >
              Eliminar pedido
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
