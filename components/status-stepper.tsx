import type { EstadoOrden } from "@/lib/db/schema";

const PASOS: { key: EstadoOrden; label: string; color: string }[] = [
  { key: "pendiente", label: "Pendiente", color: "bg-yellow-400" },
  { key: "preparacion", label: "Preparación", color: "bg-blue-500" },
  { key: "listo", label: "Listo", color: "bg-green-500" },
  { key: "despachado", label: "Despachado", color: "bg-gray-500" },
];

export function StatusStepper({ estado }: { estado: EstadoOrden }) {
  const idxActual = PASOS.findIndex((p) => p.key === estado);

  return (
    <div className="flex items-center gap-1">
      {PASOS.map((paso, idx) => {
        const activo = idx <= idxActual;
        return (
          <div key={paso.key} className="flex items-center gap-1">
            <div
              className={`h-2 w-6 rounded-full transition-colors ${
                activo ? paso.color : "bg-gray-200"
              }`}
              title={paso.label}
            />
          </div>
        );
      })}
      <span className="ml-1 text-xs font-medium text-gray-600">
        {PASOS[idxActual].label}
      </span>
    </div>
  );
}

export function EstadoBadge({ estado }: { estado: EstadoOrden }) {
  const colores: Record<EstadoOrden, string> = {
    pendiente: "bg-yellow-100 text-yellow-800 border-yellow-200",
    preparacion: "bg-blue-100 text-blue-800 border-blue-200",
    listo: "bg-green-100 text-green-800 border-green-200",
    despachado: "bg-gray-100 text-gray-700 border-gray-200",
  };

  const labels: Record<EstadoOrden, string> = {
    pendiente: "Pendiente",
    preparacion: "En preparación",
    listo: "Listo",
    despachado: "Despachado",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colores[estado]}`}
    >
      {labels[estado]}
    </span>
  );
}
