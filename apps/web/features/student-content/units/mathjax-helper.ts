const MATHJAX_SCRIPT_ID = "continuum-mathjax-runtime";
const MATHJAX_SCRIPT_SRC = "/vendor/mathjax/tex-svg.js";
const MATHJAX_LOAD_TIMEOUT_MS = 15_000;
const MATHJAX_STARTUP_TIMEOUT_MS = 15_000;

type MathJaxGlobal = {
  startup?: {
    typeset?: boolean;
    promise?: Promise<unknown>;
  };
  typesetClear?: (elements?: Element[]) => void;
  typesetPromise?: (elements?: Element[]) => Promise<void>;
};

declare global {
  interface Window {
    MathJax?: MathJaxGlobal & Record<string, unknown>;
  }
}

let mathJaxLoadPromise: Promise<MathJaxGlobal> | null = null;
let mathJaxTypesetQueue: Promise<void> = Promise.resolve();

const createMathJaxConfig = (): MathJaxGlobal & Record<string, unknown> => ({
  startup: {
    typeset: false,
  },
  loader: {
    load: ["[tex]/ams", "[tex]/mathtools", "[tex]/newcommand", "[tex]/noerrors", "[tex]/noundefined"],
  },
  tex: {
    inlineMath: [
      ["$", "$"],
      ["\\(", "\\)"],
    ],
    displayMath: [
      ["$$", "$$"],
      ["\\[", "\\]"],
    ],
    packages: {
      "[+]": ["ams", "mathtools", "newcommand", "noerrors", "noundefined"],
    },
    tags: "ams",
    tagSide: "right",
    tagIndent: "0.8em",
  },
  svg: {
    fontCache: "global",
  },
});

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`MathJax ${label} timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
};

const resetMathJaxRuntime = () => {
  if (typeof window !== "undefined") {
    delete window.MathJax;
  }
  const existingScript = document.getElementById(MATHJAX_SCRIPT_ID);
  existingScript?.remove();
  mathJaxLoadPromise = null;
};

const waitForStartup = async (mathJax: MathJaxGlobal): Promise<MathJaxGlobal> => {
  if (mathJax.startup?.promise) {
    await withTimeout(mathJax.startup.promise, MATHJAX_STARTUP_TIMEOUT_MS, "startup");
  }
  if (typeof mathJax.typesetPromise !== "function") {
    throw new Error("MathJax runtime did not expose typesetPromise");
  }
  return mathJax;
};

const loadMathJaxScript = (): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = MATHJAX_SCRIPT_ID;
    script.async = true;
    script.src = MATHJAX_SCRIPT_SRC;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const clear = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
    const handleLoad = () => {
      clear();
      resolve();
    };
    const handleError = () => {
      clear();
      reject(new Error("Не удалось загрузить MathJax runtime"));
    };

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    timeoutId = setTimeout(() => {
      clear();
      reject(new Error(`MathJax script load timeout after ${MATHJAX_LOAD_TIMEOUT_MS}ms`));
    }, MATHJAX_LOAD_TIMEOUT_MS);

    document.head.appendChild(script);
  });

const createLoadPromise = (): Promise<MathJaxGlobal> =>
  loadMathJaxScript()
    .then(() => {
      if (!window.MathJax) {
        throw new Error("MathJax runtime did not initialize");
      }
      return waitForStartup(window.MathJax);
    })
    .catch((error) => {
      resetMathJaxRuntime();
      throw error;
    });

const performTypeset = async (element: HTMLElement) => {
  const mathJax = await ensureMathJaxLoaded();
  mathJax.typesetClear?.([element]);
  await mathJax.typesetPromise?.([element]);
};

export const ensureMathJaxLoaded = (): Promise<MathJaxGlobal> => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MathJax can only be loaded in the browser"));
  }

  if (window.MathJax?.typesetPromise) {
    return waitForStartup(window.MathJax);
  }

  if (mathJaxLoadPromise) {
    return mathJaxLoadPromise;
  }

  const existingScript = document.getElementById(MATHJAX_SCRIPT_ID);
  if (existingScript) {
    existingScript.remove();
  }
  window.MathJax = createMathJaxConfig();
  mathJaxLoadPromise = createLoadPromise();

  return mathJaxLoadPromise;
};

export const typesetMathInElement = async (element: HTMLElement): Promise<void> => {
  mathJaxTypesetQueue = mathJaxTypesetQueue
    .catch(() => undefined)
    .then(async () => {
      if (!element.isConnected) return;
      try {
        await performTypeset(element);
      } catch {
        // Retry once by forcing full runtime reload in case of corrupted MathJax state.
        resetMathJaxRuntime();
        if (!element.isConnected) return;
        window.MathJax = createMathJaxConfig();
        mathJaxLoadPromise = createLoadPromise();
        await performTypeset(element);
      }
    });
  return mathJaxTypesetQueue;
};
