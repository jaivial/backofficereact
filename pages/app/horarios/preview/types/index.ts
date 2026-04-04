import type { FichajeSchedule, Member } from "../../../../../api/types";

export type PageData = {
  date: string;
  members: Member[];
  schedules: FichajeSchedule[];
  error: string | null;
};
