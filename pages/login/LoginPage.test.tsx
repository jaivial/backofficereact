import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Page from "./+Page";

vi.mock("lucide-react", () => ({
  Loader2: () => React.createElement("span", { "data-testid": "loader-icon" }),
}));

vi.mock("../../ui/feedback/useErrorToast", () => ({ useErrorToast: vi.fn() }));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps submit controls disabled until hydration completes", async () => {
    const ssrMarkup = renderToString(<Page />);
    expect(ssrMarkup).toMatch(/data-testid="login-identifier-input"[^>]*disabled/);

    render(<Page />);

    const identifier = screen.getByTestId("login-identifier-input");
    const password = screen.getByTestId("login-password-input");
    const submit = screen.getByTestId("login-submit-btn");
    await waitFor(() => {
      expect(identifier).toBeEnabled();
      expect(password).toBeEnabled();
      expect(submit).toBeEnabled();
    });
  });

  it("renders one local responsive hero image", () => {
    const { container } = render(<Page />);

    expect(screen.getByTestId("login-image-pane")).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector('source[type="image/webp"]')).toHaveAttribute(
      "srcset",
      "/media/login/login-hero.webp",
    );
    expect(container.innerHTML).not.toContain("images.unsplash.com");
  });
});
