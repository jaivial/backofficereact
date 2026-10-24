import { APIResponseError } from "../../../../api/utils/request";
import { money } from "./money";

/**
 * Turns a POS API failure into something a waiter can act on. The API speaks
 * English codes and prose; the till speaks Spanish. Codes win over prose
 * because prose changes; unknown messages pass through untouched.
 * Coordination id: pos_error_messages_v1
 */
const BY_CODE: Record<string, string | ((body: any) => string)> = {
  PIN_REQUIRED: "Esta operación necesita el PIN de un responsable.",
  PIN_INVALID: "PIN de aprobación incorrecto.",
  PIN_LOCKED: "Demasiados intentos fallidos. Espera unos minutos.",
  PIN_POLICY_NO_PIN: "Nadie tiene PIN configurado: crea al menos uno (Mi PIN) antes de exigirlo.",
  STALE_TICKET: "La cuenta cambió en otro terminal. Se ha recargado; vuelve a intentarlo.",
  STALE_VISIT: "La mesa cambió en otro terminal. Se ha recargado; vuelve a intentarlo.",
  TABLE_OCCUPIED: "Esa mesa ya está ocupada.",
  RESERVATION_ALREADY_SEATED: "Esa reserva ya está sentada en otra mesa.",
  CASH_DAY_CLOSED: "El día de caja está cerrado: solo consulta.",
  CASH_DAY_ALREADY_CLOSED: "Este día ya está cerrado.",
  CASH_DAY_ALREADY_OPEN: "Este día ya tiene la caja abierta.",
  FUTURE_CASH_DAY: "No se puede abrir la caja de un día futuro.",
  UNCLOSED_PREVIOUS_DAYS: "Hay días anteriores sin cerrar.",
  OPEN_POS_ITEMS: "Cierra o cobra todas las mesas y cuentas abiertas antes.",
  COUNTED_CASH_REQUIRED: "Introduce el efectivo contado.",
  DISCREPANCY_REASON_REQUIRED: (body) => {
    const expected = Number(body?.expectedCashCents);
    const diff = Number(body?.differenceCents);
    const figures = Number.isFinite(expected) && Number.isFinite(diff) ? ` Esperado ${money(expected)}, diferencia ${diff > 0 ? "+" : ""}${money(diff)}.` : "";
    return `El efectivo contado no cuadra con el esperado.${figures} Escribe el motivo del descuadre para cerrar.`;
  },
  DISCOUNT_EXCEEDS_TOTAL: (body) => `El descuento supera el total de la cuenta${Number.isFinite(Number(body?.maxDiscountCents)) ? ` (máximo ${money(Number(body.maxDiscountCents))})` : ""}. Para no cobrar nada usa «Invita».`,
  PAYMENT_MISMATCH: "Los pagos no cuadran con el total de la cuenta. Revisa los importes.",
  CARD_REFERENCE_REQUIRED: "Introduce la referencia del terminal de tarjeta.",
  CASH_LIMIT_EXCEEDED: "Supera el límite legal de pago en efectivo. Cobra con tarjeta o transferencia.",
  KITCHEN_ROUTES_MISSING: "Ningún plato de esta cuenta tiene estación de cocina asignada. Configura las rutas en Cocina → Rutas.",
  KITCHEN_DISPATCH_CONFLICT: "Cocina recibió otra comanda a la vez. Vuelve a enviar.",
  KITCHEN_STATUS_INVALID: "Ese cambio de estado en cocina no es válido.",
  SHIFT_REQUIRED: "Abre un turno de caja antes.",
  POS_SHIFT_REQUIRED: "Abre un turno de caja antes de usar el cajón.",
  SHIFT_ALREADY_OPEN: "Este terminal ya tiene un turno abierto.",
  POS_DISABLED: "El TPV está desactivado en Configuración.",
  POS_PLAN_REQUIRED: "Tu plan no incluye el TPV.",
  POS_PRODUCTION_ITEM: "Ese artículo es de producción interna y no se descuenta desde el TPV.",
  MERGE_DIFFERENT_BUSINESS_DAY: "No se pueden juntar mesas de días distintos.",
  IDEMPOTENCY_CONFLICT: "Esa operación ya se registró en otra cuenta.",
  CUSTOMER_EXISTS: (body) => String(body?.message || "Ya existe un cliente con ese teléfono o email."),
};

const BY_TEXT: Array<[RegExp, string]> = [
  [/^forbidden$|HTTP 403/i, "Tu rol no tiene permiso para esta operación. Pídeselo a un responsable."],
  [/^unauthorized$|HTTP 401/i, "Tu sesión ha caducado. Vuelve a entrar."],
  [/ticket is not open/i, "La cuenta ya no está abierta."],
  [/ticket not found/i, "No se encontró la cuenta."],
  [/ticket line not found/i, "Esa línea ya no existe en la cuenta."],
  [/ticket has no kitchen lines/i, "No hay platos pendientes de enviar a cocina."],
  [/table is occupied/i, "Esa mesa ya está ocupada."],
  [/visit is not open|visit not found/i, "La mesa ya no está abierta."],
  [/refund exceeds paid amount/i, "La devolución supera lo cobrado."],
  [/refund quantity exceeds sale/i, "No se pueden devolver más unidades de las vendidas."],
  [/customer not found/i, "No se encontró el cliente."],
  [/POS product not found/i, "Ese producto ya no existe en el catálogo."],
  [/invalid ticket line|invalid line/i, "Línea no válida."],
  [/invalid date/i, "Fecha no válida."],
  [/HTTP 5\d\d|^Error /i, "Error del servidor. Vuelve a intentarlo en unos segundos."],
  [/Failed to fetch|NetworkError|Load failed/i, "Sin conexión con el servidor. Comprueba la red."],
];

/** Both POS error classes expose `code` and the parsed body; duck-typed so this file depends on neither hook. */
function codeAndBody(reason: unknown): { code: string; body: any } {
  if (reason instanceof APIResponseError) return { code: reason.code, body: reason.body };
  const any = reason as { code?: unknown; body?: unknown } | null;
  return { code: typeof any?.code === "string" ? any.code : "", body: any?.body ?? null };
}

export function posErrorMessage(reason: unknown, fallback: string): string {
  const { code, body } = codeAndBody(reason);
  if (code) {
    const entry = BY_CODE[code];
    if (typeof entry === "function") return entry(body);
    if (entry) return entry;
  }
  const msg = reason instanceof Error ? reason.message : "";
  for (const [pattern, text] of BY_TEXT) if (pattern.test(msg)) return text;
  return msg || fallback;
}
