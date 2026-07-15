import type { FichajeSchedule, Member } from "../../../../../../api/types";

export type WeekGroup = {
  monday: string;
  sunday: string;
  dates: string[];
};

export type MemberFilterViewProps = {
  members: Member[];
  className?: string;
};

export type DailyScheduleCardProps = {
  date: string;
  schedule: FichajeSchedule | null;
  className?: string;
};

export type WeeklyScheduleTableProps = {
  weekGroups: WeekGroup[];
  schedulesByDate: Map<string, FichajeSchedule>;
  className?: string;
};
