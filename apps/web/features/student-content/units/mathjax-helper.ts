const MATHJAX_SCRIPT_ID = "continuum-mathjax-runtime";
const MATHJAX_SCRIPT_SRC = "/vendor/mathjax/tex-svg.js";

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
  },
  svg: {
    fontCache: "global",
  },
});

const waitForStartup = async (mathJax: MathJaxGlobal): Promise<MathJaxGlobal> => {
  await mathJax.startup?.promise;
  return mathJax;
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

  window.MathJax = createMathJaxConfig();
  mathJaxLoadPromise = new Promise<MathJaxGlobal>((resolve, reject) => {
    const existingScript = document.getElementById(MATHJAX_SCRIPT_ID) as HTMLScriptElement | null;
    const handleResolve = () => {
      if (!window.MathJax) {
        mathJaxLoadPromise = null;
        reject(new Error("MathJax runtime did not initialize"));
        return;
      }
      void waitForStartup(window.MathJax).then(resolve).catch((error) => {
        mathJaxLoadPromise = null;
        reject(error);
      });
    };

    const handleError = () => {
      mathJaxLoadPromise = null;
      reject(new Error("Не удалось загрузить MathJax runtime"));
    };

    if (existingScript) {
      existingScript.addEventListener("load", handleResolve, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = MATHJAX_SCRIPT_ID;
    script.async = true;
    script.src = MATHJAX_SCRIPT_SRC;
    script.addEventListener("load", handleResolve, { once: true });
    script.addEventListener("error", handleError, { once: true });
    document.head.appendChild(script);
  });

  return mathJaxLoadPromise;
};

export const typesetMathInElement = async (element: HTMLElement): Promise<void> => {
  const mathJax = await ensureMathJaxLoaded();
  mathJax.typesetClear?.([element]);
  await mathJax.typesetPromise?.([element]);
};
