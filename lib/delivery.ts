import type { TipoProducto } from "./db/schema";

/**
 * Cálculo de fecha estimada de entrega.
 *
 * "Horas hábiles" = horas de día hábil, no de horario de atención:
 *   - Lunes a viernes: 24 horas cada día
 *   - Sábado: 12 horas (medio día)
 *   - Domingo: 0 horas (no cuenta)
 *
 * Notebooks (≤5 unidades): 48 horas hábiles
 * Computadoras / Varios: 72 horas hábiles
 */

function horasHabilesEnDia(diaSemana: number): number {
  if (diaSemana === 0) return 0;  // Domingo
  if (diaSemana === 6) return 12; // Sábado = medio día
  return 24;                       // Lunes a viernes
}

export function calcularFechaEntrega(
  fechaInicio: Date,
  tipoProducto: TipoProducto,
  cantidadTotal: number
): Date {
  const horasHabiles =
    tipoProducto === "notebook" && cantidadTotal <= 5 ? 48 : 72;

  let horasRestantes = horasHabiles;
  const d = new Date(fechaInicio);

  // Si cae domingo, avanzar al lunes
  if (d.getDay() === 0) {
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
  }

  while (horasRestantes > 0) {
    const dia = d.getDay();
    const horasDelDia = horasHabilesEnDia(dia);

    if (horasDelDia === 0) {
      // Domingo: saltar
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
      continue;
    }

    if (horasRestantes >= horasDelDia) {
      horasRestantes -= horasDelDia;
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
    } else {
      d.setHours(d.getHours() + horasRestantes);
      horasRestantes = 0;
    }
  }

  return d;
}

export function formatearFechaEntrega(fecha: Date): string {
  return fecha.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
