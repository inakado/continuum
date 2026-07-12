import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudentExcalidrawBoard } from "./StudentExcalidrawBoard";

vi.mock("@excalidraw/excalidraw", () => ({
  Excalidraw: ({ renderTopRightUI }: { renderTopRightUI?: () => React.ReactNode }) => (
    <div>{renderTopRightUI?.()}</div>
  ),
}));

vi.mock("@/components/useExcalidrawTheme", () => ({
  useExcalidrawTheme: (onReady: unknown) => ({
    theme: "light",
    viewBackgroundColor: "#f8fafc",
    handleReady: onReady,
  }),
}));

describe("StudentExcalidrawBoard", () => {
  const requestFullscreenDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "requestFullscreen",
  );
  const fullscreenElementDescriptor = Object.getOwnPropertyDescriptor(document, "fullscreenElement");
  const exitFullscreenDescriptor = Object.getOwnPropertyDescriptor(document, "exitFullscreen");

  afterEach(() => {
    document.body.style.overflow = "";
    if (requestFullscreenDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "requestFullscreen", requestFullscreenDescriptor);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
    }
    if (fullscreenElementDescriptor) {
      Object.defineProperty(document, "fullscreenElement", fullscreenElementDescriptor);
    } else {
      Reflect.deleteProperty(document, "fullscreenElement");
    }
    if (exitFullscreenDescriptor) {
      Object.defineProperty(document, "exitFullscreen", exitFullscreenDescriptor);
    } else {
      Reflect.deleteProperty(document, "exitFullscreen");
    }
  });

  it("enters and exits native fullscreen mode", async () => {
    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: vi.fn(function requestFullscreen(this: HTMLElement) {
        fullscreenElement = this;
        document.dispatchEvent(new Event("fullscreenchange"));
        return Promise.resolve();
      }),
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: vi.fn(() => {
        fullscreenElement = null;
        document.dispatchEvent(new Event("fullscreenchange"));
        return Promise.resolve();
      }),
    });
    render(<StudentExcalidrawBoard onReady={vi.fn()} onChange={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Развернуть доску на весь экран" }));
    expect(screen.getByRole("button", { name: "Выйти из полноэкранного режима" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Выйти из полноэкранного режима" }));
    expect(screen.getByRole("button", { name: "Развернуть доску на весь экран" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("uses viewport focus fallback and exits on Escape when Fullscreen API is unavailable", async () => {
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: undefined,
    });
    render(<StudentExcalidrawBoard onReady={vi.fn()} onChange={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Развернуть доску на весь экран" }));

    const exitButton = screen.getByRole("button", { name: "Выйти из полноэкранного режима" });
    expect(exitButton).toHaveAttribute("aria-pressed", "true");
    expect(exitButton.closest("[data-focus-mode]")).toHaveAttribute("data-focus-mode", "true");
    expect(document.body).toHaveStyle({ overflow: "hidden" });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByRole("button", { name: "Развернуть доску на весь экран" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(document.body).not.toHaveStyle({ overflow: "hidden" });
  });
});
