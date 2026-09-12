import { useConfig } from "vike-react/useConfig";

export type Data = Record<string, never>;

/**
 * QR module data loader. The restaurant website is resolved client-side (via
 * the backoffice /api proxy, which injects the admin vault key) so the page
 * never depends on a direct server-to-backend admin call.
 */
export async function data() {
  const config = useConfig();
  config({ title: "QR" });
  return {};
}
