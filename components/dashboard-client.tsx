"use client";

import { useState, useMemo } from "react";
import type { Order, EstadoOrden, TipoProducto } from "@/lib/db/schema";
import { OrderCard } from "./order-card";

const SECCIONES = [
  { key: "todos", label: "Todos", emoji: "📋" },
  { key: "notebook", label: "Notebooks", emoji: "💻" },
  { key: "computadora", label: "Computadoras", emoji: "🖥️" },
  { key: "varios", label: "Varios", emoji: "🗂️" },
] as const;

const ESTADOS: { key: string; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "pendiente", label: "Pendiente" },
  { key: "preparacion", label: "Preparación" },
  { key: "listo", label: "Listo" },
  { key: "despachado", label: "Despachado" },
];

type Props = {
  pedidos: Order[];
  rol: "admin" | "tecnico";
};

export function DashboardClient({ pedidos, rol }: Props) {
  const [seccion, setSeccion] = useState<string>("todos");
  const [estado, setEstado] = useState<string>(
    rol === "tecnico" ? "pendiente" : "todos"
  );
  const [busqueda, setBusqueda] = useState("");

  const termino = busqueda.toLowerCase().trim();

  // Filtrar por sección (tipo de producto)
  const porSeccion = useMemo(
    () =>
      seccion === "todos"
        ? pedidos
        : pedidos.filter((o) => o.tipoProducto === seccion),
    [pedidos, seccion]
  );

  // Contadores por estado (sobre la sección actual)
  const contadores = useMemo(() => {
    const c = { todos: 0, pendiente: 0, preparacion: 0, listo: 0, despachado: 0 };
    for (const o of porSeccion) {
      c.todos++;
      c[o.estado as keyof typeof c]++;
    }
    return c;
  }, [porSeccion]);

  // Filtrar por estado
  const porEstado = useMemo(() => {
    if (estado === "todos") {
      // Técnicos: excluir despachados en "todos"
      return rol === "tecnico"
        ? porSeccion.filter((o) => o.estado !== "despachado")
        : porSeccion;
    }
    return porSeccion.filter((o) => o.estado === estado);
  }, [porSeccion, estado, rol]);

  // Filtrar por búsqueda
  const filtrados = useMemo(() => {
    if (!termino) return porEstado;
    return porEstado.filter((o) => {
      const campos = [o.referencia, o.clienteNombre, o.clienteTel, o.clienteEmail];
      return campos.some((c) => c?.toLowerCase().includes(termino));
    });
  }, [porEstado, termino]);

  // Estados visibles según rol
  const estadosVisibles =
    rol === "admin"
      ? ESTADOS
      : ESTADOS.filter((e) => e.key !== "despachado");

  return (
    <>
      {/* Tabs de sección */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit overflow-x-auto">
        {SECCIONES.map((s) => (
          <button
            key={s.key}
            onClick={() => setSeccion(s.key)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              seccion === s.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      {/* Filtros por estado */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {estadosVisibles.map((f) => {
          const count = contadores[f.key as keyof typeof contadores];
          const isActive = estado === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setEstado(f.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
              }`}
            >
              {f.label}
              <span className={`ml-1 ${isActive ? "text-blue-200" : "text-gray-400"}`}>
                ({count})
              </span>
            </button>
          );
        })}
        {/* Técnicos: botón extra para despachados */}
        {rol === "tecnico" && (
          <button
            onClick={() => setEstado("despachado")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              estado === "despachado"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-500 border border-gray-200 hover:border-blue-300"
            }`}
          >
            Despachado
            <span className={`ml-1 ${estado === "despachado" ? "text-blue-200" : "text-gray-400"}`}>
              ({contadores.despachado})
            </span>
          </button>
        )}
      </div>

      {/* Buscador */}
      <div className="mb-4">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por referencia, cliente, teléfono o email..."
          className="w-full max-w-md px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
        />
      </div>

      {/* Grid */}
      {filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">{termino ? "🔍" : "📭"}</p>
          <p className="text-sm">
            {termino
              ? `No se encontraron pedidos para "${busqueda}"`
              : "No hay pedidos en esta sección"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtrados.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </>
  );
}
