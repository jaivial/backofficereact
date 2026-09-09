import { useConfig } from "vike-react/useConfig";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data() {
  const config = useConfig();
  config({ title: "Bajas de campañas \u00b7 Campañas" });
  return {};
}
