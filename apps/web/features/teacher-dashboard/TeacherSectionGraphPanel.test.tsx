import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import type * as ReactModule from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { contentQueryKeys } from "@/lib/query/keys";
import { teacherApi } from "@/lib/api/teacher";
import type * as TeacherApiModule from "@/lib/api/teacher";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import TeacherSectionGraphPanel from "./TeacherSectionGraphPanel";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("reactflow", async () => {
  const React = await vi.importActual<typeof ReactModule>("react");

  type ReactFlowMockProps = {
    nodes: Array<{ id: string }>;
    edges: Array<{ id: string }>;
    onNodeClick?: (event: unknown, node: { id: string }) => void;
    onSelectionChange?: (selection: { edges?: Array<{ id: string }>; nodes?: Array<{ id: string }> }) => void;
    children?: React.ReactNode;
  };

  return {
    default: ({ nodes, edges, onNodeClick, onSelectionChange, children }: ReactFlowMockProps) => (
      <div data-testid="graph-canvas">
        <div data-testid="graph-nodes">{nodes.length}</div>
        <div data-testid="graph-edges">{edges.length}</div>
        <button
          type="button"
          onClick={() => {
            if (nodes[0]) onNodeClick?.({}, nodes[0]);
          }}
        >
          Открыть первый юнит
        </button>
        <button
          type="button"
          onClick={() => {
            if (edges[0]) onSelectionChange?.({ edges: [edges[0]], nodes: [] });
          }}
        >
          Выбрать первое ребро
        </button>
        {children}
      </div>
    ),
    addEdge: (edge: unknown, current: unknown[]) => current.concat(edge),
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
    MarkerType: { ArrowClosed: "ArrowClosed" },
    Position: { Top: "top", Bottom: "bottom" },
    useNodesState: (initial: unknown[]) => {
      const [nodes, setNodes] = React.useState(initial);
      return [nodes, setNodes, () => undefined];
    },
    useEdgesState: (initial: unknown[]) => {
      const [edges, setEdges] = React.useState(initial);
      return [edges, setEdges, () => undefined];
    },
  };
});

