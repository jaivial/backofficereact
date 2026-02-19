import { createClient } from "../../../../api/client";
import { canViewOwnSchedule } from "../../../../lib/rbac";
import type { BOSession } from "../../../../api/types";

export type Data = {
  schedules: import("../../../../api/types").FichajeSchedule[];
  error: string | null;
};

export async function data(pageContext: { session: BOSession | null }): Promise<Data> {
  const session = pageContext.session;

  if (!session) {
    return {
      schedules: [],
      error: "No hay sesión activa",
    };
  }

  // Check if user can view their own schedule
  if (!canViewOwnSchedule(session.user.role)) {
    return {
      schedules: [],
      error: "No tienes permiso para ver horarios",
    };
  }

  try {
    const client = createClient({ baseUrl: "" });
    const res = await client.horarios.getMySchedule();

    if (res.success) {
      return {
        schedules: res.schedules,
        error: null,
      };
    }

    return {
      schedules: [],
      error: res.message || "Error cargando horarios",
    };
  } catch (err) {
    return {
      schedules: [],
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}
