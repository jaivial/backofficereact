import { useConfig } from "vike-react/useConfig";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data() {
  const config = useConfig();
  config({ title: "Nueva campana · Campanas" });
  return {};
}