vi.mock("@/components/ui/Dialog", () => ({
  default: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

vi.mock("@/features/teacher-content/auth/AuthRequired", () => ({
  default: () => <div>auth required</div>,
}));

vi.mock("@/lib/api/teacher", async () => {
  const actual = await vi.importActual<typeof TeacherApiModule>("@/lib/api/teacher");
  return {
    ...actual,
    teacherApi: {
      ...actual.teacherApi,
      getSectionGraph: vi.fn(),
      getSection: vi.fn(),
      getCourse: vi.fn(),
      updateSectionGraph: vi.fn(),
      createUnit: vi.fn(),
    },
  };
});

describe("TeacherSectionGraphPanel", () => {
  const pushMock = vi.fn();

  beforeEach(() => {
    pushMock.mockReset();
    vi.mocked(useRouter).mockReturnValue({ push: pushMock } as never);
    vi.mocked(teacherApi.getSectionGraph).mockReset();
    vi.mocked(teacherApi.getSection).mockReset();
    vi.mocked(teacherApi.getCourse).mockReset();
    vi.mocked(teacherApi.updateSectionGraph).mockReset();
    vi.mocked(teacherApi.createUnit).mockReset();
  });

  it("hydrates graph and titles from teacher queries", async () => {
    vi.mocked(teacherApi.getSectionGraph).mockResolvedValue({
      nodes: [
        {
          unitId: "unit-1",
          title: "Кинематика",
          status: "draft",
          createdAt: "2026-03-02T00:00:00.000Z",
          position: { x: 20, y: 30 },
        },
      ],
      edges: [
        {
          id: "edge-1",
          fromUnitId: "unit-1",
          toUnitId: "unit-2",
        },
      ],
    } as never);
    vi.mocked(teacherApi.getSection).mockResolvedValue({
      id: "section-1",
      courseId: "course-1",
      title: "Механика",
      description: null,
      status: "draft",
      sortOrder: 0,
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      units: [],
    } as never);
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-1",
      title: "Физика",
      description: null,
      status: "draft",
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      sections: [],
    } as never);

    renderWithQueryClient(<TeacherSectionGraphPanel sectionId="section-1" />);

    expect(await screen.findByText("Физика")).toBeInTheDocument();
    expect(screen.getByText("Механика")).toBeInTheDocument();
    expect(screen.getByTestId("graph-nodes")).toHaveTextContent("1");
    expect(screen.getByTestId("graph-edges")).toHaveTextContent("1");
  });

  it("creates unit locally and keeps graph dirty until explicit save", async () => {
    vi.mocked(teacherApi.getSectionGraph).mockResolvedValue({ nodes: [], edges: [] } as never);
    vi.mocked(teacherApi.getSection).mockResolvedValue({
      id: "section-1",
      courseId: "course-1",
      title: "Механика",
      description: null,
      status: "draft",
      sortOrder: 0,
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      units: [],
    } as never);
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-1",
      title: "Физика",
      description: null,
      status: "draft",
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      sections: [],
    } as never);
    vi.mocked(teacherApi.createUnit).mockResolvedValue({
      id: "unit-1",
      sectionId: "section-1",
      title: "Кинематика",
      status: "draft",
      sortOrder: 0,
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
    } as never);

    renderWithQueryClient(<TeacherSectionGraphPanel sectionId="section-1" />);
    const user = userEvent.setup();

    await screen.findByText("В разделе нет юнитов. Создайте первый юнит вверху графа.");
    await user.click(screen.getByRole("button", { name: "Создать юнит" }));
    await user.type(screen.getByLabelText("Название юнита"), "Кинематика");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(vi.mocked(teacherApi.createUnit)).toHaveBeenCalledWith({
        sectionId: "section-1",
        title: "Кинематика",
        sortOrder: 0,
      });
    });
    expect(screen.getByTestId("graph-nodes")).toHaveTextContent("1");
    expect(screen.getByText("Юнит создан. Не забудьте сохранить граф.")).toBeInTheDocument();
  });

  it("saves current graph and updates query cache snapshot", async () => {
    vi.mocked(teacherApi.getSectionGraph).mockResolvedValue({
      nodes: [
        {
          unitId: "unit-1",
          title: "Кинематика",
          status: "draft",
          createdAt: "2026-03-02T00:00:00.000Z",
          position: { x: 20, y: 30 },
        },
      ],
      edges: [],
    } as never);
    vi.mocked(teacherApi.getSection).mockResolvedValue({
      id: "section-1",
      courseId: "course-1",
      title: "Механика",
      description: null,
      status: "draft",
      sortOrder: 0,
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      units: [],
    } as never);
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-1",
      title: "Физика",
      description: null,
      status: "draft",
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      sections: [],
    } as never);
    vi.mocked(teacherApi.updateSectionGraph).mockResolvedValue({
      nodes: [
        {
          unitId: "unit-1",
          title: "Кинематика",
          status: "published",
          createdAt: "2026-03-02T00:00:00.000Z",
          position: { x: 20, y: 30 },
        },
      ],
      edges: [],
    } as never);

    const { queryClient } = renderWithQueryClient(<TeacherSectionGraphPanel sectionId="section-1" />);
    const setQueryDataSpy = vi.spyOn(queryClient, "setQueryData");
    const user = userEvent.setup();

    await screen.findByText("Физика");
    await user.click(screen.getByRole("button", { name: "Сохранить граф" }));

    await waitFor(() => {
      expect(vi.mocked(teacherApi.updateSectionGraph)).toHaveBeenCalledWith("section-1", {
        nodes: [{ unitId: "unit-1", position: { x: 20, y: 30 } }],
        edges: [],
      });
    });
    expect(setQueryDataSpy).toHaveBeenCalledWith(
      contentQueryKeys.teacherSectionGraph("section-1"),
      expect.objectContaining({
        nodes: [expect.objectContaining({ unitId: "unit-1", status: "published" })],
      }),
    );
    expect(screen.getByText("Граф сохранён")).toBeInTheDocument();
  });

  it("switches to auth-required state on relogin errors", async () => {
    vi.mocked(teacherApi.getSectionGraph).mockRejectedValue(
      new ApiError(401, "Unauthorized", "AUTH_REQUIRED"),
    );
    vi.mocked(teacherApi.getSection).mockResolvedValue({
      id: "section-1",
      courseId: "course-1",
      title: "Механика",
      description: null,
      status: "draft",
      sortOrder: 0,
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      units: [],
    } as never);
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-1",
      title: "Физика",
      description: null,
      status: "draft",
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      sections: [],
    } as never);

    renderWithQueryClient(<TeacherSectionGraphPanel sectionId="section-1" />);

    expect(await screen.findByText("auth required")).toBeInTheDocument();
  });

  it("opens first unit on node click", async () => {
    vi.mocked(teacherApi.getSectionGraph).mockResolvedValue({
      nodes: [
        {
          unitId: "unit-1",
          title: "Кинематика",
          status: "draft",
          createdAt: "2026-03-02T00:00:00.000Z",
          position: { x: 20, y: 30 },
        },
      ],
      edges: [],
    } as never);
    vi.mocked(teacherApi.getSection).mockResolvedValue({
      id: "section-1",
      courseId: "course-1",
      title: "Механика",
      description: null,
      status: "draft",
      sortOrder: 0,
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      units: [],
    } as never);
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-1",
      title: "Физика",
      description: null,
      status: "draft",
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      sections: [],
    } as never);

    renderWithQueryClient(<TeacherSectionGraphPanel sectionId="section-1" />);
    const user = userEvent.setup();

    await screen.findByText("Физика");
    await user.click(screen.getByRole("button", { name: "Открыть первый юнит" }));

    expect(pushMock).toHaveBeenCalledWith("/teacher/units/unit-1");
  });
});
