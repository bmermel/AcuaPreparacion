"use client";

import { useState, useTransition } from "react";
import type { NotaInterna } from "@/lib/db/schema";
import { agregarNota, toggleNotaImprimible, eliminarNota } from "@/lib/actions";

function formatFechaNota(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${min}`;
}

type NotasCompactProps = {
  orderId: string;
  notas: NotaInterna[];
};

/** Version compacta para la card del dashboard */
export function NotasCompact({ orderId, notas }: NotasCompactProps) {
  const [mensaje, setMensaje] = useState("");
  const [isPending, startTransition] = useTransition();
  const [expandido, setExpandido] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!mensaje.trim()) return;

    startTransition(async () => {
      await agregarNota(orderId, mensaje.trim());
      setMensaje("");
    });
  }

  const notasVisibles = expandido ? notas : notas.slice(-2);
  const hayMas = notas.length > 2 && !expandido;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="mt-2"
    >
      {/* Notas existentes */}
      {notas.length > 0 && (
        <div className="mb-2 space-y-1">
          {hayMas && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpandido(true); }}
              className="text-xs text-blue-500 hover:underline"
            >
              Ver {notas.length - 2} nota{notas.length - 2 !== 1 ? "s" : ""} mas...
            </button>
          )}
          {notasVisibles.map((n) => (
            <div key={n.id} className="flex items-start gap-1.5">
              {n.imprimible && (
                <span className="text-xs text-orange-400 flex-shrink-0 mt-0.5" title="Se imprime">🏷️</span>
              )}
              <p className="text-xs text-gray-600 leading-relaxed">
                <span className="font-semibold text-gray-700">{n.userName}:</span>{" "}
                {n.mensaje}
                <span className="text-gray-300 ml-1">{formatFechaNota(n.createdAt)}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Input nueva nota */}
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="flex gap-1.5"
      >
        <input
          type="text"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Agregar nota..."
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-300 bg-white"
        />
        <button
          type="submit"
          disabled={isPending || !mensaje.trim()}
          onClick={(e) => e.stopPropagation()}
          className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs rounded-lg transition-colors flex-shrink-0"
        >
          {isPending ? "..." : "Enviar"}
        </button>
      </form>
    </div>
  );
}

type NotasFullProps = {
  orderId: string;
  notas: NotaInterna[];
};

/** Version completa para la pagina de detalle */
export function NotasFull({ orderId, notas }: NotasFullProps) {
  const [mensaje, setMensaje] = useState("");
  const [imprimible, setImprimible] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isToggling, startToggling] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mensaje.trim()) return;

    startTransition(async () => {
      await agregarNota(orderId, mensaje.trim(), imprimible);
      setMensaje("");
      setImprimible(false);
    });
  }

  function handleToggleImprimible(notaId: string) {
    startToggling(() => toggleNotaImprimible(orderId, notaId));
  }

  function handleEliminar(notaId: string) {
    startDeleting(() => eliminarNota(orderId, notaId));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Notas internas
      </p>

      {/* Lista de notas */}
      {notas.length > 0 ? (
        <div className="space-y-2.5 mb-4">
          {notas.map((n) => (
            <div key={n.id} className="group flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">{n.userName}</span>
                  <span className="text-xs text-gray-300" suppressHydrationWarning>
                    {formatFechaNota(n.createdAt)}
                  </span>
                  {n.imprimible && (
                    <span className="text-xs text-orange-500 font-medium">🏷️ Se imprime</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mt-0.5">{n.mensaje}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => handleToggleImprimible(n.id)}
                  disabled={isToggling}
                  className={`p-1 text-xs rounded transition-colors ${
                    n.imprimible
                      ? "text-orange-500 hover:text-orange-700"
                      : "text-gray-300 hover:text-orange-500"
                  }`}
                  title={n.imprimible ? "No imprimir esta nota" : "Imprimir esta nota"}
                >
                  🏷️
                </button>
                <button
                  onClick={() => handleEliminar(n.id)}
                  disabled={isDeleting}
                  className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                  title="Eliminar nota"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-4">Sin notas internas</p>
      )}

      {/* Formulario nueva nota */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="Escribir nota..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
          />
          <button
            type="submit"
            disabled={isPending || !mensaje.trim()}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {isPending ? "..." : "Enviar"}
          </button>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={imprimible}
            onChange={(e) => setImprimible(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-xs text-gray-500">🏷️ Incluir en impresion</span>
        </label>
      </form>
    </div>
  );
}
