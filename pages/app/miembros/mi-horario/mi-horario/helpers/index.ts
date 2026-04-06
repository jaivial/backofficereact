export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const weekdays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const weekday = weekdays[d.getDay()];
  return `${weekday}, ${pad2(day)}/${pad2(month)}/${year}`;
}

export function diffHours(start: string, end: string): string {
  const [sh, sm] = start.split(":").map((v) => Number(v));
  const [eh, em] = end.split(":").map((v) => Number(v));
  if (![sh, sm, eh, em].every((v) => Number.isFinite(v))) return "--";
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes <= 0) return "--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
