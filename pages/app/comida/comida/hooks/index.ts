import { useCallback } from "react";
import type { FoodType } from "../constants";

export function useComidaPageActions() {
  const openCategory = useCallback((type: FoodType) => {
    window.location.href = `/app/comida/${type}`;
  }, []);

  const openCreate = useCallback(() => {
    window.location.href = "/app/comida/platos";
  }, []);

  return { openCategory, openCreate };
}
