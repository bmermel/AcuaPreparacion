import type { TipoProducto } from "./db/schema";

/**
 * Cálculo de fecha estimada de entrega.
 *
 * "Horas hábiles" = horas de día hábil:
 *   - Lunes a viernes: 24 horas cada día
 *   - Sábado y domingo: 0 horas (no cuentan)
 *
 * Notebooks (≤5 unidades): 48 horas hábiles
 * Computadoras / Varios: 72 horas hábiles
 */

function horasHabilesEnDia(diaSemana: number): number {
  if (diaSemana === 0 || diaSemana === 6) return 0; // Sábado y domingo no cuentan
  return 24;                                          // Lunes a viernes
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

  // Si cae fin de semana, avanzar al lunes
  while (d.getDay() === 0 || d.getDay() === 6) {
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
