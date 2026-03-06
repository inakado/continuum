import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudentUnitRenderedContentResponse } from "@/lib/api/student";
import { StudentUnitHtmlPanel } from "./StudentUnitHtmlPanel";

vi.mock("../mathjax-helper", () => ({
  typesetMathInElement: vi.fn(async () => undefined),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const buildContent = (overrides: Partial<StudentUnitRenderedContentResponse> = {}): StudentUnitRenderedContentResponse => ({
  ok: true,
  target: "theory",
  html: "<p>content</p>",
  htmlKey: "html-key",
  pdfUrl: "https://cdn.example/base.pdf",
  pdfKey: "pdf-key",
  expiresInSec: 180,
  ...overrides,
});

describe("StudentUnitHtmlPanel", () => {
  const openSpy = vi.spyOn(window, "open");

  beforeEach(() => {
    openSpy.mockReset();
  });

  it("открывает вкладку синхронно и затем переводит её на свежий PDF URL", async () => {
    const deferred = createDeferred<string | null>();
    const getFreshPdfUrl = vi.fn(() => deferred.promise);
    const popup = {
      opener: window,
      closed: false,
      close: vi.fn(),
      location: { href: "" },
    } as unknown as Window;

    openSpy.mockReturnValue(popup);

    render(
      <StudentUnitHtmlPanel
        content={buildContent()}
        getFreshPdfUrl={getFreshPdfUrl}
        previewError={null}
        previewLoading={false}
        unavailableText="n/a"
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Скачать PDF" }));

    expect(openSpy).toHaveBeenCalledWith("", "_blank");
    expect(getFreshPdfUrl).toHaveBeenCalledTimes(1);
    expect(popup.location.href).toBe("");

    deferred.resolve("https://cdn.example/fresh.pdf");
    await waitFor(() => {
      expect(popup.location.href).toBe("https://cdn.example/fresh.pdf");
    });
  });

  it("закрывает пустую вкладку и показывает ошибку, если не удалось получить ссылку", async () => {
    const getFreshPdfUrl = vi.fn(async () => {
      throw new Error("network");
    });
    const popup = {
      opener: window,
      closed: false,
      close: vi.fn(),
      location: { href: "" },
    } as unknown as Window;

    openSpy.mockReturnValue(popup);

    render(
      <StudentUnitHtmlPanel
        content={buildContent()}
        getFreshPdfUrl={getFreshPdfUrl}
        previewError={null}
        previewLoading={false}
        unavailableText="n/a"
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Скачать PDF" }));

    await waitFor(() => {
      expect(popup.close).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Не удалось получить ссылку для скачивания PDF.")).toBeInTheDocument();
  });
});
