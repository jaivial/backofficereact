import type { ConfigDefaults, ConfigFloor, OpeningMode, WeekdayOpen } from "../../../../../../api/types";
import type { FloorTab } from "../../../../config/helpers/configHelpers";

export type RestauranteContentProps = {
  defaults: ConfigDefaults;
  floors: ConfigFloor[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  api: { config: { setDefaults: (patch: Partial<ConfigDefaults>) => Promise<{ success: boolean; message?: string }>; setDefaultFloors: (patch: { count?: number; floorNumber?: number; active?: boolean }) => Promise<{ success: boolean; message?: string }> } };
  pushToast: (t: { kind: "success" | "error"; title: string; message?: string }) => void;
};

export type FloorCard = {
  floor: ConfigFloor;
  plantaLabel: string;
  salonLabel: string;
  statusLabel: string;
  defaultLabel: string;
  keyPrefix: string;
};
