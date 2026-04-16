"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Order, Producto } from "@/lib/db/schema";
import { EstadoBadge } from "./status-stepper";
import { avanzarEstado, guardarNotas } from "@/lib/actions";

const NEXT_ESTADO_LABELS = {
  pendiente: "Marcar en preparación",
  preparacion: "Marcar como listo",
  listo: "Marcar como despachado",
  despachado: null,
};

const TIPO_ORDEN_LABEL: Record<string, string> = {
  web: "Web",
  factura_a: "Factura A",
  factura_b: "Factura B",
  cotizacion: "Cotización",
  orden_venta: "Orden de Venta",
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

export function OrderCard({ order }: { order: Order }) {
  const [notas, setNotas] = useState(order.notas ?? "");
  const [isPending, startTransition] = useTransition();
  const [isSavingNotas, startSavingNotas] = useTransition();

  const productos = (order.productos as Producto[]) ?? [];
  const nextLabel = NEXT_ESTADO_LABELS[order.estado];

  const fechaEntrega = order.fechaEntregaCustom ?? order.fechaEntregaEstimada;
  const fechaEntregaStr = formatFechaEntrega(fechaEntrega);
  const esCustom = !!order.fechaEntregaCustom;

  function handleAvanzar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(() => avanzarEstado(order.id));
  }

  function handleNotasBlur() {
    if (notas === (order.notas ?? "")) return;
    startSavingNotas(() => guardarNotas(order.id, notas));
  }

  function handleNotasClick(e: React.MouseEvent) {
    e.stopPropagation();
  }

  return (
    <Link
      href={`/orders/${order.id}`}
      className="block bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* Header: referencia + badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <span className="text-sm font-semibold text-blue-600">
            {order.referencia}
          </span>
          <span className="ml-2 text-xs text-gray-400">
            {TIPO_ORDEN_LABEL[order.tipoOrden]}
          </span>
        </div>
        <EstadoBadge estado={order.estado} />
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
          Cargado:{" "}
          {formatFechaEntrega(order.fechaVenta)}
        </p>
      )}

      {/* Fecha estimada de entrega */}
      {fechaEntregaStr && (
        <p className={`text-xs mb-3 ${esCustom ? "text-orange-600 font-medium" : "text-blue-600"}`} suppressHydrationWarning>
          {esCustom ? "⚡ Urgente:" : "📅 Entrega est.:"} {fechaEntregaStr}
        </p>
      )}

      {/* Notas */}
      <div className="mb-3">
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          onBlur={handleNotasBlur}
          onClick={handleNotasClick}
          placeholder="Agregar nota interna..."
          rows={2}
          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-300"
        />
        {isSavingNotas && (
          <p className="text-xs text-gray-400 mt-0.5">Guardando...</p>
        )}
      </div>

      {/* Botón avanzar estado */}
      {nextLabel && (
        <button
          onClick={handleAvanzar}
          disabled={isPending}
          className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium rounded-lg transition-colors"
        >
          {isPending ? "Actualizando..." : nextLabel}
        </button>
      )}

      {order.estado === "despachado" && (
        <div className="text-center text-xs text-gray-400 py-1">
          ✅ Entregado
        </div>
      )}
    </Link>
  );
}
