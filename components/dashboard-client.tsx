"use client";

import { useState, useMemo, useCallback } from "react";
import type { Order, EstadoOrden, TipoProducto } from "@/lib/db/schema";
import { OrderCard } from "./order-card";

import type { Producto } from "@/lib/db/schema";

const SECCIONES = [
  { key: "todos", label: "Todos", emoji: "📋" },
  { key: "notebook", label: "Notebooks", emoji: "💻" },
  { key: "computadora", label: "Computadoras", emoji: "🖥️" },
  { key: "all_in_one", label: "All in One", emoji: "🖥️" },
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
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

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
      return rol === "tecnico"
        ? porSeccion.filter((o) => o.estado !== "despachado")
        : porSeccion;
    }
    return porSeccion.filter((o) => o.estado === estado);
  }, [porSeccion, estado, rol]);

  // Filtrar por búsqueda (incluye productos)
  const filtrados = useMemo(() => {
    if (!termino) return porEstado;
    return porEstado.filter((o) => {
      const campos = [o.referencia, o.clienteNombre, o.clienteTel, o.clienteEmail];
      if (campos.some((c) => c?.toLowerCase().includes(termino))) return true;
      // Buscar en nombres de productos
      const prods = (o.productos as Producto[] | null) ?? [];
      return prods.some((p) => p.nombre?.toLowerCase().includes(termino));
    });
  }, [porEstado, termino]);

  // Estados visibles según rol
  const estadosVisibles =
    rol === "admin"
      ? ESTADOS
      : ESTADOS.filter((e) => e.key !== "despachado");

  const toggleSeleccion = useCallback((id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const seleccionarTodos = useCallback(() => {
    setSeleccionados(new Set(filtrados.map((o) => o.id)));
  }, [filtrados]);

  const deseleccionarTodos = useCallback(() => {
    setSeleccionados(new Set());
  }, []);

  function toggleModoSeleccion() {
    if (modoSeleccion) {
      setSeleccionados(new Set());
    }
    setModoSeleccion(!modoSeleccion);
  }

  function imprimirSeleccionados() {
    if (seleccionados.size === 0) return;
    const ids = Array.from(seleccionados).join(",");
    window.open(`/print?ids=${ids}`, "_blank");
  }

  function imprimirTodosVisibles() {
    if (filtrados.length === 0) return;
    const ids = filtrados.map((o) => o.id).join(",");
    window.open(`/print?ids=${ids}`, "_blank");
  }

  function imprimirUno(id: string) {
    window.open(`/print?ids=${id}`, "_blank");
  }

  const todosSeleccionados = filtrados.length > 0 && seleccionados.size === filtrados.length;

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

      {/* Buscador + botones de impresión */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por referencia, cliente, teléfono o email..."
          className="flex-1 min-w-[200px] max-w-md px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={toggleModoSeleccion}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
              modoSeleccion
                ? "bg-blue-50 text-blue-700 border-blue-300"
                : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
            }`}
          >
            {modoSeleccion ? "Cancelar seleccion" : "Seleccionar"}
          </button>

          {!modoSeleccion && filtrados.length > 0 && (
            <button
              onClick={imprimirTodosVisibles}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
              title="Imprimir todos los pedidos visibles"
            >
              🖨️ Imprimir todos ({filtrados.length})
            </button>
          )}
        </div>
      </div>

      {/* Barra de selección */}
      {modoSeleccion && (
        <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <span className="text-xs text-blue-700 font-medium">
            {seleccionados.size} seleccionado{seleccionados.size !== 1 ? "s" : ""}
          </span>

          <button
            onClick={todosSeleccionados ? deseleccionarTodos : seleccionarTodos}
            className="text-xs text-blue-600 hover:text-blue-800 underline transition-colors"
          >
            {todosSeleccionados ? "Deseleccionar todos" : `Seleccionar todos (${filtrados.length})`}
          </button>

          <button
            onClick={imprimirSeleccionados}
            disabled={seleccionados.size === 0}
            className="ml-auto px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-medium rounded-lg transition-colors"
          >
            🖨️ Imprimir seleccionados ({seleccionados.size})
          </button>
        </div>
      )}

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
            <OrderCard
              key={order.id}
              order={order}
              modoSeleccion={modoSeleccion}
              seleccionado={seleccionados.has(order.id)}
              onToggleSeleccion={toggleSeleccion}
              onImprimir={imprimirUno}
              rol={rol}
            />
          ))}
        </div>
      )}
    </>
  );
}
