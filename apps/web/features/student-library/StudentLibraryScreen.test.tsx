import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { StudentLibraryView } from "./StudentLibraryScreen";

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

  it("renders dense sections and lesson format labels", () => {
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
    expect(screen.getByRole("link", { name: "PDF" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Задачи" })).toBeInTheDocument();
  });
});
