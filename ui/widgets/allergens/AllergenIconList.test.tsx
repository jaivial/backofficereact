import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AllergenIconList } from "./AllergenIconList";

describe("AllergenIconList", () => {
  it("renders one icon per allergen with an accessible name", () => {
    render(<AllergenIconList allergens={["Gluten", "Leche"]} />);
    expect(screen.getByRole("img", { name: /Gluten/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Leche/ })).toBeInTheDocument();
  });

  it("normalizes legacy aliases so stored data still renders", () => {
    render(<AllergenIconList allergens={["lacteos", "frutos secos"]} />);
    expect(screen.getByRole("img", { name: /Leche/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Frutos de cascara/ })).toBeInTheDocument();
  });

  it("drops unknown allergens rather than rendering a broken image", () => {
    const { container } = render(<AllergenIconList allergens={["Gluten", "Kryptonita"]} />);
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("renders nothing when there are no known allergens", () => {
    const { container } = render(<AllergenIconList allergens={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("marks derived allergens as locked and names them as such", () => {
    render(<AllergenIconList allergens={["Gluten"]} derived={["Gluten"]} />);
    const icon = screen.getByRole("img", { name: /Gluten/ });
    const item = icon.closest("[data-slot='allergen-item']");
    expect(item).toHaveAttribute("data-derived", "true");
    expect(icon).toHaveAccessibleName(/heredado/i);
  });

  it("explains which ingredients contribute a derived allergen", () => {
    render(
      <AllergenIconList
        allergens={["Gluten"]}
        derived={["Gluten"]}
        contributors={{ Gluten: ["Harina de trigo", "Pan rallado"] }}
      />,
    );
    expect(screen.getByRole("img", { name: /Harina de trigo, Pan rallado/ })).toBeInTheDocument();
  });

  describe("when editable", () => {
    it("lets a non-derived allergen be toggled off", async () => {
      const onToggle = vi.fn();
      const { userEvent } = await import("@testing-library/user-event").then((m) => ({ userEvent: m.default }));
      render(<AllergenIconList allergens={["Gluten"]} editable onToggle={onToggle} />);
      await userEvent.click(screen.getByRole("button", { name: /Gluten/ }));
      expect(onToggle).toHaveBeenCalledWith("Gluten", false);
    });

    it("never lets a derived allergen be removed", async () => {
      const onToggle = vi.fn();
      const { userEvent } = await import("@testing-library/user-event").then((m) => ({ userEvent: m.default }));
      render(<AllergenIconList allergens={["Gluten"]} derived={["Gluten"]} editable onToggle={onToggle} />);
      const control = screen.getByRole("button", { name: /Gluten/ });
      expect(control).toBeDisabled();
      await userEvent.click(control);
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("uses buttons only in editable mode", () => {
      render(<AllergenIconList allergens={["Gluten"]} />);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });
});
