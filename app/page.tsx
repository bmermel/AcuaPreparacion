import Link from "next/link";
import { desc, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { OrderCard } from "@/components/order-card";
import { signOut, auth } from "@/lib/auth";
import type { EstadoOrden } from "@/lib/db/schema";

type Props = {
  searchParams: Promise<{ seccion?: string; estado?: string }>;
};

const ESTADO_FILTROS: { key: string; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "pendiente", label: "Pendiente" },
  { key: "preparacion", label: "Preparación" },
  { key: "listo", label: "Listo" },
  { key: "despachado", label: "Despachado" },
];

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const seccion = params.seccion === "computadoras" ? "computadoras" : "notebooks";
  const estadoFiltro = params.estado ?? "todos";

  const session = await auth();

  // Query base por tipo de producto
  const tipoProducto = seccion === "notebooks" ? "notebook" : "computadora";

  const whereConditions =
    estadoFiltro !== "todos"
      ? and(
          eq(orders.tipoProducto, tipoProducto),
          eq(orders.estado, estadoFiltro as EstadoOrden)
        )
      : eq(orders.tipoProducto, tipoProducto);

  const pedidos = await db
    .select()
    .from(orders)
    .where(whereConditions)
    .orderBy(desc(orders.createdAt));

  // Contadores por estado
  const todos = await db
    .select({ estado: orders.estado })
    .from(orders)
    .where(eq(orders.tipoProducto, tipoProducto));

  const contadores = {
    todos: todos.length,
    pendiente: todos.filter((o) => o.estado === "pendiente").length,
    preparacion: todos.filter((o) => o.estado === "preparacion").length,
    listo: todos.filter((o) => o.estado === "listo").length,
    despachado: todos.filter((o) => o.estado === "despachado").length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Acua</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:block">
              {session?.user?.name}
            </span>
            <Link
              href="/orders/new"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              + Nuevo pedido
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* Tabs de sección */}
        <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
          <Link
            href={`/?seccion=notebooks${estadoFiltro !== "todos" ? `&estado=${estadoFiltro}` : ""}`}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              seccion === "notebooks"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            💻 Notebooks
          </Link>
          <Link
            href={`/?seccion=computadoras${estadoFiltro !== "todos" ? `&estado=${estadoFiltro}` : ""}`}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              seccion === "computadoras"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            🖥️ Computadoras
          </Link>
        </div>

        {/* Filtros por estado */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {ESTADO_FILTROS.map((f) => {
            const count = contadores[f.key as keyof typeof contadores];
            const isActive = estadoFiltro === f.key;
            return (
              <Link
                key={f.key}
                href={`/?seccion=${seccion}&estado=${f.key}`}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
                }`}
              >
                {f.label}
                <span
                  className={`ml-1 ${isActive ? "text-blue-200" : "text-gray-400"}`}
                >
                  ({count})
                </span>
              </Link>
            );
          })}
        </div>

        {/* Grid de pedidos */}
        {pedidos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm">No hay pedidos en esta sección</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {pedidos.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
