import React, { useMemo } from "react";
import { usePageContext } from "vike-react/usePageContext";

import type { FichajeSchedule, Member } from "../../../../api/types";
import { TurnosView } from "./TurnosView";

type PageData = {
  date: string;
  members: Member[];
  schedules: FichajeSchedule[];
  error: string | null;
};

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? {
    date: todayISO(),
    members: [],
    schedules: [],
    error: null,
  }) as PageData;

  const initialMemberId = useMemo(() => {
    const raw = Number(pageContext.urlParsed?.search?.memberId ?? 0);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [pageContext.urlParsed?.search?.memberId]);

  return (
    <TurnosView
      date={data.date || todayISO()}
      members={data.members}
      schedules={data.schedules}
      error={data.error}
      initialMemberId={initialMemberId}
    />
  );
}
