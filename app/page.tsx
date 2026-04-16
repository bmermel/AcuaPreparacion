import Link from "next/link";
import { desc, eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { SearchableOrderGrid } from "@/components/searchable-order-grid";
import { signOut, auth } from "@/lib/auth";
import type { EstadoOrden } from "@/lib/db/schema";

type Props = {
  searchParams: Promise<{ seccion?: string; estado?: string }>;
};

const SECCIONES = [
  { key: "todos", label: "Todos", emoji: "📋" },
  { key: "notebooks", label: "Notebooks", emoji: "💻" },
  { key: "computadoras", label: "Computadoras", emoji: "🖥️" },
  { key: "varios", label: "Varios", emoji: "🗂️" },
] as const;

const ESTADO_FILTROS: { key: string; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "pendiente", label: "Pendiente" },
  { key: "preparacion", label: "Preparación" },
  { key: "listo", label: "Listo" },
  { key: "despachado", label: "Despachado" },
];

const SECCION_TO_TIPO = {
  notebooks: "notebook",
  computadoras: "computadora",
  varios: "varios",
} as const;

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const session = await auth();
  const rol = session?.user?.rol ?? "tecnico";

  const seccionParam = params.seccion ?? "todos";
  const seccion = ["todos", "notebooks", "computadoras", "varios"].includes(seccionParam)
    ? seccionParam
    : "todos";

  // Técnicos ven "pendiente" por defecto, admins ven "todos"
  const defaultEstado = rol === "tecnico" ? "pendiente" : "todos";
  const estadoFiltro = params.estado ?? defaultEstado;

  // Construir condiciones WHERE
  const tipoProducto = seccion !== "todos" ? SECCION_TO_TIPO[seccion as keyof typeof SECCION_TO_TIPO] : null;

  // Para técnicos sin filtro explícito: excluir despachados
  const estadosVisibles: EstadoOrden[] =
    rol === "tecnico" && estadoFiltro === "todos"
      ? ["pendiente", "preparacion", "listo"]
      : estadoFiltro !== "todos"
      ? [estadoFiltro as EstadoOrden]
      : ["pendiente", "preparacion", "listo", "despachado"];

  const conditions = [
    ...(tipoProducto ? [eq(orders.tipoProducto, tipoProducto)] : []),
    ...(estadoFiltro === "todos" && rol === "tecnico"
      ? [inArray(orders.estado, estadosVisibles)]
      : estadoFiltro !== "todos"
      ? [eq(orders.estado, estadoFiltro as EstadoOrden)]
      : []),
  ];

  const pedidos = await db
    .select()
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt));

  // Contadores por estado (para la sección actual)
  const todosParaConteo = await db
    .select({ estado: orders.estado })
    .from(orders)
    .where(tipoProducto ? eq(orders.tipoProducto, tipoProducto) : undefined);

  const contadores = {
    todos: todosParaConteo.length,
    pendiente: todosParaConteo.filter((o) => o.estado === "pendiente").length,
    preparacion: todosParaConteo.filter((o) => o.estado === "preparacion").length,
    listo: todosParaConteo.filter((o) => o.estado === "listo").length,
    despachado: todosParaConteo.filter((o) => o.estado === "despachado").length,
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
              {rol === "admin" && (
                <span className="ml-1 text-blue-500">(admin)</span>
              )}
            </span>
            <Link
              href="/orders/new"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              + Nuevo pedido
            </Link>
            {rol === "admin" && (
              <>
                <Link
                  href="/orders/import"
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                >
                  Qloud
                </Link>
                <Link
                  href="/contabilium"
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                >
                  Contabilium
                </Link>
                <Link
                  href="/metricas"
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                >
                  Métricas
                </Link>
              </>
            )}
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
        <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit overflow-x-auto">
          {SECCIONES.map((s) => (
            <Link
              key={s.key}
              href={`/?seccion=${s.key}&estado=${estadoFiltro}`}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                seccion === s.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {s.emoji} {s.label}
            </Link>
          ))}
        </div>

        {/* Filtros por estado */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {ESTADO_FILTROS.filter(
            (f) => rol === "admin" || f.key !== "despachado"
          ).map((f) => {
            const count = contadores[f.key as keyof typeof contadores];
            const isActive = estadoFiltro === f.key ||
              (estadoFiltro === "todos" && f.key === "todos");
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
                <span className={`ml-1 ${isActive ? "text-blue-200" : "text-gray-400"}`}>
                  ({count})
                </span>
              </Link>
            );
          })}
          {/* Técnicos: botón para ver despachados */}
          {rol === "tecnico" && (
            <Link
              href={`/?seccion=${seccion}&estado=despachado`}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                estadoFiltro === "despachado"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-500 border border-gray-200 hover:border-blue-300"
              }`}
            >
              Despachado
              <span className={`ml-1 ${estadoFiltro === "despachado" ? "text-blue-200" : "text-gray-400"}`}>
                ({contadores.despachado})
              </span>
            </Link>
          )}
        </div>

        {/* Buscador + Grid de pedidos */}
        <SearchableOrderGrid pedidos={pedidos} />
      </main>
    </div>
  );
}
