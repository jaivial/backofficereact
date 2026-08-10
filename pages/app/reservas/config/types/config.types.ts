import type {
  ConfigDailyLimit,
  ConfigDayStatus,
  ConfigFloor,
  ConfigMesasDeDos,
  ConfigMesasDeTres,
  ConfigOpeningHours,
  HourSplitConfig,
  MandatoryMenuConfig,
  MenuSelectorItem,
  OpeningMode,
} from "../../../../../api/types";

export type PageData = {
  date: string;
  day: ConfigDayStatus | null;
  dailyLimit: ConfigDailyLimit | null;
  openingHours: ConfigOpeningHours | null;
  mesasDeDos: ConfigMesasDeDos | null;
  mesasDeTres: ConfigMesasDeTres | null;
  floors: ConfigFloor[];
  hourSplit: HourSplitConfig | null;
  error: string | null;
};

export type { ConfigDailyLimit, ConfigDayStatus, ConfigFloor, ConfigMesasDeDos, ConfigMesasDeTres, ConfigOpeningHours, HourSplitConfig, MandatoryMenuConfig, MenuSelectorItem, OpeningMode };
