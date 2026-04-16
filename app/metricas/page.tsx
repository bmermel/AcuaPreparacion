import Link from "next/link";
import { eq, sql, and, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, orderHistory } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

const ESTADO_COLORS: Record<string, string> = {
  pendiente: "bg-yellow-400",
  preparacion: "bg-blue-500",
  listo: "bg-green-500",
  despachado: "bg-gray-400",
};

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  preparacion: "Preparación",
  listo: "Listo",
  despachado: "Despachado",
};

export default async function MetricasPage() {
  const session = await auth();
  if (!session || session.user.rol !== "admin") redirect("/");

  // Conteo por estado
  const todosLosEstados = await db
    .select({ estado: orders.estado })
    .from(orders);

  const conteoPorEstado = {
    pendiente: todosLosEstados.filter((o) => o.estado === "pendiente").length,
    preparacion: todosLosEstados.filter((o) => o.estado === "preparacion").length,
    listo: todosLosEstados.filter((o) => o.estado === "listo").length,
    despachado: todosLosEstados.filter((o) => o.estado === "despachado").length,
  };
  const totalPedidos = todosLosEstados.length;

  // Tiempo promedio pendiente → listo (usando historial)
  // Buscamos las transiciones a "listo" y calculamos cuánto tardaron desde el createdAt del pedido
  const transicionesAListo = await db
    .select({
      orderId: orderHistory.orderId,
      fechaListo: orderHistory.createdAt,
    })
    .from(orderHistory)
    .where(eq(orderHistory.estadoNuevo, "listo"));

  let tiempoPromedioHoras: number | null = null;
  if (transicionesAListo.length > 0) {
    // Para cada transición a listo, buscar el createdAt del pedido
    const orderIds = transicionesAListo.map((t) => t.orderId);
    const pedidosConFecha = await db
      .select({ id: orders.id, createdAt: orders.createdAt })
      .from(orders)
      .where(sql`${orders.id} = ANY(${orderIds})`);

    const fechasMap = new Map(pedidosConFecha.map((p) => [p.id, p.createdAt]));

    let totalHoras = 0;
    let count = 0;
    for (const t of transicionesAListo) {
      const createdAt = fechasMap.get(t.orderId);
      if (createdAt) {
        const diffMs = new Date(t.fechaListo).getTime() - new Date(createdAt).getTime();
        totalHoras += diffMs / (1000 * 60 * 60);
        count++;
      }
    }
    if (count > 0) {
      tiempoPromedioHoras = totalHoras / count;
    }
  }

  // Tiempo promedio por técnico
  const historialPorTecnico = await db
    .select({
      userName: orderHistory.userName,
      orderId: orderHistory.orderId,
      estadoNuevo: orderHistory.estadoNuevo,
      createdAt: orderHistory.createdAt,
    })
    .from(orderHistory)
    .where(eq(orderHistory.estadoNuevo, "listo"));

  const tecnicoStats: Record<string, { totalHoras: number; count: number }> = {};
  for (const h of historialPorTecnico) {
    // Buscar cuándo se marcó en preparación
    const [prepEntry] = await db
      .select({ createdAt: orderHistory.createdAt })
      .from(orderHistory)
      .where(
        and(
          eq(orderHistory.orderId, h.orderId),
          eq(orderHistory.estadoNuevo, "preparacion")
        )
      )
      .limit(1);

    if (prepEntry) {
      const diffMs = new Date(h.createdAt).getTime() - new Date(prepEntry.createdAt).getTime();
      const horas = diffMs / (1000 * 60 * 60);
      if (!tecnicoStats[h.userName]) {
        tecnicoStats[h.userName] = { totalHoras: 0, count: 0 };
      }
      tecnicoStats[h.userName].totalHoras += horas;
      tecnicoStats[h.userName].count++;
    }
  }

  // Pedidos completados (despachados) esta semana y este mes
  const ahora = new Date();
  const inicioSemana = new Date(ahora);
  inicioSemana.setDate(ahora.getDate() - ahora.getDay());
  inicioSemana.setHours(0, 0, 0, 0);

  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  const despachadosHistorial = await db
    .select({ createdAt: orderHistory.createdAt })
    .from(orderHistory)
    .where(eq(orderHistory.estadoNuevo, "despachado"));

  const despachadosSemana = despachadosHistorial.filter(
    (h) => new Date(h.createdAt) >= inicioSemana
  ).length;
  const despachadosMes = despachadosHistorial.filter(
    (h) => new Date(h.createdAt) >= inicioMes
  ).length;

  function formatHoras(h: number): string {
    if (h < 1) return `${Math.round(h * 60)} min`;
    if (h < 24) return `${h.toFixed(1)} hs`;
    const dias = Math.floor(h / 24);
    const horasRestantes = Math.round(h % 24);
    return `${dias}d ${horasRestantes}hs`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
          >
            ←
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Métricas</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {/* Conteo por estado */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Pedidos por estado
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(conteoPorEstado).map(([estado, count]) => (
              <div key={estado} className="text-center">
                <div className={`w-3 h-3 rounded-full ${ESTADO_COLORS[estado]} mx-auto mb-2`} />
                <p className="text-2xl font-bold text-gray-800">{count}</p>
                <p className="text-xs text-gray-500">{ESTADO_LABELS[estado]}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Total: <span className="font-semibold text-gray-800">{totalPedidos}</span> pedidos
            </p>
          </div>
        </div>

        {/* Tiempos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <p className="text-xs text-gray-500 mb-2">Tiempo promedio hasta listo</p>
            <p className="text-2xl font-bold text-blue-600">
              {tiempoPromedioHoras !== null ? formatHoras(tiempoPromedioHoras) : "—"}
            </p>
            <p className="text-xs text-gray-400 mt-1">desde carga hasta listo</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <p className="text-xs text-gray-500 mb-2">Despachados esta semana</p>
            <p className="text-2xl font-bold text-green-600">{despachadosSemana}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <p className="text-xs text-gray-500 mb-2">Despachados este mes</p>
            <p className="text-2xl font-bold text-green-600">{despachadosMes}</p>
          </div>
        </div>

        {/* Tiempos por técnico */}
        {Object.keys(tecnicoStats).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Tiempo de preparación por técnico
            </p>
            <div className="space-y-3">
              {Object.entries(tecnicoStats)
                .sort((a, b) => a[1].totalHoras / a[1].count - b[1].totalHoras / b[1].count)
                .map(([nombre, stats]) => (
                  <div key={nombre} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{nombre}</p>
                      <p className="text-xs text-gray-400">{stats.count} pedidos preparados</p>
                    </div>
                    <p className="text-sm font-semibold text-blue-600">
                      {formatHoras(stats.totalHoras / stats.count)} promedio
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {transicionesAListo.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <p className="text-3xl mb-2">📊</p>
            <p className="text-sm">
              Las métricas de tiempo se calcularán a medida que se usen los cambios de estado.
            </p>
            <p className="text-xs mt-1">
              El historial empezó a registrarse recién — los datos irán apareciendo.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
