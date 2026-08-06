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
  /** All schedules for this member on this date (multi-shift days supported). */
  schedules: FichajeSchedule[];
  /** The member whose schedule this card shows; enables the shift editor. */
  member?: Member;
  /** Opens the shift editor for this date. Required when member is set. */
  onEdit?: (date: string) => void;
  className?: string;
};

export type WeeklyScheduleTableProps = {
  weekGroups: WeekGroup[];
  schedulesByDate: Map<string, FichajeSchedule[]>;
  /** The member whose schedule the table shows; enables the shift editor. */
  member?: Member;
  /** Opens the shift editor for the given date. Required when member is set. */
  onEdit?: (date: string) => void;
  className?: string;
};
