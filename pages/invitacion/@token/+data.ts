import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const token = String((pageContext as any).routeParams?.token ?? "").trim();
  const config = useConfig();
  config({ title: "Invitación" });
  return { token };
}
