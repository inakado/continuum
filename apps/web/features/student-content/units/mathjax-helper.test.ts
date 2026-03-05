import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SCRIPT_ID = "continuum-mathjax-runtime";
const appendToHead = document.head.appendChild.bind(document.head);

const cleanupMathJaxDomState = () => {
  document.getElementById(SCRIPT_ID)?.remove();
  delete (window as typeof window & { MathJax?: unknown }).MathJax;
};

describe("mathjax-helper", () => {
  beforeEach(() => {
    cleanupMathJaxDomState();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    cleanupMathJaxDomState();
  });

  it("retries typeset once by reloading runtime when first typeset fails", async () => {
    let loadCount = 0;
    const runtimes: Array<{ typesetPromise: ReturnType<typeof vi.fn> }> = [];

    vi.spyOn(document.head, "appendChild").mockImplementation((node: Node) => {
      const appended = appendToHead(node);
      if (node instanceof HTMLScriptElement && node.id === SCRIPT_ID) {
        loadCount += 1;
        const shouldFail = loadCount === 1;
        const runtime = {
          startup: { promise: Promise.resolve() },
          typesetClear: vi.fn(),
          typesetPromise: vi.fn(() =>
            shouldFail ? Promise.reject(new Error("typeset failed")) : Promise.resolve(),
          ),
        };
        runtimes.push({ typesetPromise: runtime.typesetPromise });
        queueMicrotask(() => {
          (window as typeof window & { MathJax?: unknown }).MathJax = runtime;
          node.dispatchEvent(new Event("load"));
        });
      }
      return appended;
    });

    const { typesetMathInElement } = await import("./mathjax-helper");
    const element = document.createElement("div");
    document.body.appendChild(element);

    await expect(typesetMathInElement(element)).resolves.toBeUndefined();
    expect(loadCount).toBe(2);
    expect(runtimes).toHaveLength(2);
    expect(runtimes[0]?.typesetPromise).toHaveBeenCalledTimes(1);
    expect(runtimes[1]?.typesetPromise).toHaveBeenCalledTimes(1);
  });

  it("serializes concurrent typeset requests", async () => {
    const order: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const firstDone = new Promise<void>((resolve) => {
      releaseFirst = () => resolve();
    });

    let callIndex = 0;
    (window as typeof window & { MathJax?: unknown }).MathJax = {
      startup: { promise: Promise.resolve() },
      typesetClear: vi.fn(),
      typesetPromise: vi.fn(() => {
        callIndex += 1;
        if (callIndex === 1) {
          order.push("first-start");
          return firstDone.then(() => {
            order.push("first-end");
          });
        }
        order.push("second-start");
        return Promise.resolve().then(() => {
          order.push("second-end");
        });
      }),
    };

    const { typesetMathInElement } = await import("./mathjax-helper");
    const first = document.createElement("div");
    const second = document.createElement("div");
    document.body.append(first, second);

    const firstPromise = typesetMathInElement(first);
    const secondPromise = typesetMathInElement(second);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual(["first-start"]);

    releaseFirst();
    await Promise.all([firstPromise, secondPromise]);
    expect(order).toEqual(["first-start", "first-end", "second-start", "second-end"]);
  });

  it("replaces stale script tag before loading runtime", async () => {
    const staleScript = document.createElement("script");
    staleScript.id = SCRIPT_ID;
    document.head.appendChild(staleScript);

    let loadedScript: HTMLScriptElement | null = null;
    vi.spyOn(document.head, "appendChild").mockImplementation((node: Node) => {
      const appended = appendToHead(node);
      if (node instanceof HTMLScriptElement && node.id === SCRIPT_ID) {
        loadedScript = node;
        queueMicrotask(() => {
          (window as typeof window & { MathJax?: unknown }).MathJax = {
            startup: { promise: Promise.resolve() },
            typesetClear: vi.fn(),
            typesetPromise: vi.fn(() => Promise.resolve()),
          };
          node.dispatchEvent(new Event("load"));
        });
      }
      return appended;
    });

    const { ensureMathJaxLoaded } = await import("./mathjax-helper");
    await expect(ensureMathJaxLoaded()).resolves.toMatchObject({
      typesetPromise: expect.any(Function),
    });
    expect(loadedScript).not.toBeNull();
    expect(loadedScript).not.toBe(staleScript);
    expect(document.getElementById(SCRIPT_ID)).toBe(loadedScript);
  });
});
