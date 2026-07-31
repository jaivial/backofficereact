import React from "react";
import { render, screen } from "@testing-library/react";
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
