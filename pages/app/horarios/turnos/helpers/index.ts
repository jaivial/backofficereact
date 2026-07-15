import type { FichajeSchedule } from "../../../../../api/types";

import type { WeekGroup } from "../types/memberFilter";

export function generateDateRange(from: string, to: string): string[] {
  const start = new Date(from);
  const end = new Date(to);
  const dates: string[] = [];

  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export function getWeekGroups(dates: string[]): WeekGroup[] {
  const weeks = new Map<string, WeekGroup>();

  dates.forEach((date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - diffToMonday);
    const weekKey = monday.toISOString().split("T")[0];

    if (!weeks.has(weekKey)) {
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      weeks.set(weekKey, {
        monday: weekKey,
        sunday: sunday.toISOString().split("T")[0],
        dates: [],
      });
    }
    weeks.get(weekKey)!.dates.push(date);
  });

  return Array.from(weeks.values());
}

export function formatDateHeader(date: string): string {
  const d = new Date(date);
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const dayName = days[d.getDay()];
  const day = d.getDate();
  const month = d.toLocaleString("es-ES", { month: "long" });
  return `${dayName} ${day} de ${month}`;
}

export function formatWeekHeader(monday: string, sunday: string): string {
  const mondayDate = new Date(monday);
  const sundayDate = new Date(sunday);
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${mondayDate.getDate()} - ${sundayDate.getDate()} de ${months[mondayDate.getMonth()]}`;
}

export function getDayName(date: string): string {
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const d = new Date(date);
  return days[d.getDay()];
}

export function getScheduleForDate(schedules: FichajeSchedule[], date: string): FichajeSchedule | null {
  return schedules.find((s) => s.date === date) || null;
}
