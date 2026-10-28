import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IridescenceBackdrop from "./IridescenceBackdrop";

const gpu = vi.hoisted(() => ({ render: vi.fn(), release: vi.fn(), fail: false }));
vi.mock("ogl", () => ({
  Renderer: class {
    gl = { canvas: document.createElement("canvas"), getExtension: () => ({ loseContext: gpu.release }) };
    constructor() { if (gpu.fail) throw new Error("WebGL unavailable"); }
    render = gpu.render;
    setSize() {}
  },
  Program: class { remove() {} },
  Triangle: class { remove() {} },
  Mesh: class {},
}));

describe("IridescenceBackdrop", () => {
  beforeEach(() => {
    gpu.fail = false;
    gpu.render.mockClear();
    gpu.release.mockClear();
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("renders a still frame for reduced motion and releases GPU resources on unmount", () => {
    vi.mocked(window.matchMedia).mockReturnValue({ ...window.matchMedia("(prefers-reduced-motion: reduce)"), matches: true });
    const view = render(<IridescenceBackdrop />);
    expect(view.container.querySelector("canvas")).toBeInTheDocument();
    expect(gpu.render).toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    view.unmount();
    expect(gpu.release).toHaveBeenCalledOnce();
  });

  it("stops animation while the document is hidden", () => {
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const view = render(<IridescenceBackdrop />);
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  it("keeps the decorative fallback when WebGL is unavailable", () => {
    gpu.fail = true;
    const { container } = render(<IridescenceBackdrop />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("canvas")).not.toBeInTheDocument();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
});
