export function navigateToFacturas(filterType: string): void {
  const baseUrl = "/app/facturas";

  if (filterType === "pending") {
    window.location.href = `${baseUrl}?status=pendiente`;
  } else if (filterType === "month") {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const yyyy = firstDay.getFullYear();
    const mm = String(firstDay.getMonth() + 1).padStart(2, "0");
    const dd = String(firstDay.getDate()).padStart(2, "0");
    const todayYyyy = today.getFullYear();
    const todayMm = String(today.getMonth() + 1).padStart(2, "0");
    const todayDd = String(today.getDate()).padStart(2, "0");
    window.location.href = `${baseUrl}?date_from=${yyyy}-${mm}-${dd}&date_to=${todayYyyy}-${todayMm}-${todayDd}`;
  } else if (filterType === "week-sent") {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    const yyyy = monday.getFullYear();
    const mm = String(monday.getMonth() + 1).padStart(2, "0");
    const dd = String(monday.getDate()).padStart(2, "0");
    const todayYyyy = today.getFullYear();
    const todayMm = String(today.getMonth() + 1).padStart(2, "0");
    const todayDd = String(today.getDate()).padStart(2, "0");
    window.location.href = `${baseUrl}?status=enviada&date_from=${yyyy}-${mm}-${dd}&date_to=${todayYyyy}-${todayMm}-${todayDd}`;
  }
}
