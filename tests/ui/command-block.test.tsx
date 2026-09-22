// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommandBlock } from "../../src/ui/primitives.tsx";

const COMMAND = 'cd /d "C:\\path\\to\\nquake"\nnquake-finish.bat';

function stubClipboard(writeText: (t: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CommandBlock", () => {
  it("copies every line of the command, not just what fits on screen", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);

    render(<CommandBlock command={COMMAND} />);
    fireEvent.click(screen.getByRole("button", { name: /copy command/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(COMMAND));
    await waitFor(() => screen.getByText("Copied"));
  });

  it("falls back to execCommand where the clipboard API is refused", async () => {
    stubClipboard(() => Promise.reject(new Error("insecure context")));
    const exec = vi.fn(() => true);
    (document as unknown as { execCommand: () => boolean }).execCommand = exec;

    render(<CommandBlock command={COMMAND} />);
    fireEvent.click(screen.getByRole("button", { name: /copy command/i }));

    await waitFor(() => expect(exec).toHaveBeenCalled());
    await waitFor(() => screen.getByText("Copied"));
  });

  it("says so rather than lying when nothing can copy", async () => {
    stubClipboard(() => Promise.reject(new Error("nope")));
    (document as unknown as { execCommand: () => boolean }).execCommand =
      () => {
        throw new Error("nope");
      };

    render(<CommandBlock command={COMMAND} />);
    fireEvent.click(screen.getByRole("button", { name: /copy command/i }));

    await waitFor(() => screen.getByText(/Ctrl\+C/));
  });
});
