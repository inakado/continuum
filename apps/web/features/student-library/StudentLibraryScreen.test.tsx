import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { StudentLibrary } from "@continuum/shared";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import('react');
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore(listener => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); }, () => location.search, () => '')) };
});
beforeEach(() => {
  history.replaceState(null, '', '/student');
  const native = history.replaceState.bind(history);
  vi.spyOn(history, 'replaceState').mockImplementation((data, unused, url) => { native(data, unused, url); window.dispatchEvent(new PopStateEvent('popstate')); });
});
afterEach(() => vi.restoreAllMocks());

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
      "/student/lessons/123e4567-e89b-12d3-a456-426614174001?grade=grade_10_11",
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

const catalog: StudentLibrary = { gradeBands: [{ code: 'grade_10_11', sections: [{ id: 'mechanics', gradeBand: 'grade_10_11', title: 'Механика', description: null, status: 'published', sortOrder: 0,
  lessons: ['Равномерное движение', 'Равноускоренное движение'].map((title, index) => ({ id: `lesson-${index + 1}`, title, description: null, status: 'published', sortOrder: index, formats: { pdf: true, tasks: true, interactive: false } })) }] }] };
it('filters full names, keeps source order and carries the catalog context to the lesson', () => {
  render(<StudentLibraryView library={catalog} />);
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Найти занятие' }), { target: { value: 'равноускоренное' } });
  expect(screen.queryByRole('link', { name: /Равномерное/ })).not.toBeInTheDocument();
  const link = screen.getByRole('link', { name: /Равноускоренное/ });
  expect(link).toHaveTextContent(/^2/);
  const url = new URL(link.getAttribute('href')!, location.origin);
  expect(url.searchParams.get('q')).toBe('равноускоренное');
  expect(url.searchParams.get('grade')).toBe('grade_10_11');
  fireEvent.click(screen.getByRole('button', { name: 'Очистить поиск' }));
  expect(screen.getAllByRole('link')).toHaveLength(2);
  expect(location.search).not.toContain('q=');
});
it('offers only granted grades and selects a valid fallback for an unavailable grade', () => {
  history.replaceState(null, '', '/student?grade=grade_9');
  const extra = { ...catalog.gradeBands[0], code: 'grade_7' as const, sections: [] };
  render(<StudentLibraryView library={{ gradeBands: [extra, ...catalog.gradeBands] }} />);
  expect(screen.queryByRole('button', { name: '9 класс' })).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Класс материалов' })).toHaveValue('grade_10_11');
  fireEvent.change(screen.getByRole('combobox', { name: 'Класс материалов' }), { target: { value: 'grade_7' } });
  expect(screen.getByText('Материалов пока нет')).toBeVisible();
});
it('returns to the referenced lesson with keyboard focus after opening a material', () => {
  history.replaceState(null, '', '/student?grade=grade_10_11#lesson-lesson-2');
  render(<StudentLibraryView library={catalog} />);
  expect(screen.getByRole('link', { name: /Равноускоренное/ })).toHaveFocus();
});
