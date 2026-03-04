import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PdfCanvasPreview from "./PdfCanvasPreview";

type MockPdfPage = {
  getViewport: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
};

type MockPdfDocument = {
  numPages: number;
  getPage: ReturnType<typeof vi.fn>;
};

const getDocumentMock = vi.fn();
const globalWorkerOptions = { workerSrc: "" };

vi.mock("pdfjs-dist", () => ({
  version: "5.4.624",
  GlobalWorkerOptions: globalWorkerOptions,
  getDocument: getDocumentMock,
}));

const createRenderTask = () => ({
  promise: Promise.resolve(),
  cancel: vi.fn(),
});

const createPage = (): MockPdfPage => ({
  getViewport: vi.fn(({ scale }: { scale: number }) => ({
    width: 400 * scale,
    height: 600 * scale,
  })),
  render: vi.fn(() => createRenderTask()),
});

const createDocument = (pageCount: number): MockPdfDocument => {
  const pages = Array.from({ length: pageCount }, () => createPage());
  return {
    numPages: pageCount,
    getPage: vi.fn(async (pageNumber: number) => pages[pageNumber - 1]),
  };
};

class MockResizeObserver {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback([{ target, contentRect: { width: 640 } as DOMRectReadOnly }] as ResizeObserverEntry[], this as never);
  }

  disconnect() {}
}

describe("PdfCanvasPreview", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getDocumentMock.mockReset();
    globalWorkerOptions.workerSrc = "";

    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 640;
      },
    });

    Object.defineProperty(window.HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => ({
        setTransform: vi.fn(),
        clearRect: vi.fn(),
      })),
    });
  });

  it("loads PDF document and renders a canvas for each page", async () => {
    const pdfDocument = createDocument(2);
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve(pdfDocument),
      destroy: vi.fn(),
    });

    render(<PdfCanvasPreview url="https://cdn.example.com/doc.pdf" />);

    expect(screen.getByText("Загрузка PDF…")).toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelectorAll("canvas")).toHaveLength(2);
    });
    await waitFor(() => {
      expect(pdfDocument.getPage).toHaveBeenCalledTimes(2);
    });

    expect(getDocumentMock).toHaveBeenCalledWith({
      url: "https://cdn.example.com/doc.pdf",
      withCredentials: false,
    });
  });

  it("refreshes expired presigned URL and retries loading", async () => {
    const freshDocument = createDocument(1);
    const getFreshUrl = vi.fn(async () => "https://cdn.example.com/fresh.pdf");

    getDocumentMock
      .mockReturnValueOnce({
        promise: Promise.reject({ status: 403, message: "expired" }),
        destroy: vi.fn(),
      })
      .mockReturnValueOnce({
        promise: Promise.resolve(freshDocument),
        destroy: vi.fn(),
      });

    render(
      <PdfCanvasPreview
        url="https://cdn.example.com/original.pdf"
        refreshKey="theory-key"
        getFreshUrl={getFreshUrl}
      />,
    );

    await waitFor(() => {
      expect(getFreshUrl).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(document.querySelectorAll("canvas")).toHaveLength(1);
    });

    expect(getDocumentMock).toHaveBeenNthCalledWith(1, {
      url: "https://cdn.example.com/original.pdf",
      withCredentials: false,
    });
    expect(getDocumentMock).toHaveBeenNthCalledWith(2, {
      url: "https://cdn.example.com/fresh.pdf",
      withCredentials: false,
    });
  });

  it("shows refresh error when URL refresh fails", async () => {
    const getFreshUrl = vi.fn(async () => {
      throw new Error("refresh failed");
    });

    getDocumentMock.mockReturnValue({
      promise: Promise.reject({ status: 403, message: "expired" }),
      destroy: vi.fn(),
    });

    render(
      <PdfCanvasPreview
        url="https://cdn.example.com/original.pdf"
        refreshKey="theory-key"
        getFreshUrl={getFreshUrl}
      />,
    );

    expect(await screen.findByText("refresh failed")).toBeInTheDocument();
    expect(getFreshUrl).toHaveBeenCalledTimes(1);
  });
});
