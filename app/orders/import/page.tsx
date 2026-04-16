"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import Link from "next/link";
import { importarDesdeQloud, guardarReglaProducto, verificarDuplicado } from "@/lib/actions";
import type { TipoProducto } from "@/lib/db/schema";

type Resultado = {
  success: boolean;
  mensaje: string;
  orderId?: string;
  productosNoClasificados?: string[];
};

const TIPO_LABELS: Record<TipoProducto, string> = {
  notebook: "💻 Notebook",
  computadora: "🖥️ Computadora",
  varios: "🗂️ Varios",
};

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  preparacion: "En preparacion",
  listo: "Listo",
  despachado: "Despachado",
};

const ESTADO_COLORS: Record<string, string> = {
  pendiente: "bg-yellow-50 border-yellow-300 text-yellow-800",
  preparacion: "bg-blue-50 border-blue-300 text-blue-800",
  listo: "bg-green-50 border-green-300 text-green-800",
  despachado: "bg-gray-50 border-gray-300 text-gray-700",
};

export default function ImportarQloudPage() {
  const [qloudId, setQloudId] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [isPending, startTransition] = useTransition();
  const [reglasPendientes, setReglasPendientes] = useState<Record<string, TipoProducto>>({});
  const [guardando, startGuardando] = useTransition();
  const [duplicado, setDuplicado] = useState<{
    existe: boolean;
    orderId?: string;
    estado?: string;
    referencia?: string;
  } | null>(null);
  const [checkingDup, setCheckingDup] = useState(false);
  const [forzarImport, setForzarImport] = useState(false);

  // Verificar duplicado con debounce
  const checkDuplicado = useCallback(async (idStr: string) => {
    const id = parseInt(idStr.replace(/\D/g, ""), 10);
    if (!id) {
      setDuplicado(null);
      setForzarImport(false);
      return;
    }
    setCheckingDup(true);
    try {
      const result = await verificarDuplicado({ qloudId: id, referencia: `#${id}` });
      setDuplicado(result);
      setForzarImport(false);
    } catch {
      setDuplicado(null);
    }
    setCheckingDup(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => checkDuplicado(qloudId), 400);
    return () => clearTimeout(timer);
  }, [qloudId, checkDuplicado]);

  function handleImportar(e: React.FormEvent) {
    e.preventDefault();
    const id = parseInt(qloudId.replace(/\D/g, ""), 10);
    if (!id) return;
    setResultado(null);

    startTransition(async () => {
      const res = await importarDesdeQloud(id);
      setResultado(res);
      if (res.productosNoClasificados?.length) {
        const init: Record<string, TipoProducto> = {};
        res.productosNoClasificados.forEach((p) => (init[p] = "computadora"));
        setReglasPendientes(init);
      }
    });
  }

  function handleGuardarReglas() {
    startGuardando(async () => {
      await Promise.all(
        Object.entries(reglasPendientes).map(([patron, tipo]) =>
          guardarReglaProducto(patron, tipo)
        )
      );
      setReglasPendientes({});
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            ←
          </Link>
          <h1 className="text-sm font-semibold text-gray-900">Importar pedido de Qloud</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Formulario */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            ID del pedido en Qloud
          </p>
          <form onSubmit={handleImportar} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={qloudId}
                onChange={(e) => setQloudId(e.target.value)}
                placeholder="Ej: 130564"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={isPending || !qloudId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {isPending ? "Buscando..." : duplicado?.existe ? "Actualizar" : "Importar"}
              </button>
            </div>

            {checkingDup && (
              <p className="text-xs text-gray-400">Verificando...</p>
            )}

            {/* Alerta de duplicado */}
            {duplicado?.existe && !resultado && (
              <div className={`rounded-lg border p-3 ${ESTADO_COLORS[duplicado.estado ?? ""] ?? "bg-amber-50 border-amber-300 text-amber-800"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium">
                    ⚠️ Este pedido ya esta cargado ({duplicado.referencia}) — Estado: {ESTADO_LABELS[duplicado.estado ?? ""] ?? duplicado.estado}
                  </p>
                  {duplicado.orderId && (
                    <Link
                      href={`/orders/${duplicado.orderId}`}
                      className="text-xs text-blue-600 hover:underline flex-shrink-0"
                    >
                      Ver pedido →
                    </Link>
                  )}
                </div>
                <p className="text-xs mt-1 opacity-75">
                  Si importas de nuevo, se actualizaran los datos con la informacion mas reciente de Qloud.
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Resultado */}
        {resultado && (
          <div
            className={`rounded-xl border p-4 ${
              resultado.success
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <p
              className={`text-sm font-medium ${
                resultado.success ? "text-green-800" : "text-red-800"
              }`}
            >
              {resultado.success ? "✅" : "❌"} {resultado.mensaje}
            </p>
            {resultado.success && resultado.orderId && (
              <Link
                href={`/orders/${resultado.orderId}`}
                className="mt-2 inline-block text-xs text-blue-600 hover:underline"
              >
                Ver pedido →
              </Link>
            )}
          </div>
        )}

        {/* Productos no clasificados */}
        {Object.keys(reglasPendientes).length > 0 && (
          <div className="bg-white rounded-xl border border-amber-200 p-4">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
              ⚠️ Productos no reconocidos
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Estos productos no se pudieron clasificar automaticamente. Asignales un tipo para que el sistema los reconozca en el futuro.
            </p>
            <div className="space-y-3">
              {Object.entries(reglasPendientes).map(([nombre, tipo]) => (
                <div key={nombre} className="flex items-center gap-2">
                  <p className="flex-1 text-sm text-gray-700 truncate" title={nombre}>
                    {nombre}
                  </p>
                  <select
                    value={tipo}
                    onChange={(e) =>
                      setReglasPendientes((prev) => ({
                        ...prev,
                        [nombre]: e.target.value as TipoProducto,
                      }))
                    }
                    className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    {(Object.keys(TIPO_LABELS) as TipoProducto[]).map((k) => (
                      <option key={k} value={k}>
                        {TIPO_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button
              onClick={handleGuardarReglas}
              disabled={guardando}
              className="mt-4 w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {guardando ? "Guardando..." : "Guardar reglas de clasificacion"}
            </button>
          </div>
        )}

        {/* Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            ¿Para que sirve esto?
          </p>
          <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
            <li>Importar pedidos de Qloud que no entraron por el webhook automatico</li>
            <li>Verificar que la informacion de un pedido se importo correctamente</li>
            <li>Enseñarle al sistema a reconocer nuevos productos automaticamente</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
