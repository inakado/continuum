import type { StudentExcalidrawBoard as StudentExcalidrawBoardComponent } from "./StudentExcalidrawBoard";

let boardModulePromise: Promise<
  typeof StudentExcalidrawBoardComponent
> | null = null;

export const loadStudentExcalidrawBoard = () => {
  if (!boardModulePromise) {
    boardModulePromise = import("./StudentExcalidrawBoard")
      .then((module) => module.StudentExcalidrawBoard)
      .catch((error: unknown) => {
        boardModulePromise = null;
        throw error;
      });
  }

  return boardModulePromise;
};
