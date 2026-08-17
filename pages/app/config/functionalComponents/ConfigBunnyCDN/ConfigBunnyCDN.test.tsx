import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { ConfigBunnyCDN } from "./ConfigBunnyCDN";

const config = {
  publicPullBaseUrl: "https://public.example.net",
  publicStorageZone: "public-zone",
  hasPublicStorageAccessKey: true,
  publicStorageAccessKeyMask: "abcd••••wxyz",
  memberPullBaseUrl: "https://members.example.net",
  memberStorageZone: "member-zone",
  hasMemberStorageAccessKey: false,
  memberStorageAccessKeyMask: "",
  privateStorageZone: "private-zone",
  hasPrivateStorageAccessKey: true,
  privateStorageAccessKeyMask: "priv••••cret",
  publicConfigured: true,
  membersConfigured: false,
  privateConfigured: true,
};

describe("ConfigBunnyCDN", () => {
  it("loads restaurant settings and submits changed non-secret fields", async () => {
    const getBunnyCDNConfig = vi.fn().mockResolvedValue({ success: true, config });
    const setBunnyCDNConfig = vi.fn().mockResolvedValue({ success: true, config });
    const pushToast = vi.fn();
    const api = { config: { getBunnyCDNConfig, setBunnyCDNConfig } } as never;

    render(React.createElement(ConfigBunnyCDN, { api, pushToast }));

    expect(await screen.findByTestId("bunnycdn-config-section")).toBeInTheDocument();
    expect(screen.getByTestId("bunny-public-zone")).toHaveValue("public-zone");
    expect(screen.getByTestId("bunny-public-key")).toHaveAttribute("type", "password");

    fireEvent.change(screen.getByTestId("bunny-public-zone"), { target: { value: "new-public-zone" } });
    fireEvent.click(screen.getByTestId("bunnycdn-save-button"));

    await waitFor(() => expect(setBunnyCDNConfig).toHaveBeenCalledWith(expect.objectContaining({
      publicStorageZone: "new-public-zone",
      publicStorageAccessKey: "",
    })));
    expect(pushToast).toHaveBeenCalledWith(expect.objectContaining({ kind: "success" }));
  });
});
