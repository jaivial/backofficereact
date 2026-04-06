import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import EmailProviderConfigInner from "./EmailProviderConfig";

vi.mock("lucide-react", () => ({
  ChevronDown: () => React.createElement("span", { "data-testid": "chevron-icon" }),
}));

function makeConfig(overrides = {}) {
  return {
    id: 0,
    provider: "smtp",
    smtpHost: "",
    smtpPort: 587,
    smtpUsername: "",
    smtpPassword: "",
    smtpFromEmail: "",
    smtpEncryption: "tls",
    gmailAppPassword: "",
    gmailFromEmail: "",
    isActive: false,
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderWithProps(props: any = {}) {
  const merged = {
    config: makeConfig(),
    setField: vi.fn(),
    save: vi.fn().mockResolvedValue(true),
    load: vi.fn().mockResolvedValue(undefined),
    saving: false,
    pushToast: vi.fn(),
    ...props,
  };
  const utils = render(React.createElement(EmailProviderConfigInner, merged));
  const trigger = screen.getByTestId("email-provider-trigger");
  fireEvent.click(trigger);
  return utils;
}

describe("EmailProviderConfig", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("renders accordion title", () => {
    renderWithProps();
    expect(screen.getByText(/configuración proveedor de email/i)).toBeInTheDocument();
  });

  it("shows SMTP fields when provider is smtp", () => {
    renderWithProps({ config: makeConfig({ provider: "smtp" }) });
    expect(screen.getByLabelText(/host smtp/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/puerto/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/usuario smtp/i)).toBeInTheDocument();
  });

  it("shows Gmail fields when provider is gmail", () => {
    renderWithProps({ config: makeConfig({ provider: "gmail" }) });
    expect(screen.getByLabelText(/cuenta gmail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña de aplicación google/i)).toBeInTheDocument();
  });

  it("disables save button when SMTP fields are empty", () => {
    renderWithProps({ config: makeConfig({ provider: "smtp" }) });
    expect(screen.getByTestId("email-save-button")).toBeDisabled();
  });

  it("disables save button when Gmail fields are empty", () => {
    renderWithProps({ config: makeConfig({ provider: "gmail" }) });
    expect(screen.getByTestId("email-save-button")).toBeDisabled();
  });

  it("enables save button when SMTP fields are filled", async () => {
    renderWithProps({ config: makeConfig({
      provider: "smtp",
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      smtpUsername: "test@test.com",
      smtpPassword: "secret",
      smtpFromEmail: "from@test.com",
    }) });
    expect(screen.getByTestId("email-save-button")).not.toBeDisabled();
  });

  it("enables save button when Gmail fields are filled", async () => {
    renderWithProps({ config: makeConfig({
      provider: "gmail",
      gmailFromEmail: "test@gmail.com",
      gmailAppPassword: "abcd1234",
    }) });
    expect(screen.getByTestId("email-save-button")).not.toBeDisabled();
  });

  it("calls setField when SMTP host input changes", () => {
    const setField = vi.fn();
    renderWithProps({ config: makeConfig({ provider: "smtp" }), setField });
    const input = screen.getByTestId("email-smtp-host");
    fireEvent.change(input, { target: { value: "smtp.example.com" } });
    expect(setField).toHaveBeenCalledWith("smtpHost", "smtp.example.com");
  });

  it("calls save when save button is clicked", async () => {
    const save = vi.fn().mockResolvedValue(true);
    renderWithProps({ config: makeConfig({
      provider: "smtp",
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      smtpUsername: "test@test.com",
      smtpPassword: "secret",
      smtpFromEmail: "from@test.com",
    }), save });
    fireEvent.click(screen.getByTestId("email-save-button"));
    await waitFor(() => { expect(save).toHaveBeenCalled(); });
  });

  it("calls pushToast with success when save succeeds", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const pushToast = vi.fn();
    renderWithProps({ config: makeConfig({
      provider: "smtp",
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      smtpUsername: "test@test.com",
      smtpPassword: "secret",
      smtpFromEmail: "from@test.com",
    }), save, pushToast });
    fireEvent.click(screen.getByTestId("email-save-button"));
    await waitFor(() => {
      expect(pushToast).toHaveBeenCalledWith({
        kind: "success",
        title: "Guardado",
        message: "Configuración de email guardada",
      });
    });
  });
});
