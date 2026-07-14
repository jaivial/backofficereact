import type { RestaurantInfo } from "../../../../../../api/types";

export type ContactoContentProps = {
  initialInfo: RestaurantInfo;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  api: {
    config: {
      setRestaurantInfo: (patch: Partial<RestaurantInfo>) => Promise<{ success: boolean; message?: string; restaurantInfo?: RestaurantInfo }>;
      checkRestaurantWebsite: (website: string) => Promise<{ success: boolean; message?: string; website?: string }>;
    };
  };
  pushToast: (t: { kind: "success" | "error"; title: string; message?: string }) => void;
};
