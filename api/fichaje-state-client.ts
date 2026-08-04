import type { APIError, APISuccess, FichajeState } from "./types";
import { createApiFetch, createJsonRequest, normalizeClientOpts, type ClientOpts } from "./utils/request";

export function createFichajeStateClient(opts: ClientOpts = { baseUrl: "" }) {
  const json = createJsonRequest(createApiFetch(normalizeClientOpts(opts)));
  return {
    getState(): Promise<APISuccess<{ state: FichajeState }> | APIError> {
      return json("/api/admin/fichaje/state", { method: "GET" });
    },
  };
}
