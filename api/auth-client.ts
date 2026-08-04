import { createAuthModule } from "./modules/auth";
import { createApiFetch, createJsonRequest, normalizeClientOpts, type ClientOpts } from "./utils/request";

export function createAuthClient(opts: ClientOpts = { baseUrl: "" }) {
  const json = createJsonRequest(createApiFetch(normalizeClientOpts(opts)));
  return { auth: createAuthModule(json) };
}
