import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { EditorDish } from "../../types/menuEditor.types";
import { MenuItemEditor } from "./MenuItemEditor";

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  const icons = Object.fromEntries(
    Object.keys(actual).map((key) => [
      key,
      () => React.createElement("span", { "data-testid": `icon-${key}` }),
    ]),
  );
  return { ...icons };
});

vi.mock("motion/react", () => {
  const React = require("react");
  const forwardRef = (render: any) => React.forwardRef(render);
  const DOM_MOTION_PROPS = new Set([
    "dragListener",
    "dragControls",
    "dragMomentum",
    "dragElastic",
    "whileDrag",
  ]);
  const cleanProps = (props: any) => Object.fromEntries(
    Object.entries(props).filter(([key]) => key !== "children" && !DOM_MOTION_PROPS.has(key)),
  );
  const createMotionProxy = () => new Proxy({}, {
    get: () => (props: any) => React.createElement("div", cleanProps(props), props.children),
  });
  return {
    Reorder: {
      Item: forwardRef((props: any, ref: any) => React.createElement("div", { ...cleanProps(props), ref }, props.children)),
      Group: forwardRef((props: any, ref: any) => React.createElement("div", { ...cleanProps(props), ref }, props.children)),
    },
    motion: createMotionProxy(),
    useDragControls: () => ({ start: vi.fn() }),
    useReducedMotion: () => false,
  };
});

vi.mock("../../../../../ui/widgets/food/FoodDishCard", () => ({
  FoodDishCard: ({ children }: { children: React.ReactNode }) => React.createElement("div", { "data-testid": "food-dish-card" }, children),
}));

const baseDish: EditorDish = {
  clientId: "dish-1",
  id: 42,
  title: "Paella valenciana",
  description: "",
  description_enabled: false,
  allergens: [],
  supplement_enabled: false,
  supplement_price: null,
  price: null,
  active: true,
  position: 0,
  ai_requested: false,
  ai_generating: false,
  same_day_booking_blocked: false,
};

const defaultProps = {
  sectionClientId: "section-1",
  dish: baseDish,
  dishIdx: 0,
  isALaCarte: false,
  showDishImages: false,
  mediaLoading: false,
  startDishDrag: vi.fn(),
  pickDishImage: vi.fn(),
  setAllergenModal: vi.fn(),
  removeDish: vi.fn(),
  updateDish: vi.fn(),
  toggleSameDayBooking: vi.fn(),
};

describe("MenuItemEditor", () => {
  it("renders same-day booking switch with correct test id", () => {
    render(React.createElement(MenuItemEditor, defaultProps));
    const sw = screen.getByTestId("menu-item-editor-same-day-booking-switch-dish-1");
    expect(sw).toBeInTheDocument();
  });

  it("renders same-day booking label text", () => {
    render(React.createElement(MenuItemEditor, defaultProps));
    expect(screen.getByText("No permitir reserva mismo dia")).toBeInTheDocument();
  });

  it("shows switch unchecked when same_day_booking_blocked is false", () => {
    render(React.createElement(MenuItemEditor, defaultProps));
    const sw = screen.getByTestId("menu-item-editor-same-day-booking-switch-dish-1");
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("shows switch checked when same_day_booking_blocked is true", () => {
    const props = { ...defaultProps, dish: { ...baseDish, same_day_booking_blocked: true } };
    render(React.createElement(MenuItemEditor, props));
    const sw = screen.getByTestId("menu-item-editor-same-day-booking-switch-dish-1");
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("calls toggleSameDayBooking with blocked=true when switch is toggled on", () => {
    const toggleSameDayBooking = vi.fn();
    const props = { ...defaultProps, toggleSameDayBooking };
    render(React.createElement(MenuItemEditor, props));
    const sw = screen.getByTestId("menu-item-editor-same-day-booking-switch-dish-1");
    fireEvent.click(sw);
    expect(toggleSameDayBooking).toHaveBeenCalledWith("section-1", "dish-1", true);
  });

  it("calls toggleSameDayBooking with blocked=false when switch is toggled off", () => {
    const toggleSameDayBooking = vi.fn();
    const props = { ...defaultProps, dish: { ...baseDish, same_day_booking_blocked: true }, toggleSameDayBooking };
    render(React.createElement(MenuItemEditor, props));
    const sw = screen.getByTestId("menu-item-editor-same-day-booking-switch-dish-1");
    fireEvent.click(sw);
    expect(toggleSameDayBooking).toHaveBeenCalledWith("section-1", "dish-1", false);
  });

  it("disables switch when dish has no id (unsaved dish)", () => {
    const props = { ...defaultProps, dish: { ...baseDish, id: undefined } };
    render(React.createElement(MenuItemEditor, props));
    const sw = screen.getByTestId("menu-item-editor-same-day-booking-switch-dish-1");
    expect(sw).toHaveAttribute("disabled");
  });
});
