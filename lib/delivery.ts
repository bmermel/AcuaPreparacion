import type { TipoProducto } from "./db/schema";

// Horario de trabajo: L-V 10:00–18:00 (8hs), Sáb 10:00–14:00 (4hs), Dom cerrado

const APERTURA = 10; // 10:00
const CIERRE_SEMANA = 18; // 18:00
const CIERRE_SABADO = 14; // 14:00

function minutosHabilesEnDia(fecha: Date): number {
  const dia = fecha.getDay(); // 0=Dom, 6=Sáb
  if (dia === 0) return 0;
  if (dia === 6) return (CIERRE_SABADO - APERTURA) * 60;
  return (CIERRE_SEMANA - APERTURA) * 60;
}

function cierreDelDia(fecha: Date): number {
  const dia = fecha.getDay();
  if (dia === 6) return CIERRE_SABADO;
  return CIERRE_SEMANA;
}

// Avanza la fecha al próximo instante de apertura si está fuera de horario
function normalizarInicio(fecha: Date): Date {
  const d = new Date(fecha);
  const dia = d.getDay();
  const hora = d.getHours() + d.getMinutes() / 60;

  // Domingo → lunes 10:00
  if (dia === 0) {
    d.setDate(d.getDate() + 1);
    d.setHours(APERTURA, 0, 0, 0);
    return d;
  }

  const cierre = cierreDelDia(d);

  // Después del cierre → próximo día hábil a las 10:00
  if (hora >= cierre) {
    d.setDate(d.getDate() + (dia === 6 ? 2 : 1)); // Sáb → Lun
    d.setHours(APERTURA, 0, 0, 0);
    return d;
  }

  // Antes de apertura → mismo día a las 10:00
  if (hora < APERTURA) {
    d.setHours(APERTURA, 0, 0, 0);
    return d;
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

  let minutosRestantes = horasHabiles * 60;
  const d = normalizarInicio(new Date(fechaInicio));

  while (minutosRestantes > 0) {
    const dia = d.getDay();

    if (dia === 0) {
      // Domingo: saltar al lunes 10:00
      d.setDate(d.getDate() + 1);
      d.setHours(APERTURA, 0, 0, 0);
      continue;
    }

    const cierre = cierreDelDia(d);
    const horaActual = d.getHours() + d.getMinutes() / 60;

    if (horaActual >= cierre) {
      // Pasó el cierre: ir al próximo día hábil
      d.setDate(d.getDate() + (dia === 6 ? 2 : 1));
      d.setHours(APERTURA, 0, 0, 0);
      continue;
    }

    // Minutos disponibles hasta el cierre hoy
    const minutosHastacierre = (cierre - horaActual) * 60;

    if (minutosRestantes <= minutosHastacierre) {
      d.setMinutes(d.getMinutes() + minutosRestantes);
      minutosRestantes = 0;
    } else {
      minutosRestantes -= minutosHastacierre;
      d.setDate(d.getDate() + (dia === 6 ? 2 : 1));
      d.setHours(APERTURA, 0, 0, 0);
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
