import type {
  ConfigDailyLimit,
  ConfigDayStatus,
  ConfigFloor,
  ConfigMesasDeDos,
  ConfigMesasDeTres,
  ConfigOpeningHours,
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
  error: string | null;
};

export type { ConfigDailyLimit, ConfigDayStatus, ConfigFloor, ConfigMesasDeDos, ConfigMesasDeTres, ConfigOpeningHours, MandatoryMenuConfig, MenuSelectorItem, OpeningMode };
