import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";

/**
 * Isolated check that assistant-ui v0.15's store-driven primitives react to
 * typing in this app's React/assistant-ui version combo. If typing does not
 * update the composer state here, the library stack itself is broken in this
 * repo (independent of the Forky WebSocket wiring).
 */
function Chat({ adapter }: { adapter: ChatModelAdapter }) {
  const runtime = useLocalRuntime(adapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root>
        <ComposerPrimitive.Root>
          <ComposerPrimitive.Input data-testid="input" />
          <ComposerPrimitive.Send asChild>
            <button type="button">send</button>
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

const passthroughAdapter: ChatModelAdapter = {
  async *run() {
    // never used in this test
  },
};

describe("assistant-ui store reactivity", () => {
  it("updates the composer draft as the user types", async () => {
    render(<Chat adapter={passthroughAdapter} />);
    const input = screen.getByTestId("input") as HTMLTextAreaElement;

    fireEvent.change(input, { target: { value: "hola" } });
    await waitFor(() => expect(input.value).toBe("hola"));
  });

  it("clears the draft after send", async () => {
    render(<Chat adapter={passthroughAdapter} />);
    const input = screen.getByTestId("input") as HTMLTextAreaElement;

    fireEvent.change(input, { target: { value: "hola" } });
    await waitFor(() => expect(input.value).toBe("hola"));

    fireEvent.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => expect(input.value).toBe(""));
  });
});
