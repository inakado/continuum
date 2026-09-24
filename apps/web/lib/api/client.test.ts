import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiRequestParsed } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("apiRequestParsed", () => {
  it("sends files unchanged with the declared content type and session cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '{"ok":true}',
    });
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["%PDF-"], "Конспект.pdf");

    await apiRequestParsed("/upload", z.object({ ok: z.boolean() }), {
      method: "PUT",
      body: file,
      contentType: "application/pdf",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/upload"),
      expect.objectContaining({
        method: "PUT",
        body: file,
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/pdf" },
      }),
    );
  });
});
