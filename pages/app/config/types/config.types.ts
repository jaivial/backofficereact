import type { ConfigDefaults, ConfigFloor, RestaurantInfo } from "../../../../api/types";

export type PageData = {
  defaults: ConfigDefaults | null;
  floors: ConfigFloor[];
  restaurantInfo: RestaurantInfo | null;
  error: string | null;
};
