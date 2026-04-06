import { createClient } from "../../../../api/client";
import type { WidgetSettings } from "../../../../api/types";
import { BookingManager } from "./BookingManager";

type PageData = {
  settings: WidgetSettings | null;
  error: string | null;
};

export default function Page() {
  return <BookingManager />;
}
