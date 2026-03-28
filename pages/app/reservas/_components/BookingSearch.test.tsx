import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

import { BookingSearch } from "./BookingSearch";

describe("BookingSearch", () => {
  it("renders name and phone inputs", () => {
    render(
      <BookingSearch
        onSearch={() => {}}
        onClear={() => {}}
        busy={false}
        reduceMotion={false}
      />,
    );

    expect(screen.getByPlaceholderText(/nombre.*email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/teléfono/i)).toBeInTheDocument();
  });

  it("calls onSearch after debounce when typing in name input", async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();

    render(
      <BookingSearch
        onSearch={onSearch}
        onClear={() => {}}
        busy={false}
        reduceMotion={false}
      />,
    );

    const nameInput = screen.getByPlaceholderText(/nombre.*email/i);
    fireEvent.change(nameInput, { target: { value: "Beatriz" } });

    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearch).toHaveBeenCalledWith({ name: "Beatriz", phone: "", count: 15 });
    vi.useRealTimers();
  });

  it("calls onClear when all inputs are emptied after debounce", async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const onClear = vi.fn();

    render(
      <BookingSearch
        onSearch={onSearch}
        onClear={onClear}
        busy={false}
        reduceMotion={false}
      />,
    );

    const nameInput = screen.getByPlaceholderText(/nombre.*email/i);
    fireEvent.change(nameInput, { target: { value: "test" } });

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onSearch).toHaveBeenCalled();

    fireEvent.change(nameInput, { target: { value: "" } });

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onClear).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("does not trigger search when busy", async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();

    render(
      <BookingSearch
        onSearch={onSearch}
        onClear={() => {}}
        busy={true}
        reduceMotion={false}
      />,
    );

    const nameInput = screen.getByPlaceholderText(/nombre.*email/i);
    fireEvent.change(nameInput, { target: { value: "test" } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearch).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("debounces resets timer on rapid typing", async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();

    render(
      <BookingSearch
        onSearch={onSearch}
        onClear={() => {}}
        busy={false}
        reduceMotion={false}
      />,
    );

    const nameInput = screen.getByPlaceholderText(/nombre.*email/i);
    fireEvent.change(nameInput, { target: { value: "B" } });

    act(() => {
      vi.advanceTimersByTime(150);
    });

    fireEvent.change(nameInput, { target: { value: "Be" } });

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(onSearch).toHaveBeenCalledWith({ name: "Be", phone: "", count: 15 });
    expect(onSearch).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
