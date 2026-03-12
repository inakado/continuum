import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentQueryKeys } from "@/lib/query/keys";
import { teacherApi } from "@/lib/api/teacher";
import type * as TeacherApiModule from "@/lib/api/teacher";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import TeacherDashboardScreen from "./TeacherDashboardScreen";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({
    alt = "",
    src,
    unoptimized: _unoptimized,
  }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => (
    <span aria-label={alt} data-src={typeof src === "string" ? src : ""} />
  ),
}));

vi.mock("next/dynamic", () => ({
  default: () => (props: {
    sectionId: string;
    sectionTitle: string | null;
    courseTitle: string | null;
    onBackToSections: () => void;
    onBackToCourses: () => void;
  }) => (
    <div data-testid="teacher-graph-panel">
      <div>{props.courseTitle}</div>
      <div>{props.sectionTitle}</div>
      <button type="button" onClick={props.onBackToSections}>
        Назад к разделам
      </button>
      <button type="button" onClick={props.onBackToCourses}>
        Назад к курсам
      </button>
    </div>
  ),
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/AlertDialog", () => ({
  default: ({
    open,
    title,
    onConfirm,
    onOpenChange,
  }: {
    open: boolean;
    title: string;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <button type="button" onClick={onConfirm}>
          Подтвердить
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          Отмена
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/ui/Dialog", () => ({
  default: ({
    open,
    title,
    description,
    children,
  }: {
    open: boolean;
    title?: React.ReactNode;
    description?: React.ReactNode;
    children: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog" aria-label={typeof title === "string" ? title : "dialog"}>
        {title ? <div>{title}</div> : null}
        {description ? <div>{description}</div> : null}
        {children}
      </div>
    ) : null,
}));

vi.mock("@/features/teacher-content/auth/use-teacher-logout", () => ({
  useTeacherLogout: () => vi.fn(),
}));

vi.mock("@/features/teacher-content/shared/use-teacher-identity", () => ({
  useTeacherIdentity: () => ({
    displayName: "Teacher One",
  }),
}));

vi.mock("@/features/teacher-students/TeacherStudentsPanel", () => ({
  default: () => <div>students panel</div>,
}));

vi.mock("@/features/teacher-review/TeacherReviewInboxPanel", () => ({
  default: () => <div>review inbox</div>,
}));

vi.mock("@/features/teacher-review/TeacherReviewSubmissionDetailPanel", () => ({
  default: () => <div>review submission</div>,
}));

vi.mock("@/lib/api/teacher", async () => {
  const actual = await vi.importActual<typeof TeacherApiModule>("@/lib/api/teacher");
  return {
    ...actual,
    teacherApi: {
      ...actual.teacherApi,
      listCourses: vi.fn(),
      getCourse: vi.fn(),
      createCourse: vi.fn(),
      createSection: vi.fn(),
      presignCourseCoverImageUpload: vi.fn(),
      applyCourseCoverImage: vi.fn(),
      presignCourseCoverImageView: vi.fn(),
      presignSectionCoverImageUpload: vi.fn(),
      applySectionCoverImage: vi.fn(),
      presignSectionCoverImageView: vi.fn(),
      updateSection: vi.fn(),
      deleteCourse: vi.fn(),
      publishSection: vi.fn(),
    },
  };
});

describe("TeacherDashboardScreen", () => {
  const replaceMock = vi.fn();
  const pushMock = vi.fn();

  beforeEach(() => {
    replaceMock.mockReset();
    pushMock.mockReset();
    vi.mocked(useRouter).mockReturnValue({ replace: replaceMock, push: pushMock } as never);
    vi.mocked(teacherApi.listCourses).mockReset();
    vi.mocked(teacherApi.getCourse).mockReset();
    vi.mocked(teacherApi.createCourse).mockReset();
    vi.mocked(teacherApi.createSection).mockReset();
    vi.mocked(teacherApi.presignCourseCoverImageUpload).mockReset();
    vi.mocked(teacherApi.applyCourseCoverImage).mockReset();
    vi.mocked(teacherApi.presignCourseCoverImageView).mockReset();
    vi.mocked(teacherApi.presignSectionCoverImageUpload).mockReset();
    vi.mocked(teacherApi.applySectionCoverImage).mockReset();
    vi.mocked(teacherApi.presignSectionCoverImageView).mockReset();
    vi.mocked(teacherApi.updateSection).mockReset();
    vi.mocked(teacherApi.deleteCourse).mockReset();
    vi.mocked(teacherApi.publishSection).mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      }),
    );
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue("blob:cover-preview"),
      revokeObjectURL: vi.fn(),
    });
    window.history.replaceState(null, "", "/teacher");
  });

  it("renders teacher courses list in edit mode", async () => {
    vi.mocked(teacherApi.listCourses).mockResolvedValueOnce([
      {
        id: "course-1",
        title: "Алгебра",
        description: "Базовый курс",
        status: "draft",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);

    renderWithQueryClient(<TeacherDashboardScreen active="edit" />);

    expect(await screen.findByText("Алгебра")).toBeInTheDocument();
    expect(screen.getByText("Базовый курс")).toBeInTheDocument();
  });

  it("creates course and invalidates teacher courses query", async () => {
    vi.mocked(teacherApi.listCourses).mockResolvedValue([]);
    vi.mocked(teacherApi.createCourse).mockResolvedValueOnce({
      id: "course-2",
      title: "Геометрия",
      description: "Новый курс",
      status: "draft",
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    } as never);
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-2",
      title: "Геометрия",
      description: "Новый курс",
      status: "draft",
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
      sections: [],
    } as never);

    const { queryClient } = renderWithQueryClient(<TeacherDashboardScreen active="edit" />);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();

    expect(await screen.findByText("Пока нет курсов. Создайте первый.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Создать курс" }));
    expect(screen.getByRole("dialog", { name: "Создание курса" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Название курса"), "Геометрия");
    await user.type(screen.getByLabelText("Описание курса"), "Новый курс");
    await user.click(screen.getByRole("button", { name: "Сохранить курс" }));

    await waitFor(() => {
      expect(vi.mocked(teacherApi.createCourse).mock.calls[0]?.[0]).toEqual({
        title: "Геометрия",
        description: "Новый курс",
      });
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: contentQueryKeys.teacherCourses(),
      });
    });
  });

  it("creates course with selected cover image and uploads it after create", async () => {
    vi.mocked(teacherApi.listCourses).mockResolvedValue([]);
    vi.mocked(teacherApi.createCourse).mockResolvedValueOnce({
      id: "course-2",
      title: "Геометрия",
      description: "Новый курс",
      coverImageAssetKey: null,
      status: "draft",
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    } as never);
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-2",
      title: "Геометрия",
      description: "Новый курс",
      coverImageAssetKey: "courses/course-2/cover/1700000000000-abcd1234.webp",
      status: "draft",
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
      sections: [],
    } as never);
    vi.mocked(teacherApi.presignCourseCoverImageUpload).mockResolvedValue({
      assetKey: "courses/course-2/cover/1700000000000-abcd1234.webp",
      uploadUrl: "https://upload.example.com/course-cover",
      headers: {},
      expiresInSec: 600,
    } as never);
    vi.mocked(teacherApi.applyCourseCoverImage).mockResolvedValue({
      ok: true,
      courseId: "course-2",
      assetKey: "courses/course-2/cover/1700000000000-abcd1234.webp",
    } as never);
    vi.mocked(teacherApi.presignCourseCoverImageView).mockResolvedValue({
      ok: true,
      courseId: "course-2",
      key: "courses/course-2/cover/1700000000000-abcd1234.webp",
      expiresInSec: 600,
      url: "https://cdn.example.com/course-cover.webp",
    } as never);

    renderWithQueryClient(<TeacherDashboardScreen active="edit" />);
    const user = userEvent.setup();

    await screen.findByText("Пока нет курсов. Создайте первый.");
    await user.click(screen.getByRole("button", { name: "Создать курс" }));

    const fileInput = document.querySelector('input[name="courseCoverImage"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    await user.upload(fileInput as HTMLInputElement, new File(["cover"], "cover.webp", { type: "image/webp" }));

    await user.type(screen.getByLabelText("Название курса"), "Геометрия");
    await user.type(screen.getByLabelText("Описание курса"), "Новый курс");
    await user.click(screen.getByRole("button", { name: "Сохранить курс" }));

    await waitFor(() => {
      expect(vi.mocked(teacherApi.presignCourseCoverImageUpload)).toHaveBeenCalledWith("course-2", {
        filename: "cover.webp",
        contentType: "image/webp",
        sizeBytes: 5,
      });
    });
    expect(vi.mocked(teacherApi.applyCourseCoverImage)).toHaveBeenCalledWith(
      "course-2",
      "courses/course-2/cover/1700000000000-abcd1234.webp",
    );
  });

  it("opens course, creates section and invalidates selected course query", async () => {
    vi.mocked(teacherApi.listCourses).mockResolvedValueOnce([
      {
        id: "course-1",
        title: "Алгебра",
        description: "Базовый курс",
        status: "draft",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-1",
      title: "Алгебра",
      description: "Базовый курс",
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [],
    } as never);
    vi.mocked(teacherApi.createSection).mockResolvedValue({
      id: "section-1",
      courseId: "course-1",
      title: "Линейные уравнения",
      description: "Новый раздел",
      status: "draft",
      sortOrder: 0,
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    } as never);

    const { queryClient } = renderWithQueryClient(<TeacherDashboardScreen active="edit" />);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Алгебра/ }));
    expect(await screen.findByText("Разделов пока нет.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Новый раздел" }));
    expect(screen.getByRole("dialog", { name: "Создание раздела" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Название раздела"), "Линейные уравнения");
    await user.type(screen.getByLabelText("Описание раздела"), "Новый раздел");
    await user.click(screen.getByRole("button", { name: "Сохранить раздел" }));

    await waitFor(() => {
      expect(vi.mocked(teacherApi.createSection).mock.calls[0]?.[0]).toEqual({
        courseId: "course-1",
        title: "Линейные уравнения",
        description: "Новый раздел",
        sortOrder: 0,
      });
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: contentQueryKeys.teacherCourse("course-1"),
      });
    });
  });

  it("creates section with selected cover image and uploads it after create", async () => {
    vi.mocked(teacherApi.listCourses).mockResolvedValueOnce([
      {
        id: "course-1",
        title: "Алгебра",
        description: "Базовый курс",
        status: "draft",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-1",
      title: "Алгебра",
      description: "Базовый курс",
      coverImageAssetKey: null,
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [],
    } as never);
    vi.mocked(teacherApi.createSection).mockResolvedValue({
      id: "section-1",
      courseId: "course-1",
      title: "Линейные уравнения",
      description: "Новый раздел",
      coverImageAssetKey: null,
      status: "draft",
      sortOrder: 0,
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    } as never);
    vi.mocked(teacherApi.presignSectionCoverImageUpload).mockResolvedValue({
      assetKey: "sections/section-1/cover/1700000000000-abcd1234.webp",
      uploadUrl: "https://upload.example.com/section-cover",
      headers: {},
      expiresInSec: 600,
    } as never);
    vi.mocked(teacherApi.applySectionCoverImage).mockResolvedValue({
      ok: true,
      sectionId: "section-1",
      assetKey: "sections/section-1/cover/1700000000000-abcd1234.webp",
    } as never);
    vi.mocked(teacherApi.presignSectionCoverImageView).mockResolvedValue({
      ok: true,
      sectionId: "section-1",
      key: "sections/section-1/cover/1700000000000-abcd1234.webp",
      expiresInSec: 600,
      url: "https://cdn.example.com/section-cover.webp",
    } as never);

    renderWithQueryClient(<TeacherDashboardScreen active="edit" />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Алгебра/ }));
    await screen.findByText("Разделов пока нет.");
    await user.click(screen.getByRole("button", { name: "Новый раздел" }));

    const fileInput = document.querySelector('input[name="sectionCoverImage"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    await user.upload(fileInput as HTMLInputElement, new File(["cover"], "section.webp", { type: "image/webp" }));

    await user.type(screen.getByLabelText("Название раздела"), "Линейные уравнения");
    await user.type(screen.getByLabelText("Описание раздела"), "Новый раздел");
    await user.click(screen.getByRole("button", { name: "Сохранить раздел" }));

    await waitFor(() => {
      expect(vi.mocked(teacherApi.presignSectionCoverImageUpload)).toHaveBeenCalledWith("section-1", {
        filename: "section.webp",
        contentType: "image/webp",
        sizeBytes: 5,
      });
    });
    expect(vi.mocked(teacherApi.applySectionCoverImage)).toHaveBeenCalledWith(
      "section-1",
      "sections/section-1/cover/1700000000000-abcd1234.webp",
    );
  });

  it("opens edit course modal instead of inline editing", async () => {
    vi.mocked(teacherApi.listCourses).mockResolvedValueOnce([
      {
        id: "course-1",
        title: "Алгебра",
        description: "Базовый курс",
        status: "draft",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);

    renderWithQueryClient(<TeacherDashboardScreen active="edit" />);
    const user = userEvent.setup();

    await screen.findByText("Алгебра");
    await user.click(screen.getByRole("button", { name: "Редактировать курс" }));

    expect(screen.getByRole("dialog", { name: "Редактирование курса" })).toBeInTheDocument();
    expect(screen.getByLabelText("Название")).toHaveValue("Алгебра");
    expect(screen.getByLabelText("Описание")).toHaveValue("Базовый курс");
  });

  it("opens section graph and supports back navigation", async () => {
    vi.mocked(teacherApi.listCourses).mockResolvedValueOnce([
      {
        id: "course-1",
        title: "Алгебра",
        description: "Базовый курс",
        status: "draft",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-1",
      title: "Алгебра",
      description: "Базовый курс",
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [
        {
          id: "section-1",
          courseId: "course-1",
          title: "Линейные уравнения",
          description: "Раздел",
          status: "draft",
          sortOrder: 0,
          createdAt: "2026-01-03T00:00:00.000Z",
          updatedAt: "2026-01-03T00:00:00.000Z",
        },
      ],
    } as never);

    renderWithQueryClient(<TeacherDashboardScreen active="edit" />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Алгебра/ }));
    await user.click(await screen.findByRole("button", { name: /Линейные уравнения/ }));

    expect(await screen.findByTestId("teacher-graph-panel")).toBeInTheDocument();
    expect(screen.getByText("Алгебра")).toBeInTheDocument();
    expect(screen.getByText("Линейные уравнения")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Назад к разделам" }));
    expect(await screen.findByText("Линейные уравнения")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Курсы" }));
    expect(await screen.findByText("Алгебра")).toBeInTheDocument();
    expect(screen.queryByTestId("teacher-graph-panel")).not.toBeInTheDocument();
  });

  it("publishes section and invalidates selected course query", async () => {
    vi.mocked(teacherApi.listCourses).mockResolvedValueOnce([
      {
        id: "course-1",
        title: "Алгебра",
        description: "Базовый курс",
        status: "draft",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-1",
      title: "Алгебра",
      description: "Базовый курс",
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [
        {
          id: "section-1",
          courseId: "course-1",
          title: "Линейные уравнения",
          description: "Раздел",
          status: "draft",
          sortOrder: 0,
          createdAt: "2026-01-03T00:00:00.000Z",
          updatedAt: "2026-01-03T00:00:00.000Z",
        },
      ],
    } as never);
    vi.mocked(teacherApi.publishSection).mockResolvedValue({
      id: "section-1",
      courseId: "course-1",
      title: "Линейные уравнения",
      description: "Раздел",
      status: "published",
      sortOrder: 0,
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    } as never);

    const { queryClient } = renderWithQueryClient(<TeacherDashboardScreen active="edit" />);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Алгебра/ }));
    await user.click(screen.getByRole("switch", { name: "Опубликовать раздел" }));

    await waitFor(() => {
      expect(teacherApi.publishSection).toHaveBeenCalledWith("section-1");
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: contentQueryKeys.teacherCourse("course-1"),
      });
    });
  });

  it("restores selected course and section from history state", async () => {
    window.history.replaceState(
      {
        __continuumTeacherEditNav: true,
        courseId: "course-1",
        sectionId: "section-1",
        sectionTitle: "Линейные уравнения",
      },
      "",
      "/teacher",
    );
    vi.mocked(teacherApi.listCourses).mockResolvedValue([
      {
        id: "course-1",
        title: "Алгебра",
        description: "Базовый курс",
        status: "draft",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-1",
      title: "Алгебра",
      description: "Базовый курс",
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [
        {
          id: "section-1",
          courseId: "course-1",
          title: "Линейные уравнения",
          description: "Раздел",
          status: "draft",
          sortOrder: 0,
          createdAt: "2026-01-03T00:00:00.000Z",
          updatedAt: "2026-01-03T00:00:00.000Z",
        },
      ],
    } as never);

    renderWithQueryClient(<TeacherDashboardScreen active="edit" />);

    expect(await screen.findByTestId("teacher-graph-panel")).toBeInTheDocument();
    expect(screen.getByText("Линейные уравнения")).toBeInTheDocument();
    await waitFor(() => {
      expect(teacherApi.getCourse).toHaveBeenCalledWith("course-1");
    });
  });

  it("reacts to popstate and returns to courses root", async () => {
    vi.mocked(teacherApi.listCourses).mockResolvedValue([
      {
        id: "course-1",
        title: "Алгебра",
        description: "Базовый курс",
        status: "draft",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-1",
      title: "Алгебра",
      description: "Базовый курс",
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [
        {
          id: "section-1",
          courseId: "course-1",
          title: "Линейные уравнения",
          description: "Раздел",
          status: "draft",
          sortOrder: 0,
          createdAt: "2026-01-03T00:00:00.000Z",
          updatedAt: "2026-01-03T00:00:00.000Z",
        },
      ],
    } as never);

    renderWithQueryClient(<TeacherDashboardScreen active="edit" />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Алгебра/ }));
    await user.click(await screen.findByRole("button", { name: /Линейные уравнения/ }));
    expect(await screen.findByTestId("teacher-graph-panel")).toBeInTheDocument();

    window.dispatchEvent(
      new PopStateEvent("popstate", {
        state: {
          __continuumTeacherEditNav: true,
          courseId: null,
          sectionId: null,
          sectionTitle: null,
        },
      }),
    );

    await waitFor(() => {
      expect(screen.queryByTestId("teacher-graph-panel")).not.toBeInTheDocument();
    });
    expect(await screen.findByRole("button", { name: /Алгебра/ })).toBeInTheDocument();
  });

  it("deletes selected course and resets edit selection to courses root", async () => {
    vi.mocked(teacherApi.listCourses).mockResolvedValue([
      {
        id: "course-1",
        title: "Алгебра",
        description: "Базовый курс",
        status: "draft",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-1",
      title: "Алгебра",
      description: "Базовый курс",
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [],
    } as never);
    vi.mocked(teacherApi.deleteCourse).mockResolvedValue(undefined as never);

    const { queryClient } = renderWithQueryClient(<TeacherDashboardScreen active="edit" />);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Алгебра/ }));
    expect(await screen.findByText("Разделов пока нет.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Курсы" }));
    await user.click(screen.getByRole("button", { name: "Удалить курс" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    await waitFor(() => {
      expect(teacherApi.deleteCourse).toHaveBeenCalledWith("course-1");
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: contentQueryKeys.teacherCourses(),
      });
    });
    expect(await screen.findByText("Алгебра")).toBeInTheDocument();
    expect(screen.queryByText("Разделов пока нет.")).not.toBeInTheDocument();
  });
});
