import type { TipoProducto } from "./db/schema";

/**
 * Horario laboral: Lunes a Viernes, 11:00 a 18:00 (Argentina).
 *
 * Notebooks (<=5 unidades): 48 horas habiles
 * Computadoras / All in One / Varios: 72 horas habiles
 *
 * Las horas habiles se cuentan solo dentro del horario laboral (7hs/dia).
 */

const HORA_INICIO = 11; // 11:00
const HORA_FIN = 18;    // 18:00
const HORAS_POR_DIA = HORA_FIN - HORA_INICIO; // 7 horas habiles por dia

/**
 * Normaliza una fecha al proximo momento laboral valido.
 *
 * - Si cae en dia laboral dentro de horario → la misma fecha
 * - Si cae antes de las 11 en dia laboral → ese dia a las 11:00
 * - Si cae despues de las 18 en dia laboral → siguiente dia laboral a las 11:00
 * - Si cae en fin de semana → lunes siguiente a las 11:00
 */
export function normalizarAHorarioLaboral(fecha: Date): Date {
  const d = new Date(fecha);

  // Avanzar si cae en fin de semana
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
    d.setHours(HORA_INICIO, 0, 0, 0);
  }

  // Si es antes del horario laboral, poner a las 11
  if (d.getHours() < HORA_INICIO) {
    d.setHours(HORA_INICIO, 0, 0, 0);
  }

  // Si es despues del horario laboral, avanzar al siguiente dia laboral
  if (d.getHours() >= HORA_FIN) {
    d.setDate(d.getDate() + 1);
    d.setHours(HORA_INICIO, 0, 0, 0);
    // Si caimos en fin de semana, avanzar
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
  }

  return d;
}

export function calcularFechaEntrega(
  fechaInicio: Date,
  tipoProducto: TipoProducto,
  cantidadTotal: number
): Date {
  const horasHabiles =
    tipoProducto === "notebook" && cantidadTotal <= 5 ? 48 : 72;

  // Normalizar la fecha de inicio al proximo momento laboral
  const d = normalizarAHorarioLaboral(fechaInicio);

  let horasRestantes = horasHabiles;

  while (horasRestantes > 0) {
    const dia = d.getDay();

    // Fin de semana: saltar
    if (dia === 0 || dia === 6) {
      d.setDate(d.getDate() + 1);
      d.setHours(HORA_INICIO, 0, 0, 0);
      continue;
    }

    // Horas disponibles hoy desde la hora actual hasta las 18
    const horaActual = d.getHours() + d.getMinutes() / 60;
    const horasDisponiblesHoy = Math.max(0, HORA_FIN - horaActual);

    if (horasRestantes <= horasDisponiblesHoy) {
      // Termina hoy
      d.setHours(d.getHours() + Math.floor(horasRestantes));
      d.setMinutes(d.getMinutes() + Math.round((horasRestantes % 1) * 60));
      horasRestantes = 0;
    } else {
      // Consumir las horas de hoy y pasar al dia siguiente
      horasRestantes -= horasDisponiblesHoy;
      d.setDate(d.getDate() + 1);
      d.setHours(HORA_INICIO, 0, 0, 0);
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
