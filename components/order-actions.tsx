"use client";

import { useState, useTransition } from "react";
import type { Order } from "@/lib/db/schema";
import { avanzarEstado, retrocederEstado, actualizarFechaEntregaCustom } from "@/lib/actions";
import { formatearFechaEntrega } from "@/lib/delivery";

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
  const [isPendingAvanzar, startAvanzar] = useTransition();
  const [isPendingRetroceder, startRetroceder] = useTransition();
  const [isSavingFecha, startSavingFecha] = useTransition();
  const [editandoFecha, setEditandoFecha] = useState(false);
  const [fechaCustomInput, setFechaCustomInput] = useState("");

  const nextLabel = NEXT_LABELS[order.estado];
  const prevLabel = PREV_LABELS[order.estado];
  const fechaEntrega = order.fechaEntregaCustom ?? order.fechaEntregaEstimada;
  const esCustom = !!order.fechaEntregaCustom;

  function handleAvanzar() {
    startAvanzar(() => avanzarEstado(order.id));
  }

  function handleRetroceder() {
    startRetroceder(() => retrocederEstado(order.id));
  }

  function handleGuardarFecha() {
    if (!fechaCustomInput) return;
    startSavingFecha(async () => {
      await actualizarFechaEntregaCustom(order.id, new Date(fechaCustomInput));
      setEditandoFecha(false);
    });
  }

  function handleQuitarFechaCustom() {
    startSavingFecha(async () => {
      await actualizarFechaEntregaCustom(order.id, null);
    });
  }

  return (
    <>
      {/* Fecha de entrega */}
      {fechaEntrega && (
        <div className={`rounded-xl border p-4 ${esCustom ? "bg-orange-50 border-orange-200" : "bg-blue-50 border-blue-200"}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${esCustom ? "text-orange-700" : "text-blue-700"}`}>
            {esCustom ? "⚡ Entrega urgente" : "📅 Entrega estimada"}
          </p>
          <p className={`text-sm font-medium ${esCustom ? "text-orange-800" : "text-blue-800"}`}>
            {formatearFechaEntrega(new Date(fechaEntrega))}
          </p>
          {!editandoFecha ? (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setEditandoFecha(true)}
                className="text-xs text-blue-600 hover:underline"
              >
                {esCustom ? "Cambiar fecha" : "Marcar como urgente"}
              </button>
              {esCustom && (
                <button
                  onClick={handleQuitarFechaCustom}
                  disabled={isSavingFecha}
                  className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
                >
                  Quitar urgencia
                </button>
              )}
            </div>
          ) : (
            <div className="mt-2 flex gap-2 items-center">
              <input
                type="datetime-local"
                value={fechaCustomInput}
                onChange={(e) => setFechaCustomInput(e.target.value)}
                className="flex-1 text-xs border border-blue-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={handleGuardarFecha}
                disabled={isSavingFecha || !fechaCustomInput}
                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
              >
                {isSavingFecha ? "..." : "Guardar"}
              </button>
              <button
                onClick={() => setEditandoFecha(false)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Botones de estado */}
      {(nextLabel || prevLabel || order.estado === "despachado") && (
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

    </>
  );
}
