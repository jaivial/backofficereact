import type { Booking, ConfigFloor } from "../../../api/types";

export function bookingFloorDisplay(booking: Booking, floors: ConfigFloor[] = []): string {
  if (typeof booking.preferred_floor_number !== "number") return "";
  const match = floors.find((floor) => floor.floorNumber === booking.preferred_floor_number);
  return match?.name || `Planta ${booking.preferred_floor_number}`;
}

export function bookingSalonDisplay(booking: Booking): string {
  return String(booking.preferred_salon_name || "").trim();
}
