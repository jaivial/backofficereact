import type { MenuSelectorItem } from "../../../../../../../api/types";

export interface MandatoryMenuConfigProps {
  availableMenus: MenuSelectorItem[];
  selectedMenuIds: number[];
  menuChooseMain: number[];
  mandatoryBooking: boolean;
  showMandatoryInfo: boolean;
  mandatoryMenuBusy: boolean;
  mandatoryMenuStatus: boolean;
  onToggle: (checked: boolean) => void;
  onMenuChange: (ids: number[], chooseMain: number[]) => void;
  onBookingChange: (checked: boolean) => void;
  onInfoToggle: () => void;
  onSave: () => void;
}
