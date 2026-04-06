import type { RestaurantInfo } from "../../../../../../api/types";

export type ContactoContentProps = {
  initialInfo: RestaurantInfo;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  api: { config: { setRestaurantInfo: (patch: Partial<RestaurantInfo>) => Promise<{ success: boolean; message?: string; restaurantInfo?: RestaurantInfo }> } };
  pushToast: (t: { kind: "success"; title: string; message: string }) => void;
};
