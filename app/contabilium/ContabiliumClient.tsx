"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { TipoFc, ComprobanteResumen, OrdenVentaResumen } from "@/lib/contabilium";
import { buscarContabilium, importarContabilium } from "./actions";
import type { TipoProducto } from "@/lib/db/schema";

type Documento = (ComprobanteResumen | OrdenVentaResumen) & { _tipoFc: TipoFc };

const TIPO_LABELS: Record<TipoFc, string> = {
  FCA: "Factura A",
  FCB: "Factura B",
  COT: "Cotización",
  OV: "Orden de Venta",
};

const TIPO_PRODUCTO_LABELS: Record<TipoProducto, string> = {
  notebook: "💻 Notebook",
  computadora: "🖥️ Computadora",
  varios: "🗂️ Varios",
};

function getNumero(doc: Documento): string {
  return (doc as ComprobanteResumen).Numero ?? (doc as OrdenVentaResumen).Numero;
}

function getMonto(doc: Documento): number {
  return (doc as ComprobanteResumen).ImporteTotalNeto ?? (doc as OrdenVentaResumen).ImporteTotal ?? 0;
}

function formatFecha(str: string): string {
  const d = new Date(str);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatMonto(n: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

// Fecha de hace 7 días como default
function haceNDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function ContabiliumClient() {
  const hoy = new Date().toISOString().slice(0, 10);
  const [fechaDesde, setFechaDesde] = useState(haceNDias(7));
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [tiposSeleccionados, setTiposSeleccionados] = useState<TipoFc[]>(["FCA", "FCB", "COT", "OV"]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [isPending, startBusqueda] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Estado de importación por doc
  const [importStates, setImportStates] = useState<Record<number, {
    tipoProducto: TipoProducto;
    isPending: boolean;
    resultado: { success: boolean; mensaje: string; orderId?: string } | null;
  }>>({});
  const [, startImport] = useTransition();

  function toggleTipo(tipo: TipoFc) {
    setTiposSeleccionados((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
  }

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDocumentos([]);
    setImportStates({});

    startBusqueda(async () => {
      try {
        const result = await buscarContabilium({ fechaDesde, fechaHasta, tipos: tiposSeleccionados });
        if ("error" in result) {
          setError(result.error);
        } else {
          setDocumentos(result.documentos as Documento[]);
          if (result.documentos.length === 0) {
            setError("No se encontraron documentos en ese rango de fechas.");
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al buscar");
      }
    });
  }

  function handleImportar(doc: Documento) {
    const docId = doc.ID;
    const tipoProducto = importStates[docId]?.tipoProducto ?? "notebook";

    setImportStates((prev) => ({
      ...prev,
      [docId]: { ...(prev[docId] ?? { tipoProducto: "notebook" }), isPending: true, resultado: null },
    }));

    startImport(async () => {
      const resultado = await importarContabilium({
        id: docId,
        tipoFc: doc._tipoFc,
        tipoProducto,
      });

      setImportStates((prev) => ({
        ...prev,
        [docId]: { ...(prev[docId] ?? { tipoProducto }), isPending: false, resultado },
      }));
    });
  }

  function setTipoProductoDoc(docId: number, tipoProducto: TipoProducto) {
    setImportStates((prev) => ({
      ...prev,
      [docId]: { tipoProducto, isPending: false, resultado: null, ...(prev[docId] ?? {}) },
    }));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            ←
          </Link>
          <h1 className="text-sm font-semibold text-gray-900">Importar desde Contabilium</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filtros de búsqueda</p>
          <form onSubmit={handleBuscar} className="space-y-3">
            {/* Fechas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Desde</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  max={fechaHasta}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Hasta</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  min={fechaDesde}
                  max={hoy}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Tipos de documento */}
            <div>
              <label className="block text-xs text-gray-600 mb-2">Tipo de comprobante</label>
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(TIPO_LABELS) as TipoFc[]).map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => toggleTipo(tipo)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      tiposSeleccionados.includes(tipo)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    {TIPO_LABELS[tipo]}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || tiposSeleccionados.length === 0}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isPending ? "Buscando..." : "Buscar en Contabilium"}
            </button>
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Resultados */}
        {documentos.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {documentos.length} documento{documentos.length !== 1 ? "s" : ""} encontrado{documentos.length !== 1 ? "s" : ""}
              </p>
            </div>

            {documentos.map((doc) => {
              const docId = doc.ID;
              const state = importStates[docId] ?? { tipoProducto: "notebook" as TipoProducto, isPending: false, resultado: null };
              const yaImportado = state.resultado?.success === true;
              const duplicado = state.resultado?.success === false && state.resultado?.orderId;

              return (
                <div key={`${doc._tipoFc}-${docId}`} className="px-4 py-4">
                  {/* Cabecera del doc */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {TIPO_LABELS[doc._tipoFc]}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">{getNumero(doc)}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1 truncate">{doc.RazonSocial}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>{formatFecha(doc.FechaEmision)}</span>
                        <span>{formatMonto(getMonto(doc))}</span>
                      </div>
                    </div>
                  </div>

                  {/* Acción de importar */}
                  {!yaImportado && !duplicado && (
                    <div className="mt-3 flex items-center gap-2">
                      <select
                        value={state.tipoProducto}
                        onChange={(e) => setTipoProductoDoc(docId, e.target.value as TipoProducto)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        {(Object.keys(TIPO_PRODUCTO_LABELS) as TipoProducto[]).map((k) => (
                          <option key={k} value={k}>{TIPO_PRODUCTO_LABELS[k]}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleImportar(doc)}
                        disabled={state.isPending}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        {state.isPending ? "Importando..." : "Importar a Acua"}
                      </button>
                    </div>
                  )}

                  {/* Resultado exitoso */}
                  {yaImportado && state.resultado && (
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-xs text-green-700 font-medium">✅ {state.resultado.mensaje}</span>
                      {state.resultado.orderId && (
                        <Link
                          href={`/orders/${state.resultado.orderId}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Ver pedido →
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Duplicado */}
                  {duplicado && state.resultado && (
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-xs text-amber-700 font-medium">⚠️ {state.resultado.mensaje}</span>
                      {state.resultado.orderId && (
                        <Link
                          href={`/orders/${state.resultado.orderId}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Ver pedido →
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Error de importación */}
                  {state.resultado?.success === false && !state.resultado?.orderId && (
                    <div className="mt-3">
                      <span className="text-xs text-red-600">❌ {state.resultado.mensaje}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
