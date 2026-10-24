"use client";

import { useState } from "react";
import { studentLibraryApi } from "./student-library.api";

type PdfSelection = { lessonId: string; type: "pdf" | "tasks_pdf" };

export function useStudentPdf() {
  const [opening, setOpening] = useState<PdfSelection | null>(null);
  const [error, setError] = useState(false);
  const open = async (selection: PdfSelection) => {
    if (opening) return;
    // Create the tab during the click, before either authenticated API request.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    setOpening(selection);
    setError(false);
    try {
      const lesson = await studentLibraryApi.getLesson(selection.lessonId);
      const artifact = lesson.artifacts.find((item) => item.type === selection.type);
      if (!artifact) throw new Error("PDF недоступен");
      const result = await studentLibraryApi.getArtifactView(artifact.id);
      if (tab) tab.location.replace(result.url);
      else window.location.assign(result.url);
    } catch {
      tab?.close();
      setError(true);
    } finally {
      setOpening(null);
    }
  };
  return { open, opening, error };
}
