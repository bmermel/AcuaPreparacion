"use client";

import { useState, useTransition } from "react";
import type { Order } from "@/lib/db/schema";
import { avanzarEstado, retrocederEstado, guardarNotas } from "@/lib/actions";

const NEXT_LABELS: Record<string, string | null> = {
  pendiente: "Marcar en preparación",
  preparacion: "Marcar como listo",
  listo: "Marcar como despachado",
  despachado: null,
};

const PREV_LABELS: Record<string, string | null> = {
  pendiente: null,
  preparacion: "Volver a pendiente",
  listo: "Volver a preparación",
  despachado: "Volver a listo",
};

export function OrderActions({ order }: { order: Order }) {
  const [notas, setNotas] = useState(order.notas ?? "");
  const [isPendingAvanzar, startAvanzar] = useTransition();
  const [isPendingRetroceder, startRetroceder] = useTransition();
  const [isSaving, startSaving] = useTransition();

  const nextLabel = NEXT_LABELS[order.estado];
  const prevLabel = PREV_LABELS[order.estado];

  function handleAvanzar() {
    startAvanzar(() => avanzarEstado(order.id));
  }

  function handleRetroceder() {
    startRetroceder(() => retrocederEstado(order.id));
  }

  function handleNotasBlur() {
    if (notas === (order.notas ?? "")) return;
    startSaving(() => guardarNotas(order.id, notas));
  }

  return (
    <>
      {/* Botones de estado */}
      {(nextLabel || prevLabel) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Cambiar estado
          </p>
          {nextLabel && (
            <button
              onClick={handleAvanzar}
              disabled={isPendingAvanzar}
              className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isPendingAvanzar ? "Actualizando..." : nextLabel}
            </button>
          )}
          {prevLabel && (
            <button
              onClick={handleRetroceder}
              disabled={isPendingRetroceder}
              className="w-full py-2 px-3 border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium rounded-lg transition-colors"
            >
              {isPendingRetroceder ? "Actualizando..." : prevLabel}
            </button>
          )}
          {order.estado === "despachado" && (
            <div className="text-center text-sm text-gray-400 py-1">
              ✅ Pedido entregado
            </div>
          )}
        </div>
      )}

      {/* Notas */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label
          htmlFor="notas-detail"
          className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"
        >
          Notas internas
        </label>
        <textarea
          id="notas-detail"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          onBlur={handleNotasBlur}
          placeholder="Observaciones, detalles del equipo, accesorios, etc."
          rows={4}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-300"
        />
        {isSaving && (
          <p className="text-xs text-gray-400 mt-1">Guardando...</p>
        )}
      </div>
    </>
  );
}
