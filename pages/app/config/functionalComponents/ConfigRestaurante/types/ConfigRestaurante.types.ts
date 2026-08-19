import type { ConfigDefaults, ConfigFloor, ConfigSalon, OpeningMode, WeekdayOpen } from "../../../../../../api/types";
import type { FloorTab } from "../../../../config/helpers/configHelpers";

/** Response from floor/salon aforo setters that can be rejected when the sum of
 *  salon aforos would exceed a floor's max aforo. */
export type AforoErrorResponse = {
  success: boolean;
  message?: string;
  floors?: ConfigFloor[];
  aforoCapped?: boolean;
  remainingAforo?: number;
  totalSalonAforo?: number;
};

export type RestauranteContentProps = {
  defaults: ConfigDefaults;
  floors: ConfigFloor[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  api: { config: {
    setDefaults: (patch: Partial<ConfigDefaults>) => Promise<{ success: boolean; message?: string }>;
    setDefaultFloors: (patch: { count?: number; floorNumber?: number; active?: boolean; maxAforo?: number }) => Promise<AforoErrorResponse>;
    listSalons: (date?: string) => Promise<{ success: boolean; message?: string; salons?: ConfigSalon[] }>;
    createSalon: (input: { floorId: number; name: string; hasCapacityLimit: boolean; capacityLimit: number; isActive?: boolean; date?: string }) => Promise<AforoErrorResponse & { salons?: ConfigSalon[] }>;
    updateSalon: (salonId: number, input: { floorId: number; name: string; hasCapacityLimit: boolean; capacityLimit: number; isActive?: boolean; date?: string }) => Promise<AforoErrorResponse & { salons?: ConfigSalon[] }>;
    deleteSalon: (salonId: number) => Promise<{ success: boolean; message?: string }>;
  } };
  pushToast: (t: { kind: "success" | "error" | "info"; title: string; message?: string }) => void;
  /** Optimistic notification: parent should replace its floors state with this array. */
  onFloorsChanged?: (floors: ConfigFloor[]) => void;
  /** Optimistic notification: parent should merge this patch into its defaults state. */
  onDefaultsChanged?: (patch: Partial<ConfigDefaults>) => void;
  /** Persisted collapsed/expanded state of the "Reparto por hora" details accordion. */
  hourSplitDetailsOpen: boolean;
  onHourSplitDetailsOpenChange: (next: boolean) => void;
};

export type FloorCard = {
  floor: ConfigFloor;
  plantaLabel: string;
  salonLabel: string;
  statusLabel: string;
  defaultLabel: string;
  keyPrefix: string;
};
