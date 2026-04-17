"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Order, Producto, NotaInterna } from "@/lib/db/schema";
import { EstadoBadge } from "./status-stepper";
import { avanzarEstado, eliminarPedido } from "@/lib/actions";
import { NotasCompact } from "./notas-internas";

const NEXT_ESTADO_LABELS = {
  pendiente: "Marcar en preparación",
  preparacion: "Marcar como listo",
  listo: "Marcar como despachado",
  despachado: null,
};

const TIPO_ORDEN_LABEL: Record<string, string> = {
  web: "Web",
  factura_a: "FCA",
  factura_b: "FCB",
  cotizacion: "FC COT",
  orden_venta: "OV",
};

function formatFechaEntrega(fecha: Date | string | null): string | null {
  if (!fecha) return null;
  const d = new Date(fecha);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}, ${hh}:${min}`;
}

type OrderCardProps = {
  order: Order;
  modoSeleccion?: boolean;
  seleccionado?: boolean;
  onToggleSeleccion?: (id: string) => void;
  onImprimir?: (id: string) => void;
  rol?: "admin" | "tecnico";
};

export function OrderCard({
  order,
  modoSeleccion = false,
  seleccionado = false,
  onToggleSeleccion,
  onImprimir,
  rol,
}: OrderCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [deleted, setDeleted] = useState(false);

  const productos = (order.productos as Producto[]) ?? [];
  const notasInternas = (order.notasInternas as NotaInterna[] | null) ?? [];
  const nextLabel = NEXT_ESTADO_LABELS[order.estado];

  const fechaEntrega = order.fechaEntregaCustom ?? order.fechaEntregaEstimada;
  const fechaEntregaStr = formatFechaEntrega(fechaEntrega);
  const esCustom = !!order.fechaEntregaCustom;

  function handleAvanzar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(() => avanzarEstado(order.id));
  }

  function handleCheckbox(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onToggleSeleccion?.(order.id);
  }

  function handleImprimir(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onImprimir?.(order.id);
  }

  function handleEliminar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Eliminar pedido ${order.referencia}?`)) return;
    startDeleting(async () => {
      await eliminarPedido(order.id);
      setDeleted(true);
    });
  }

  if (deleted) return null;

  return (
    <div
      className={`bg-white border rounded-xl p-4 transition-all ${
        seleccionado
          ? "border-blue-400 ring-2 ring-blue-200 shadow-sm"
          : "border-gray-200 hover:shadow-md"
      }`}
    >
      {/* Zona clickeable: navega al detalle */}
      <Link
        href={modoSeleccion ? "#" : `/orders/${order.id}`}
        onClick={modoSeleccion ? (e) => { e.preventDefault(); onToggleSeleccion?.(order.id); } : undefined}
        className="block cursor-pointer"
      >
        {/* Header: checkbox/referencia + badge + botones */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {modoSeleccion && (
              <div
                onClick={handleCheckbox}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  seleccionado
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-300 bg-white"
                }`}
              >
                {seleccionado && (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            )}
            <div className="min-w-0">
              <span className="text-sm font-semibold text-blue-600">
                {order.referencia}
              </span>
              <span className="ml-2 text-xs text-gray-400">
                {TIPO_ORDEN_LABEL[order.tipoOrden]}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!modoSeleccion && onImprimir && (
              <button
                onClick={handleImprimir}
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                title="Imprimir este pedido"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.25 7.034l-.009.001" />
                </svg>
              </button>
            )}
            {!modoSeleccion && rol === "admin" && (
              <button
                onClick={handleEliminar}
                disabled={isDeleting}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                title="Eliminar pedido"
              >
                {isDeleting ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                )}
              </button>
            )}
            <EstadoBadge estado={order.estado} />
          </div>
        </div>

        {/* Cliente */}
        {order.clienteNombre && (
          <p className="text-sm text-gray-800 font-medium mb-1">
            {order.clienteNombre}
          </p>
        )}
        {order.clienteTel && (
          <p className="text-xs text-gray-500 mb-2">📞 {order.clienteTel}</p>
        )}

        {/* Productos */}
        {productos.length > 0 && (
          <div className="mb-2 space-y-0.5">
            {productos.map((p, i) => (
              <p key={i} className="text-xs text-gray-600">
                <span className="font-medium">{p.cantidad}x</span> {p.nombre}
              </p>
            ))}
          </div>
        )}

        {/* Envío */}
        {order.envioTipo && (
          <p className="text-xs text-gray-500 mb-2">
            {order.envioTipo === "retiro" ? "🏪 Retiro en local" : "🚚 Envío a domicilio"}
          </p>
        )}

        {/* Fecha de carga */}
        {order.fechaVenta && (
          <p className="text-xs text-gray-400" suppressHydrationWarning>
            Cargado: {formatFechaEntrega(order.fechaVenta)}
          </p>
        )}

        {/* Fecha estimada de entrega */}
        {fechaEntregaStr && (
          <p className={`text-xs ${esCustom ? "text-orange-600 font-medium" : "text-blue-600"}`} suppressHydrationWarning>
            {esCustom ? "⚡ Urgente:" : "📅 Entrega est.:"} {fechaEntregaStr}
          </p>
        )}
      </Link>

      {/* Zona NO clickeable: notas + botón avanzar */}
      <div className="mt-2">
        {/* Notas internas */}
        <NotasCompact orderId={order.id} notas={notasInternas} />

        {/* Botón avanzar estado */}
        {nextLabel && (
          <button
            onClick={handleAvanzar}
            disabled={isPending}
            className="w-full mt-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {isPending ? "Actualizando..." : nextLabel}
          </button>
        )}

        {order.estado === "despachado" && (
          <div className="text-center text-xs text-gray-400 py-1 mt-1">
            ✅ Entregado
          </div>
        )}
      </div>
    </div>
  );
}
