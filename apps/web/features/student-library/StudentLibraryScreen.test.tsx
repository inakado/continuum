import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { StudentLibraryView } from "./StudentLibraryScreen";
import { studentLibraryApi } from "./student-library.api";

vi.mock("./student-library.api", () => ({ studentLibraryApi: { getLesson: vi.fn(), getArtifactView: vi.fn() } }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

describe("StudentLibraryView", () => {
  it("renders the no-access state", () => {
    render(<StudentLibraryView library={{ gradeBands: [] }} />);
    expect(screen.getByText("Материалы этого класса недоступны")).toBeInTheDocument();
  });

  it("keeps lesson navigation separate from opening its PDF directly", async () => {
    const replace = vi.fn();
    const open = vi.spyOn(window, "open").mockReturnValue({ location: { replace }, close: vi.fn() } as never);
    vi.mocked(studentLibraryApi.getLesson).mockResolvedValue({ artifacts: [{ id: "pdf-id", type: "pdf" }, { id: "tasks-id", type: "tasks_pdf" }] } as never);
    vi.mocked(studentLibraryApi.getArtifactView).mockImplementation(async (id) => ({ url: `https://files.example/${id}.pdf`, expiresIn: 60 } as never));
    render(
      <StudentLibraryView
        library={{
          gradeBands: [
            {
              code: "grade_10_11",
              sections: [
                {
                  id: "123e4567-e89b-12d3-a456-426614174000",
                  gradeBand: "grade_10_11",
                  title: "Механика",
                  description: null,
                  status: "published",
                  sortOrder: 0,
                  lessons: [
                    {
                      id: "123e4567-e89b-12d3-a456-426614174001",
                      title: "Кинематика",
                      description: null,
                      status: "published",
                      sortOrder: 0,
                      formats: { pdf: true, interactive: false, tasks: true },
                    },
                  ],
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("10–11 классы")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Кинематика/ })).toHaveAttribute(
      "href",
      "/student/lessons/123e4567-e89b-12d3-a456-426614174001",
    );
    fireEvent.click(screen.getByRole("button", { name: /Открыть PDF/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("https://files.example/pdf-id.pdf"));
    expect(studentLibraryApi.getLesson).toHaveBeenCalledWith("123e4567-e89b-12d3-a456-426614174001");
    fireEvent.click(screen.getByRole("button", { name: /Открыть задачи/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("https://files.example/tasks-id.pdf"));
    expect(open).toHaveBeenCalledTimes(2);
    open.mockRestore();
  });
});
