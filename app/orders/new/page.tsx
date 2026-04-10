"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { crearPedidoManual } from "@/lib/actions";

const TIPOS_ORDEN = [
  { key: "factura_a", label: "Factura A", placeholder: "Ej: FCA54444" },
  { key: "factura_b", label: "Factura B", placeholder: "Ej: FCB12345" },
  { key: "cotizacion", label: "Cotización", placeholder: "Ej: COT789" },
  { key: "orden_venta", label: "Orden de Venta", placeholder: "Ej: OV 3772" },
] as const;

export default function NuevoPedidoPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tipoOrden, setTipoOrden] = useState<string>("factura_b");
  const [error, setError] = useState<string | null>(null);

  const tipoActual = TIPOS_ORDEN.find((t) => t.key === tipoOrden);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await crearPedidoManual(formData);
        router.push("/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear el pedido");
      }
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Volver"
          >
            ←
          </Link>
          <h1 className="text-sm font-semibold text-gray-900">Nuevo pedido manual</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Tipo de orden */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Tipo de comprobante
            </p>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_ORDEN.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTipoOrden(t.key)}
                  className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-colors text-left ${
                    tipoOrden === t.key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <input type="hidden" name="tipoOrden" value={tipoOrden} />
          </div>

          {/* Referencia */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label
              htmlFor="referencia"
              className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"
            >
              Número de referencia <span className="text-red-500">*</span>
            </label>
            <input
              id="referencia"
              name="referencia"
              type="text"
              required
              placeholder={tipoActual?.placeholder ?? ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Tipo de producto */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Tipo de producto <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
                <input
                  type="radio"
                  name="tipoProducto"
                  value="notebook"
                  defaultChecked
                  className="text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">💻 Notebook</span>
              </label>
              <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
                <input
                  type="radio"
                  name="tipoProducto"
                  value="computadora"
                  className="text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">🖥️ Computadora</span>
              </label>
            </div>
          </div>

          {/* Datos del cliente */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Datos del cliente <span className="text-gray-400 font-normal normal-case">(opcionales)</span>
            </p>
            <div>
              <label htmlFor="clienteNombre" className="block text-xs text-gray-600 mb-1">
                Nombre
              </label>
              <input
                id="clienteNombre"
                name="clienteNombre"
                type="text"
                placeholder="Nombre del cliente"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="clienteTel" className="block text-xs text-gray-600 mb-1">
                Teléfono
              </label>
              <input
                id="clienteTel"
                name="clienteTel"
                type="tel"
                placeholder="Ej: 11 2345-6789"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Notas */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label
              htmlFor="notas"
              className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"
            >
              Notas internas <span className="text-gray-400 font-normal normal-case">(opcionales)</span>
            </label>
            <textarea
              id="notas"
              name="notas"
              rows={3}
              placeholder="Observaciones, detalles del equipo, accesorios, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-3">
            <Link
              href="/"
              className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg text-center hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isPending ? "Creando..." : "Crear pedido"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
