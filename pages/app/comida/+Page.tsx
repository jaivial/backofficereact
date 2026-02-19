import React, { useCallback, useMemo } from "react";
import { usePageContext } from "vike-react/usePageContext";

import type { Data } from "./+data";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { FoodTypePanelGrid } from "./_components/FoodTypePanelGrid";
import type { FoodType } from "./_components/foodTypes";

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data;
  useErrorToast(data.error);

  const countsByType = useMemo(
    () => ({
      vinos: data.countsByType?.vinos || 0,
      cafes: data.countsByType?.cafes || 0,
      postres: data.countsByType?.postres || 0,
      platos: data.countsByType?.platos || 0,
      bebidas: data.countsByType?.bebidas || 0,
    }),
    [data.countsByType],
  );

  const onSelect = useCallback((type: FoodType) => {
    window.location.assign(`/app/comida/${type}`);
  }, []);

  return (
    <section aria-label="Carta" className="bo-menuV2Page is-selector">
      <FoodTypePanelGrid countsByType={countsByType} onSelect={onSelect} />
    </section>
  );
}
